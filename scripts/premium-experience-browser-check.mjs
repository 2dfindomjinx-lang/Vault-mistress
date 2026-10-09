import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const fixture = `
import {createRoot} from 'react-dom/client';import {useState} from 'react';
import {CollectionVitrine} from './src/components/CollectionVitrine';import {TributePanel} from './src/components/TributePanel';import {CosmeticShop} from './src/components/CosmeticShop';import {AppLicenseShelf} from './src/components/AppLicenseShelf';import {CratesPanel} from './src/components/CratesPanel';import {WheelVerdict} from './src/components/WheelVerdict';
import {buildShrineStatus} from './src/lib/shrine';import {SAMPLE_CRATE_ITEMS,CRATE_TYPES,getCrateItemImageUrl} from './src/lib/crates';import {getItemAvatarSlot} from './src/lib/avatar-slots';
const chosen=Object.entries(SAMPLE_CRATE_ITEMS).find(([id,item])=>item.rarity==='legendary'&&getItemAvatarSlot(id));const [itemId,item]=chosen;const title={id:'demo-title',name:'Her Treasure',description:'A title.',price:500};
const cosmetic={id:'demo-color',name:'Rose',description:'A name color.',type:'username-color',color:'#ff78a4',price:500};
function App(){const [mode,setMode]=useState('vitrine'),[owned,setOwned]=useState(0),[shrine,setShrine]=useState(buildShrineStatus(0,[]));const [pending,setPending]=useState(false);return <><nav>{['vitrine','shrine','cosmetic','programs','cases','wheel'].map(m=><button onClick={()=>setMode(m)} key={m}>{m}</button>)}</nav>
{mode==='vitrine'&&<CollectionVitrine item={{itemId,name:item.name,rarity:item.rarity,imageUrl:getCrateItemImageUrl(itemId,item.image_url),pricePm:50,buybackPm:40,ownedFromShop:owned,ownedInInventory:owned,sellValueCoins:item.sell_value}} initialOwned={0} equipped={{}} disabled={false} pending={pending} money={100} error='' onBuy={()=>{window.buyCalls=(window.buyCalls||0)+1;setPending(true);setTimeout(()=>{setOwned(1);setPending(false)},300)}} onClose={()=>setMode('shrine')}/>}
{mode==='shrine'&&<TributePanel coins={100000} affection={100} hideAffectionOffer shrine={shrine} onTribute={()=>{}} onShrinePurchase={async amount=>{window.offeringCalls=(window.offeringCalls||0)+1;return new Promise(resolve=>{window.resolveOffering=ok=>{const next=buildShrineStatus(amount,[]);if(ok)setShrine(next);resolve(ok?next:null)}})}}/>}
{mode==='cosmetic'&&<CosmeticShop coins={100000} equippedCosmeticIds={{}} ownedCosmeticIds={[]} ownedTitleIds={[]} premiumTitle={title} shopItems={[cosmetic]} onEquipCosmetic={()=>{}} onPurchaseCosmetic={()=>{}} onPurchaseTitle={()=>{}}/>}
{mode==='programs'&&<AppLicenseShelf money={100} onPurchased={()=>{}}/>}
{mode==='cases'&&<CratesPanel coins={100000} crates={Object.entries(CRATE_TYPES).filter(([,c])=>c.enabled).map(([crate_type,c])=>({...c,crate_type}))} inventory={[]} onSellItem={async()=>({success:true})} onOpenCrate={async(type,quantity=1)=>{window.openCalls=(window.openCalls||0)+1;return {success:true,result:{items:Array.from({length:quantity},()=>({...item,item_id:itemId,variant:'normal'})),item:{...item,item_id:itemId,variant:'normal'},newCoins:90000}}}}/>}
{mode==='wheel'&&<div data-wheel-narrow style={{width:85}}><WheelVerdict kind='chastity' label='+4h'/></div>}</>};createRoot(document.getElementById('root')).render(<App/>);
`;
const built = await build({ outfile: "tmp/premium-fixture.js", stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, platform: "browser", define: { "process.env": "{}" }, jsx: "automatic", plugins: [{ name: "fixture", setup(b) {
  b.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'import{createElement}from"react";export default function Image({fill,unoptimized,quality,sizes,priority,preload,...p}){return createElement("img",{...p,style:fill?{position:"absolute",width:"100%",height:"100%",inset:0,...p.style}:p.style})}', resolveDir: process.cwd(), loader: "js" }));
  b.onLoad({ filter: /[\\/]lib[\\/]sound\.ts$/ }, () => ({ contents: "export const emitSoundEvent=()=>{};export const playSoundLoop=()=>()=>{};export const unlockAudio=()=>{}", loader: "js" }));
} }] });
const js = built.outputFiles.find(file=>file.path.endsWith(".js")).text;
const modules = built.outputFiles.find(file=>file.path.endsWith(".css"))?.text ?? "";
const tw = await postcss([tailwind()]).process('@import "tailwindcss" source(none); @source "../src/components";', { from: path.resolve("scripts/premium-fixture.css") });
const css = tw.css + modules;
const server = createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return;}
  if(pathname==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end(css);return;}
  if(pathname==='/api/user/app-licenses'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({programs:[{slug:'discipline',title:'Principessa’s Discipline',description:'The Android program.',link:'#',pricePm:20,code:null,bound:false,deviceName:null},{slug:'wallpaper',title:'Wallpaper Control',description:'Wallpapers chosen by Principessa.',link:'#',pricePm:25,code:null,bound:false,deviceName:null},{slug:'techdom-windows',title:'Principessa Techdom',description:'Techdom sessions.',link:'#',pricePm:50,code:'TECHDOM-DEMO',bound:true,deviceName:'Demo PC'}]}));return;}
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{background:#120a12;color:#faeaf1}nav{display:flex;gap:14px;padding:15px}</style><div id="root"></div><script src="/fixture.js"></script>');return;}
  const file=path.resolve('public','.'+decodeURIComponent(pathname));const publicRoot=path.resolve('public')+path.sep;
  if(file.startsWith(publicRoot)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':file.endsWith('.mp4')?'video/mp4':'image/png');res.end(fs.readFileSync(file));return;}
  res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
fs.mkdirSync('tmp/premium-review',{recursive:true});
let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [1440,768,390]){
    const page=await browser.newPage({viewport:{width,height:950}});const errors=[],media=[];
    page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('request',req=>{if(req.url().endsWith('.mp4'))media.push(req.url());});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if(process.argv.includes('--cases-only')){
      await page.getByRole('button',{name:'Close preview',exact:true}).click();
      await page.getByRole('button',{name:'cases',exact:true}).click();
      await page.evaluate(()=>{window.caseReveals=0;window.addEventListener('court:crate-opened',()=>window.caseReveals++);});
      await page.getByRole('button',{name:'Quick opening · Off'}).click();
      const started=Date.now();
      await page.getByRole('button').filter({hasText:/^Open(?: |$)/}).first().click();
      await page.getByText('New to your inventory',{exact:true}).first().waitFor();
      assert.ok(Date.now()-started<1600,'Quick opening reveals promptly with an immediate API response');
      await page.getByRole('button',{name:'Back to Cases',exact:true}).click();
      for(const quantity of [1,2]){
        await page.getByRole('group').filter({has:page.getByRole('button',{name:'2',exact:true})}).first().getByRole('button',{name:String(quantity),exact:true}).click();
        await page.evaluate(()=>{
          window.originalRaf=window.requestAnimationFrame;
          window.requestAnimationFrame=()=>0;
          Object.defineProperty(document,'hidden',{configurable:true,value:true});
          Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
          document.dispatchEvent(new Event('visibilitychange'));
        });
        // DOM click avoids Playwright's rAF-based actionability checks, also
        // intentionally suspended here to simulate a background browser tab.
        await page.getByRole('button').filter({hasText:/^Open(?: |$)/}).first().evaluate(button=>button.click());
        await page.waitForFunction(expected=>window.caseReveals>=expected,quantity+1,{polling:50,timeout:3000});
        await page.evaluate(()=>{window.requestAnimationFrame=window.originalRaf;delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
        assert.equal(await page.getByRole('button',{name:'Back to Cases',exact:true}).isDisabled(),false,'Background opening completes without a visible animation frame');
        await page.getByRole('button',{name:'Back to Cases',exact:true}).click();
      }
      assert.equal(await page.evaluate(()=>window.openCalls),3,'Each opening requests and reveals exactly once');
      assert.deepEqual(errors,[]);await page.close();continue;
    }
    if(process.argv.includes('--programs-only')){
      await page.getByRole('button',{name:'Close preview',exact:true}).click();
      await page.getByRole('button',{name:'programs',exact:true}).click();
      await page.getByRole('button',{name:'Watch Principessa Techdom preview'}).waitFor();
      assert.equal(await page.locator('.court-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>=1024?3:width>=640?2:1);
      assert.equal(await page.locator('article').count(),3);
      assert.ok(await page.locator('article img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)),'Program media loads');
      assert.ok(await page.locator('article').last().getByText(/Restore on a new PC/).isVisible());
      assert.ok(await page.getByRole('link',{name:'Download free desktop pet'}).isVisible());
      assert.equal(media.length,0,'No eager video download');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
      await page.getByRole('button',{name:'Watch Principessa Techdom preview'}).click();
      assert.equal(await page.locator('video').getAttribute('src'),'/programs/principessa-techdom.mp4');
      await page.getByRole('button',{name:'Close preview',exact:true}).click();
      assert.deepEqual(errors,[]);await page.close();continue;
    }
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button',{name:/Acquire ·/}).click();await page.getByText('Received',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.buyCalls),1);
    await page.waitForTimeout(850);await page.screenshot({animations:"disabled",path:`tmp/premium-review/vitrine-${width}.png`});
    await page.getByRole('button',{name:'Close preview',exact:true}).click();
    const offering=page.getByRole('button').filter({hasText:'Royal Offering'});await offering.click();
    assert.equal(await page.getByRole('button',{name:'Close offering'}).isDisabled(),true);
    assert.equal(await page.locator('[data-phase=accepted]').count(),0,'No success before server confirmation');
    await page.evaluate(()=>window.resolveOffering(false));await page.locator('[data-phase=failed]').waitFor();
    await page.getByRole('button',{name:'Close offering'}).click();await offering.click();await page.evaluate(()=>window.resolveOffering(true));await page.locator('[data-phase=accepted]').waitFor();
    await page.screenshot({animations:"disabled",path:`tmp/premium-review/shrine-${width}.png`});
    assert.equal(await page.evaluate(()=>window.offeringCalls),2);await page.getByRole('button',{name:'Close offering'}).click();
    await page.getByRole('button',{name:'cosmetic',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:/^Preview(?: on your profile)?$/}).count(),0,'Shop uses its inline previews without another dialog');
    await page.getByRole('button',{name:'programs',exact:true}).click();await page.getByRole('button',{name:/Watch .* preview/}).first().waitFor();
    assert.equal(media.length,0,'No video request before opening its preview');await page.getByRole('button',{name:/Watch .* preview/}).first().click();assert.equal(await page.locator('video').getAttribute('preload'),'none');await page.getByRole('button',{name:'Close preview',exact:true}).click();assert.equal(await page.locator('video').count(),0);
    await page.getByRole('button',{name:'cases',exact:true}).click();await page.getByRole('button',{name:'Quick opening · Off'}).click();
    const open=page.getByRole('button').filter({hasText:/^Open(?: |$)/}).first();await open.click();await page.getByText('New to your inventory',{exact:true}).waitFor({timeout:7000});
    assert.equal(await page.evaluate(()=>window.openCalls),1);
    const box=await page.getByRole('dialog').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=width+1,'Modal fits viewport');
    await page.getByRole('button',{name:'Back to Cases',exact:true}).click();await page.getByRole('button',{name:'wheel',exact:true}).click();assert.ok(await page.locator('[data-wheel-narrow]').evaluate(el=>el.scrollWidth<=el.clientWidth),'Wheel verdict fits its narrow mobile column');
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log(process.argv.includes('--cases-only')?'Cases passed at 1440/768/390px: fast quick reveal, single and multi opens with suspended rAF, hidden-tab completion and exactly-once reveals. API fixtures only; no real purchases.':process.argv.includes('--programs-only')?'Programs passed at 1440/768/390px: 3/2/1 columns, loaded images, Techdom activation copy, free pet download, on-demand video, no overflow. API fixtures only; no real purchases.':'Premium UI passed at 1440/768/390px: accepted/failed offers, no premature reward, acquire receipt, inline shop previews, on-demand video, quick case reveal, viewport containment. API fixtures only; no real purchases.');
} finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
