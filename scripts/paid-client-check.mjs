import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { paidRequestId, finishPaidRequest, isDefinitiveRejection } from '../src/lib/paid-request.ts';

// Execute the actual event handlers with HTTP/timer dependencies. Unlike a
// textual assertion, this catches locks left set after a rejected fetch.
const files=['src/components/FindomWheels.tsx'];
if(process.argv[2]) files.push(`${process.argv[2]}/components/court-app.tsx`);
for(const file of files){
  const source=await readFile(file,'utf8');
  const start=source.indexOf('  const spin = async (wheelId: WheelId) => {');
  const stop=source.indexOf(file.includes('court-app')?'  const payDebt =':'  const payWithPm =',start);
  assert.ok(start>0&&stop>start);
  const handler=source.slice(start,stop);
  const code=`export function fixture(d) {
    const {paidRequestId,finishPaidRequest,isDefinitiveRejection,fetch}=d;
    const disabled=false, status={userId:'fixture-user'}, viewer={userId:'fixture-user',refreshMoney:()=>{}}, rotations={chastity:0};
    let spinningWheel=null;
    const spinInFlight={current:false}, spinController={current:null}, spinTimer={current:null}, timers={current:[]};
    const setSpinningWheel=value=>{spinningWheel=value};
    const setError=()=>{},setResult=()=>{},setResults=()=>{},notify=()=>{},emitSoundEvent=()=>{},onProfile=()=>{},onDebtChange=()=>{},loadStatus=()=>{};
    const setState=()=>{},setRotations=()=>{};
    const buildWheelVisualSlices=()=>[{segmentIndex:0}], FULL_TURNS=5,SPIN_MS=4200;
    const window={setTimeout:(fn)=>{d.timers.push(fn);return d.timers.length;}};
    ${handler}
    return {spin};
  }`;
  const built=await transform(code,{loader:'ts',format:'esm'});
  const {fixture}=await import(`data:text/javascript;base64,${Buffer.from(built.code).toString('base64')}`);
  let fail=true,calls=[],timerCallbacks=[];
  const instance=fixture({paidRequestId,finishPaidRequest,isDefinitiveRejection,timers:timerCallbacks,
    fetch:async(_url,init)=>{calls.push(JSON.parse(init.body));if(fail)throw Error('response lost');return Response.json({ok:true,kind:'chastity',segmentIndex:0,segment:{amount:4,label:'4h'},days:4,label:'4h',money:50,chastityUntil:null});},
  });
  await instance.spin('chastity');
  fail=false;await instance.spin('chastity');
  assert.equal(calls.length,2,`${file}: network error releases in-flight guard`);
  assert.equal(calls[0].requestId,calls[1].requestId,'Retry must reuse charge receipt');
  await instance.spin('chastity');assert.equal(calls.length,2,'Animation prevents double-click purchases');
  timerCallbacks.splice(0).forEach(fn=>fn());
  await instance.spin('chastity');assert.equal(calls.length,3);
  assert.notEqual(calls[2].requestId,calls[1].requestId,'Intentional next spin gets a fresh ID');
  timerCallbacks.splice(0).forEach(fn=>fn());
}
console.log('Both real wheel handlers: lost response retry, unchanged request ID, click guard and deliberate new spin passed.');
