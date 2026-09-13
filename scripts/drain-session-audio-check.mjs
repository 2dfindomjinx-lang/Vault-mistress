// Isolated real TributePanel + native MP3 playback; no backend or payments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import {createRoot} from 'react-dom/client';
    import {TributePanel} from './src/components/TributePanel';
    const root = createRoot(document.getElementById('app'));
    window.batches = []; window.syncOk = true;
    let settings = {coins:10000, soundVolume:1, gameplaySoundEnabled:true};
    window.renderFixture = (next = {}) => {
      settings = {...settings,...next};
      root.render(<TributePanel {...settings} affection={100} hideAffectionOffer onTribute={()=>{}}
        shrine={{revealedMemories:[{path:'/shrine/shrine_1.webp',title:'Memory'}],level:1,totalSpent:10000,unlockedImageCount:1,availableImageCount:1,coinsUntilNextUnlock:10000,topWorshippers:[]}}
        onDrainSessionSync={async (amount,final)=>{window.batches.push({amount,final});return window.syncOk;}} />);
    };
    window.unmountFixture = () => root.unmount();
    window.renderFixture();
  ` },
  bundle:true, write:false, outfile:'tmp/drain-audio-fixture.js', platform:'browser', jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},
});
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  let mp3Requests = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const assetPath = url.pathname === '/_next/image' ? url.searchParams.get('url') : url.pathname;
    if (assetPath === '/sounds/drain_session.mp3') mp3Requests++;
    const publicRoot = path.resolve('public');
    const asset = path.resolve(publicRoot, '.' + assetPath);
    if (asset.startsWith(publicRoot+path.sep) && fs.existsSync(asset) && fs.statSync(asset).isFile()) return route.fulfill({path:asset});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><main id="app"></main>'});
  });
  await page.goto('http://drain-audio.invalid/');
  await page.addStyleTag({content:bundle.outputFiles.find(file=>file.path.endsWith('.css')).text + '\nimg{pointer-events:none}.pointer-events-none{pointer-events:none}.fixed{position:fixed}'});
  await page.clock.install();
  await page.evaluate(() => {
    const NativeAudio = window.Audio;
    window.voices = [];
    window.Audio = function(src) { const audio = new NativeAudio(src); window.voices.push(audio); return audio; };
  });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const start = () => page.getByRole('button',{name:'Start Draining',exact:true}).click();
  const stop = () => page.getByRole('button',{name:'Stop',exact:true}).click();
  const sound = page.getByRole('button',{name:'Drain session sound',exact:true});
  await start();
  assert.equal(await sound.getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>window.voices.length),0);
  assert.equal(mp3Requests,0,'Do not download or play before explicit sound opt-in');
  await sound.click();
  await page.waitForFunction(()=>window.voices[0]?.currentTime > 0);
  assert.deepEqual(await page.evaluate(()=>({loop:window.voices[0].loop,volume:window.voices[0].volume,muted:window.voices[0].muted})),{loop:true,volume:1,muted:false});
  await page.evaluate(()=>window.renderFixture({soundVolume:.3,gameplaySoundEnabled:false}));
  await page.waitForFunction(()=>window.voices[0].muted && window.voices[0].volume === .3);
  await page.evaluate(()=>window.renderFixture({gameplaySoundEnabled:true}));
  await page.clock.runFor(2600);
  assert.ok(await page.locator('[data-drain-popup]').count() >= 3,'Drain popups still spawn');
  const drained = await page.evaluate(()=>{
    const text = Array.from(document.querySelectorAll('p')).find(p=>p.textContent.trim().startsWith('Drained:')).textContent;
    const amount = Number(text.match(/Drained:\s*([\d,]+)/)[1].replaceAll(',',''));
    Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Stop').click();
    return amount;
  });
  assert.equal(await sound.count(),0);
  assert.equal(await page.evaluate(()=>window.voices[0].paused && !window.voices[0].hasAttribute('src')),true);
  assert.ok(drained>=200);
  assert.deepEqual(await page.evaluate(()=>window.batches.reduce((sum,b)=>sum+b.amount,0)),drained);
  assert.equal(await page.evaluate(()=>window.batches.at(-1).final),true);
  assert.equal(await page.locator('[data-drain-popup]').count(),0);
  await start();
  assert.equal(await sound.getAttribute('aria-pressed'),'false','New sessions never inherit sound-on');
  assert.equal(await page.evaluate(()=>window.voices.length),1);
  await sound.click();
  await page.waitForFunction(()=>window.voices[1].currentTime > 0);
  await sound.click();
  assert.equal(await page.evaluate(()=>window.voices[1].paused),true);
  await sound.click();
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await sound.getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>window.voices[1].paused),true);
  await page.evaluate(()=>{const audio=window.voices[1];const real=audio.play;audio.play=function(){audio.play=real;return Promise.reject(new Error('test playback failure'));};});
  await sound.click();
  await page.getByRole('status').filter({hasText:'Sound unavailable'}).waitFor();
  assert.equal(await sound.getAttribute('aria-pressed'),'false');
  await sound.click();
  await page.waitForFunction(()=>!window.voices[1].paused);
  await stop();
  await page.evaluate(()=>window.renderFixture({coins:100}));
  await start(); await sound.click();
  await page.clock.runFor(1100);
  assert.equal(await sound.count(),0,'Balance exhaustion removes/stops the audio control');
  assert.equal(await page.evaluate(()=>window.voices.at(-1).paused),true);
  await page.evaluate(()=>{window.syncOk=false;window.renderFixture({coins:10000});});
  await start(); await sound.click();
  await page.clock.runFor(10500);
  await page.getByText('Drain session stopped - out of coins.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.voices.at(-1).paused),true);
  await page.evaluate(()=>{window.syncOk=true;});
  await start(); await sound.click();
  await page.evaluate(()=>window.unmountFixture());
  assert.equal(await page.evaluate(()=>window.voices.every(audio=>audio.paused && !audio.hasAttribute('src'))),true);
  assert.deepEqual(errors,[]);
  console.log('Drain audio passed: real MP3 playback, no default playback/download, loop, manual toggle, volume/mute, new session reset, visibility, playback failure/retry, Stop, exhausted balance, rejected sync, unmount; popups and exact final Coin sync preserved.');
} finally { await browser.close(); }
