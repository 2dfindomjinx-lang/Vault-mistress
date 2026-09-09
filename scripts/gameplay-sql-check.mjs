import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const user = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const rpc = async (query, args) => (await db.query(query, args)).rows[0].result;
const open = (crash = 2, target = 1.5) =>
  rpc("select gamble_crash_open($1,100,$2,$3) result", [user, crash, target]);
const status = (id) =>
  rpc("select gamble_crash_status($1,$2) result", [user, id]);
const cashout = (id, multiplier = 1.1) =>
  rpc("select gamble_crash_cashout($1,$2,$3) result", [user, id, multiplier]);
const age = (id, seconds) =>
  db.query(
    "update gamble_rounds set state=state||jsonb_build_object('startsAt',clock_timestamp()-$2*interval '1 second') where id=$1",
    [id, seconds],
  );
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key, coins int, updated_at timestamptz);
    create table coin_transactions(user_id uuid,amount int,balance_before int,balance_after int,reason text,metadata jsonb);
    insert into profiles values ('${user}',100000,null),('${other}',1000,null);`);
  await db.exec(
    await readFile(
      new URL("../supabase/gamble-hall.sql", import.meta.url),
      "utf8",
    ),
  );
  const patch = await readFile(
    new URL("../supabase/202609100001_court_gameplay.sql", import.meta.url),
    "utf8",
  );
  await db.exec(patch);
  await db.exec(patch);
  const first = await open();
  assert.ok(
    first.startsAtMs > Date.now() + 2000,
    "Countdown begins after database work",
  );
  const waiting = await status(first.roundId);
  assert.equal(waiting.settled, false);
  assert.equal(
    waiting.crashPoint,
    undefined,
    "No secret leaks during countdown",
  );
  assert.equal((await cashout(first.roundId)).error, "round_starting");
  const resume = await open(3, 2);
  assert.equal(resume.roundId, first.roundId);
  assert.equal(
    resume.autoCashout,
    1.5,
    "A retry cannot change the fixed target",
  );
  assert.equal(
    (await db.query("select count(*)::int n from coin_transactions")).rows[0].n,
    1,
  );
  await age(first.roundId, 40); // Both target and crash passed before the poll.
  const result = await status(first.roundId);
  assert.equal(result.survived, true);
  assert.equal(
    result.payout,
    150,
    "Late delivery preserves the preselected target",
  );
  for (const duplicate of await Promise.all([
    cashout(first.roundId, 9),
    status(first.roundId),
    cashout(first.roundId),
  ])) {
    assert.equal(duplicate.payout, 150);
  }
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from coin_transactions where amount>0",
      )
    ).rows[0].n,
    1,
    "One payout only",
  );
  assert.equal(
    (
      await rpc("select gamble_crash_status($1,$2) result", [
        other,
        first.roundId,
      ])
    ).error,
    "round_not_found",
  );
  const lost = await open(1.2, 1.5);
  await age(lost.roundId, 40);
  assert.equal(
    (await status(lost.roundId)).payout,
    0,
    "Crash before target loses",
  );
  const tied = await open(1.5, 1.5);
  await age(tied.roundId, 40);
  assert.equal(
    (await status(tied.roundId)).survived,
    false,
    "Target at crash is too late",
  );
  const instant = await open(1, 1.5);
  assert.equal(
    (await status(instant.roundId)).crashed,
    false,
    "Instant bust still waits for countdown",
  );
  await age(instant.roundId, 0.2);
  assert.equal((await status(instant.roundId)).crashed, true);
  const manual = await open(3, null);
  await age(manual.roundId, 3);
  const early = await cashout(manual.roundId, 1.1);
  assert.equal(early.survived, true);
  assert.equal(early.payout, 110, "Manual cashout remains available");
  const forged = await open(1.2, null);
  await age(forged.roundId, 40);
  assert.equal(
    (await cashout(forged.roundId, 1.01)).payout,
    0,
    "A low claimed multiplier cannot resurrect a bust",
  );
  for (const target of [1, 31])
    assert.equal((await open(2, target)).error, "invalid_bet");
  const privileges = await db.query(
    "select has_function_privilege('authenticated','gamble_crash_open(uuid,integer,numeric,numeric)','execute') allowed",
  );
  assert.equal(privileges.rows[0].allowed, false);
  for (const mines of [7, 10, 15]) {
    let fairMultiplier = 1;
    for (let picks = 1; picks <= 25 - mines; picks++) {
      fairMultiplier *= (26 - picks) / (26 - picks - mines);
      const actual = Number(
        await rpc("select gamble_mines_multiplier($1,$2) result", [
          mines,
          picks,
        ]),
      );
      assert.ok(
        Math.abs(
          actual - Math.min(250, Math.floor(fairMultiplier * 0.82 * 100) / 100),
        ) < 0.011,
      );
    }
  }
  const jewelry = await rpc(
    "select gamble_open_round($1,'mines',100,$2,0) result",
    [
      user,
      {
        mineCount: 7,
        mines: [0, 1, 2, 3, 4, 5, 6],
        picks: Array.from({ length: 18 }, (_, i) => i + 7),
      },
    ],
  );
  const jewelryReturn = await rpc("select gamble_mines_cashout($1,$2) result", [
    user,
    jewelry.roundId,
  ]);
  assert.equal(
    jewelryReturn.payout,
    25000,
    "Even the last safe gem pays within the existing settlement ceiling",
  );
  console.log(
    "Patience SQL passed: delayed result, countdown, fixed target, manual win, bust, retry/resume, duplicate payout and ownership checks. Isolated PostgreSQL; no live database.",
  );
  console.log(
    "Jewelry Box: all mine/pick curves checked; 250x maximum cashout paid successfully.",
  );
} finally {
  await db.close();
}
