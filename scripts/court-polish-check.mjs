import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const bundle = await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import {createRoot} from 'react-dom/client';
 import {GambleHall} from './src/components/GambleHall';
 import {CratesPanel} from './src/components/CratesPanel';
 import {DebtSection} from './src/components/DebtSection';
 import {CommandGesture} from './src/components/CourtGamePresentation';
 const root=createRoot(document.getElementById('app'));
 const won={item_id:'classic_thighhighs',name:'Classic Thighhighs',description:'',rarity:'uncommon',sell_value:250,variant:'normal'};
 window.show=(kind)=>root.render(kind==='cases'?<CratesPanel coins={50000} crates={[{crate_type:'principessa',name:'Principessa Case',description:'',cost:500}]} inventory={[]} onOpenCrate={async()=>({success:true,result:{item:won,newCoins:49500}})} onSellItem={async()=>({success:true})}/>:kind==='debt'?<DebtSection tasks={[{id:"pet-debt-contract",kind:"debt-contract",title:"Debt",description:"",status:"available"}]} petDebtContract={{id:'00000000-0000-0000-0000-000000000001',contract_type:'evil',status:'active',pet_name:'Test',period_type:'weekly',debt_amount:1000,duration_periods:4,paid_periods:1,missed_periods:0,created_at:new Date().toISOString(),started_at:new Date().toISOString(),ends_at:new Date().toISOString(),next_due_at:new Date().toISOString()}} onDebtAutoPayChange={()=>{}} onPayDebtPeriod={()=>{}} onSignDebtContract={()=>{}}/>:<><div style={{width:90}}><CommandGesture action="bow"/></div><GambleHall/></>);
 window.show('games');
`},bundle:true,write:false,outfile:'tmp/court-polish-fixture.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});let requests=0;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/user/gamble'){
   const body=route.request().postDataJSON();requests++;
   const result=body.action==='plinko'?{path:Array(12).fill(1),bucket:12,payout:0,multiplier:0,roundId:String(requests)}:body.action==='mines-open'?{roundId:'mine',mineCount:3}:body.action==='mines-pick'?{bust:true,mines:[0,1,2]}:{};
   return route.fulfill({json:result});
  }
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{contracts:[],money:100}});
  const relative=url.pathname==='/_next/image'?url.searchParams.get('url'):url.pathname;
  const asset=path.resolve('public','.'+relative);
  if(asset.startsWith(path.resolve('public')+path.sep)&&fs.existsSync(asset)&&fs.statSync(asset).isFile())return route.fulfill({body:fs.readFileSync(asset)});
  return route.fulfill({contentType:'text/html',body:'<html><body style="margin:20px;background:#10090f;color:white"><div id="app"></div></body></html>'});
 });
 await page.goto('http://court.test');
 const css=fs.readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('.next/static/chunks/'+f,'utf8')).join('\n');
 await page.addStyleTag({content:css+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});
 await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
 await page.locator('[data-table-choice="plinko"]').click();
 for(let i=0;i<4;i++){await page.getByRole('button',{name:'Release the ball',exact:true}).click();await page.getByRole('button',{name:'Release the ball',exact:true}).waitFor({timeout:7000});}
 assert.equal(requests,4);
 await page.locator('[data-table-choice="mines"]').click();
 assert.equal(await page.getByText('Choose the traps',{exact:true}).count(),1);
 await page.evaluate(()=>window.show('cases'));
 await page.getByRole('button',{name:'Open 1',exact:true}).click();
 await page.getByRole('button',{name:'Open Again',exact:true}).waitFor({timeout:15000});
 const alignment=await page.evaluate(()=>{const marker=document.querySelector('[class*="border-yellow-400/95"]');const viewport=marker?.parentElement;const strip=viewport?.querySelector('[class*="will-change-transform"]');const winner=strip?.children[43];if(!marker||!winner)throw Error('Reel not rendered');const a=marker.getBoundingClientRect(),b=winner.getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2);});
 assert.ok(alignment<=2,'winner/marker offset: '+alignment);
 await page.evaluate(()=>window.show('debt'));
 await page.locator('#evil-contract-panel').waitFor();
 assert.equal(await page.locator('#coin-contract-panel').isVisible(),false);
 const positions=await page.evaluate(()=>{const evil=document.querySelector('#evil-contract-panel').getBoundingClientRect();const summary=document.querySelector('[aria-label="Recorded commitments"]').getBoundingClientRect();const throne=document.querySelector('#throne-contract-panel').getBoundingClientRect();return {evil:evil.x,summary:summary.x,throne:throne.x};});
 assert.ok(positions.evil<positions.summary&&positions.summary<positions.throne);
 assert.deepEqual(errors,[]);
 console.log('Four consecutive Plinko rounds, visible difficulty, actual reel alignment and Evil/summary/Throne layout passed.');
} finally {await browser.close();}
