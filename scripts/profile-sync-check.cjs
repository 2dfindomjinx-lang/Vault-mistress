const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

// Exercise the actual page updater with React setter stand-ins, without a live
// account or database writes. A partial response must never reset other fields.
const source = fs.readFileSync('src/app/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let updater;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'applyProfileStats') updater = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(updater);
const body = updater.getText(ast);
const state = {};
const context = {
  exports: {},
  timeoutUntilRef: { current: null }, timeoutReasonRef: { current: null }, addressTermRef: { current: 'sub' },
  resolveProfileDisplayName: p => p.display_name,
  refreshDisplayName: () => {}, normalizeEquipment: slots => slots,
  normalizeAddressTerm: value => value || 'sub', MAX_AVATAR_PRESET_SLOTS: 3,
  getUserLevelProgress: xp => ({ level: Math.floor(xp / 100) + 1 }),
};
for (const setter of new Set(body.match(/\bset[A-Z]\w+/g))) {
  context[setter] = value => { state[setter] = typeof value === 'function' ? value(state[setter] ?? []) : value; };
}
vm.runInNewContext(ts.transpileModule(`exports.apply = ${body};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const apply = context.exports.apply;
apply({ id: 'user', username: 'example', coins: 500, principessa_money: 50, total_devotion: 1000,
  tribute_code: 'VM-TEST', pet_tribute_code: 'PT-TEST', streak_freezes: 1,
  user_level: 7, user_xp: 650, stored_rights: 3, right_expirations: ['2030-01-01'],
  daily_purchase_count: 2, right_purchase_date: '2026-09-13', pm_burned_total: 120,
  timeout_until: '2030-01-01', timeout_reason: 'test', equipped_avatar_slots: { top: 'item' },
  avatar_presets: [{ name: 'Saved outfit' }], unlocked_avatar_preset_slots: 3, address_term: 'femsub' });
const before = structuredClone(state);
apply({ coins: 450 });
assert.deepEqual(structuredClone(state), { ...before, setCoins: 450 });
assert.equal(context.timeoutUntilRef.current, '2030-01-01');
assert.equal(context.addressTermRef.current, 'femsub');
apply({ total_devotion: 0, streak_freezes: 0, stored_rights: 0, pm_burned_total: 0,
  right_expirations: null, right_purchase_date: null, timeout_until: null, timeout_reason: null });
for (const key of ['setTotalDevotion', 'setStreakFreezes', 'setStoredRights', 'setBurnedTotal']) assert.equal(state[key], 0);
assert.equal(state.setRightExpirations.length, 0);
assert.equal(state.setRightPurchaseDate, null);
assert.equal(context.timeoutUntilRef.current, null);
assert.equal(context.timeoutReasonRef.current, null);
apply({ user_level: 9, user_xp: 850, stored_rights: 4, daily_purchase_count: 5, pm_burned_total: 200 });
assert.equal(state.setUserLevel, 9);
assert.equal(state.setUserXp, 850);
assert.equal(state.setStoredRights, 4);
assert.equal(state.setDailyPurchaseCount, 5);
assert.equal(state.setBurnedTotal, 200);
assert.equal(state.setTributeCode, 'VM-TEST');
assert.equal(state.setPetTributeCode, 'PT-TEST');
const columns = fs.readFileSync('src/lib/profile-columns.ts', 'utf8').match(/"([^"]+)"/)[1].split(',').map(s => s.trim());
for (const field of new Set([...body.matchAll(/profile\.(\w+)/g)].map(match => match[1]))) assert.ok(columns.includes(field), `Missing query field: ${field}`);
assert.ok(source.startsWith('"use client";'));
assert.ok(source.includes('import { profileSelect } from "@/lib/profile-columns";'));
console.log('Profile sync passed: partial responses preserve state; explicit zero/null clears; XP, rights, furnace and codes synchronize; query covers updater fields.');
