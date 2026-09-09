// Isolated PostgreSQL-compatible engine, never connects to production.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || "../.next/sql-validation/node_modules/@electric-sql/pglite");
const db = new PGlite();
const sql = await readFile(new URL("./sql/2026-09-09-chat-history-case-opening.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const retention = await readFile(new URL("../supabase/retention-maintenance.sql", import.meta.url), "utf8");
const user = "00000000-0000-0000-0000-000000000001";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${user}');
    create table profiles(id uuid primary key, coins integer not null default 0, timeout_until timestamptz, updated_at timestamptz);
    insert into profiles(id,coins) values ('${user}', 1000);
  `);
  // Exercise against the actual task and ledger table definitions.
  for (const table of ["user_tasks", "coin_transactions", "live_chat_messages"]) {
    const match = schema.match(new RegExp("create table if not exists public\\." + table + " \\([\\s\\S]*?\\n\\);", "i"));
    assert.ok(match, table);
    await db.exec(match[0]);
  }
  const chatSweep = retention.match(/delete from public\.live_chat_messages[\s\S]*?get diagnostics live_chat_count = row_count;/i)[0];
  await db.exec(`create function run_data_retention() returns jsonb language plpgsql as $$
    declare live_chat_count integer:=0; begin
    ${chatSweep}
    return jsonb_build_object('live_chat_count',live_chat_count,'other_rule','preserved'); end $$;
    insert into live_chat_messages(user_id,message,created_at) values ('${user}','Keep old history',now()-interval '90 days');`);
  await db.exec(sql);
  await db.exec(sql); // Idempotent reapplication.
  const maintenance = (await db.query("select run_data_retention() as result")).rows[0].result;
  assert.equal(maintenance.other_rule, "preserved");
  assert.equal(maintenance.live_chat_count, 0);
  assert.equal((await db.query("select count(*)::int as count from live_chat_messages")).rows[0].count, 1);
  const open = async (reward) => (await db.query("select open_daily_game_case($1,$2) as result", [user, reward])).rows[0].result;
  const first = await open(350);
  assert.equal(first.coins, 1350);
  assert.equal(first.reward, 350);
  assert.equal(new Date(first.cooldownUntil).toISOString().slice(11,19), "21:00:00");
  const retries = await Promise.all(Array.from({ length: 8 }, () => open(1000)));
  assert.ok(retries.every((result) => result.error === "cooldown"));
  assert.equal((await db.query("select count(*)::int as count from coin_transactions")).rows[0].count, 1);
  assert.equal((await db.query("select coins from profiles")).rows[0].coins, 1350);
  await assert.rejects(open(999999));
  await db.exec("update user_tasks set claimed_at=now()-interval '2 days'; update profiles set timeout_until=now()+interval '1 hour'");
  assert.equal((await open(100)).error, "timeout_active");
  await db.exec("update profiles set timeout_until=null");
  // Force ledger failure: the preceding balance update must be rolled back.
  await db.exec("alter table coin_transactions add constraint simulate_ledger_failure check (amount <> 100)");
  await assert.rejects(open(100));
  assert.equal((await db.query("select coins from profiles")).rows[0].coins, 1350);
  assert.equal((await open(125)).coins, 1475);
  assert.equal((await db.query("select has_function_privilege('authenticated','open_daily_game_case(uuid,integer)','execute') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_function_privilege('service_role','open_daily_game_case(uuid,integer)','execute') as allowed")).rows[0].allowed, true);
  console.log("SQL: schema compatibility, idempotence, retained history, reward, cooldown, repeated requests, timeout, rollback and service-only access passed.");
  console.log("PGlite serializes queries; real multi-connection lock contention remains a deployment-environment check.");
} finally { await db.close(); }
