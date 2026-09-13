import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const user = '00000000-0000-0000-0000-000000000001';
const rpc = async (sql, args = []) => (await db.query(sql, args)).rows[0].result;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key, coins int, updated_at timestamptz);
    create table coin_transactions(user_id uuid,amount int,balance_before int,balance_after int,reason text,metadata jsonb);
    insert into profiles values ('${user}',100000,null);`);
  for (const file of ['gamble-hall.sql','202609100001_court_gameplay.sql','202609130001_gamble_cashout_receipt.sql','202609130001_gamble_cashout_receipt.sql']) {
    await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'));
  }
  const open = () => rpc('select gamble_crash_open($1,100,1.17,null) result',[user]);
  const first = await open();
  // A 1.13 click received before a 1.17 crash, processed two seconds later.
  await db.query("update gamble_rounds set state=state||jsonb_build_object('startsAt',clock_timestamp()-interval '4 seconds') where id=$1",[first.roundId]);
  const receipt = (await db.query("select (state->>'startsAt')::timestamptz + interval '1.75 seconds' received from gamble_rounds where id=$1",[first.roundId])).rows[0].received;
  const cashout = () => rpc('select gamble_crash_cashout_at($1,$2,1.13,$3) result',[user,first.roundId,receipt]);
  const won = await cashout();
  assert.equal(won.survived,true,'database delay must not change an on-time cashout');
  assert.equal(won.multiplier,1.13,'timing tolerance must not reduce the requested on-time payout');
  const count = (await db.query('select count(*)::int n from coin_transactions')).rows[0].n;
  await cashout();
  assert.equal((await db.query('select count(*)::int n from coin_transactions')).rows[0].n,count,'retry cannot pay twice');
  const second = await open();
  await db.query("update gamble_rounds set state=state||jsonb_build_object('startsAt',clock_timestamp()-interval '10 seconds') where id=$1",[second.roundId]);
  const late = await rpc('select gamble_crash_cashout_at($1,$2,1.01,clock_timestamp()) result',[user,second.roundId]);
  assert.equal(late.survived,false,'a client cannot rescue a late click with a lower multiplier');
  assert.equal((await rpc('select gamble_crash_cashout_at($1,$2,1.01,clock_timestamp()-interval \'1 minute\') result',[user,second.roundId])).error,'invalid_receipt_time');
  assert.equal((await db.query("select has_function_privilege('authenticated','gamble_crash_cashout_at(uuid,uuid,numeric,timestamptz)','EXECUTE') allowed")).rows[0].allowed,false);
  console.log('Cashout receipt, late loss, retry payout, timestamp bounds and service-only permissions passed.');
} finally { await db.close(); }
