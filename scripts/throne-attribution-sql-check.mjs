import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const courtSqlPath = process.argv[2];
if (!courtSqlPath) throw new Error('Pass the Court supabase/court-wheels-pm.sql path.');
const db = new PGlite();
const user = '00000000-0000-0000-0000-000000000001';
const hidden = '00000000-0000-0000-0000-000000000002';
const repair = await readFile(new URL('../supabase/202609110002_repair_throne_debt_attribution.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/202609110001_throne_attribution.sql', import.meta.url), 'utf8');
const bundle = await readFile(join(dirname(courtSqlPath), 'court-throne-attribution-fix.sql'), 'utf8');
const attribute = async id => (await db.query('select attribute_throne_debt_payment($1) result', [id])).rows[0].result;
const feed = async () => (await db.query('select * from get_court_activity(40)')).rows;
const snapshot = async () => {
  const result = {};
  for (const table of ['profiles', 'money_transactions', 'throne_debts', 'throne_debt_installments']) {
    result[table] = (await db.query(`select * from ${table} order by 1`)).rows;
  }
  return result;
};
async function event(id, message, options = {}) {
  const payload = { contract_version: '1', event_type: 'gift_purchased', event_id: id,
    data: { message, price: options.price ?? 1234, currency: options.currency ?? 'USD' } };
  await db.query(`insert into throne_webhook_events(event_id,payload,status,user_id,attribution_code)
    values ($1,$2,$3,$4,$5)`, [id, JSON.stringify(payload), options.status ?? 'unmatched', options.userId ?? null, options.code ?? null]);
}
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table profiles(id uuid primary key, username text, display_name text, avatar_url text,
      hide_from_leaderboard boolean default false, is_admin boolean default false,
      principessa_money int default 25, coins int default 100, tribute_total int default 3000,
      total_devotion int default 5, chastity_until timestamptz);
    create table throne_debts(id uuid primary key default gen_random_uuid(), user_id uuid, debt_code text, status text default 'active');
    create table throne_debt_installments(id int, status text);
    create table throne_webhook_events(event_id text primary key, payload jsonb, status text default 'received',
      user_id uuid, attribution_code text, occurred_at timestamptz default '2026-09-01T12:00:00Z',
      created_at timestamptz default '2026-09-01T12:00:00Z', processed_at timestamptz);
    create table tribute_claims(event_id text unique, status text default 'unmatched', user_id uuid);
    create table money_transactions(id uuid default gen_random_uuid(), user_id uuid, amount int, reason text,
      metadata jsonb default '{}', source_key text unique, created_at timestamptz default now());
    create table coin_transactions(id uuid, user_id uuid, amount int, reason text, metadata jsonb, created_at timestamptz);
    create table admin_pet_task_logs(status text, transaction_ids jsonb);
    create function is_public_throne_tribute_transaction(text,jsonb) returns boolean language sql as $$ select false $$;
    create table wheel_spins(id uuid, user_id uuid, wheel_id text, segment_label text, amount numeric,
      amount_owed_usd numeric, amount_paid_usd numeric, pay_code text, created_at timestamptz,
      status text, kind text, metadata jsonb, paid_at timestamptz);
    create table court_carts(paid_by uuid, settled_by uuid, price_usd numeric, tax_usd numeric,
      item_name text, paid_at timestamptz, settled_at timestamptz, status text);
    insert into profiles(id,username) values ('${user}','debt-owner');
    insert into profiles(id,username,hide_from_leaderboard) values ('${hidden}','hidden-owner',true);
    insert into throne_debts(user_id,debt_code) values ('${user}','TD-1234ABCD'),('${hidden}','TD-87654321');
    insert into throne_debt_installments values (1,'submitted_for_review');
  `);
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(await readFile(courtSqlPath, 'utf8'));
  await event('old-debt', 'td-1234abcd TD-1234ABCD');
  await event('hidden-debt', 'TD-87654321');
  await event('unknown', 'TD-FFFFFFFF');
  await event('ambiguous', 'TD-1234ABCD VM-1234ABCD');
  await event('invalid', 'TD-1234ABCD', { currency: 'EUR' });
  await event('zero', 'TD-1234ABCD', { price: 0 });
  await event('ignored', 'TD-1234ABCD', { status: 'ignored' });
  await event('manual-credit', 'TD-1234ABCD', { status: 'credited', userId: user });
  await event('unfinished-claim', 'TD-1234ABCD');
  await event('ordinary-anon', 'Thank you');
  await db.query("insert into tribute_claims(event_id) values ('old-debt')");
  await db.query(`insert into money_transactions(user_id,amount,reason,source_key)
    values ($1,10,'throne_tribute','throne:unfinished-claim'),($1,10,'throne_tribute','throne:manual-credit')`, [user]);
  const before = await snapshot();
  assert.equal((await feed()).filter(r => r.kind === 'tribute_anon').length, 7);
  await db.exec(bundle);
  assert.deepEqual(await snapshot(), before, 'Repair must not change balances, rewards, contracts, or installments');
  const old = (await db.query("select * from throne_webhook_events where event_id='old-debt'")).rows[0];
  assert.equal(old.user_id, user);
  assert.equal(old.status, 'credited');
  assert.equal(old.attribution_code, 'TD-1234ABCD');
  assert.equal(new Date(old.occurred_at).toISOString(), '2026-09-01T12:00:00.000Z');
  assert.equal((await db.query("select status from tribute_claims where event_id='old-debt'")).rows[0].status, 'linked');
  let activity = await feed();
  const debtLines = activity.filter(r => r.label === 'Throne Debt');
  assert.equal(debtLines.length, 1, 'Public owner appears once, hidden owner never appears');
  assert.equal(debtLines[0].username, 'debt-owner');
  assert.equal(Number(debtLines[0].amount), 12.34);
  assert.equal(activity.filter(r => r.kind === 'tribute_claimed').length, 0, 'Repair is not a second late-claim story');
  assert.equal(activity.filter(r => r.kind === 'tribute_anon').length, 5);
  assert.equal((await attribute('unknown')).error, 'unknown_debt_code');
  assert.equal((await attribute('ambiguous')).error, 'ambiguous_or_missing_debt_code');
  assert.equal((await attribute('invalid')).error, 'invalid_payment');
  assert.equal((await attribute('zero')).error, 'invalid_payment');
  assert.equal((await attribute('ignored')).error, 'event_already_handled');
  assert.equal((await attribute('unfinished-claim')).error, 'payment_already_claimed');
  assert.equal((await attribute('old-debt')).duplicate, true);
  await db.exec(repair);
  await db.exec(bundle);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await feed(), activity, 'Re-running repair leaves feed unchanged');
  await event('fresh', 'TD-1234ABCD', { status: 'received' });
  assert.equal((await attribute('fresh')).userId, user);
  assert.equal((await feed()).filter(r => r.label === 'Throne Debt').length, 2, 'Separate actual payments remain separate');
  await db.exec('set role authenticated');
  await assert.rejects(attribute('fresh'), /permission denied/);
  await db.exec('reset role');
  console.log('Throne SQL checks passed: atomic attribution, historical repair, no economy/installment changes, exact cents, timestamps, privacy, feed deduplication and RPC permissions.');
} finally { await db.close(); }
