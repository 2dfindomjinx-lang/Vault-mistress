// Revision pass: remove the shared air/noise stem at its source, before mixing.
// Existing pitches, timing, envelopes, room reflections and event IDs survive.
import { Scene as OriginalScene, SR, TAU, frames, fade, random, seedOf } from './synthesis.mjs';
export { finish, wav, loudness, SR, TAU, frames, fade, random, seedOf } from './synthesis.mjs';
export const DRY_REVISION = 'dry-2026-09-13';

export class Scene extends OriginalScene {
  constructor(seconds, seed) {
    super(seconds, seed);
    this.drySeed = seed;
    this.removedNoiseLayers = 0;
    this.cleanPlucks = 0;
    this.materialGrains = 0;
  }
  friction(_at, duration, _gain, _options = {}) {
    // Deliberately omit this stem entirely, including the old short hiss attacks.
    // Consume the same RNG draws so later independent layers retain their seed.
    for (let i = 0; i < frames(duration); i++) this.random();
    this.removedNoiseLayers++;
  }
  pluck(at, hz, duration, gain, pan = 0, dark = .55) {
    // Replace the noise-excited string with its pitched, damped partials.
    // The former random delay-line excitation itself made a hiss at note onset.
    const oldRingLength = Math.ceil(SR / hz - .5) + 2;
    for (let i = 0; i < oldRingLength; i++) this.random();
    const out = new Float32Array(frames(duration));
    const harmonics = Math.min(14, Math.floor(4800 / hz));
    for (let partial = 1; partial <= harmonics; partial++) {
      const amplitude = .32 / partial ** (1.25 + dark);
      const decay = 2.8 + partial * (1.9 + dark * 3.8);
      for (let i = 0; i < out.length; i++) {
        const t = i / SR;
        out[i] += Math.sin(TAU * hz * partial * t) * amplitude * Math.exp(-t * decay) * fade(t, duration, .002, .055);
      }
    }
    this.mix(out, at, pan, gain);
    this.cleanPlucks++;
  }
  grains(at, duration, gain, { material = 'paper', count = 4, pan = 0, tag = '' } = {}) {
    // Discrete resonant contacts, with silence between them. No white-noise bed,
    // rising filter, long noise envelope or automatic introductory whoosh.
    const rnd = random(seedOf(`${this.drySeed}/${material}/${at}/${tag}`));
    for (let k = 0; k < count; k++) {
      const slot = duration / Math.max(1, count);
      const start = at + k * slot + (k ? (.5 + rnd() * .5) * slot * .24 : 0);
      const length = Math.min(slot * .53, material === 'cloth' ? .025 : material === 'ember' ? .020 : .013);
      const hz = material === 'cloth' ? 180 + (.5 + rnd() * .5) * 280
        : material === 'ember' ? 320 + (.5 + rnd() * .5) * 1200
        : 900 + (.5 + rnd() * .5) * 1550;
      const level = gain * (.36 + (.5 + rnd() * .5) * .34);
      const out = new Float32Array(frames(length));
      for (let i = 0; i < out.length; i++) {
        const t = i / SR;
        const resonance = Math.sin(TAU * hz * t) + .17 * Math.sin(TAU * hz * 1.87 * t) + .065 * Math.sin(TAU * hz * 3.14 * t);
        out[i] = resonance * Math.exp(-t / Math.max(.002, length * .28)) * fade(t, length, .001, length * .32);
      }
      this.mix(out, start, pan + rnd() * .06, level);
      this.materialGrains++;
    }
  }
}

