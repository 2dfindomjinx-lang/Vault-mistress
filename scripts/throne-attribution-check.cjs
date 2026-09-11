// Execute the real webhook with an in-memory Supabase adapter. Signature
// verification is stubbed; routing, retry decisions and payout dispatch are real.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
let tables, calls, lookupFails, debtFails;
const db = {
  from(table) {
    let action = 'read', values, filters = [];
    const q = {
      select() { return q; },
      insert(v) { action = 'insert'; values = v; return q; },
      upsert(v) { action = 'upsert'; values = v; return q; },
      update(v) { action = 'update'; values = v; return q; },
      eq(k, v) { filters.push(r => r[k] === v); return q; },
      ilike(k, v) { filters.push(r => String(r[k]).toUpperCase() === v.toUpperCase()); return q; },
      maybeSingle() { return q; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (table === 'profiles' && lookupFails) return { data: null, error: { message: 'database unavailable' } };
          let rows = tables[table];
          assert.ok(rows, table);
          if (action === 'insert' || action === 'upsert') {
            const exists = rows.find(r => r.event_id === values.event_id);
            if (exists && action === 'insert') return { data: null, error: { code: '23505' } };
            if (!exists) rows.push({ status: table === 'tribute_claims' ? 'unmatched' : 'received', ...values });
          }
          const matches = rows.filter(r => filters.every(f => f(r)));
          if (action === 'update') matches.forEach(r => Object.assign(r, values));
          return { data: matches[0] ?? null, error: null };
        }).then(resolve, reject);
      },
    };
    return q;
  },
  async rpc(name, args) {
    calls.push({ name, args });
    if (name === 'apply_throne_debt_payment') {
      if (debtFails) return { data: null, error: { message: 'RPC unavailable' } };
      const event = tables.throne_webhook_events.find(e => e.event_id === args.p_event_id);
      if (!event.payload.data.message.includes('TD-1234ABCD')) return { data: { error: 'unknown_debt_code' }, error: null };
      Object.assign(event, { status: 'credited', user_id: 'debt-owner', attribution_code: 'TD-1234ABCD' });
      return { data: { userId: 'debt-owner', awarded: 0, applied:10, remaining:65, unallocated:0, status:'applied' }, error: null };
    }
    if (name === 'credit_throne_tribute') return { data: { awarded: 10 }, error: null };
    if (name === 'apply_wheel_throne_payment') return { data: { userId: 'wheel-owner', remaining: 0, status: 'paid' }, error: null };
    throw Error(name);
  },
};
const mocks = {
  'node:crypto': { verify: () => true },
  '@/lib/supabase/admin': { createSupabaseAdminClient: () => db, isSupabaseAdminConfigured: true },
  '@/lib/admin-pet-task-logs': { syncThroneMilestoneTitlesFromLedgers: async () => {} },
  '@/lib/user-notifications': { createUserNotification: async () => {} },
  '@/lib/birthday': { getBirthdayWindowState: () => ({ isLive: false }), BIRTHDAY_MONEY_BONUS_PERCENT: 0.5, BIRTHDAY_CANDLE_CODE_MONEY_PERCENT: 0.5 },
  '@/lib/pet-throne': { PET_THRONE_TASK_BONUS_PERCENT: 0.25 },
};
function load(file) {
  const m = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(
    id => mocks[id] ?? (id.startsWith('@/') ? load('src/' + id.slice(2) + '.ts') : require(id)), m, m.exports,
  );
  return m.exports;
}
const { POST } = load('src/app/api/webhooks/throne/route.ts');
const { extractThroneAttributionCode } = load('src/lib/throne-attribution.ts');
function reset() {
  calls = []; lookupFails = false; debtFails = false;
  tables = { throne_webhook_events: [], tribute_claims: [], profiles: [
    { id: 'vm-owner', tribute_code: 'VM-1234ABCD' },
    { id: 'pet-owner', pet_tribute_code: 'PT-ABC123' },
    { id: 'candle-owner', candle_code: 'CK-ABC123' },
    { id: 'court-owner', court_tribute_code: 'P2-1234ABCD' },
  ] };
}
async function send(message, eventId = 'event-1') {
  const response = await POST(new Request('https://example.test/api/webhooks/throne', {
    method: 'POST', headers: { 'x-signature-timestamp': String(Math.floor(Date.now() / 1000)), 'x-signature-ed25519': 'a'.repeat(128) },
    body: JSON.stringify({ contract_version: '1', event_type: 'gift_purchased', event_id: eventId, data: { message, price: 1000, currency: 'USD' } }),
  }));
  return { status: response.status, body: await response.json() };
}
(async () => {
  assert.equal(extractThroneAttributionCode('td-1234abcd TD-1234ABCD'), 'TD-1234ABCD');
  for (const invalid of ['TD-1234ABCDE', 'XTD-1234ABCD', 'TD-123', 'TD-1234ABCD VM-1234ABCD', 'PP-1234ABCD']) {
    assert.equal(extractThroneAttributionCode(invalid), null, invalid);
  }
  for (const [code, userId] of [['VM-1234ABCD', 'vm-owner'], ['PT-ABC123', 'pet-owner'], ['CK-ABC123', 'candle-owner'], ['p2-1234abcd', 'court-owner']]) {
    reset();
    assert.equal((await send(`For you (${code})`)).body.matched, true);
    assert.equal(calls[0].args.p_user_id, userId);
    assert.equal(tables.throne_webhook_events[0].status, 'credited');
    await send(code);
    assert.equal(calls.length, 1, 'Duplicate does not pay twice');
  }
  reset();
  assert.equal((await send('WL-ABC123')).status, 200);
  assert.deepEqual(calls.map(c => c.name), ['apply_wheel_throne_payment']);
  reset();
  assert.equal((await send('TD-1234ABCD')).body.moneyAwarded, 0);
  assert.equal(tables.throne_webhook_events[0].user_id, 'debt-owner');
  assert.deepEqual(calls.map(c => c.name), ['apply_throne_debt_payment']);
  await send('TD-1234ABCD');
  assert.equal(calls.length, 1, 'Debt redelivery is a no-op');
  reset();
  assert.equal((await send('TD-FFFFFFFF')).body.matched, false);
  assert.equal(tables.throne_webhook_events[0].status, 'unmatched');
  assert.equal(tables.tribute_claims.length, 1);
  reset(); debtFails = true;
  assert.equal((await send('TD-1234ABCD')).status, 500);
  assert.equal(tables.throne_webhook_events[0].status, 'received');
  assert.equal(tables.tribute_claims.length, 0);
  debtFails = false;
  assert.equal((await send('TD-1234ABCD')).body.matched, true);
  reset(); lookupFails = true;
  assert.equal((await send('P2-1234ABCD')).status, 500);
  assert.equal(tables.throne_webhook_events[0].status, 'received');
  lookupFails = false;
  assert.equal((await send('P2-1234ABCD')).body.matched, true);
  assert.equal(calls.length, 1);
  reset();
  assert.equal((await send('TD-1234ABCD VM-1234ABCD')).body.matched, false);
  assert.equal(calls.length, 0, 'Ambiguous message never credits an arbitrary owner');
  console.log('Throne routing checks passed: all six code families, unknown/ambiguous codes, no-PM debt attribution, duplicates and database retries.');
})().catch(error => { console.error(error); process.exitCode = 1; });
