import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const uid = "00000000-0000-0000-0000-000000000001";
const sql = await readFile(
  new URL(
    "../supabase/202609090001_atomic_economy.sql",
    import.meta.url,
  ),
  "utf8",
);
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(id uuid primary key,coins int not null,affection int not null default 0,tribute_total int not null default 0,timeout_until timestamptz,updated_at timestamptz);
 insert into profiles(id,coins) values ('${uid}',1000);
 create table user_tasks(user_id uuid references profiles(id),task_id text,completed_at timestamptz,claimed_at timestamptz,reward_coins int,metadata jsonb,primary key(user_id,task_id));
 create table coin_transactions(id uuid default gen_random_uuid(),user_id uuid,amount int,balance_before int,balance_after int,reason text,metadata jsonb);
 create table devotion_events(user_id uuid,amount int,source text,source_key text,metadata jsonb,unique(user_id,source_key));`);
  await db.exec(sql);
  await db.exec(sql);
  const run = async (
    key,
    expected = 1000,
    next = 1100,
    taskExpected = null,
    reason = "reward:task:daily-login",
  ) =>
    (
      await db.query(
        "select commit_economy_action($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result",
        [
          uid,
          key,
          { coins: expected },
          { coins: next },
          "daily-login",
          taskExpected,
          {
            task_id: "daily-login",
            claimed_at: "2026-09-09T12:00:00Z",
            completed_at: "2026-09-09T12:00:00Z",
            reward_coins: next - expected,
            metadata: {},
          },
          reason,
          {},
          1,
        ],
      )
    ).rows[0].result;
  assert.equal((await run("login:day")).coins, 1100);
  for (const result of await Promise.all(
    Array.from({ length: 8 }, () => run("login:day")),
  ))
    assert.equal(result.duplicate, true);
  assert.equal(
    (await db.query("select count(*)::int n from coin_transactions")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from devotion_events")).rows[0].n,
    1,
  );
  assert.equal((await run("stale", 1000)).error, "stale_profile");
  assert.equal((await run("second-key", 1100, 1200)).error, "stale_task");
  const task = (await db.query("select * from user_tasks")).rows[0];
  // Ledger insert fails after balance write: the complete transaction rolls back.
  await db.exec(
    "alter table coin_transactions add constraint injected_failure check(amount<>125)",
  );
  await assert.rejects(run("failure", 1100, 1225, { task_id: "daily-login" }));
  assert.equal(
    (await db.query("select coins from profiles")).rows[0].coins,
    1100,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from economy_receipts where operation_key='failure'",
      )
    ).rows[0].n,
    0,
  );
  await db.exec(
    "alter table coin_transactions drop constraint injected_failure",
  );
  assert.equal(
    (await run("failure", 1100, 1225, { task_id: task.task_id })).coins,
    1225,
  );
  await db.exec("update profiles set timeout_until=now()+interval '1 hour'");
  assert.equal(
    (await run("timeout", 1225, 1300, { task_id: task.task_id })).error,
    "timeout_active",
  );
  assert.equal(
    (await run("spend", 1225, -1, { task_id: task.task_id }, "spend:test"))
      .error,
    "insufficient_funds",
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','commit_economy_action(uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,integer)','execute') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('service_role','commit_economy_action(uuid,text,jsonb,jsonb,text,jsonb,jsonb,text,jsonb,integer)','execute') allowed",
      )
    ).rows[0].allowed,
    true,
  );
  await db.exec(
    "alter table profiles add column last_login_at timestamptz, add column equipped_avatar_slots jsonb",
  );
  const milestoneSql = await readFile(
    new URL(
      "../supabase/202609090002_product_milestones.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(milestoneSql);
  await db.exec(milestoneSql);
  await db.exec("update profiles set last_login_at=now()-interval '3 days'");
  await db.exec(
    "update profiles set last_login_at=last_login_at+interval '1 day',equipped_avatar_slots='{\"top\":\"test-shirt\"}'",
  );
  await db.exec(
    "insert into coin_transactions(user_id,amount,reason) select id,100,'reward:game:crown-match' from profiles",
  );
  const milestones = (
    await db.query("select get_product_milestone_counts() as result")
  ).rows[0].result;
  assert.equal(milestones.firstVisits, 1);
  assert.equal(milestones.firstGames, 1);
  assert.equal(milestones.firstEquipment, 1);
  assert.equal(milestones.nextDayEligible, 1);
  assert.equal(milestones.nextDayReturns, 1);
  console.log(
    "Milestones passed: migrations reapply, prospective visit/game/equipment, next-day cohort.",
  );
  console.log(
    "SQL passed: reapply, duplicate receipts, stale balance/task, all-or-nothing rollback, retry, devotion, timeout, insufficient funds, grants. PGlite serializes connections; production lock contention requires staging.",
  );
} finally {
  await db.close();
}
