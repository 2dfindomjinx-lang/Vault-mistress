// Audition round two. No writes to src/, public/, the first preview, or Downloads.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scene, finish, wav, loudness, SR, TAU, seedOf, frames, fade, random, DRY_REVISION, dryMaterial, dryFireLoop } from './dry-synthesis.mjs';
import { buttonCatalog, eventCatalog, auditNotes } from './round2-catalog.mjs';

const OUT = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(OUT,'../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const previous = JSON.parse(readFileSync(join(OUT,'index.html'),'utf8').match(/<script id="sound-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const selection = JSON.parse(readFileSync(join(OUT,'choices-round1.json'),'utf8'));
const paths = new Set(['src/lib/sound.ts',...eventCatalog.map(e=>e.path),...auditNotes.map(e=>e.path)]);
for(const name of readdirSync(join(ROOT,'public/sounds'))) paths.add(`public/sounds/${name}`);
for(const name of ['index.html','manifest.json','generate.mjs','player-template.html']) paths.add(`outputs/sound-lab/${name}`);
for(const palette of ['velvet','obsidian']) for(const name of readdirSync(join(OUT,'audio',palette))) paths.add(`outputs/sound-lab/audio/${palette}/${name}`);
const protectedHashes = Object.fromEntries([...paths].map(path=>[path,hash(readFileSync(join(ROOT,path)))]));
for(const item of [...eventCatalog,...auditNotes]) {
  const source=readFileSync(join(ROOT,item.path),'utf8'), at=source.indexOf(item.anchor);
  if(at<0) throw new Error(`Missing evidence for ${item.id || item.title}: ${item.anchor}`);
  item.line=source.slice(0,at).split('\n').length;
}

function wood(s,t,hz,g=.5,pan=0,d=.15) {
  s.tone(t,hz,d,g,{decay:30,pan,attack:.0015,harmonic:.12});
  s.tone(t+.001,hz*2.38,d*.72,g*.21,{decay:48,pan,attack:.001});
  s.friction(t,d*.4,g*.33,{low:500,high:3100,decay:75,pan});
}
function ceramic(s,t,hz,g=.3,pan=0,d=.18) { s.modal(t,hz,d,g,{muted:true,pan});s.friction(t,.025,g*.42,{low:1900,high:5600,decay:90,pan}); }
function glass(s,t,hz,g=.25,pan=0,d=.5) { s.tone(t,hz,d,g,{fm:1.15,decay:7,pan,attack:.002});s.modal(t+.002,hz*1.498,d,g*.14,{pan}); }
function breath(s,t,d,g=.3,up=false,pan=0) { s.friction(t,d,g,{low:up?650:230,high:up?4600:2600,swell:true,pan}); }
function chime(s,t,notes,g=.25,step=.09,bright=false) {
  notes.forEach((hz,i)=>bright?glass(s,t+i*step,hz,g/(1+i*.18),-.25+i*.15,.72):s.pluck(t+i*step,hz,.85,g*2.7/(1+i*.16),-.25+i*.15));
}
function rattle(s,t,d,seed,material='wood',count=8) {
  const rnd=random(seed);let time=t;
  for(let i=0;i<count;i++) {
    const g=(.4+(.5+.5*rnd())*.3)*(1-i/count*.7),pan=rnd()*.35;
    if(material==='metal')s.modal(time,560+220*rnd(),.15,g*.34,{metal:true,muted:true,pan});
    else wood(s,time,360+rnd()*140,g,pan,.11);
    time+=d/count*(.7+(.5+.5*rnd())*.6);
  }
}

function buttonSound(button) {
  const s=new Scene(button.seconds,seedOf(button.id));
  switch(button.recipe) {
    case 'felt':s.tone(0,210,.08,.7,{end:145,decay:55,attack:.002});s.friction(0,.04,.08,{low:100,high:950,decay:65});break;
    case 'silk':s.friction(0,.105,.75,{low:850,high:4800,swell:true});s.tone(.035,360,.055,.13,{decay:55});break;
    case 'velvet':s.tone(0,175,.14,.7,{end:110,decay:26,attack:.006,harmonic:.02});s.friction(.005,.045,.16,{low:100,high:1500,decay:55});break;
    case 'rubber':s.tone(0,620,.078,.65,{end:245,decay:50,fm:.5,attack:.0015});break;
    case 'switch':wood(s,0,460,.42,0,.07);wood(s,.045,740,.22,0,.055);s.friction(.002,.023,.22,{low:1400,high:5200,decay:100});break;
    case 'scissor':s.friction(0,.027,.68,{low:800,high:4600,decay:90});wood(s,.014,970,.14,0,.049);break;
    case 'snap':s.friction(0,.035,.72,{low:750,high:6200,decay:120});s.tone(.001,890,.05,.28,{decay:80,attack:.001});break;
    case 'thock':wood(s,0,170,.75,0,.16);s.tone(.003,340,.11,.21,{end:240,decay:40});s.friction(.035,.03,.10,{low:700,high:2300,decay:95});break;
    case 'walnut':wood(s,0,420,.75,0,.115);break;
    case 'bamboo':wood(s,0,810,.58,0,.105);s.tone(.002,1110,.07,.15,{decay:35,harmonic:0});break;
    case 'mahogany':wood(s,0,255,.75,0,.155);s.tone(0,139,.15,.16,{decay:28});break;
    case 'woodblock':wood(s,0,1180,.48,0,.07);s.friction(0,.021,.18,{low:1500,high:4200,decay:120});break;
    case 'brass':s.impact(0,230,.5);s.modal(.014,745,.14,.19,{metal:true,muted:true});break;
    case 'silver':s.modal(0,1465,.12,.37,{metal:true,muted:true});s.friction(.004,.026,.1,{low:2000,high:5800,decay:95});break;
    case 'detent':s.modal(0,910,.07,.3,{metal:true,muted:true});s.modal(.025,1190,.063,.19,{metal:true,muted:true});wood(s,0,330,.2,0,.06);break;
    case 'lock':wood(s,0,260,.52,0,.10);s.modal(.028,650,.105,.24,{metal:true,muted:true});s.impact(.05,215,.18);break;
    case 'smoke':glass(s,0,690,.38,0,.195);s.tone(0,185,.11,.18,{decay:30});break;
    case 'frost':s.modal(0,1080,.14,.28,{muted:true});s.friction(.002,.09,.29,{low:1700,high:4200,decay:42});break;
    case 'porcelain':ceramic(s,0,820,.53,0,.135);break;
    case 'crystal':glass(s,0,1567.98,.32,0,.205);s.tone(.004,783.99,.13,.12,{decay:24});break;
    case 'bubble':s.tone(0,285,.13,.6,{end:910,decay:38,attack:.001,fm:.55});break;
    case 'drop':s.tone(0,1550,.21,.52,{end:390,decay:20,fm:.35});s.tone(.016,620,.15,.19,{end:220,decay:34});break;
    case 'finger':wood(s,0,265,.39,0,.07);s.friction(0,.041,.52,{low:200,high:3400,decay:68});break;
    case 'paper':s.friction(0,.052,.6,{low:1700,high:6200,decay:55});s.friction(.037,.073,.27,{low:700,high:3700,swell:true,flutter:39});break;
    case 'softbit':s.tone(0,660,.09,.45,{decay:37,fm:.7,attack:.004});break;
    case 'vector':s.tone(0,930,.125,.5,{end:420,decay:30,fm:.2,attack:.002});break;
    case 'pixel':s.tone(0,880,.038,.39,{decay:34,harmonic:.24,attack:.001});s.tone(.049,1320,.05,.21,{decay:42,harmonic:.13,attack:.001});break;
    case 'hush':s.tone(.019,525,.14,.23,{end:580,decay:23,attack:.012});s.friction(0,.13,.46,{low:800,high:4200,swell:true});break;
    case 'ring':wood(s,0,230,.56,0,.12);s.modal(.015,1244.51,.17,.15,{metal:true,muted:true});break;
    case 'seal':s.impact(0,118,.76);s.modal(.009,385,.15,.16,{muted:true,metal:true});s.friction(.04,.08,.14,{low:170,high:1600,swell:true});break;
    case 'pearl':s.tone(0,620,.17,.38,{end:450,decay:19,fm:1.1});ceramic(s,.005,1025,.13,0,.175);break;
    case 'heartbeat':s.tone(0,220,.10,.57,{end:100,decay:26,attack:.003});s.tone(.086,270,.115,.31,{end:130,decay:35,attack:.003});s.friction(.09,.03,.09,{low:400,high:1700,decay:75});break;
  }
  return s;
}

function eventSound(event,version) {
  const bright=version==='b', s=new Scene(event.seconds,seedOf(event.id+version));
  const step=bright?.075:.10;
  switch(event.id) {
    case 'card_flip':breath(s,0,.19,.5,bright);s.friction(.11,.095,.23,{low:bright?1700:700,high:4400,decay:40});break;
    case 'round_correct':chime(s,0,bright?[880,1174.66]:[440,659.25],.26,step,bright);break;
    case 'life_lost':s.tone(0,bright?392:220,.26,.45,{end:bright?196:110,decay:15,fm:bright?.6:0});s.friction(.04,.065,.17,{low:250,high:1800,decay:40});break;
    case 'countdown_tick':bright?ceramic(s,0,880,.35,0,.14):wood(s,0,390,.6,0,.15);break;
    case 'countdown_go':s.tone(0,bright?880:440,.31,.3,{end:bright?1320:660,decay:13,fm:bright?.6:0});wood(s,.07,240,.18,0,.14);break;
    case 'guard_parry':s.impact(0,bright?280:140,.63);s.modal(.008,bright?1250:630,.33,.29,{metal:true,muted:!bright});s.friction(.018,.16,.27,{low:1100,high:4600,swell:true});break;
    case 'slot_stop':wood(s,0,bright?370:190,.64,0,.2);s.modal(.025,bright?1020:590,.16,.20,{metal:true,muted:true});wood(s,.065,275,.18,0,.11);break;
    case 'dice_roll':rattle(s,0,.60,seedOf(version+'dice'),'wood',9);ceramic(s,.60,bright?1150:700,.19,.23,.18);break;
    case 'roulette_roll':{
      const d=2.96;breath(s,0,d,bright?.14:.10,bright);
      let t=.03,i=0;while(t<d) {const progress=t/d,g=.12+progress*.10;bright?ceramic(s,t,1050-i%3*90,g,Math.sin(t*4)*.28,.09):wood(s,t,620+i%3*70,g,Math.sin(t*4)*.28,.085);t+=.055+progress**2*.23;i++;}
      wood(s,3.06,bright?450:260,.42,0,.24);break;
    }
    case 'plinko_hit':bright?s.modal(0,1680,.09,.4,{muted:true,metal:true}):ceramic(s,0,960,.4,0,.09);break;
    case 'gem_found':wood(s,0,340,.24,0,.12);glass(s,.065,bright?1174.66:783.99,.25,0,.37);break;
    case 'mine_bust':s.impact(0,bright?110:83,.94);s.friction(.006,.31,.48,{low:bright?1100:280,high:bright?5400:2800,decay:11});s.tone(.035,370,.54,.19,{end:90,decay:8,fm:bright?.6:0});break;
    case 'casino_cashout':rattle(s,0,.27,seedOf('cashout'+version),bright?'metal':'wood',5);chime(s,.19,bright?[880,1174.66]:[440,659.25],.22,.12,bright);break;
    case 'crash_break':breath(s,0,.22,.47,bright);s.tone(.12,300,.63,.7,{end:65,decay:7,fm:bright?1.1:.1});s.friction(.15,.42,.32,{low:bright?1300:500,high:4500,decay:9});break;
    case 'wheel_tick':bright?s.modal(0,900,.09,.35,{metal:true,muted:true}):wood(s,0,560,.56,0,.09);wood(s,.019,bright?480:290,.2,0,.07);break;
    case 'wheel_verdict':s.impact(0,bright?130:98,.72);s.modal(.03,bright?660:330,.71,.25,{metal:true});s.pad(.10,[146.83,220],.74,.15,{attack:.07});break;
    case 'timeout_lock':s.friction(0,.15,.24,{low:500,high:3500,swell:true});s.impact(.09,bright?180:95,.67);s.modal(.15,bright?860:490,.32,.22,{metal:true,muted:true});wood(s,.25,230,.25,0,.19);break;
    case 'timeout_release':s.modal(0,bright?1050:580,.21,.22,{metal:true,muted:true});s.impact(.10,240,.25);chime(s,.19,bright?[659.25,880]:[329.63,440],.19,.09,bright);break;
    case 'furnace_ignite':s.friction(0,.11,.62,{low:1200,high:5400,decay:24});breath(s,.055,.69,.68,bright);s.tone(.09,bright?155:105,.54,.22,{end:65,decay:5,attack:.04});break;
    case 'furnace_note':s.friction(0,.15,.8,{low:bright?800:1400,high:bright?5700:4200,decay:27,flutter:bright?65:40});wood(s,.02,310,.18,0,.10);break;
    case 'furnace_ash':s.friction(0,.86,.44,{low:bright?480:1100,high:bright?2400:4300,decay:3});if(bright)s.impact(.14,88,.38);s.friction(.18,.55,.15,{low:1900,high:4900,decay:7,flutter:40});break;
    case 'drain_start':breath(s,0,.63,.48,bright);s.tone(.06,bright?380:220,.66,.28,{end:110,decay:3,attack:.14});s.modal(.36,bright?880:440,.4,.09,{metal:true});break;
    case 'drain_pulse':s.tone(0,bright?185:130,.32,.5,{end:85,decay:12,attack:.01});s.friction(.02,.19,.18,{low:bright?1400:450,high:3200,swell:true});break;
    case 'drain_popup':breath(s,0,.35,.50,bright);if(bright)glass(s,.10,1174.66,.11,0,.27);else s.pluck(.085,520,.31,.26,0,.73);break;
    case 'drain_stop':s.tone(0,bright?392:196,.63,.32,{end:98,decay:5,attack:.02});breath(s,.06,.45,.25,bright);break;
    case 'click_pulse':s.tone(0,bright?470:240,.066,.5,{end:bright?380:170,decay:50,attack:.0015});s.friction(0,.024,.13,{low:400,high:bright?3000:1300,decay:100});break;
    case 'click_stage':chime(s,0,bright?[659.25,880,1318.51]:[329.63,440,659.25],.28,.14,bright);s.pad(.14,[220,329.63],.81,.17,{attack:.14});break;
    case 'level_surrender':breath(s,0,.62,.40,bright);s.tone(.03,110,.76,.22,{end:440,decay:1.8,attack:.18,fm:bright?.3:0});s.impact(.51,110,.50);chime(s,.52,bright?[880,1174.66]:[440,587.33],.24,.10,bright);break;
    case 'sacrifice_resolve':s.modal(0,bright?493.88:246.94,.85,.29,{metal:!bright});s.tone(.12,220,.74,.30,{end:82.41,decay:5});breath(s,.15,.62,.23,bright);break;
    case 'daily_reward':rattle(s,0,.24,seedOf('daily'+version),'metal',4);chime(s,.16,bright?[783.99,1174.66]:[392,587.33],.24,.12,bright);break;
    case 'money_convert':wood(s,0,220,.38,0,.17);breath(s,.02,.29,.3,bright);[0,.08,.14,.19].forEach((t,i)=>glass(s,.18+t,(bright?880:659.25)*(i%2?1.5:1),.22-i*.035,-.26+i*.17,.53));break;
    case 'item_equip':breath(s,0,.26,.45,bright);bright?ceramic(s,.14,1174.66,.24,0,.27):wood(s,.13,510,.42,0,.21);break;
    case 'item_sell':breath(s,0,.24,.24,bright);chime(s,.12,bright?[880,587.33]:[440,293.66],.24,.14,bright);wood(s,.30,190,.25,0,.21);break;
    case 'debt_installment':s.friction(0,.18,.18,{low:1300,high:4400,swell:true,flutter:27});s.impact(.19,bright?220:135,.64);glass(s,.26,bright?880:440,.17,0,.47);break;
    case 'debt_completed':wood(s,0,170,.7,0,.28);s.impact(.15,98,.58);s.modal(.20,bright?880:440,.63,.16,{metal:true});chime(s,.40,bright?[587.33,880,1174.66]:[293.66,440,587.33],.22,.15,bright);s.pad(.41,[146.83,220],1.01,.13);break;
    case 'notification_received':chime(s,0,bright?[880,1174.66]:[440,659.25],.22,.18,bright);break;
    case 'runway_vote':bright?glass(s,0,1046.50,.27,0,.5):s.pluck(0,698.46,.5,.75,0,.62);breath(s,.03,.20,.10,bright);break;
    case 'runway_supervote':chime(s,0,bright?[783.99,1046.50,1567.98]:[392,523.25,783.99],.24,.12,bright);breath(s,.19,.43,.16,bright);break;
    case 'loyalty_milestone':chime(s,0,bright?[587.33,783.99,880,1174.66]:[293.66,392,440,587.33],.25,.14,bright);s.pad(.14,[196,293.66,392],1.05,.18);break;
    case 'crawl_contact':wood(s,0,bright?250:165,.43,-.08,.13);s.friction(.018,.20,.34,{low:bright?600:220,high:bright?3100:1700,swell:true,pan:.08});wood(s,.135,bright?370:210,.16,.08,.11);break;
    case 'jigsaw_reveal':s.friction(0,.28,.49,{low:bright?1500:800,high:4800,swell:true,flutter:24});wood(s,.15,bright?510:300,.27,0,.18);bright?glass(s,.25,1046.50,.19,0,.49):s.pluck(.24,523.25,.5,.51,0,.67);break;
    default:throw new Error(`Unrendered event ${event.id}`);
  }
  if(event.seconds>.4 && !['furnace_note','dice_roll','roulette_roll','furnace_ignite','furnace_ash'].includes(event.id))s.room(bright?.12:.17,.95);
  return s;
}

const audio={}, inventory=[];
function exportSound(key,scene,offset,{loop=false,channels:raw}={}) {
  let result;
  if(loop) {
    let peak=0;for(const c of raw)for(const x of c)peak=Math.max(peak,Math.abs(x));
    const level=loudness(raw), gain=Math.min(10**((-22+offset-level)/20),.80/peak);
    const channels=raw.map(c=>Float32Array.from(c,x=>x*gain));
    result={channels,peak:peak*gain,lufs:level+20*Math.log10(gain)};
    result.waveform=Array.from({length:64},(_,j)=>{let p=0;for(let i=Math.floor(j*channels[0].length/64);i<Math.floor((j+1)*channels[0].length/64);i++)p=Math.max(p,Math.abs(channels[0][i]),Math.abs(channels[1][i]));return +(p/result.peak).toFixed(3);});
  } else result=finish(scene,-22+offset);
  const bytes=wav(result.channels),filename=`${key.replaceAll(':','-').replaceAll('_','-')}.wav`,path=`audio/round2/${filename}`;
  mkdirSync(join(OUT,'audio/round2'),{recursive:true});writeFileSync(join(OUT,path),bytes);
  const entry={key,filename,path,dryRevision:DRY_REVISION,removedNoiseLayers:scene?.removedNoiseLayers??1,cleanPlucks:scene?.cleanPlucks??0,seconds:result.channels[0].length/SR,peak:+result.peak.toFixed(5),lufs:+result.lufs.toFixed(2),offset,loop,waveform:result.waveform,sha256:hash(bytes),bytes:bytes.length,proposedSiteVolume:+(10**((-30.5+offset-result.lufs)/20)).toFixed(4)};
  audio[key]={...entry,uri:`data:audio/wav;base64,${bytes.toString('base64')}`};inventory.push(entry);
}
for(const button of buttonCatalog) {button.audio=button.id;exportSound(button.id,dryMaterial(buttonSound(button),button.id,'button'),-5);}
for(const event of eventCatalog) {
  event.audio={};
  for(const version of ['a','b']) {
    const key=`${event.id}:${version}`;event.audio[version]=key;
    exportSound(key,event.loop?null:dryMaterial(eventSound(event,version),event.id,version),event.offset,event.loop?{loop:true,channels:dryFireLoop(event.id,version)}:{});
  }
}

const selected=selection.selections.map(choice=>{
  const old=previous.events.find(e=>e.id===choice.event);
  if(!old || !old.clips[choice.choice]) throw new Error(`Invalid previous choice: ${choice.event}`);
  const key=`selected:${choice.event}`;
  audio[key]={...old.clips[choice.choice],key,offset:old.offset,loop:false};
  return {...choice,key,description:old.descriptions[choice.choice]};
});
const oldButton=previous.events.find(e=>e.id==='button_click');
const references=['current','velvet','obsidian'].map(version=>{
  const key=`reference:${version}`;audio[key]={...oldButton.clips[version],key,offset:-5,loop:false};
  return {key,title:{current:'Sitedeki buton',velvet:'İlk paket · A',obsidian:'İlk paket · B'}[version]};
});
const payload={buttons:buttonCatalog,events:eventCatalog,notes:auditNotes,selected,references,audio};
const template=readFileSync(join(OUT,'round2-template.html'),'utf8');
writeFileSync(join(OUT,'round2.html'),template.replace('__ROUND2_DATA__',JSON.stringify(payload).replaceAll('<','\\u003c')));
const manifest={dryRevision:DRY_REVISION,scope:'Audition only; generated alternatives are dry revisions. Live app and original site audio unchanged.',format:'48 kHz / 16-bit stereo PCM WAV',generation:'Original procedural synthesis. No voice, external samples or audio generation service.',previousSelections:selection.selections,buttons:buttonCatalog,events:eventCatalog,notes:auditNotes,protectedHashes,audio:inventory};
writeFileSync(join(OUT,'manifest-round2.json'),JSON.stringify(manifest,null,2));
const sourceLink=item=>`[${item.path}:${item.line}](${join(ROOT,item.path).replaceAll('\\','/')}:${item.line})`;
const report=[
  '# Principessa — Ses ayrımı ve eksik sesler',
  '',
  `Bu inceleme güncel yerel koddan yapıldı. Canlı hesaba bağlanılmadı, sesler ana siteye eklenmedi. ${buttonCatalog.length} yeni buton ve ${eventCatalog.length} yeni olay için ${eventCatalog.length*2} alternatif üretildi. Önceki 12 seçim korunuyor.`,
  '',
  'Her yeni olay için A daha tok/dokulu, B daha keskin/kristal bir yorumdur. Hepsi ayrı HTML üzerinde dinlenebilir. Dinleme ve seçim kullanıcıya aittir.',
  '',
  ...auditNotes.flatMap(n=>[`## ${n.title}`,'',`${n.text} ${sourceLink(n)}`,'']),
  '## Olay bazında öneriler','',
  '| Olay | Mevcut durum | Öneri ve tetikleme | Kaynak |',
  '|---|---|---|---|',
  ...eventCatalog.map(e=>`| ${e.code} · ${e.title} (${e.kind}) | ${e.current} | ${e.proposal} **Ne zaman:** ${e.trigger} | ${sourceLink(e)} |`),
  '',
  '## Uygulama önceliği','',
  'İlk grup: buton seçimi, casino fiziksel ses ayrımı, Crown Match ve hak kaybı, Furnace zaman çizelgesi ve çifte sonuç seslerinin kaldırılması. İkinci grup: Drain / Click Game, taksit ödemesi / kontrat kapanışı ve PM dönüşümü. Bildirim, Runway ve küçük koleksiyon sesleri kullanıcı tercihine bağlı tamamlayıcı gruptur.',
  '',
  'İleride entegrasyon yapılırsa sunucu tarafından doğrulanan işlemlerde tek sonuç sesi, animasyona bağlı temaslarda görsel olay tetiklemesi, ses/loop iptali ve mevcut UI/Gameplay ses tercihleri korunmalı. Yeni sesleri yalnızca UI düğmelerine bağlamak yeterli değildir. Kullanıcının kabul etmediği seçenekler otomatik uygulanmamalı.',
];
writeFileSync(join(OUT,'audit-round2.md'),report.join('\n'));
for(const [path,digest] of Object.entries(protectedHashes)) if(hash(readFileSync(join(ROOT,path)))!==digest)throw new Error(`Protected file changed: ${path}`);
console.log(JSON.stringify({buttons:buttonCatalog.length,newEvents:eventCatalog.length,newWavs:inventory.length,previousChoices:selected.length,protectedFilesUnchanged:paths.size,htmlMB:+(readFileSync(join(OUT,'round2.html')).length/1048576).toFixed(2)},null,2));
