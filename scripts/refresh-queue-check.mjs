import assert from "node:assert/strict";
import { test } from "node:test";
import { createRefreshQueue } from "../src/lib/refresh-queue.ts";
import { paidRequestId, finishPaidRequest, isDefinitiveRejection } from "../src/lib/paid-request.ts";

test('bursts coalesce; in-flight changes trigger exactly one trailing read', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  let calls = 0, release;
  const queue = createRefreshQueue(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  queue.request(); queue.request(); queue.request();
  t.mock.timers.tick(250); assert.equal(calls,1);
  queue.request(); queue.request();
  t.mock.timers.tick(2000); assert.equal(calls,1);
  release(); await Promise.resolve();
  t.mock.timers.tick(250); assert.equal(calls,2);
  queue.dispose(); release(); await Promise.resolve();
  t.mock.timers.tick(10000); assert.equal(calls,2);
});
test('hidden tabs defer reads, failures back off, disposal cancels work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout','Date'], now: 10000 });
  let visible=false,calls=0;
  const queue=createRefreshQueue(async()=>{ calls++; throw Error('offline'); }, {visible:()=>visible});
  queue.request(); t.mock.timers.tick(10000); assert.equal(calls,0);
  visible=true; queue.request(); t.mock.timers.tick(250); await Promise.resolve();
  assert.equal(calls,1); t.mock.timers.tick(1200); assert.equal(calls,1);
  t.mock.timers.tick(1200); await Promise.resolve(); assert.equal(calls,2);
  queue.dispose(); t.mock.timers.tick(100000); assert.equal(calls,2);
});
test('paid receipts survive ambiguous retries and separate users/actions', () => {
  const memory=new Map();
  globalThis.sessionStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const a=paidRequestId('user-a:wheel:chastity');
  assert.equal(paidRequestId('user-a:wheel:chastity'),a);
  assert.notEqual(paidRequestId('user-b:wheel:chastity'),a);
  assert.notEqual(paidRequestId('user-a:shop:buy:royal'),a);
  assert.equal(isDefinitiveRejection(503),false);
  assert.equal(isDefinitiveRejection(429),false);
  assert.equal(isDefinitiveRejection(408),false);
  assert.equal(isDefinitiveRejection(402),true);
  finishPaidRequest('user-a:wheel:chastity');
  assert.notEqual(paidRequestId('user-a:wheel:chastity'),a);
  delete globalThis.sessionStorage;
});
