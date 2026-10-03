import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";

const bundle = await build({ tsconfigRaw: { compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }, stdin: { contents: 'export * from "./src/lib/crate-upgrade"; export { SAMPLE_CRATE_ITEMS } from "./src/lib/crates";', resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm" });
const odds = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
for (const input of Object.values(odds.SAMPLE_CRATE_ITEMS)) {
  if (input.sell_value <= 0) continue;
  for (const target of odds.listCrateUpgradeTargetItems()) {
    const chance = odds.computeCrateUpgradeChance(input.sell_value, target.sellValue);
    if (chance === null) continue;
    assert.ok(chance * target.sellValue <= 0.9 * input.sell_value + 1e-8, "Every upgrade stays within the advertised EV budget");
  }
}

const db = new PGlite();
const user = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const rpc = async (sql, values) => (await db.query(sql, values)).rows[0].result;
const quantity = async (id, item) => (await db.query("select quantity from user_crate_inventory where user_id=$1 and item_id=$2", [id, item])).rows[0]?.quantity ?? 0;
const upgrade = (request, roll = 0, from = "cheap", target = "rare") => rpc(
  "select execute_crate_upgrade($1,$2,$3,'normal',5,$4,'normal',100000,'premium','rare',$5) result",
  [user, request, from, target, roll],
);
const haul = (itemId, sellValue) => [{ itemId, variant: "normal", sellValue }];
const createDuel = (crates, items) => rpc("select create_crate_duel($1,$2,100,$3,48) result", [user, JSON.stringify(crates), JSON.stringify(items)]);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create table profiles(id uuid primary key references auth.users(id), coins integer, updated_at timestamptz, principessa_case_bad_luck_count integer default 0);
    create table coin_transactions(user_id uuid, amount int, balance_before int, balance_after int, reason text, metadata jsonb);
    create table crate_types(crate_type text primary key, cost integer);
    create table crate_items(item_id text primary key);
    create table user_crate_inventory(user_id uuid, item_id text references crate_items(item_id), variant text, quantity int check(quantity>0), unique(user_id,item_id,variant));
    create table crate_opens(id uuid primary key default gen_random_uuid(), user_id uuid, crate_type text, item_id text, variant text, cost integer, received_sell_value integer, opened_at timestamptz default now());
    insert into auth.users values('${user}'),('${other}');
    insert into profiles(id,coins) values('${user}',100000),('${other}',100000);
    insert into crate_types values('basic',25),('premium',75);
    insert into crate_items values('cheap'),('rare');
    insert into user_crate_inventory values('${user}','cheap','normal',10);`);
  await db.exec(await readFile(new URL("../supabase/crate-duels.sql", import.meta.url), "utf8"));
  const patch = await readFile(new URL("../supabase/2026-10-03-crate-safety.sql", import.meta.url), "utf8");
  await db.exec(patch);
  await db.exec(patch);

  const requestId = randomUUID();
  const first = await upgrade(requestId);
  assert.equal(first.won, true);
  assert.equal(first.chancePercent, 0.0045, "Tiny chance is not raised to 0.5%");
  assert.deepEqual(await upgrade(requestId, 0.99), first, "Retries preserve the original roll");
  assert.equal(await quantity(user, "cheap"), 9);
  assert.equal(await quantity(user, "rare"), 1);
  assert.equal((await upgrade(requestId, 0, "other-input")).error, "request_mismatch");
  const wins = await Promise.all([upgrade(randomUUID()), upgrade(randomUUID())]);
  assert.ok(wins.every((result) => result.won));
  assert.equal(await quantity(user, "rare"), 3, "Each payout increments the current inventory");
  await upgrade(randomUUID(), 0.99);
  assert.equal(await quantity(user, "rare"), 3);
  const beforeFailure = await quantity(user, "cheap");
  await db.exec(`create function reject_upgrade_receipt() returns trigger language plpgsql as $$ begin raise exception 'receipt unavailable'; end; $$;
    create trigger reject_receipt before insert on crate_item_upgrades for each row execute function reject_upgrade_receipt();`);
  await assert.rejects(upgrade(randomUUID()), /receipt unavailable/);
  assert.equal(await quantity(user, "cheap"), beforeFailure, "Logging failure rolls consumption back");
  assert.equal(await quantity(user, "rare"), 3, "Logging failure rolls grant back");
  await db.exec("drop trigger reject_receipt on crate_item_upgrades");

  const open = (coins, pity, nextPity, cost, items, metadata = {}) => rpc(
    "select commit_crate_open($1,'premium',$2,$3,$4,$5,$6,$7) result",
    [user, coins, pity, nextPity, cost, JSON.stringify(items), JSON.stringify(metadata)],
  );
  assert.equal((await open(100000, 0, 1, 75, haul("rare", 50))).success, true);
  assert.equal(await quantity(user, "rare"), 4, "Normal opens preserve Upgrade payouts");
  assert.equal((await open(100000, 0, 1, 75, haul("rare", 50))).error, "stale_profile");
  assert.equal(await quantity(user, "rare"), 4, "Stale purchases grant nothing");
  assert.equal((await open(99925, 1, 2, 75, [...haul("rare", 50), ...haul("cheap", 5)], { community_goal_keys_used: 1 })).success, true);
  assert.deepEqual((await db.query("select cost from crate_opens order by cost")).rows.map(row => row.cost), [0, 75, 75], "Free keys and paid rounds keep their individual costs");
  await db.exec(`create function reject_open_receipt() returns trigger language plpgsql as $$ begin raise exception 'coin log unavailable'; end; $$;
    create trigger reject_coin_receipt before insert on coin_transactions for each row execute function reject_open_receipt();`);
  await assert.rejects(open(99850, 2, 3, 75, haul("rare", 50)), /coin log unavailable/);
  assert.equal(await quantity(user, "rare"), 5);
  assert.deepEqual((await db.query("select coins,principessa_case_bad_luck_count pity from profiles where id=$1", [user])).rows[0], { coins: 99850, pity: 2 }, "Failed purchase restores coins and pity");
  assert.equal((await db.query("select count(*)::int n from crate_opens")).rows[0].n, 3, "Failed purchase leaves no opening history");
  await db.exec("drop trigger reject_coin_receipt on coin_transactions; delete from crate_opens;");
  assert.equal((await open(99850, 2, 2, 0, haul("cheap", 5), { free_open_applied: true })).success, true);
  assert.equal((await open(99850, 2, 2, 0, haul("cheap", 5), { free_open_applied: true })).error, "free_open_used", "Free opens cannot race with an unchanged balance");
  await db.exec("delete from crate_opens");

  const duel = await createDuel(["basic", "premium"], [...haul("cheap", 5), ...haul("rare", 50)]);
  assert.equal((await db.query("select count(*)::int n from crate_opens")).rows[0].n, 0, "Open challenges never leak sealed results");
  const sealed = (await rpc("select get_crate_duel_lobby($1) result", [user])).find((row) => row.id === duel.duelId);
  assert.equal(sealed.challenger_items, undefined);
  assert.equal(sealed.challenger_total_value, undefined);
  const accepted = await rpc("select accept_crate_duel($1,$2,$3) result", [other, duel.duelId, JSON.stringify([...haul("cheap", 20), ...haul("rare", 100)])]);
  assert.equal(accepted.winnerId, other);
  const published = (await db.query("select user_id,crate_type,item_id,cost from crate_opens where source_duel_id=$1 order by user_id,source_duel_round", [duel.duelId])).rows;
  assert.equal(published.length, 4);
  assert.deepEqual(published.filter((row) => row.user_id === user).map((row) => row.crate_type), ["basic", "premium"], "Mixed lineup matches each opening");
  assert.equal(published.filter((row) => row.user_id === user).length, 2, "Losing opener keeps their own history credit");
  await db.query("select publish_crate_duel_openings($1)", [duel.duelId]);
  await db.exec(patch);
  assert.equal((await db.query("select count(*)::int n from crate_opens")).rows[0].n, 4, "Trigger, backfill and patch reruns do not duplicate history");
  const cancelled = await createDuel(["basic"], haul("cheap", 5));
  await rpc("select cancel_crate_duel($1,$2) result", [user, cancelled.duelId]);
  assert.equal((await db.query("select count(*)::int n from crate_opens where source_duel_id=$1", [cancelled.duelId])).rows[0].n, 1);

  const live = await createDuel(["basic"], haul("cheap", 5));
  await db.query("update crate_duels set created_at=now()-interval '1 day' where id=$1", [live.duelId]);
  await db.exec(`insert into crate_duels(challenger_id,crate_type,crate_cost,quantity,challenger_items,challenger_total_value,expires_at)
    select '${other}','basic',25,1,'[]',0,now()+interval '1 day' from generate_series(1,35);`);
  assert.ok((await rpc("select get_crate_duel_lobby($1) result", [user])).some((row) => row.id === live.duelId), "Own challenge survives a busy public lobby");
  await db.query("update crate_duels set expires_at=now()-interval '1 second' where id=$1", [live.duelId]);
  await rpc("select get_crate_duel_lobby($1) result", [user]);
  assert.equal((await db.query("select status from crate_duels where id=$1", [live.duelId])).rows[0].status, "cancelled");
  assert.equal((await db.query("select count(*)::int n from crate_opens where source_duel_id=$1", [live.duelId])).rows[0].n, 1);
  await db.exec("set role authenticated");
  await assert.rejects(upgrade(randomUUID()), /permission denied for function/);
  await assert.rejects(open(99850, 2, 2, 75, haul("rare", 50)), /permission denied for function/);
  await assert.rejects(rpc("select get_crate_duel_lobby($1) result", [user]), /permission denied for function/);
  await db.exec("reset role");
  console.log("Crate safety: EV, atomic rollback, retry receipts, payouts, sealed history, mixed lineups, backfill, expiry, lobby visibility and permissions passed.");
} finally { await db.close(); }