export function dryMaterial(scene, id, palette) {
  const bright = palette === 'b' || palette === 'obsidian';
  // Only restore identity to cues whose main material used to be mostly noise.
  // Everything else retains its original non-noise layers without additions.
  switch (id) {
    case 'click_silk': scene.grains(0, .085, .32, { material: 'cloth', count: 3 }); break;
    case 'click_scissor': scene.grains(0, .025, .22, { material: 'paper', count: 2 }); break;
    case 'click_snap': scene.grains(0, .016, .40, { material: 'paper', count: 1 }); break;
    case 'click_paper': scene.grains(0, .105, .46, { material: 'paper', count: 5 }); break;
    case 'card_flip': scene.grains(0, .20, .45, { material: bright ? 'cloth' : 'paper', count: bright ? 4 : 6 }); break;
    case 'drain_popup': scene.modal(0, bright ? 1046.50 : 523.25, .17, .09, { muted: true }); break;
    case 'drain_start': scene.tone(0, bright ? 185 : 130, .25, .11, { decay: 19 }); break;
    case 'debt_installment': scene.grains(0, .12, .10, { material: 'paper', count: 3 }); break;
    case 'item_equip': scene.grains(0, .10, .14, { material: 'cloth', count: 3 }); break;
    case 'jigsaw_reveal': scene.grains(0, .19, .28, { material: 'paper', count: 6 }); break;
    case 'crawl_contact': scene.grains(.02, .16, .16, { material: 'cloth', count: 3 }); break;
    case 'furnace_ignite':
      scene.grains(0, .075, .46, { material: 'paper', count: 3 });
      scene.grains(.09, .52, .34, { material: 'ember', count: bright ? 10 : 7 });
      break;
    case 'furnace_note': scene.grains(0, .14, .57, { material: bright ? 'ember' : 'paper', count: 5 }); break;
    case 'furnace_ash':
      for (let i = 0; i < 5; i++) scene.grains(i * .135, .07, .38 * Math.exp(-i * .43), { material: 'ember', count: 2, tag: String(i) });
      break;
    case 'cosmetic_purchased': scene.grains(0, .10, .12, { material: 'cloth', count: 3 }); break;
    case 'debt_contract_signed':
      scene.grains(0, bright ? .21 : .37, .22, { material: 'paper', count: bright ? 6 : 10 });
      break;
  }
  // A deleted introductory layer must not leave an empty wait before the cue.
  // Keep file duration/identity, moving the remaining mix and its reflections
  // together; ordinary 1–2 ms anti-click attacks remain untouched.
  let peak = 0;
  for (const channel of [scene.left, scene.right]) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  let onset = 0;
  while (onset < scene.left.length && Math.max(Math.abs(scene.left[onset]), Math.abs(scene.right[onset])) < peak * .0005) onset++;
  scene.removedIntroSeconds = 0;
  if (peak > 0 && onset > frames(.015)) {
    const shift = Math.max(0, onset - frames(.001));
    for (const channel of [scene.left, scene.right]) { channel.copyWithin(0, shift); channel.fill(0, channel.length - shift); }
    scene.removedIntroSeconds = shift / SR;
  }
  return scene;
}

export function dryFireLoop(id, palette) {
  const length = frames(4), channels = [new Float32Array(length), new Float32Array(length)];
  const rnd = random(seedOf(`${id}/${palette}/dry-embers`));
  for (let channel = 0; channel < 2; channel++) {
    const count = palette === 'a' ? 29 : 21;
    for (let k = 0; k < count; k++) {
      const start = Math.floor((k + (.5 + rnd() * .5) * .7) / count * length);
      const duration = (palette === 'a' ? .012 : .022) + (.5 + rnd() * .5) * .017;
      const hz = (palette === 'a' ? 450 : 180) + (.5 + rnd() * .5) * (palette === 'a' ? 1400 : 620);
      const gain = .16 + (.5 + rnd() * .5) * .17;
      for (let i = 0; i < frames(duration); i++) {
        const t = i / SR;
        channels[channel][(start + i) % length] += gain *
          (Math.sin(TAU * hz * t) + .16 * Math.sin(TAU * hz * 2.31 * t)) *
          Math.exp(-t / (duration * .25)) * fade(t, duration, .0012, .009);
      }
    }
  }
  return channels;
}
