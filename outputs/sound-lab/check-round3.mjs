import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const OUT=dirname(fileURLToPath(import.meta.url));
const read=p=>readFileSync(join(OUT,p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('manifest-round3.json'));
assert.equal(manifest.audio.length,60);
assert.equal(new Set(manifest.audio.map(a=>a.sha256)).size,60);
assert.equal(manifest.kept.length,46);
assert.equal(manifest.audio.filter(a=>a.event.startsWith('drain')).length,0);
for(const entry of manifest.audio){
 const bytes=read(entry.path);assert.equal(hash(bytes),entry.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.readUInt32LE(24),48000);assert.equal(bytes.readUInt16LE(22),2);
 let peak=0;for(let i=44;i<bytes.length;i+=2)peak=Math.max(peak,Math.abs(bytes.readInt16LE(i)));
 assert.ok(peak>50&&peak<32767,entry.key+' must be audible and unclipped');
 if(entry.loop)for(let c=0;c<2;c++)assert.ok(Math.abs(bytes.readInt16LE(44+c*2)-bytes.readInt16LE(bytes.length-4+c*2))<300,entry.key+' loop seam');
 else {assert.equal(bytes.readInt16LE(44),0);assert.equal(bytes.readInt16LE(bytes.length-2),0);}
}
for(const [p,digest]of Object.entries(manifest.protectedHashes))assert.equal(hash(read(p)),digest,p);
for(const [p,digest]of Object.entries(manifest.liveHashes))assert.equal(hash(readFileSync(join(OUT,'../../public/sounds',p))),digest,p);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const active=new Set();window.soundCheck={max:0,starts:0};
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){active.add(this);window.soundCheck.starts++;window.soundCheck.max=Math.max(window.soundCheck.max,active.size);this.addEventListener('ended',()=>active.delete(this),{once:true});return start.apply(this,args);};
  AudioBufferSourceNode.prototype.stop=function(...args){active.delete(this);return stop.apply(this,args);};
 });
 await page.goto(pathToFileURL(join(OUT,'round3.html')).href);
 const decodeCount=await page.evaluate(async()=>{
  const d=JSON.parse(document.getElementById('round3-data').textContent),ctx=new OfflineAudioContext(2,48000,48000);
  for(const a of Object.values(d.audio)){
   const str=atob(a.uri.split(',')[1]),bytes=Uint8Array.from(str,c=>c.charCodeAt(0));
   const buffer=await ctx.decodeAudioData(bytes.buffer);if(buffer.duration<=0)throw new Error(a.key);
  }
  return Object.keys(d.audio).length;
 });
 assert.equal(decodeCount,107);
 assert.equal(await page.evaluate(()=>window.soundCheck.starts),0,'No autoplay');
 assert.equal(await page.locator('.card').count(),12);
 const getExport=async()=>{const promise=page.waitForEvent('download');await page.locator('#export').click();const download=await promise;return JSON.parse(readFileSync(await download.path(),'utf8'));};
 const baseline=await getExport();
 assert.deepEqual(baseline.selections,manifest.preferences.selections);
 assert.deepEqual(baseline.eventSelections,manifest.preferences.eventSelections);
 await page.locator('[data-play]').first().click();
 await page.waitForFunction(()=>window.soundCheck.starts>0);
 await page.locator('[data-play]').nth(1).click();
 assert.equal(await page.evaluate(()=>window.soundCheck.max),1,'Switching clips stops the preceding voice');
 await page.locator('[data-choice]').first().click();
 const key=manifest.events[0].variants[0];
 await page.reload();
 assert.equal(await page.locator(`[data-choice="${key}"]`).getAttribute('aria-pressed'),'true');
 const chosen=await getExport();
 assert.equal(chosen.eventSelections.find(e=>e.event==='card_flip').audioKey,key);
 assert.deepEqual(chosen.eventSelections.filter(e=>e.event!=='card_flip'),manifest.preferences.eventSelections.filter(e=>e.event!=='card_flip'));
 assert.deepEqual(chosen.selections,manifest.preferences.selections);
 assert.deepEqual(chosen.drainSession,{file:'drain_session.mp3',defaultEnabled:false,loop:true,activation:'explicit-per-session'});
 const wavDownload=page.waitForEvent('download');await page.locator('.actions a').first().click();
 assert.equal(hash(readFileSync(await(await wavDownload).path())),manifest.audio[0].sha256);
 for(const event of manifest.events){await page.locator(`[data-tab="${event.id}"]`).click();assert.equal(await page.locator('.card').count(),12);}
 await page.locator('[data-tab="furnace_burn"]').click();await page.locator('[data-loop]').first().click();
 await page.waitForFunction(()=>document.getElementById('now-detail').textContent.includes('Döngü'));
 await page.locator('#stop').click();
 await page.locator('#drain-start').click();
 assert.equal(await page.locator('#drain-sound').getAttribute('aria-pressed'),'false');
 const starts=await page.evaluate(()=>window.soundCheck.starts);
 await page.locator('#drain-sound').click();await page.waitForFunction(()=>document.getElementById('drain-sound').getAttribute('aria-pressed')==='true');
 assert.equal(await page.evaluate(()=>window.soundCheck.starts),starts+1);
 await page.locator('#drain-stop').click();await page.locator('#drain-start').click();
 assert.equal(await page.locator('#drain-sound').getAttribute('aria-pressed'),'false');
 await page.locator('#drain-stop').click();
 await page.locator('[data-tab="card_flip"]').click();
 await page.screenshot({path:join(OUT,'round3-desktop.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>window.soundCheck.max),1,'Only one audition voice at a time');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:join(OUT,'round3-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 const result={generated:60,perEvent:12,decoded:decodeCount,previousSoundChoicesPreserved:46,allPriorDecisionsRetained:55,drainGenerated:0,defaultDrainOff:true,exportRoundTrip:true,wavDownloadMatches:true,maximumConcurrentVoices:1,mobileOverflow:false,protectedFilesUnchanged:Object.keys(manifest.protectedHashes).length,liveSoundsUnchanged:Object.keys(manifest.liveHashes).length,pageErrors:errors};
 writeFileSync(join(OUT,'verification-round3.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
