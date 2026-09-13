// Standalone audition pack. Reads the site registry/assets; only writes beside this file.
// Run: node outputs/sound-lab/generate.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scene, finish, wav, SR, TAU, frames, fade, seedOf, DRY_REVISION, dryMaterial } from './dry-synthesis.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(OUT, '../..');
const registryPath = join(ROOT, 'src/lib/sound.ts');
const registry = readFileSync(registryPath, 'utf8');
const sha = data => createHash('sha256').update(data).digest('hex');
const snapshot = { 'src/lib/sound.ts': sha(registry) };
const palettes = [
  { id: 'velvet', title: 'Velvet Court', short: 'Velvet', letter: 'A', description: 'Sıcak metal, mühür, ipek. Daha dokulu ve törensel.' },
  { id: 'obsidian', title: 'Obsidian', short: 'Obsidian', letter: 'B', description: 'Cam, mekanik kilitler, derin vuruşlar. Daha keskin ve modern.' },
];
const events = [
  ['button_click', 'Buton tıklaması', 'Arayüz', 'Menüler ve oyun içi seçimler', -5, 'Deri kaplı, tok bir mekanik dokunuş.', 'Kısa, temiz bir cam ve krom dokunuşu.'],
  ['error', 'İşlem reddedildi', 'Arayüz', 'Geçersiz veya tamamlanamayan işlemler', -2, 'Kapanan kilit; kısa ve kesin.', 'İki kuru darbe, aşağı inen bir ton.'],
  ['task_completion', 'Başarı', 'Oyunlar', 'Görev tamamlama ve oyun kazanma', 0, 'Yukarı açılan üç sıcak tel vuruşu.', 'Hızlı, parlak bir kristal onay.'],
  ['task_fail', 'Başarısızlık', 'Oyunlar', 'Kaybedilen turlar ve yanlış seçimler', -2, 'Gevşeyen tel ve yumuşak bir zincir düşüşü.', 'Doğrudan başlayan derin düşüş.'],
  ['crate_reel_tick', 'Kasa / çark tıkırtısı', 'Oyunlar', 'Kasa şeridi, çarklar ve casino animasyonları', -7, 'Küçük pirinç dişli; kısa ve kuru.', 'Seramik fiş; daha belirgin, çok kısa.'],
  ['crate_reveal', 'Kasa açılışı', 'Oyunlar', 'Standart ödülün ortaya çıkışı', -1, 'Kutu mandalı ve mücevher.', 'Tok kutu açılışı, cilalı cam parıltısı.'],
  ['crate_legendary_reveal', 'Efsanevi ödül', 'Oyunlar', 'Nadir açılışın büyük anı', 3, 'Derin taç vuruşu ve yükselen dört notalı imza.', 'Ters kristal yükselişi, güçlü vuruş ve geniş parıltı.'],
  ['tribute_sent', 'Tribute', 'Ekonomi', 'Tribute gönderildiğinde', 1, 'Altın tepsiye düşen üç farklı para.', 'Işıltılı para akışı ve net bir son vuruş.'],
  ['cosmetic_purchased', 'Shop alışverişi', 'Ekonomi', 'Kozmetik alımı ve ilgili shop işlemleri', -1, 'İpek açılışı, küçük bir takı klipsi.', 'Parlak vitrin açılışı ve iki cam vuruşu.'],
  ['debt_contract_signed', 'Kontrat imzası', 'Ekonomi', 'Debt contract imzalandığında', 0, 'Kalem izi, ağır mühür ve kilit kapanışı.', 'Kısa onay taraması ve çift mekanik mühür.'],
  ['gallery_unlock', 'Galeri açılışı', 'Principessa', 'Yeni galeri içeriğinin kilidi açıldığında', 1, 'Anahtar ve sıcak bir açılış.', 'Kilit açılır; temiz kristal notalar.'],
  ['affection_level_up', 'Affection yükselişi', 'Principessa', 'Yakınlık seviyesi yükseldiğinde', 1, 'Sıcak, yavaş açılan tel ve celesta cümlesi.', 'Yükselen kristal motif ve yumuşak ışık halkası.'],
  ['random_event_activation', 'Principessa etkinliği', 'Principessa', 'Özel bir etkinlik başladığında', 0, 'İki davetkâr metal vuruşu ve karanlık bir kuyruk.', 'Yaklaşan bir sinyal ve derin, tek bir vurgu.'],
].map(([id, title, group, usage, offset, velvet, obsidian]) => {
  const match = registry.match(new RegExp(`${id}:\\s*\\{[^}]*src:\\s*"([^\"]+)"[^}]*volume:\\s*([\\d.]+)`));
  if (!match) throw new Error(`Sound absent from registry: ${id}`);
  const relative = `public${match[1]}`;
  const original = readFileSync(join(ROOT, relative));
  snapshot[relative] = sha(original);
  return {
    id, title, group, usage, offset,
    descriptions: { current: 'Sitedeki mevcut kayıt.', velvet, obsidian },
    clips: { current: {
      filename: basename(match[1]), siteVolume: Number(match[2]),
      uri: `data:audio/${match[1].endsWith('.mp3') ? 'mpeg' : 'wav'};base64,${original.toString('base64')}`,
    } },
  };
});

