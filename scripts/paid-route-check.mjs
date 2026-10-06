import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
await mkdir('tmp/paid-route-check', { recursive: true });
globalThis.auditAuth = true;
let calls = [], rpcResult, rpcError = null;
globalThis.auditDb = {
  async rpc(name,args) { calls.push({name,args}); return {data:rpcResult,error:rpcError}; },
  from(table) {
    const filters={};
    const q={ select:()=>q, eq:(key,value)=>{ filters[key]=value; return q; },
      single:async()=>({data:{id:'audit-user',principessa_money:901},error:null}),
      maybeSingle:async()=>{assert.equal(table,'user_crate_inventory');assert.equal(filters.variant,'normal');return {data:{quantity:7,pm_quantity:3},error:null};},
    }; return q;
  },
};
async function load(file,aliasRoot,name) {
  const output=path.resolve(`tmp/paid-route-check/${name}.mjs`);
  await build({entryPoints:[file],outfile:output,bundle:true,format:'esm',platform:'node',packages:'external',
    tsconfigRaw:{compilerOptions:{baseUrl:'.',paths:{'@/*':[`${aliasRoot}/*`]}}},
    plugins:[{name:'test-server',setup(b){
      b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
      b.onResolve({filter:/^@\/lib\/(supabase\/(admin|server|fast-auth)|rate-limit|same-origin)$/},args=>({path:args.path,namespace:'test'}));
      b.onLoad({filter:/.*/,namespace:'test'},({path:p})=>({loader:'js',contents:
        p.endsWith('/admin')?'export const createSupabaseAdminClient=()=>globalThis.auditDb; export const isSupabaseAdminConfigured=true; export const getSupabaseAdminConfigErrors=()=>[];':
        p.endsWith('/server')?'export const createClient=async()=>({auth:{getUser:async()=>({data:{user:globalThis.auditAuth?{id:"audit-user"}:null},error:null})}});':
        p.endsWith('/fast-auth')?'export const getFastUser=async()=>({id:"audit-user"});':
        p.endsWith('/same-origin')?'export const blockCrossOrigin=()=>null;':
        'export const checkRateLimit=async()=>({allowed:true}); export const rateLimitResponse=()=>new Response(null,{status:429});'}));
    }}],logLevel:'silent'});
  return import(pathToFileURL(output));
}
const shop=await load('src/app/api/user/money-shop/route.ts','src','shop');
const wheel=await load('src/app/api/user/wheels/route.ts','src','wheel');
const request=body=>new Request('http://audit.invalid/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
// Extract a real catalogue item instead of maintaining a hardcoded price fixture.
const catalogue=await build({stdin:{contents:'export { SAMPLE_CRATE_ITEMS } from "./src/lib/crates";',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {SAMPLE_CRATE_ITEMS}=await import(`data:text/javascript;base64,${Buffer.from(catalogue.outputFiles[0].text).toString('base64')}`);
const [itemId,item]=Object.entries(SAMPLE_CRATE_ITEMS).find(([,item])=>item.rarity==='legendary'&&item.sell_value>0);
const body={action:'buy',itemId,requestId:randomUUID(),pricePm:0,refundPm:999999};
assert.equal((await shop.POST(request({...body,requestId:undefined}))).status,422);
assert.equal(calls.length,0);
rpcResult={success:true,replayed:true,pricePm:38,refundPm:27};
const purchase=await shop.POST(request(body)); const result=await purchase.json();
assert.equal(purchase.status,200);assert.equal(result.ownedInInventory,7);assert.equal(result.ownedFromShop,3);
assert.equal(result.profile.principessa_money,901,'Replay returns current balance');
assert.equal(calls[0].name,'execute_money_shop');
assert.equal(calls[0].args.p_price_pm,Math.ceil(item.sell_value/1000*1.5),'Client price ignored');
assert.notEqual(calls[0].args.p_refund_pm,999999);
rpcError={message:'offline'};
const unavailable=await shop.POST(request(body));assert.equal(unavailable.status,503);
assert.doesNotMatch((await unavailable.json()).error,/nothing was charged/i);
rpcError=null;globalThis.auditAuth=false;
assert.equal((await shop.POST(request(body))).status,401);globalThis.auditAuth=true;
const receipt={spinId:randomUUID(),segmentIndex:2,segment:{amount:30,label:'Original verdict',throneUrl:null},money:900,chastityUntil:'2026-10-07T00:00:00Z'};
rpcResult=receipt;calls=[];
const landed=await wheel.POST(request({action:'spin',wheelId:'chastity',requestId:randomUUID()}));
assert.equal(landed.status,200);const verdict=await landed.json();
assert.deepEqual(verdict.segment,receipt.segment);assert.equal(verdict.segmentIndex,receipt.segmentIndex);
assert.equal(calls[0].name,'spin_findom_wheel_once');assert.ok(calls[0].args.p_request_id);
if(process.argv[2]) {
  const root=path.resolve(process.argv[2]);
  const court=await load(path.join(root,'app/api/wheels/route.ts'),root,'court-wheel');
  const response=await court.POST(request({action:'spin',wheelId:'chastity',requestId:randomUUID()}));
  const payload=await response.json();assert.equal(response.status,200);
  assert.equal(payload.segmentIndex,receipt.segmentIndex);assert.equal(payload.label,receipt.segment.label);assert.equal(payload.days,30);
}
console.log('Paid API handlers: trusted prices, required receipts, current inventory on replay, ambiguous failure, auth, original wheel result in both clients passed. HTTP/DB fixtures only.');
