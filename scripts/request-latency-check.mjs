import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build, transform } from "esbuild";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";

const user = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const db = new PGlite();
const sqlFile = (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), "utf8");
const query = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.result;
const run = (operation, args, id = user) => query("select gamble_request($1,$2,$3) result", [id, operation, JSON.stringify(args)]);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table profiles(id uuid primary key, coins int, updated_at timestamptz, private_note text);
    create table coin_transactions(id bigserial primary key, user_id uuid, amount int, balance_before int, balance_after int, reason text, metadata jsonb);
    alter table coin_transactions enable row level security;
    create policy own_transactions on coin_transactions for select to authenticated using (user_id=auth.uid());
    grant select on coin_transactions to authenticated;
    insert into profiles values ('${user}',100000,null,'private'),('${other}',1000,null,'private');`);
  for (const file of ["gamble-hall.sql", "202609100001_court_gameplay.sql", "202609130001_gamble_cashout_receipt.sql"]) await db.exec(await sqlFile(file));
  // Limiter fixture: test the wrapper's bucket selection and fail-closed
  // behavior without depending on the private/local security migration.
  await db.exec(`create table rate_limit_buckets(bucket_key text primary key, request_count int);
    create function check_rate_limit(p_key text,p_max_count int,p_window_seconds int)
    returns jsonb language plpgsql as $$
    declare v_count int;
    begin
      insert into rate_limit_buckets values(p_key,1)
        on conflict(bucket_key) do update set request_count=rate_limit_buckets.request_count+1
        returning request_count into v_count;
      return jsonb_build_object('allowed',v_count<=p_max_count,'retryAfterSeconds',p_window_seconds);
    end; $$;`);
  const migration = await sqlFile("202610090001_request_latency.sql");
  await db.exec(migration);
  await db.exec(migration); // re-runnable

  // Whole history, correct metadata, no other user's balance, no anonymous access.
  await db.exec(`insert into coin_transactions(user_id,amount,reason,metadata)
    select '${user}',1,'throne_tribute','{}' from generate_series(1,1105);
    insert into coin_transactions(user_id,amount,reason,metadata) values
    ('${user}',50,'live_gift','{"command":"give"}'),
    ('${user}',30,'live_gift','{"kind":"manual_coin_purchase"}'),
    ('${user}',20,'live_gift','{"source":"throne"}'),
    ('${user}',999,'live_gift','{}'),('${user}',999,'other','{"source":"throne"}'),
    ('${user}',-100,'throne_tribute','{}'),('${other}',123456,'throne_tribute','{}');
    set role authenticated; set test.user_id='${user}';`);
  assert.equal(Number(await query("select my_throne_coin_total() result")), 1205);
  await db.exec(`set test.user_id='${other}';`);
  assert.equal(Number(await query("select my_throne_coin_total() result")), 123456);
  await assert.rejects(() => run("gamble_play_round", {}), /permission denied/);
  await db.exec("reset role;");
  assert.equal(await query("select has_function_privilege('anon','my_throne_coin_total()','execute') result"), false);
  assert.equal(await query("select has_function_privilege('service_role','gamble_request(uuid,text,jsonb)','execute') result"), true);

  const played = await run("gamble_play_round", { p_user_id: other, p_game: "slots", p_wager: 100, p_payout: 150, p_state: {} });
  assert.equal(played.profile.coins, 100050);
  assert.equal(await query("select coins result from profiles where id=$1", [other]), 1000, "Nested caller ID cannot override the verified user");
  const doubled = await run("gamble_double_round", { p_round_id: played.result.roundId, p_won: false });
  assert.equal(doubled.result.payout, 0);
  const mine = await run("gamble_open_round", { p_game: "mines", p_wager: 100, p_state: { mineCount: 7, mines: [0,1,2,3,4,5,6], picks: [] } });
  assert.equal(mine.result.mines, undefined);
  const picked = await run("gamble_mines_pick", { p_round_id: mine.result.roundId, p_cell: 10 });
  assert.equal(picked.profile, null, "Safe pick does not fetch/send a profile");
  assert.equal(picked.result.mines, undefined);
  const taken = await run("gamble_mines_cashout", { p_round_id: mine.result.roundId });
  assert.ok(taken.result.payout >= 0);
  assert.ok(taken.profile);

  const crash = await run("gamble_crash_open", { p_wager: 100, p_crash_point: 1.17, p_auto_cashout: null });
  const poll = await run("gamble_crash_status", { p_round_id: crash.result.roundId });
  assert.equal(poll.result.settled, false);
  assert.equal(poll.result.crashPoint, undefined);
  assert.equal(poll.profile, null);
  const intruder = await run("gamble_crash_status", { p_round_id: crash.result.roundId }, other);
  assert.equal(intruder.result.error, "round_not_found");
  assert.equal(intruder.profile, null);

  // Arrived at 1.13x, DB reached after 1.17x: the server receipt still wins.
  await db.query("update gamble_rounds set state=state||jsonb_build_object('startsAt',clock_timestamp()-interval '4 seconds') where id=$1", [crash.result.roundId]);
  const receipt = await query("select (state->>'startsAt')::timestamptz+interval '1.9 seconds' result from gamble_rounds where id=$1", [crash.result.roundId]);
  const cashArgs = { p_round_id: crash.result.roundId, p_requested_multiplier: 1.13, p_received_at: receipt };
  const cash = await run("gamble_crash_cashout_at", cashArgs);
  assert.equal(cash.result.survived, true);
  assert.equal(cash.result.payout, 113);
  const replay = await run("gamble_crash_cashout_at", cashArgs);
  assert.equal(replay.profile.coins, cash.profile.coins, "Repeated cashout cannot pay twice");

  const count = () => query("select request_count result from rate_limit_buckets where bucket_key=$1", [`gamble:${user}`]);
  const beforeMalformed = await count();
  const malformed = await run("gamble_mines_pick", { p_round_id: "invalid", p_cell: 2 });
  assert.equal(malformed.error, "operation_failed");
  assert.equal(await count(), beforeMalformed + 1, "Invalid input cannot roll back the limiter");
  assert.equal((await run("gamble_patch_round", {})).error, "invalid_operation");
  await db.query("update rate_limit_buckets set request_count=30 where bucket_key=$1", [`gamble:${user}`]);
  const limited = await run("gamble_play_round", { p_game: "slots", p_wager: 100, p_payout: 0, p_state: {} });
  assert.equal(limited.error, "rate_limited");
  assert.equal(await query("select coins result from profiles where id=$1", [user]), cash.profile.coins);
  assert.ok((await run("gamble_crash_status", { p_round_id: crash.result.roundId })).result, "Status uses its own rate bucket");
  console.log("PASS: migration twice; private aggregate; operation allowlist; balances; rate limits; round ownership; receipt-time cashout; no duplicate payout");
} finally { await db.close(); }

async function bundle(entry, plugins = []) {
  const result = await build({ entryPoints: [entry], write: false, bundle: true, format: "esm", platform: "node", plugins });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
let calls = [];
let error = null;
let data = { result: { roundId: "round", payout: 123 }, profile: { id: user, coins: 500, private_note: "secret" } };
globalThis.latencyDb = {
  async rpc(name, args) {
    calls.push({ name, args });
    if (name === "check_rate_limit") return { data: { allowed: true }, error: null };
    if (name !== "gamble_request") return { data: { roundId: "legacy" }, error: null };
    return { data, error };
  },
  from() { return { select() { return this; }, eq() { return this; }, single: async () => ({ data: { id: user, coins: 123 } }) }; },
};
globalThis.latencyAuth = true;
const { POST } = await bundle("src/app/api/user/gamble/route.ts", [{ name: "server-fixtures", setup(b) {
  b.onResolve({ filter: /^@\/lib\/supabase\/(admin|server)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path.endsWith("/admin")
    ? "export const isSupabaseAdminConfigured=true; export const getSupabaseAdminConfigErrors=()=>[]; export const createSupabaseAdminClient=()=>globalThis.latencyDb;"
    : `export const createClient=async()=>({auth:{getUser:async()=>({data:{user:globalThis.latencyAuth?{id:'${user}'}:null},error:null})}});` }));
} }]);
const post = (body) => POST(new Request("https://audit.invalid/api/user/gamble", { method: "POST", body: JSON.stringify(body) }));
let response = await post({ action: "slots", bet: 100, payout: 999999, userId: other });
assert.equal(response.status, 200);
assert.equal(calls.length, 1, "One DB round trip for a paid game");
assert.equal(calls[0].name, "gamble_request");
assert.equal(calls[0].args.p_user_id, user);
assert.notEqual(calls[0].args.p_args.p_payout, 999999);
assert.equal((await response.json()).profile.private_note, undefined);
assert.match(response.headers.get("Server-Timing"), /app;dur=/);
calls = []; globalThis.latencyAuth = false;
assert.equal((await post({ action: "slots", bet: 100 })).status, 401);
assert.equal(calls.length, 0); globalThis.latencyAuth = true;
data = { error: "rate_limited", retryAfterSeconds: 17 };
response = await post({ action: "slots", bet: 100 });
assert.equal(response.status, 429); assert.equal(response.headers.get("Retry-After"), "17");
calls = []; error = { code: "FETCH_ERROR", message: "network unavailable after dispatch" };
const originalError = console.error;
try {
  console.error = () => {}; // Expected transport failure; avoid a data-URL stack dump.
  assert.equal((await post({ action: "slots", bet: 100 })).status, 503);
} finally { console.error = originalError; }
assert.equal(calls.length, 1, "No mutation retry on ambiguous transport failure");
calls = []; error = { code: "PGRST202", message: "RPC missing" };
assert.equal((await post({ action: "slots", bet: 100 })).status, 200);
assert.deepEqual(calls.map((c) => c.name), ["gamble_request", "check_rate_limit", "gamble_play_round"]);

const { applyInventoryQuantities } = await bundle("src/lib/inventory-quantities.ts");
const inventory = [
  { item_id: "a", variant: "normal", quantity: 5, name: "A" },
  { item_id: "a", variant: "foil", quantity: 3, name: "Foil A" },
  { item_id: "classic", variant: "normal", quantity: 1 },
];
assert.deepEqual(applyInventoryQuantities(inventory, [{ item_id: "a", variant: "normal", quantity: 0 }, { item_id: "a", variant: "foil", quantity: 1 }]), [
  { item_id: "a", variant: "foil", quantity: 1, name: "Foil A" }, inventory[2],
]);
assert.equal(inventory[0].quantity, 5, "Does not mutate the previous UI snapshot");
console.log("PASS: API auth, one RPC, private-field filtering, 429, no network retry, SQL rollout fallback, variant-aware inventory updates");

// Exercise the actual page read callback against deliberately reordered responses.
const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const start = page.indexOf("  const loadCratesData = useCallback");
const end = page.indexOf("  useEffect(() => {", start);
const callbackCode = (await transform(page.slice(start, end) + "\nglobalThis.loadInventory = loadCratesData;", { loader: "tsx" })).code;
const pendingReads = [];
const snapshots = [];
const context = {
  isPreviewMode: false, isGuestMode: false, authUserId: user,
  useCallback: (fn) => fn,
  crateMutationBusy: { current: false }, crateReadVersion: { current: 0 }, crateReadSequence: { current: 0 },
  setAvailableCrates() {}, setCrateInventory: (items) => snapshots.push(items),
  setCrateOpenCredits() {}, setCrateFreeOpensUsedToday() {}, setPityStats() {},
  fetch: () => new Promise((resolve) => pendingReads.push(resolve)), console,
};
vm.createContext(context); vm.runInContext(callbackCode, context);
const completeRead = (index, quantity) => pendingReads[index]({ ok: true, json: async () => ({ inventory: [{ item_id: 'a', variant: 'normal', quantity }] }) });
const stale = context.loadInventory();
context.crateReadVersion.current++; // A sale begins and invalidates the old GET.
completeRead(0, 20); await stale;
assert.equal(snapshots.length, 0);
const firstRead = context.loadInventory();
const newerRead = context.loadInventory();
completeRead(2, 1); await newerRead;
completeRead(1, 20); await firstRead;
assert.equal(snapshots.length, 1);
assert.equal(snapshots[0][0].quantity, 1);
context.crateMutationBusy.current = true;
await context.loadInventory();
assert.equal(pendingReads.length, 3, "No redundant GET during a mutation");
console.log("PASS: late inventory reads cannot undo a sale or overwrite a newer refresh");
