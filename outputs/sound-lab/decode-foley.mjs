import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const OUT=path.join(path.dirname(fileURLToPath(import.meta.url)),'sources/foley');
const CACHE=path.join(OUT,'decoded');fs.mkdirSync(CACHE,{recursive:true});
const files=['fireplace.wav','fireloop.flac','zippo.flac','lighter.ogg','lighter-takes.mp3','forge.ogg','catching.ogg'];
for(const pack of ['casino','book','impact'])for(const name of fs.readdirSync(path.join(OUT,pack))){
 if(pack==='casino'&&/^card-(place|slide|shove)|^cards-pack-(open|take)/.test(name)||pack==='book'&&/^BookFlip(1|2|3|4|5|6|8|9|10|11|12|13)\.wav$/.test(name)||pack==='impact'&&/^(impactSoft_(medium|heavy)|footstep_(carpet|wood))_00[0-4]\.ogg$/.test(name))files.push(`${pack}/${name}`);
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.goto('about:blank');
 const index=[];
 for(const file of files){
  const result=await page.evaluate(async base64=>{
   const text=atob(base64),bytes=Uint8Array.from(text,c=>c.charCodeAt(0)),ctx=new OfflineAudioContext(2,1,48000);
   const b=await ctx.decodeAudioData(bytes.buffer),channels=[];
   for(let c=0;c<b.numberOfChannels;c++){
    const raw=new Uint8Array(b.getChannelData(c).buffer);let text='';
    for(let i=0;i<raw.length;i+=16384)text+=String.fromCharCode(...raw.subarray(i,i+16384));channels.push(btoa(text));
   }
   return{duration:b.duration,sampleRate:b.sampleRate,channels};
  },fs.readFileSync(path.join(OUT,file)).toString('base64'));
  const key=file.replaceAll('/','--'),channels=result.channels.map((base64,c)=>{
   const filename=key+`.${c}.f32`;fs.writeFileSync(path.join(CACHE,filename),Buffer.from(base64,'base64'));return filename;
  });
  index.push({file,duration:result.duration,sampleRate:result.sampleRate,channels});
 }
 fs.writeFileSync(path.join(CACHE,'index.json'),JSON.stringify(index,null,2));
 const lighter=index.find(f=>f.file==='lighter-takes.mp3'),raw=fs.readFileSync(path.join(CACHE,lighter.channels[0]));
 const samples=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4),rms=[];
 for(let i=0;i<samples.length;i+=4800){let sum=0;for(let j=i;j<Math.min(i+4800,samples.length);j++)sum+=samples[j]**2;rms.push(Math.round(20*Math.log10(Math.sqrt(sum/4800)+1e-9)));}
 console.log(JSON.stringify({decoded:index.length,recordings:index.slice(0,7).map(x=>({file:x.file,seconds:+x.duration.toFixed(3)})),lighterRms100ms:rms}));
}finally{await browser.close();}