function render(id, palette) {
  const a = palette === 'velvet';
  const durations = {
    button_click: a ? .16 : .13, error: .48, task_completion: a ? 1.0 : .84,
    task_fail: a ? .82 : .75, crate_reel_tick: a ? .075 : .062,
    crate_reveal: a ? 1.45 : 1.35, crate_legendary_reveal: a ? 3.15 : 3.25,
    tribute_sent: a ? 1.24 : 1.13, cosmetic_purchased: a ? 1.05 : .94,
    debt_contract_signed: a ? 1.85 : 1.55, gallery_unlock: a ? 1.72 : 1.65,
    affection_level_up: a ? 2.55 : 2.3, random_event_activation: a ? 1.6 : 1.45,
  };
  const s = new Scene(durations[id], seedOf(`${palette}/${id}`));
  switch (id) {
    case 'button_click':
      if (a) {
        s.impact(0, 290, .75); s.modal(.009, 760, .11, .1, { muted: true });
      } else {
        s.modal(0, 1310, .1, .28, { muted: true }); s.impact(.011, 380, .38);
        s.friction(0, .025, .13, { low: 1500, high: 5800, decay: 110 });
      }
      break;
    case 'crate_reel_tick':
      if (a) {
        s.modal(0, 690, .06, .42, { muted: true }); s.impact(.006, 270, .34);
      } else {
        s.friction(0, .025, .5, { low: 900, high: 5600, decay: 120 });
        s.modal(.003, 1620, .045, .28, { muted: true }); s.tone(.002, 370, .04, .25, { decay: 65 });
      }
      break;
    case 'error':
      if (a) {
        s.impact(0, 205, .55); s.impact(.095, 144, .6);
        s.modal(.104, 392, .28, .11, { metal: true, muted: true });
      } else {
        s.tone(0, 320, .12, .5, { decay: 19, fm: .28 });
        s.tone(.115, 226, .25, .57, { end: 196, decay: 14, fm: .18 });
        s.friction(.12, .055, .22, { low: 450, high: 2100, decay: 50 });
      }
      break;
    case 'task_completion':
      if (a) {
        s.pluck(0, 587.33, .7, .95, -.2);
        s.pluck(.10, 880, .65, .78, .1);
        s.modal(.195, 1174.66, .64, .23, { pan: .22 });
      } else {
        [587.33, 880, 1174.66].forEach((hz, i) => s.tone(i * .085, hz, .5, .32 - i * .04, { fm: 1.5, decay: 9, pan: (i - 1) * .18 }));
        s.friction(.14, .19, .10, { low: 1700, high: 4500, swell: true });
      }
      s.room(a ? .22 : .13);
      break;
    case 'task_fail':
      if (a) {
        s.pluck(0, 220, .6, .8, -.1, .72); s.tone(.06, 150, .5, .3, { end: 110, decay: 8 });
        [0, .052, .091].forEach((t, i) => s.modal(.10 + t, 620 - i * 83, .24, .075, { metal: true, muted: true, pan: i * .12 }));
      } else {
        s.friction(0, .16, .5, { low: 140, high: 1600, swell: true });
        s.tone(.10, 195, .5, .6, { end: 73.42, decay: 8, fm: .4 }); s.impact(.12, 98, .28);
      }
      s.room(.10, .8);
      break;
    case 'tribute_sent':
      if (a) {
        [659.25, 880, 1174.66].forEach((hz, i) => {
          s.modal(i * .14, hz, .75, .27 - i * .03, { metal: true, pan: -.3 + i * .3 });
          s.impact(i * .14, 255, .16, -.3 + i * .3);
        });
        s.friction(.43, .19, .14, { low: 180, high: 1700, swell: true });
      } else {
        [1174.66, 880, 1318.51, 1760].forEach((hz, i) => s.tone(i * .07, hz, .54, .23 - i * .022, { fm: 2.1, decay: 10, pan: -.32 + i * .2 }));
        s.impact(.22, 196, .4); s.modal(.23, 659.25, .66, .18, { metal: true });
      }
      s.room(.21);
      break;
    case 'cosmetic_purchased':
      if (a) {
        s.friction(0, .28, .30, { low: 650, high: 4800, swell: true, pan: -.15 });
        s.impact(.13, 350, .26); s.pluck(.16, 698.46, .63, .7, -.1);
        s.modal(.28, 1046.50, .6, .18, { pan: .18 });
      } else {
        s.friction(0, .15, .26, { low: 900, high: 5100, swell: true });
        s.tone(.06, 783.99, .55, .32, { fm: 1.2, decay: 9, pan: -.15 });
        s.tone(.19, 1174.66, .55, .24, { fm: .6, decay: 8, pan: .2 }); s.impact(.06, 293, .15);
      }
      s.room(.18);
      break;
    case 'debt_contract_signed':
      if (a) {
        s.friction(0, .24, .36, { low: 1300, high: 5200, swell: true, flutter: 28, pan: -.2 });
        s.friction(.25, .16, .27, { low: 1700, high: 4700, swell: true, flutter: 19, pan: .1 });
        s.impact(.48, 112, 1.2); s.modal(.488, 320, .35, .17, { muted: true, metal: true });
        s.impact(.70, 290, .27); s.modal(.705, 870, .27, .14, { muted: true, metal: true });
        s.pad(.55, [146.83, 220, 293.66], 1.05, .11, { attack: .075 });
      } else {
        s.friction(0, .26, .38, { low: 1200, high: 3700, swell: true, flutter: 38, pan: -.1 });
        s.tone(.05, 500, .2, .13, { end: 820, decay: 4, fm: .25 });
        s.impact(.31, 130.81, .85); s.impact(.39, 82.41, .9);
        s.modal(.395, 493.88, .32, .14, { metal: true, muted: true });
        s.pad(.43, [164.81, 246.94], .83, .13, { attack: .07 });
      }
      s.room(.18, 1.1);
      break;
    case 'gallery_unlock':
      if (a) {
        s.modal(0, 735, .18, .2, { muted: true, metal: true, pan: -.18 });
        s.impact(.11, 260, .40); s.friction(.12, .55, .33, { low: 400, high: 4400, swell: true, pan: .1 });
        s.pluck(.31, 440, .9, .65, -.25); s.modal(.43, 659.25, .86, .19, { pan: .15 });
        s.pad(.42, [220, 329.63], .94, .13);
      } else {
        s.impact(0, 190, .25); s.friction(.025, .55, .38, { low: 330, high: 4900, swell: true });
        s.tone(.13, 294, .48, .12, { end: 587.33, decay: 1.9, attack: .12 });
        s.tone(.4, 880, .83, .24, { fm: 1.8, decay: 5, pan: -.22 });
        s.tone(.49, 1318.51, .73, .16, { fm: .9, decay: 5, pan: .22 });
      }
      s.room(.27, 1.2);
      break;
    case 'affection_level_up':
      if (a) {
        [440, 587.33, 659.25, 880].forEach((hz, i) => { s.pluck(i * .18, hz, 1.25, .8 - i * .07, -.27 + i * .18); s.modal(i * .18 + .015, hz, 1.25, .10, { pan: -.15 + i * .1 }); });
        s.pad(.15, [220, 293.66, 329.63], 1.96, .26, { attack: .35 });
        s.friction(.32, .85, .075, { low: 1200, high: 4500, swell: true });
      } else {
        [587.33, 659.25, 880, 1174.66].forEach((hz, i) => s.tone(i * .15, hz, 1.25, .26 - i * .025, { fm: .8, decay: 3.5, pan: -.3 + i * .2 }));
        s.pad(.16, [293.66, 440, 587.33], 1.69, .2, { attack: .32 });
        s.friction(.33, .74, .15, { low: 1300, high: 5000, swell: true });
      }
      s.room(.32, 1.45);
      break;
    case 'random_event_activation':
      if (a) {
        s.modal(0, 440, .95, .27, { metal: true, pan: -.16 });
        s.modal(.24, 587.33, .98, .25, { metal: true, pan: .16 });
        s.pad(.09, [146.83, 220], 1.12, .21, { attack: .18 });
        s.friction(.08, .4, .16, { low: 600, high: 3100, swell: true });
      } else {
        s.friction(0, .34, .48, { low: 400, high: 4200, swell: true });
        s.tone(.06, 294, .28, .16, { end: 588, decay: 1, attack: .1 });
        s.impact(.30, 98, .63); s.tone(.32, 587.33, .85, .25, { fm: 1.4, decay: 5 });
        s.tone(.44, 880, .65, .14, { fm: .7, decay: 5, pan: .2 });
      }
      s.room(.27, 1.25);
      break;
    case 'crate_reveal':
      if (a) {
        s.impact(0, 190, .55); s.modal(.018, 570, .24, .13, { metal: true, muted: true });
        s.friction(.04, .33, .3, { low: 460, high: 4000, swell: true });
        s.pluck(.18, 587.33, .82, .8, -.22); s.modal(.29, 880, .78, .24, { pan: .18 });
      } else {
        s.friction(0, .30, .5, { low: 460, high: 4600, swell: true });
        s.impact(.14, 146.83, .5); s.tone(.18, 587.33, .73, .3, { fm: 2.2, decay: 5, pan: -.18 });
        s.tone(.28, 880, .8, .2, { fm: 1.4, decay: 5, pan: .18 });
      }
      s.room(.26, 1.2);
      break;
    case 'crate_legendary_reveal':
      if (a) {
        s.friction(0, .34, .26, { low: 450, high: 4100, swell: true });
        s.impact(.19, 73.42, 1.0); s.modal(.2, 293.66, 1.85, .22, { metal: true });
        [587.33, 880, 1174.66, 1760].forEach((hz, i) => { s.pluck(.25 + i * .135, hz, 1.7, .83 - i * .1, -.35 + i * .23); s.modal(.25 + i * .135, hz, 1.6, .10, { pan: .3 - i * .2 }); });
        s.pad(.3, [146.83, 220, 293.66, 440], 2.35, .29, { attack: .16 });
        s.friction(.52, .7, .11, { low: 2000, high: 5200, swell: true });
      } else {
        // Reversed struck glass gives a recognisable pull into the reveal.
        const reverse = new Float32Array(frames(.4));
        for (let i = 0; i < reverse.length; i++) {
          const t = i / SR;
          reverse[reverse.length - 1 - i] = (Math.sin(TAU * 880 * t) + .25 * Math.sin(TAU * 1318.51 * t)) * Math.exp(-t * 12) * fade(t, .4, .008, .03);
        }
        s.mix(reverse, 0, -.1, .21); s.friction(0, .44, .36, { low: 700, high: 4600, swell: true });
        s.impact(.40, 65.41, 1.1); s.tone(.405, 130.81, 1.5, .27, { decay: 3, harmonic: .15 });
        [523.25, 783.99, 1046.50, 1567.98].forEach((hz, i) => s.tone(.44 + i * .12, hz, 1.75, .24 - i * .025, { fm: 1.7, decay: 3.2, pan: -.36 + i * .24 }));
        s.pad(.47, [130.81, 196, 261.63, 392], 2.22, .24, { attack: .19 });
      }
      s.room(.35, 1.55);
      break;
    default: throw new Error(id);
  }
  return s;
}

