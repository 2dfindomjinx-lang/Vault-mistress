// Recording-based auditions. No oscillators, notes, synthesized impacts or noise generators.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { wav, loudness } from './synthesis.mjs';
const OUT=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(OUT,'../..');
const SRC=path.join(OUT,'sources/foley'),CACHE=path.join(SRC,'decoded'),SR=48000;
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(OUT,p));
const previous=JSON.parse(read('round3.html').toString().match(/<script id="round3-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const sources=JSON.parse(fs.readFileSync(path.join(SRC,'sources.json'),'utf8')).filter(s=>!s.error);
const sourceMap=new Map(sources.map(s=>[s.id,s]));
const index=JSON.parse(fs.readFileSync(path.join(CACHE,'index.json'),'utf8'));
const protectedFiles=['round3.html','round2.html','index.html','choices-round2.json'];
const protectedHashes=Object.fromEntries(protectedFiles.map(p=>[p,hash(read(p))]));
const liveHashes=Object.fromEntries(fs.readdirSync(path.join(ROOT,'public/sounds')).map(p=>[p,hash(fs.readFileSync(path.join(ROOT,'public/sounds',p)))]));
const sourceLicense=s=>s.license==='CC-BY-3.0'?'https://creativecommons.org/licenses/by/3.0/':s.license==='CC-BY-4.0'?'https://creativecommons.org/licenses/by/4.0/':s.license==='CC0-1.0'?'https://creativecommons.org/publicdomain/zero/1.0/':s.page;
function decoded(file){
 const item=index.find(i=>i.file===file);if(!item)throw new Error(`Missing decoded recording: ${file}`);
 const channels=item.channels.map(name=>{const b=fs.readFileSync(path.join(CACHE,name));return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4).slice();});
 return channels.length===1?[channels[0],channels[0].slice()]:channels.slice(0,2);
}
function clip(file,start=0,end=Infinity,trim=true){
 const source=decoded(file),n=source[0].length;
 let first=Math.round(start*SR),last=Math.min(n,Math.round(end*SR));
 if(trim){
  let peak=0;for(const ch of source)for(let i=first;i<last;i++)peak=Math.max(peak,Math.abs(ch[i]));
  const threshold=peak*.002;
  while(first<last&&Math.max(Math.abs(source[0][first]),Math.abs(source[1][first]))<threshold)first++;
  while(last>first&&Math.max(Math.abs(source[0][last-1]),Math.abs(source[1][last-1]))<threshold)last--;
  first=Math.max(Math.round(start*SR),first-Math.round(.008*SR));last=Math.min(n,last+Math.round(.03*SR));
 }
 if(last<=first)throw new Error(`Empty recording excerpt: ${file}`);
 return source.map(ch=>ch.slice(first,last));
}
function edges(channels,attack=.002,release=.018){
 const n=channels[0].length;
 for(const ch of channels)for(let i=0;i<n;i++)ch[i]*=Math.min(1,i/(attack*SR))*Math.min(1,(n-1-i)/(release*SR));
 return channels;
}
function loop(channels,crossfade=.12){
 const n=channels[0].length,x=Math.min(Math.round(crossfade*SR),Math.floor(n/5)),length=n-x;
 return channels.map(ch=>{
  const out=ch.slice(x);
  for(let i=0;i<x;i++){const amount=.5-.5*Math.cos(Math.PI*i/(x-1));out[length-x+i]=ch[n-x+i]*(1-amount)+ch[i]*amount;}
  return out;
 });
}
function mix(parts,seconds){
 const channels=[new Float32Array(Math.round(seconds*SR)),new Float32Array(Math.round(seconds*SR))];
 for(const {audio,at=0,gain=1}of parts)for(let c=0;c<2;c++)for(let i=0;i<audio[c].length;i++){
  const destination=i+Math.round(at*SR);if(destination>=0&&destination<channels[c].length)channels[c][destination]+=audio[c][i]*gain;
 }
 return channels;
}
function normalize(channels,target){
 let peak=0;for(const ch of channels)for(const v of ch){if(!Number.isFinite(v))throw new Error('Invalid sample');peak=Math.max(peak,Math.abs(v));}
 const level=loudness(channels);if(peak<.00001)throw new Error('Silent sound');
 const gain=Math.min(10**((target-level)/20),.88/peak);
 for(const ch of channels)for(let i=0;i<ch.length;i++)ch[i]*=gain;
 const waveform=Array.from({length:64},(_,j)=>{let p=0;for(let i=Math.floor(j*channels[0].length/64);i<Math.floor((j+1)*channels[0].length/64);i++)p=Math.max(p,Math.abs(channels[0][i]),Math.abs(channels[1][i]));return +(p/(peak*gain)).toFixed(3);});
 return {channels,peak:peak*gain,lufs:level+20*Math.log10(gain),waveform};
}
const audio={},inventory=[],events=previous.events.map(e=>({...e,variants:[]}));
const eventMap=new Map(events.map(e=>[e.id,e]));
fs.mkdirSync(path.join(OUT,'audio/foley'),{recursive:true});
function add(event,title,description,channels,recordingFiles,{looped=false,target=-27,edits='Silence trimmed; level matched; 2 ms attack / 18 ms release.'}={}){
 const group=eventMap.get(event),key=`${event}:foley-${String(group.variants.length+1).padStart(2,'0')}`;
 const conditioned=looped?loop(channels):edges(channels);
 const result=normalize(conditioned,target),bytes=wav(result.channels),filename=key.replaceAll('_','-').replace(':','-')+'.wav',filePath='audio/foley/'+filename;
 const credits=recordingFiles.map(({source,file,excerpt})=>{const s=sourceMap.get(source);return{author:s.author,title:s.title,source:s.page,license:s.license,licenseUrl:sourceLicense(s),recording:file,excerpt:excerpt||'full recording, leading/trailing silence trimmed',sourceSha256:s.sha256};});
 const entry={key,event,title,description,filename,path:filePath,origin:'licensed-recording-edit',recordingFiles,credits,edits:looped?'Recording excerpt, 120 ms seam crossfade, level matched. No synthetic layers.':edits,loop:looped,seconds:result.channels[0].length/SR,peak:+result.peak.toFixed(5),lufs:+result.lufs.toFixed(2),waveform:result.waveform,bytes:bytes.length,sha256:hash(bytes)};
 fs.writeFileSync(path.join(OUT,filePath),bytes);audio[key]={...entry,uri:'data:audio/wav;base64,'+bytes.toString('base64')};inventory.push(entry);group.variants.push(key);
}
// Separate physical takes from the source pack, never pitch-shifted clones.
for(let i=1;i<=8;i++){
 const file=`casino/card-slide-${i}.ogg`;
 add('card_flip',`Kart kaydırma ${i}`,'Kartın yüzeye sürtünmesi; doğal kâğıt dokusu.',clip(file),[{source:'casino',file}],{target:-27});
}
for(let i=1;i<=4;i++){
 const file=`casino/card-place-${i}.ogg`;
 add('card_flip',`Kart bırakma ${i}`,'Kart masaya inerken çıkan kısa temas.',clip(file),[{source:'casino',file}],{target:-27});
}

add('furnace_ignite','Çakmak · doğal kayıt','Çakmak taşı, tutuşma ve hafif gaz sesi.',clip('lighter.ogg'),[{source:'lighter',file:'lighter.ogg'}],{target:-24});
add('furnace_ignite','Çakmak taşı · kısa','Çakmağın üç fiziksel vuruşundan sonuncusu.',clip('lighter-takes.mp3',1.34,1.86),[{source:'lighter-takes',file:'lighter-takes.mp3',excerpt:'1.34–1.86 s; public MP3 preview'}],{target:-25});
add('furnace_ignite','Kapak ve ateş','Metal kapak kaydı, ardından ocağın alevi. İki kayıttan montaj.',mix([{audio:clip('zippo.flac'),gain:.85},{audio:edges(clip('fireloop.flac',.5,2.35,false),.025,.2),at:.20,gain:.72}],2.15),[{source:'zippo',file:'zippo.flac'},{source:'fireloop',file:'fireloop.flac',excerpt:'.50–2.35 s'}],{target:-24,edits:'Two recorded sources mixed; flame faded in over 25 ms; level matched.'});
add('furnace_ignite','Alev alma · işlenmiş efekt','Hazır alev alma efekti; kaynak sesin işlenmiş sürümü.',clip('catching.ogg'),[{source:'catching',file:'catching.ogg'}],{target:-25});

add('furnace_burn','Şömine çıtırtısı','Ayrı odun patlamaları ve aralarındaki doğal ateş dokusu.',clip('fireplace.wav',0,Infinity,false),[{source:'fireplace',file:'fireplace.wav'}],{looped:true,target:-29});
add('furnace_burn','Ocak alevi','Daha sürekli yanan ateşin gövdesi ve uğultusu.',clip('fireloop.flac',0,Infinity,false),[{source:'fireloop',file:'fireloop.flac'}],{looped:true,target:-30});
add('furnace_burn','Demirci ocağı','Kömür ve odun yanan gerçek bir demirci ocağından kesit.',clip('forge.ogg',1,9.12,false),[{source:'forge',file:'forge.ogg',excerpt:'1.00–9.12 s'}],{looped:true,target:-29});
add('furnace_burn','Ocak ve köz','Demirci ocağı ile yakın şömine çıtırtısının montajı.',mix([{audio:clip('forge.ogg',9,17.12,false),gain:.8},{audio:clip('fireplace.wav',0,Infinity,false),at:.45,gain:.38},{audio:clip('fireplace.wav',0,Infinity,false),at:4.6,gain:.3}],8.12),[{source:'forge',file:'forge.ogg',excerpt:'9.00–17.12 s'},{source:'fireplace',file:'fireplace.wav'}],{looped:true,target:-29});

for(let i=0;i<5;i++){
 const file=`impact/impactSoft_medium_00${i}.ogg`;
 add('crawl_contact',`Yumuşak temas ${i+1}`,'Yumuşak malzeme darbesi; Crawl teması için foley adayı.',clip(file),[{source:'impact',file}],{target:-31});
}
for(let i=0;i<3;i++){
 const file=`impact/footstep_carpet_00${i}.ogg`;
 add('crawl_contact',`Halı teması ${i+1}`,'Halı üzerindeki fiziksel temas kaydı; kaynak bir ayak sesi.',clip(file),[{source:'impact',file}],{target:-32});
}
for(const i of [1,2,4,8]){
 const file=`book/BookFlip${i}.wav`;
 add('jigsaw_reveal',`Kâğıt açılışı ${[1,2,4,8].indexOf(i)+1}`,'Gerçek sayfa çevirme dokusu, kısa açılış için.',clip(file),[{source:'book',file}],{target:-26});
}
for(let i=1;i<=2;i++){
 const file=`casino/cards-pack-open-${i}.ogg`;
 add('jigsaw_reveal',`Paket açılışı ${i}`,'Kart paketinin açılması; karton ve kâğıt hareketi.',clip(file),[{source:'casino',file}],{target:-26});
}

// Keep accepted sounds and the supplied Drain MP3 byte-for-byte in the preview.
for(const item of previous.kept)audio[item.key]=previous.audio[item.key];
audio['drain:provided']=previous.audio['drain:provided'];
const payload={...previous,events,audio,recordingSources:sources.map(s=>({...s,licenseUrl:sourceLicense(s)}))};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const creditHtml='<details class="kept"><summary>Kaynak kayıtlar ve lisanslar</summary>'+sources.map(s=>`<p class="footnote"><a href="${escape(s.page)}" target="_blank" rel="noopener">${escape(s.title)}</a> — ${escape(s.author)} · <a href="${sourceLicense(s)}" target="_blank" rel="noopener">${s.license}</a>. Düzenleme: kesit alma, seviye eşleme; belirtilen kayıtlarda döngü geçişi veya montaj.</p>`).join('')+'<p class="footnote">Kaynak sahipleri bu projeyle ilişkili değildir. Tek tek indirilen seslerin kaynak bilgileri tercih dosyasında da yer alır.</p></details>';
let template=read('round3-template.html').toString()
 .replaceAll('round3','foley').replaceAll('Round 3','Foley').replaceAll('Sound Atelier 03','Sound Atelier · Foley')
 .replace('Son <em>dokunuşlar.</em>','Malzemenin <em>kendi sesi.</em>')
 .replace('Ses seçmediğin beş alan için 12’şer yeni alternatif. Temaslar, kısa motifler ve kuru ateş dokuları. Her ses tek başına çalar.','Kart, kâğıt, çakmak ve ateş kayıtları. Doğal hışırtı ve çıtırtıları korunmuş fiziksel efektler; kaynağı ve yapılan düzenleme her seçenekte yazıyor.')
 .replace('60 yeni alternatif',`${inventory.length} fiziksel efekt`)
 .replace('12 sesi sırayla dinle','Sırayla dinle')
 .replace("+'<small>12</small>'","+'<small>'+event.variants.length+'</small>'")
 .replace("$('event-title').textContent=event.title;","$('event-title').textContent=event.title;$('tour').textContent=event.variants.length+' sesi sırayla dinle';")
 .replace('6 saniyelik dokular. Döngü ile uzun dinleyebilirsin.','Gerçek ateş kayıtları ve belirtilen montaj. Doğal uğultu korunur; döngü ile uzun dinleyebilirsin.')
 .replace('${escape(a.description)}</p><div class="player">','${escape(a.description)}</p><p class="footnote" style="margin:0 0 9px">${a.credits.map(c=>`<a href="${escape(c.source)}" target="_blank" rel="noopener">${escape(c.author)}</a> · ${escape(c.license)}`).join(" + ")}</p><div class="player">')
 .replace("file:clip.filename,audioKey:key};","file:clip.filename,audioKey:key,credits:clip.credits,edits:clip.edits};")
 .replace('</main><footer',creditHtml+'</main><footer');
// Replacement above changes the data element id but the insertion token was uppercase.
template=template.replace('__ROUND3_DATA__','__FOLEY_DATA__');
fs.writeFileSync(path.join(OUT,'foley-template.html'),template);
fs.writeFileSync(path.join(OUT,'foley.html'),template.replace('__FOLEY_DATA__',JSON.stringify(payload).replaceAll('<','\\u003c')));
const manifest={scope:'Recording-based auditions only. No src/ or public/ changes. Earlier choices and Drain unchanged.',count:inventory.length,events,preferences:previous.preferences,sources:payload.recordingSources,audio:inventory,protectedHashes,liveHashes};
fs.writeFileSync(path.join(OUT,'manifest-foley.json'),JSON.stringify(manifest,null,2));
const credits=['# Recording sources and attribution','','These are edited third-party physical effects, not original AI-generated recordings. Natural material noise is preserved. Files are audition-only.','',...sources.map(s=>`- **${s.title}** — ${s.author}. Source: ${s.page}. License: ${s.license} (${sourceLicense(s)}).`),'','## Edits and file mapping','',...inventory.map(a=>`- **${a.filename}**: ${a.credits.map(c=>`${c.author}, ${c.recording} (${c.excerpt}), ${c.license}`).join(' + ')}. Edits: ${a.edits}`),'','CC-BY files require retaining attribution, the license link, and an indication of edits when integrated or redistributed. This information is embedded in the HTML and selected-file JSON. No endorsement is implied.'];
fs.writeFileSync(path.join(OUT,'FOLEY-CREDITS.md'),credits.join('\n'));
for(const [p,digest]of Object.entries(protectedHashes))if(hash(read(p))!==digest)throw new Error(`Previous file changed: ${p}`);
for(const [p,digest]of Object.entries(liveHashes))if(hash(fs.readFileSync(path.join(ROOT,'public/sounds',p)))!==digest)throw new Error(`Live sound changed: ${p}`);
console.log(JSON.stringify({physicalAlternatives:inventory.length,groups:events.map(e=>[e.id,e.variants.length]),keptChoices:previous.kept.length,htmlMB:+(read('foley.html').length/1048576).toFixed(2),sourceRecordings:sources.length,liveFilesUnchanged:Object.keys(liveHashes).length},null,2));
