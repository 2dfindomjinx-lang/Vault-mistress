import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSecurityFixture } from './security-economy-fixture.mjs';
const db=await createSecurityFixture();
const user=randomUUID(), hidden=randomUUID(), admin=randomUUID(), other=randomUUID();
const query=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
const pet=async(action,reward=200,proof={}) => (await query('select apply_pet_action($1,$2,$3,$4) r',[user,action,reward,proof])).r;
const progress=async(task,status='available',metadata={}) => (await query('select save_pet_task_progress($1,$2,$3,$4) r',[user,task,status,metadata])).r;
const wallet=async(id,operation,amount,uid=user) => (await query('select execute_wallet_action($1,$2,$3,$4) r',[uid,id,operation,amount])).r;
const profile=()=>query('select * from profiles where id=$1',[user]);
try {
  for(const id of [user,hidden,admin,other]) await db.query('insert into profiles(id,username) values($1,$2)',[id,id]);
  assert.equal((await progress('pet-daily-report','approved')).error,'review_required');
  assert.equal((await progress('pet-daily-report','pending',{proofText:'sent'})).submitted,true);
  assert.equal((await progress('pet-daily-report','approved')).error,'review_required');
  assert.equal((await progress('pet-daily-report','pending')).submitted,undefined,'Pending review cannot be repeatedly submitted');
  assert.equal((await pet('reward:invented')).error,'invalid_action');
  assert.equal((await pet('reward:pet-affection-claim',0)).error,'task_not_ready');
  assert.equal((await pet('reward:pet-confession-dm')).error,'task_not_ready');
  assert.equal((await progress('pet-confession-dm','available',{count:4})).error,'invalid_progress');
  for(let count=1;count<=4;count++) assert.equal((await progress('pet-confession-dm','available',{count})).task.metadata.count,count);
  const first=await pet('reward:pet-confession-dm'); assert.equal(first.task.metadata.count,5);
  const before=await profile();
  for(const r of await Promise.all(Array.from({length:8},()=>pet('reward:pet-confession-dm')))) assert.equal(r.replayed,true);
  assert.deepEqual(await profile(),before); assert.equal(before.total_devotion,2);
  assert.equal((await progress('pet-confession-dm','available',{count:1})).task.status,'approved','Reset cannot reopen a rewarded task');
  assert.equal((await pet('reward:pet-perfect-writing',999999)).error,'invalid_reward');
  const wait=await progress('pet-evil-wait','available',{waitEndsAt:'2000-01-01'});
  assert.ok(new Date(wait.task.metadata.waitEndsAt)>new Date());
  assert.equal((await pet('reward:pet-evil-wait')).error,'task_not_ready');
  await db.query("update user_pet_tasks set metadata=jsonb_set(metadata,'{waitEndsAt}',to_jsonb((now()-interval '1 second')::text)) where task_id='pet-evil-wait'");
  assert.equal((await pet('reward:pet-evil-wait')).success,true);
  assert.equal((await pet('reward:pet-false-hope',200,{key:'a'})).error,'task_not_ready');
  for(let i=0;i<198;i++) {
    const r=await progress('pet-false-hope','available',{key:i%2?'d':'a',expectedProgress:i<99?i:i-99,expectedStage:i<99?1:2});
    assert.ok(r.task,JSON.stringify(r));
  }
  assert.equal((await pet('reward:pet-false-hope',200,{key:'a'})).success,true);
  const loss=await pet('reward:pet-favor-roulette',500,{pickedIndex:0,winningIndices:[1],result:'loss'});
  assert.equal(loss.task.status,'failed'); const afterLoss=await profile();
  assert.equal((await pet('reward:pet-favor-roulette',500,{pickedIndex:1,winningIndices:[1],result:'win'})).task.metadata.result,'loss');
  assert.deepEqual(await profile(),afterLoss,'New client roll cannot replace a settled loss');
  await db.query("update profiles set last_pet_tax_at=now()-interval '8 days' where id=$1",[user]);
  const tax=await pet('spend:pet-weekly-tax',99999); assert.equal(tax.collected,true);
  const afterTax=await profile();assert.equal((await pet('spend:pet-weekly-tax')).collected,false);assert.deepEqual(await profile(),afterTax);
  const id=randomUUID(); const conversion=await wallet(id,'money-convert',20);
  assert.equal(conversion.breakdown.totalCoins,23000);const afterConvert=await profile();
  assert.equal((await wallet(id,'money-convert',20)).replayed,true);assert.deepEqual(await profile(),afterConvert);
  assert.equal((await wallet(id,'money-convert',21)).error,'request_mismatch');
  assert.equal((await wallet(randomUUID(),'money-convert',999999)).error,'insufficient_money');
  for(const amount of [1,9,10,19,20,49,50,99,100]) {
    const bonus=amount>=100?.25:amount>=50?.2:amount>=20?.15:amount>=10?.1:0;
    assert.equal((await wallet(randomUUID(),'money-convert',amount)).breakdown.totalCoins,amount*1000+Math.floor(amount*1000*bonus));
  }
  const burn=randomUUID();assert.equal((await wallet(burn,'furnace',10)).burned,10);assert.equal((await wallet(burn,'furnace',10)).replayed,true);
  assert.equal((await profile()).pm_burned_total,10);
  const shrine=randomUUID();assert.equal((await wallet(shrine,'shrine',5000)).totalSpent,5000);
  assert.equal((await wallet(shrine,'shrine',5000)).replayed,true);
  // >1,000 ledger rows prove that PostgREST's default row cap cannot truncate totals.
  await db.query("insert into coin_transactions(user_id,amount,reason,metadata) select $1,-5000,'tribute:shrine','{}'::jsonb from generate_series(1,1200)",[other]);
  await db.query("update profiles set hide_from_leaderboard=true where id=$1",[hidden]);
  await db.query("update profiles set is_admin=true where id=$1",[admin]);
  for(const id of [hidden,admin]) await db.query("insert into coin_transactions(user_id,amount,reason,metadata) values($1,-9000000,'tribute:shrine','{}')",[id]);
  const summary=(await query('select get_shrine_summary($1) r',[other])).r;
  assert.equal(summary.totalSpent,6000000);assert.equal(summary.topWorshippers[0].userId,other);
  assert.equal(summary.topWorshippers.length,2);assert.ok(summary.topWorshippers.every(x=>x.userId!==hidden&&x.userId!==admin));
  // Failure after wallet mutations must roll back balances, rewards, ledgers AND receipt.
  await db.exec("create function reject_record() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$; create trigger reject_record before insert on paid_operation_receipts for each row execute function reject_record();");
  const snapshot=await profile();
  for(const [operation,amount] of [['money-convert',10],['shrine',5000],['furnace',5]]) {
    await assert.rejects(wallet(randomUUID(),operation,amount),/injected failure/);assert.deepEqual(await profile(),snapshot);
  }
  await db.exec('drop trigger reject_record on paid_operation_receipts; create trigger reject_pet before insert on coin_transactions for each row execute function reject_record();');
  await assert.rejects(pet('reward:pet-perfect-writing'),/injected failure/);assert.deepEqual(await profile(),snapshot);
  assert.equal((await query("select count(*)::int n from user_pet_tasks where task_id='pet-perfect-writing'")).n,0);
  await db.exec('drop trigger reject_pet on coin_transactions; set role authenticated');
  await assert.rejects(pet('reward:pet-perfect-writing'),/permission denied/);
  await assert.rejects(progress('pet-perfect-writing','approved'),/permission denied/);
  await assert.rejects(wallet(randomUUID(),'money-convert',1),/permission denied/);
  await assert.rejects(query('select get_shrine_summary($1)',[user]),/permission denied/);
  await assert.rejects(query("insert into user_pet_tasks(user_id,task_id) values($1,'forged')",[user]),/permission denied/);
  console.log('Security/economy SQL passed: repeated rewards, self-approval, forged progress/timers, sequence, tax, conversion tiers, receipts, rollback, 1200-row totals, privacy and grants. Isolated PostgreSQL; separate connection contention and production remain untested.');
} finally { await db.close(); }