for (const event of events) for (const palette of palettes) {
  const scene = dryMaterial(render(event.id, palette.id), event.id, palette.id);
  const result = finish(scene, -22 + event.offset);
  const filename = `${event.id.replaceAll('_', '-')}.wav`;
  const dir = join(OUT, 'audio', palette.id);
  mkdirSync(dir, { recursive: true });
  const data = wav(result.channels);
  writeFileSync(join(dir, filename), data);
  event.clips[palette.id] = {
    filename: `${palette.id}-${filename}`, path: `audio/${palette.id}/${filename}`,
    uri: `data:audio/wav;base64,${data.toString('base64')}`,
    seconds: result.channels[0].length / SR, peak: +result.peak.toFixed(5),
    lufs: +result.lufs.toFixed(2), waveform: result.waveform, bytes: data.length,
    sha256: sha(data), dryRevision: DRY_REVISION, removedNoiseLayers: scene.removedNoiseLayers, cleanPlucks: scene.cleanPlucks,
    // If later approved, this gain approximates the site's current listening level.
    proposedSiteVolume: +(10 ** ((-30.5 + event.offset - result.lufs) / 20)).toFixed(4),
  };
}

const payload = { palettes, events };
const template = readFileSync(join(OUT, 'player-template.html'), 'utf8');
writeFileSync(join(OUT, 'index.html'), template.replace('__SOUND_LAB_DATA__', JSON.stringify(payload).replaceAll('<', '\\u003c')));
const manifest = {
  format: '48 kHz, 16-bit stereo PCM WAV', generation: 'Original deterministic procedural sound design; no voice, no external samples.',
  scope: 'Separate audition only. No site files changed.', dryRevision: DRY_REVISION, originalHashes: snapshot, palettes,
  events: events.map(event => ({ ...event, clips: Object.fromEntries(Object.entries(event.clips).map(([key, { uri, waveform, ...meta }]) => [key, meta])) })),
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
for (const [relative, expected] of Object.entries(snapshot)) {
  if (sha(readFileSync(join(ROOT, relative))) !== expected) throw new Error(`Original changed: ${relative}`);
}
console.log(JSON.stringify({
  events: events.length, alternatives: events.length * palettes.length,
  html: join(OUT, 'index.html'), htmlMB: +(readFileSync(join(OUT, 'index.html')).length / 1048576).toFixed(2),
  originalsUnchanged: Object.keys(snapshot).length,
  clips: events.map(e => ({ event: e.id, velvet: e.clips.velvet.seconds, obsidian: e.clips.obsidian.seconds })),
}, null, 2));
