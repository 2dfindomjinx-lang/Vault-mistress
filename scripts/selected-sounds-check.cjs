const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const selected = { exports: {} };
vm.runInNewContext(compile('src/lib/selected-sounds.ts'), selected);
const registry = selected.exports.selectedSounds;
const preferences = JSON.parse(fs.readFileSync('public/sounds/selected/preferences.json'));
const audition = JSON.parse(fs.readFileSync('outputs/sound-lab/foley.html', 'utf8').match(/<script id="foley-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(Object.keys(registry).length, 51);
for (const entry of [...preferences.selections, ...preferences.eventSelections]) {
  if (entry.choice === 'silent') { assert.equal(registry[entry.event], undefined); continue; }
  const definition = registry[entry.event];
  const approved = audition.audio[entry.choice === 'foley' ? entry.audioKey : 'kept:' + entry.event];
  const bytes = fs.readFileSync('public' + definition.src);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), crypto.createHash('sha256').update(Buffer.from(approved.uri.split(',')[1], 'base64')).digest('hex'), entry.event);
  assert.ok(Number.isFinite(definition.volume) && definition.volume > 0 && definition.volume <= 1);
}
const voices = [];
class AudioMock extends EventTarget {
  constructor(src) { super(); this.src = src; this.paused = true; this.currentTime = 0; voices.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  cloneNode() { return new AudioMock(this.src); }
}
const document = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible' });
const window = Object.assign(new EventTarget(), { localStorage: { getItem: () => null, setItem: () => {} } });
const runtime = { exports: {}, require: () => selected.exports, Audio: AudioMock, document, window, Event, console };
vm.runInNewContext(compile('src/lib/sound.ts'), runtime);
const sound = runtime.exports;
const stop = sound.emitSoundEvent('furnace_burn', { loop: true });
assert.equal(typeof stop, 'function');
const fire = voices.at(-1);
assert.equal(fire.loop, true);
sound.updateSoundSettings({ masterVolume: 0.3 });
assert.equal(fire.volume, registry.furnace_burn.volume * 0.3);
sound.updateSoundSettings({ gameplayEnabled: false });
assert.equal(fire.muted, true);
sound.updateSoundSettings({ gameplayEnabled: true });
assert.equal(fire.muted, false);
stop(); assert.equal(fire.paused, true); assert.equal(fire.loop, false);
sound.emitSoundEvent('roulette_roll', { loop: true });
document.hidden = true; document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
assert.ok(voices.every(voice => voice.paused));
const count = voices.length; sound.emitSoundEvent('card_flip'); assert.equal(voices.length, count);
assert.ok(!fs.readFileSync('src/components/CratesPanel.tsx', 'utf8').includes('scheduleSoundTick'));
assert.ok(!fs.readFileSync('src/components/GambleHall.tsx', 'utf8').includes('setInterval(() => emitSoundEvent'));
console.log('51 approved asset hashes, silent Drain events, loop lifetime, volume/mute, hidden-tab cleanup and animation scheduler checks passed.');
