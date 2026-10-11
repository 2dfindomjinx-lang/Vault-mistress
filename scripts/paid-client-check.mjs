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

// Also exercise the actual conversion/Furnace hooks. A retry after a lost reply
// must reuse its receipt, while the next intentional operation gets a new one.
const { default: ts } = await import('typescript');
const page=await readFile('src/app/page.tsx','utf8');
const ast=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const handlers=new Map();
function visit(node) {
  if(ts.isVariableDeclaration(node)&&['handleMoneyConvert','handleFurnaceBurn'].includes(node.name.getText(ast))) handlers.set(node.name.getText(ast),node.initializer.arguments[0].getText(ast));
  ts.forEachChild(node,visit);
}
visit(ast);
for(const [name,handler] of handlers) {
  const built=await transform(`export function fixture(d) {
    const {paidRequestId,finishPaidRequest,isDefinitiveRejection,fetch}=d;
    const authUserId='wallet-fixture', coinsRef={current:0};
    const setMoneyConverting=()=>{},setFurnaceBurning=()=>{},setFurnaceError=()=>{},setMoneyShopError=()=>{},applyProfileStats=()=>{},emitSoundEvent=()=>{},setBurnedTotal=()=>{};
    return ${handler};
  }`,{loader:'ts',format:'esm'});
  const {fixture}=await import('data:text/javascript;base64,'+Buffer.from(built.code).toString('base64'));
  let fail=true;const calls=[];
  const run=fixture({paidRequestId,finishPaidRequest,isDefinitiveRejection,fetch:async(_url,init)=>{
    calls.push(JSON.parse(init.body));if(fail)throw Error('lost reply');return Response.json({profile:{coins:10},burnedTotal:1});
  }});
  await run(20);fail=false;await run(20);await run(20);
  assert.equal(calls[0].requestId,calls[1].requestId,name+' retries the same receipt');
  assert.notEqual(calls[1].requestId,calls[2].requestId,name+' creates the next receipt after success');
}
assert.equal(handlers.size,2);
console.log('Actual PM conversion and Furnace client handlers preserve ambiguous requests and start new receipts only after success.');
