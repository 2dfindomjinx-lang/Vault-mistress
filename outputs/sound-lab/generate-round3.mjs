// New auditions only. Keeps every downloaded choice and every earlier audio file.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scene, finish, wav, loudness, SR, TAU, seedOf, frames, fade, random } from './dry-synthesis.mjs';

const OUT=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(OUT,'../..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>readFileSync(join(OUT,name),'utf8');
const preferences=JSON.parse(read('choices-round2.json'));
const previous=JSON.parse(read('round2.html').match(/<script id="round2-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const protectedPaths=['index.html','round2.html','manifest.json','manifest-round2.json','choices-round2.json'];
for(const dir of ['audio/velvet','audio/obsidian','audio/round2']) for(const name of readdirSync(join(OUT,dir))) protectedPaths.push(`${dir}/${name}`);
const protectedHashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(readFileSync(join(OUT,p)))]));
const liveHashes=Object.fromEntries(readdirSync(join(ROOT,'public/sounds')).map(name=>[name,hash(readFileSync(join(ROOT,'public/sounds',name)))]));

// Fixed-frequency damped materials: no noise source, filter sweep or air layer.
function contact(s,at,hz,gain=1,material='wood',pan=0,duration=.16){
  const materials={wood:[[1,1,38],[2.31,.29,68],[4.57,.075,100]],felt:[[1,1,50],[1.48,.1,90]],paper:[[1,.55,110],[1.83,.32,145],[3.12,.12,185]],stone:[[1,1,29],[2.71,.2,60],[4.95,.08,88]],ceramic:[[1,1,18],[2.756,.25,38],[5.4,.05,61]],metal:[[1,.7,22],[1.491,.4,30],[2.136,.18,46],[3.069,.06,70]],ember:[[1,.8,95],[1.79,.19,150],[3.21,.07,210]],rubber:[[1,1,38],[3,.11,65],[5,.035,95]]};
  for(const [ratio,level,decay] of materials[material]) s.tone(at,hz*ratio,duration,gain*level,{decay,attack:.0018,harmonic:0,pan});
}
const pluck=(s,t,hz,g=.8,d=.45,pan=0)=>s.pluck(t,hz,d,g,pan);
function sparks(s,at,count,span,gain=.35,low=260,high=1500){
  for(let i=0;i<count;i++) contact(s,at+(i/count)*span+(i?(.5+s.random()*.5)*span/count*.3:0),low+(.5+s.random()*.5)*(high-low),gain*(.45+(.5+s.random()*.5)*.55),'ember',s.random()*.3,.04);
}
const phrase=(s,notes,step=.08,g=.55,start=0)=>notes.forEach((hz,i)=>pluck(s,start+i*step,hz,g/(1+i*.13),.52,(i-(notes.length-1)/2)*.1));

