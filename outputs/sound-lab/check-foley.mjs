import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const OUT=path.dirname(fileURLToPath(import.meta.url)),read=p=>fs.readFileSync(path.join(OUT,p));
const manifest=JSON.parse(read('manifest-foley.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(manifest.count,34);
for(const a of manifest.audio){assert.equal(hash(read(a.path)),a.sha256);assert.ok(a.credits.length>0);assert.ok(a.peak>0&&a.peak<1);}
for(const [p,h] of Object.entries(manifest.protectedHashes))assert.equal(hash(read(p)),h);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop,active=new Set();window.audioCheck={starts:0,max:0};
  AudioBufferSourceNode.prototype.start=function(...a){active.add(this);window.audioCheck.starts++;window.audioCheck.max=Math.max(window.audioCheck.max,active.size);this.addEventListener('ended',()=>active.delete(this),{once:true});return start.apply(this,a);};
  AudioBufferSourceNode.prototype.stop=function(...a){active.delete(this);return stop.apply(this,a);};
 });
 await page.goto(pathToFileURL(path.join(OUT,'foley.html')).href);
 assert.equal(await page.locator('.card').count(),12);
 const decoded=await page.evaluate(async()=>{
  const d=JSON.parse(document.getElementById('foley-data').textContent),ctx=new OfflineAudioContext(2,1,48000);
  for(const a of Object.values(d.audio)){const b=Uint8Array.from(atob(a.uri.split(',')[1]),c=>c.charCodeAt(0));const audio=await ctx.decodeAudioData(b.buffer);if(!audio.duration)throw new Error(a.key);}
  return Object.keys(d.audio).length;
 });
 assert.equal(decoded,81);assert.equal(await page.evaluate(()=>window.audioCheck.starts),0);
 const exported=async()=>{const promise=page.waitForEvent('download');await page.locator('#export').click();return JSON.parse(fs.readFileSync(await(await promise).path(),'utf8'));};
 const baseline=await exported();assert.deepEqual(baseline.selections,manifest.preferences.selections);assert.deepEqual(baseline.eventSelections,manifest.preferences.eventSelections);
 await page.locator('[data-play]').first().click();await page.waitForFunction(()=>window.audioCheck.starts>0);
 await page.locator('[data-play]').nth(1).click();assert.equal(await page.evaluate(()=>window.audioCheck.max),1);
 for(const event of manifest.events){await page.locator(`[data-tab="${event.id}"]`).click();assert.equal(await page.locator('.card').count(),event.variants.length);}
 await page.locator('[data-tab="furnace_burn"]').click();
 await page.locator('[data-choice]').nth(2).click();
 const chosen=await exported(),fire=chosen.eventSelections.find(x=>x.event==='furnace_burn');
 assert.equal(fire.choice,'foley');assert.equal(fire.credits[0].license,'CC-BY-4.0');assert.ok(fire.credits[0].source.includes('WWS_Fireoftheforge'));assert.ok(fire.edits.includes('crossfade'));
 assert.deepEqual(chosen.selections,manifest.preferences.selections);
 assert.deepEqual(chosen.eventSelections.filter(e=>e.event!=='furnace_burn'),manifest.preferences.eventSelections.filter(e=>e.event!=='furnace_burn'));
 await page.locator('[data-loop]').nth(2).click();await page.waitForFunction(()=>document.getElementById('now-detail').textContent.includes('Döngü'));
 await page.locator('#stop').click();await page.locator('#drain-start').click();assert.equal(await page.locator('#drain-sound').getAttribute('aria-pressed'),'false');await page.locator('#drain-stop').click();
 const promise=page.waitForEvent('download');await page.locator('.actions a').first().click();assert.equal(hash(fs.readFileSync(await(await promise).path())),manifest.audio.find(a=>a.key===manifest.events.find(e=>e.id==='furnace_burn').variants[0]).sha256);
 await page.locator('[data-tab="card_flip"]').click();await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:path.join(OUT,'foley-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(OUT,'foley-mobile.png')});
 assert.deepEqual(errors,[]);
 const result={physicalAlternatives:34,decoded,priorSoundChoicesPreserved:46,exportPreserves55Decisions:true,selectedFileCreditsExported:true,oneVoiceAtATime:true,wavDownloadMatches:true,drainStillDefaultOff:true,mobileOverflow:false,pageErrors:errors};
 fs.writeFileSync(path.join(OUT,'verification-foley.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