const recipes={
  card_flip:[
    ['Papercut','Tek, keskin kart kenarı; kısa ve kuru.',.17,s=>{contact(s,0,1630,.44,'paper');contact(s,.029,860,.22,'felt');}],
    ['Velvet Tap','Keçeye bırakılan ağır kart; yumuşak ve baslı.',.24,s=>contact(s,0,195,.75,'felt',0,.15)],
    ['Ivory Tile','Mahjong taşı gibi net, porselen bir temas.',.32,s=>{contact(s,0,740,.38,'ceramic');contact(s,.043,440,.16,'stone');}],
    ['Book Corner','Sayfa köşesinin iki ayrı küçük tıkı.',.21,s=>{contact(s,0,1250,.38,'paper',-.12);contact(s,.055,1690,.21,'paper',.12);}],
    ['Walnut','Ahşap masa üstünde tok bir kart vuruşu.',.24,s=>contact(s,0,345,.58,'wood')],
    ['Silk String','Kısacık, sıcak bir pizzicato.',.33,s=>pluck(s,0,392,1,.28)],
    ['Detent','Mekanik bir yuvanın oturma hissi.',.18,s=>{contact(s,0,560,.5,'metal',0,.085);contact(s,.035,310,.33,'wood',0,.09);}],
    ['Double Touch','Parmak ve kart teması, iki net adım.',.27,s=>{contact(s,0,280,.45,'felt');contact(s,.085,920,.3,'paper');}],
    ['Slate','Koyu taş üzerinde tek, ağır tık.',.29,s=>contact(s,0,270,.6,'stone',0,.21)],
    ['Rubber Edge','Elastik ve yuvarlak, çok kısa bir pop.',.20,s=>contact(s,0,620,.65,'rubber',0,.14)],
    ['Silver Pin','İnce metalin küçük ve temiz çınlaması.',.30,s=>contact(s,0,1320,.22,'metal',0,.22)],
    ['Pixel Fold','İki küçük dijital nota, kısa bir dönüş.',.23,s=>{s.tone(0,740,.055,.42,{decay:28,attack:.002,harmonic:.16});s.tone(.06,554.37,.07,.3,{decay:32,attack:.002,harmonic:.16});}],
  ],
  furnace_ignite:[
    ['Matchbox','Kibrit teması, ardından birkaç ayrı köz.',.83,s=>{contact(s,0,1300,.48,'paper');sparks(s,.09,7,.36,.25);}],
    ['Flint','Çakmaktaşının iki vuruşu ve küçük kıvılcımlar.',.77,s=>{contact(s,0,840,.4,'stone');contact(s,.13,1190,.3,'metal');sparks(s,.2,5,.3,.28);}],
    ['Iron Latch','Demir mandal kapanır, ocak uyanır.',.94,s=>{contact(s,0,280,.5,'metal',-.08,.25);contact(s,.16,150,.45,'wood');sparks(s,.21,5,.34,.18,200,670);}],
    ['Hearth','Derin bir ocak vuruşu ve tok közler.',1.05,s=>{s.tone(0,78,.46,.38,{decay:10,attack:.008,harmonic:.08});sparks(s,.04,8,.68,.17,140,500);}],
    ['Lighter','Çakmağın kapağı, düğmesi, üç kuru çıtırtı.',.64,s=>{contact(s,0,1180,.22,'metal',0,.12);contact(s,.12,500,.32,'wood');sparks(s,.19,3,.18,.3,400,1800);}],
    ['Stone Kiln','Taş fırının tok sesi; sıcak ve kısa.',.92,s=>{contact(s,0,220,.56,'stone',0,.35);contact(s,.075,440,.22,'ceramic',0,.24);sparks(s,.2,4,.32,.22,160,650);}],
    ['Coal Break','Kömürün kırılan küçük parçaları.',.74,s=>{[0,.033,.095,.18,.28,.39].forEach((t,i)=>contact(s,t,175+i*41,.4/(1+i*.25),'stone',s.random()*.2,.09));}],
    ['Spark Crown','Parlak bir kıvılcım kümesi; metalik.',.79,s=>{[0,.057,.138].forEach((t,i)=>contact(s,t,1650-i*370,.22,'metal',i*.13-.13,.18));sparks(s,.21,5,.32,.16);}],
    ['Molten','Düşük, yoğun bir rezonans; küçük metal temasları.',1.12,s=>{s.tone(0,110,.64,.4,{decay:7,attack:.012,fm:.6,harmonic:.06});contact(s,.04,330,.15,'metal',0,.35);sparks(s,.32,4,.38,.14,220,680);}],
    ['Porcelain Stove','Seramik kapağın oturuşu ve ince közler.',.84,s=>{contact(s,0,510,.4,'ceramic',0,.3);contact(s,.08,290,.24,'stone');sparks(s,.18,6,.36,.12,700,1450);}],
    ['Arc Ignition','Üç kısa elektrik darbesi, ardından tok açılış.',.74,s=>{[0,.052,.112].forEach(t=>s.tone(t,880,.028,.23,{fm:1.7,decay:75,attack:.001,harmonic:.2}));s.tone(.18,146.83,.32,.36,{decay:12,attack:.005,harmonic:.1});}],
    ['Dark Ember','Sıcak, düşük bir nota ve seyrek kıvılcımlar.',1.00,s=>{pluck(s,0,98,1.8,.55);sparks(s,.045,7,.6,.18,250,850);}],
  ],
  crawl_contact:[
    ['Soft Palm','Avuç içinin yumuşak, tek teması.',.22,s=>contact(s,0,125,.72,'felt',0,.16)],
    ['Velvet Knee','Kumaşla örtülü dizin çok hafif vuruşu.',.25,s=>{contact(s,0,185,.58,'felt');contact(s,.047,280,.15,'felt');}],
    ['Marble Palm','Sert zeminde daha net bir el teması.',.26,s=>{contact(s,0,250,.6,'stone');contact(s,.015,970,.12,'paper');}],
    ['Wooden Floor','Ahşap zeminin kısa ve sıcak rezonansı.',.32,s=>contact(s,0,156,.68,'wood',0,.24)],
    ['Leather Contact','Deri üzerinde sıkı, orta frekanslı temas.',.22,s=>{contact(s,0,370,.42,'rubber');contact(s,.028,720,.11,'felt');}],
    ['Carpet','Halıya düşen çok boğuk bir vuruş.',.20,s=>s.tone(0,83,.14,.8,{decay:35,attack:.007,harmonic:.02})],
    ['Two Points','Avuç ve diz için birbirinden ayrılan iki temas.',.39,s=>{contact(s,0,180,.5,'felt',-.18);contact(s,.17,120,.58,'felt',.18);}],
    ['Fingertips','Önce parmaklar, sonra hafif avuç teması.',.25,s=>{contact(s,0,480,.16,'wood');contact(s,.04,215,.45,'felt');}],
    ['Weight Shift','Kısa ama daha ağır bir ağırlık aktarımı.',.31,s=>{s.tone(0,65,.22,.65,{decay:17,attack:.009,harmonic:.03});contact(s,.009,295,.16,'wood');}],
    ['Quiet Tap','Ritim içinde kaybolan minimal, kuru tık.',.15,s=>contact(s,0,350,.42,'felt',0,.095)],
    ['Tile Contact','Fayansa temas; ince bir sertlik, kısa kuyruk.',.24,s=>{contact(s,0,410,.3,'ceramic',0,.16);contact(s,.002,130,.5,'felt');}],
    ['Soft Pulse','Gerçek temas yerine sade, sıcak oyun darbesi.',.28,s=>s.tone(0,146.83,.22,.6,{decay:18,attack:.004,harmonic:.15})],
  ],
  jigsaw_reveal:[
    ['Envelope Seal','Zarf mührü açılır, küçük bir sıcak nota kalır.',.87,s=>{contact(s,0,1270,.27,'paper');contact(s,.064,740,.16,'paper');pluck(s,.14,523.25,.8,.56);}],
    ['Secret Key','Küçük kilit ve berrak bir keşif.',1.03,s=>{contact(s,0,1180,.24,'metal',0,.16);phrase(s,[659.25,987.77],.11,.52,.1);}],
    ['Puzzle Fit','Parçanın yuvaya oturması gibi iki ahşap tık.',.53,s=>{contact(s,0,400,.5,'wood');contact(s,.085,610,.35,'wood');pluck(s,.13,392,.4,.28);}],
    ['Glass Window','Cam gibi saydam, iki açık nota.',1.09,s=>{s.modal(0,783.99,.65,.22);s.modal(.15,1174.66,.65,.14);}],
    ['Bookmark','Kısa sayfa teması ve yuvarlak bir son nota.',.65,s=>{contact(s,0,1460,.24,'paper');s.tone(.1,440,.32,.26,{decay:12,attack:.003,harmonic:.06});}],
    ['Small Discovery','Üç telli, kısa bir keşif motifi.',.95,s=>phrase(s,[392,493.88,587.33],.09,.76)],
    ['Porcelain Box','Minik kutu kapağı ve porselen çınlama.',.82,s=>{contact(s,0,560,.29,'ceramic');contact(s,.11,830,.23,'ceramic',0,.4);}],
    ['Pixel Portal','Temiz dijital arpej, belirgin oyun hissi.',.67,s=>[523.25,659.25,1046.5].forEach((hz,i)=>s.tone(i*.07,hz,.18,.3,{decay:17,attack:.002,harmonic:.24}))],
    ['Golden Thread','Arp benzeri ince, parlak iki tel.',1.04,s=>{pluck(s,0,880,.85,.7,-.12);pluck(s,.15,1318.51,.58,.66,.12);}],
    ['Hidden Room','Daha koyu ve meraklı, alçak keşif motifi.',1.15,s=>{phrase(s,[164.81,246.94,329.63],.115,1.0);s.room(.045,.6);}],
    ['Open Locket','Madalyonun metal mandalı ve küçük çınlaması.',.94,s=>{contact(s,0,960,.23,'metal',0,.12);s.modal(.09,1568,.53,.11,{metal:true});}],
    ['Quiet Reveal','Tek, kısa ve sıcak bir doğrulama notası.',.54,s=>pluck(s,0,349.23,1.15,.43)],
  ],
};

const loopRecipes=[
  ['Sleeping Coals','Seyrek, alçak köz patlamaları.',14,'ember',180,490,.022],
  ['Dry Kindling','Kuru çıraların küçük, daha sık tıkırtıları.',43,'wood',440,1200,.035],
  ['Paper Embers','İnce ve hızlı, ayrı kâğıt közleri.',58,'paper',900,2100,.023],
  ['Stone Hearth','Taş ocağın ağır, aralıklı temasları.',20,'stone',120,420,.055],
  ['Crackling Crown','Parlak, düzensiz kıvılcım kümeleri.',49,'ember',650,1750,.028],
  ['Charcoal','Boğuk kömür kırıntıları, çok kısa kuyruklar.',27,'felt',150,580,.035],
  ['Copper Heat','Bakır gibi hafif metalik közler.',23,'metal',430,950,.065],
  ['Soft Fireplace','Yumuşak ve orta yoğunlukta ahşap çıtırtısı.',32,'wood',200,660,.04],
  ['Ceramic Kiln','Seramik içindeki küçük, tok patlamalar.',18,'ceramic',300,750,.065],
  ['Last Embers','Uzun boşluklar bırakan son birkaç köz.',9,'ember',190,1150,.028],
  ['Banknote Fire','Çok küçük, seri ve hafif kâğıt temasları.',76,'paper',620,1550,.018],
  ['Enchanted Coals','Camımsı, ince fantastik kıvılcımlar.',30,'metal',1000,2200,.041],
];
function fireLoop(recipe,index){
  const [, ,count,material,low,high,duration]=recipe;
  const seconds=6,s=new Scene(seconds+.5,seedOf(`round3/fire/${index}`)),rnd=random(seedOf(`embers/${index}`));
  for(let i=0;i<count;i++){
    const at=(i+(.5+rnd()*.5)*.8)/count*seconds;
    contact(s,at,low+(.5+rnd()*.5)*(high-low),.25+(.5+rnd()*.5)*.45,material,rnd()*.42,duration);
    if(index===4 && i%5===0) contact(s,at+.035,high*.72,.17,'ember',rnd()*.3,.025);
  }
  const channels=[s.left,s.right].map(source=>{
    const out=new Float32Array(frames(seconds));
    for(let i=0;i<source.length;i++)out[i%out.length]+=source[i];
    // Periodic conditioning: warm filter state on the preceding loop, no fades.
    let x=0,y=0,l1=0,l2=0;const alpha=1-Math.exp(-TAU*6100/SR);
    for(let pass=0;pass<3;pass++)for(let i=0;i<out.length;i++){
      const current=out[i],hp=current-x+.995*y;x=current;y=hp;
      l1+=alpha*(hp-l1);l2+=alpha*(l1-l2);
      if(pass===2)out[i]=l2;
    }
    return out;
  });
  let peak=0;for(const c of channels)for(const v of c)peak=Math.max(peak,Math.abs(v));
  const level=loudness(channels),gain=Math.min(10**((-32-level)/20),.72/peak);
  for(const c of channels)for(let i=0;i<c.length;i++)c[i]*=gain;
  const waveform=Array.from({length:64},(_,j)=>{let m=0;for(let i=Math.floor(j*channels[0].length/64);i<Math.floor((j+1)*channels[0].length/64);i++)m=Math.max(m,Math.abs(channels[0][i]),Math.abs(channels[1][i]));return +(m/(peak*gain)).toFixed(3);});
  return {channels,peak:peak*gain,lufs:level+20*Math.log10(gain),waveform};
}

const ids=['card_flip','furnace_ignite','furnace_burn','crawl_contact','jigsaw_reveal'];
const audio={},inventory=[],events=[];
mkdirSync(join(OUT,'audio/round3'),{recursive:true});
for(const id of ids){
  const old=previous.events.find(e=>e.id===id);
  if(preferences.eventSelections.find(e=>e.event===id)?.choice!=='silent') throw new Error(`Refusing to replace a selected sound: ${id}`);
  const list=id==='furnace_burn'?loopRecipes:recipes[id];
  const event={id,title:old.title,group:old.group,trigger:old.trigger,loop:old.loop,variants:[]};
  for(let i=0;i<list.length;i++){
    const [title,description,seconds,draw]=list[i],key=`${id}:r3-${String(i+1).padStart(2,'0')}`;
    let result;
    if(event.loop)result=fireLoop(list[i],i);
    else {const s=new Scene(seconds,seedOf(key));draw(s);if(s.removedNoiseLayers)throw new Error('No noise stems allowed in round 3');result=finish(s,-24+old.offset);}
    const bytes=wav(result.channels),filename=key.replaceAll('_','-').replace(':','-')+'.wav',filePath=`audio/round3/${filename}`;
    writeFileSync(join(OUT,filePath),bytes);
    const entry={key,filename,path:filePath,title,description,event:id,seconds:result.channels[0].length/SR,loop:event.loop,peak:+result.peak.toFixed(5),lufs:+result.lufs.toFixed(2),waveform:result.waveform,sha256:hash(bytes),bytes:bytes.length};
    audio[key]={...entry,uri:`data:audio/wav;base64,${bytes.toString('base64')}`};inventory.push(entry);event.variants.push(key);
  }
  events.push(event);
}
const kept=[];
for(const selection of [...preferences.selections,...preferences.eventSelections]){
  if(selection.choice==='silent')continue;
  const oldKey=selection.audioKey ?? `selected:${selection.event}`;
  const source=previous.audio[oldKey];
  if(!source)throw new Error(`Missing selected audio ${oldKey}`);
  const key=`kept:${selection.event}`;
  audio[key]={...source,key,title:selection.title};
  kept.push({...selection,key});
}
const drainBytes=readFileSync(join(ROOT,'public/sounds/drain_session.mp3'));
audio['drain:provided']={key:'drain:provided',title:'Drain Session',filename:'drain_session.mp3',loop:true,uri:`data:audio/mpeg;base64,${drainBytes.toString('base64')}`,sha256:hash(drainBytes)};
const payload={events,audio,kept,preferences,baselineHash:hash(readFileSync(join(OUT,'choices-round2.json'))),drain:{source:'drain_session.mp3',defaultEnabled:false,loop:true,scope:'drain-session-only'}};
writeFileSync(join(OUT,'round3.html'),read('round3-template.html').replace('__ROUND3_DATA__',JSON.stringify(payload).replaceAll('<','\\u003c')));
const manifest={scope:'Audition only for five previously silent events. Existing selections retained. No Drain audio generated.',format:'48 kHz, 16-bit stereo PCM WAV',synthesis:'Damped fixed-frequency materials and additive plucks; no noise or shared whoosh stem.',preferences,events,kept,drain:payload.drain,protectedHashes,liveHashes,audio:inventory};
writeFileSync(join(OUT,'manifest-round3.json'),JSON.stringify(manifest,null,2));
for(const [p,digest] of Object.entries(protectedHashes))if(hash(readFileSync(join(OUT,p)))!==digest)throw new Error(`Previous file changed: ${p}`);
for(const [p,digest] of Object.entries(liveHashes))if(hash(readFileSync(join(ROOT,'public/sounds',p)))!==digest)throw new Error(`Live sound changed: ${p}`);
console.log(JSON.stringify({newAlternatives:inventory.length,events:events.length,perEvent:12,keptSoundChoices:kept.length,drainGenerated:0,htmlMB:+(readFileSync(join(OUT,'round3.html')).length/1048576).toFixed(2),previousFilesUnchanged:protectedPaths.length,liveFilesUnchanged:Object.keys(liveHashes).length},null,2));
