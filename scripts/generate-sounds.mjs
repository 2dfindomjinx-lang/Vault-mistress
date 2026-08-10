// Synthesises the site's UI/gameplay sound palette into public/sounds/.
//
// Run with:  node scripts/generate-sounds.mjs
//
// WHY GENERATED RATHER THAN SOURCED:
//   * No licensing question - nothing here is anyone else's recording.
//   * The whole palette shares one voice. Stock packs never do, which is what
//     makes a UI sound "cheap" more often than the individual samples do.
//   * Tuning is a code edit. Want the confirmation chime a third higher, or the
//     click 20% quieter? Change a number and re-run, instead of hunting for a
//     new file.
//
// Output is 16-bit 44.1kHz MONO WAV. Mono halves the size and no UI cue here is
// positional. Every sound is deliberately SHORT - the palette it replaces had a
// 37-second music bed on gallery unlock and a 17-second one on level up.
//
// House style: dark, warm, low-mid weight, no bright digital beeps. Bells use
// slightly inharmonic partials (real metal is not a harmonic series) and every
// sound is faded at both edges so it can never click on start or stop.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

/**
 * GLOBAL BRIGHTNESS. Lower = darker and softer, higher = brighter and sharper.
 *
 * This is the one knob to reach for if the palette is fatiguing. The first pass
 * shipped a near-unfiltered white-noise transient in the click (a one-pole at
 * k=0.6 is ~6.4kHz, which is barely filtering at all) and bell partials running
 * up to 10kHz. Both read as "harsh" long before they read as "loud", because
 * the ear is most sensitive at 2-5kHz and a sub-millisecond edge dumps energy
 * straight into that band.
 *
 * Everything below is now filtered against this ceiling, and no partial is
 * allowed above it.
 */
const TONE_CEILING_HZ = 4200;

// ---------------------------------------------------------------- primitives

const seconds = (n) => Math.round(n * SR);

function buffer(durationSec) {
  return new Float32Array(seconds(durationSec));
}

/** Exponential decay. `rate` is nepers/second - higher is snappier. */
function decay(t, rate) {
  return Math.exp(-t * rate);
}

/** Short raised-cosine attack so nothing starts on a discontinuity. */
function attack(t, attackSec) {
  if (attackSec <= 0) return 1;
  return t >= attackSec ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / attackSec);
}

/**
 * A struck-metal voice. Partials are offset from the harmonic series and the
 * higher ones decay faster, which is what separates a bell from an organ.
 */
function addBell(out, { freq, gain = 1, decayRate = 6, start = 0, partials = [1, 2.76, 5.4], attackSec = 0.006 }) {
  const offset = seconds(start);
  // Anything above the tone ceiling is dropped rather than filtered later: a
  // partial you cannot hear cleanly only contributes fizz.
  const audible = partials.filter((ratio) => freq * ratio <= TONE_CEILING_HZ);
  const voiced = audible.length > 0 ? audible : [partials[0]];

  for (let i = 0; i + offset < out.length; i++) {
    const t = i / SR;
    let sample = 0;
    for (let p = 0; p < voiced.length; p++) {
      // Upper partials both start quieter and die sooner. The exponent is
      // steeper than a natural bell on purpose - this is a UI cue, not a
      // performance instrument, and the top end is what tires the ear.
      const partialGain = 1 / (p + 1) ** 1.9;
      const partialDecay = decayRate * (1 + p * 1.2);
      sample += partialGain * Math.sin(2 * Math.PI * freq * voiced[p] * t) * decay(t, partialDecay);
    }
    out[i + offset] += sample * gain * attack(t, attackSec);
  }
}

/** Sine with an optional exponential pitch glide, for thuds and sweeps. */
function addTone(out, { freqStart, freqEnd = freqStart, gain = 1, duration, decayRate = 5, start = 0, attackSec = 0.003 }) {
  const offset = seconds(start);
  const length = seconds(duration);
  let phase = 0;
  for (let i = 0; i < length && i + offset < out.length; i++) {
    const t = i / SR;
    const progress = i / length;
    const freq = freqStart * (freqEnd / freqStart) ** progress;
    phase += (2 * Math.PI * freq) / SR;
    out[i + offset] += Math.sin(phase) * gain * decay(t, decayRate) * attack(t, attackSec);
  }
}

/** Filtered noise - the "air" in a click, the paper in a stamp. */
function addNoise(out, { gain = 1, duration, decayRate = 40, start = 0, lowpass: lowpassK = 0.35, seed = 1 }) {
  const offset = seconds(start);
  const length = seconds(duration);
  // Deterministic LCG: re-running the script must produce byte-identical files.
  let rng = seed >>> 0;
  let last = 0;
  for (let i = 0; i < length && i + offset < out.length; i++) {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    const white = (rng / 0xffffffff) * 2 - 1;
    last += lowpassK * (white - last); // one-pole lowpass
    const t = i / SR;
    out[i + offset] += last * gain * decay(t, decayRate) * attack(t, 0.001);
  }
}

/**
 * Cheap shimmer tail: a few detuned feedback combs.
 *
 * `snapshot` decides whether the combs feed on the ORIGINAL dry signal or on
 * the running buffer. Chained (the default) each comb also re-processes the
 * previous comb's output, which compounds into a dense wash - fine as texture
 * under a short cue, but it was what turned the legendary reveal into flat
 * noise. Snapshot mode keeps the tail as space around the sound instead of a
 * layer on top of it.
 *
 * The default stays chained on purpose: the cues already approved were tuned
 * against it and must regenerate byte-identically.
 */
function addTail(out, { start = 0, gain = 0.22, delays = [0.037, 0.053, 0.071], feedback = 0.62, snapshot = false }) {
  const offset = seconds(start);
  const source = snapshot ? Float32Array.from(out) : out;
  for (const delaySec of delays) {
    const d = seconds(delaySec);
    for (let i = offset + d; i < out.length; i++) {
      out[i] += source[i - d] * feedback * gain;
    }
  }
}

/** Soft saturation - tames peaks and adds a little warmth instead of clipping. */
function saturate(out, amount = 1.4) {
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.tanh(out[i] * amount) / Math.tanh(amount);
  }
}

/**
 * Cascaded one-pole lowpass. Two poles give a 12dB/octave slope, which is what
 * actually removes fizz - a single pole at 6dB leaves far too much of the
 * 4-8kHz band, and that band is exactly what makes a UI sound painful.
 */
function lowpass(out, cutoffHz, poles = 2) {
  const k = 1 - Math.exp((-2 * Math.PI * cutoffHz) / SR);
  for (let pole = 0; pole < poles; pole++) {
    let state = 0;
    for (let i = 0; i < out.length; i++) {
      state += k * (out[i] - state);
      out[i] = state;
    }
  }
}

/**
 * Final stage: tone-shape, peak-normalise, then fade both edges.
 *
 * The fade-in is deliberately longer than the 2ms the first pass used. A 2ms
 * ramp is still a transient sharp enough to sting; 6ms is inaudible as a delay
 * but audibly softer.
 */
function finish(out, peak = 0.85, fadeOutSec = 0.02, { cutoffHz = TONE_CEILING_HZ, fadeInSec = 0.006 } = {}) {
  lowpass(out, cutoffHz);

  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 0) {
    const scale = peak / max;
    for (let i = 0; i < out.length; i++) out[i] *= scale;
  }

  const fadeIn = seconds(fadeInSec);
  for (let i = 0; i < fadeIn && i < out.length; i++) {
    // Raised cosine rather than linear: a linear ramp still has a corner at
    // both ends of the fade, and corners are broadband energy.
    out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeIn);
  }

  const fadeOut = seconds(fadeOutSec);
  for (let i = 0; i < fadeOut && i < out.length; i++) {
    out[out.length - 1 - i] *= i / fadeOut;
  }
  return out;
}

function writeWav(name, samples) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  const path = join(OUT_DIR, name);
  writeFileSync(path, buf);
  return { bytes: buf.length, name, seconds: samples.length / SR };
}

// ------------------------------------------------------------------ palette

const sounds = {
  // A wooden "tock", not a click. No noise burst at all: the noise transient
  // was what made the first version sting, and a pitched body carries the same
  // information without any 4-8kHz content.
  "button-click.wav": () => {
    const out = buffer(0.075);
    addTone(out, { duration: 0.07, freqStart: 520, freqEnd: 380, gain: 0.9, decayRate: 55, attackSec: 0.004 });
    addTone(out, { duration: 0.05, freqStart: 1040, gain: 0.16, decayRate: 90, attackSec: 0.004 });
    return finish(out, 0.34, 0.02, { cutoffHz: 2200, fadeInSec: 0.004 });
  },

  // NOT GENERATED - crate_reel_tick and debt_contract_signed keep their
  // original hand-made assets (crate-reel-tick.mp3, debt-contract-signed.wav).
  // They are deliberately absent from this map so re-running the script cannot
  // overwrite them. See the registry in src/lib/sound.ts for the paths.

  // Low and flat, not a buzzer. Says "no" without stabbing the ear. Saturation
  // was removed here - it was adding harmonics to an already sustained tone,
  // which is the definition of buzzy.
  "error.wav": () => {
    const out = buffer(0.34);
    addTone(out, { duration: 0.15, freqStart: 262, gain: 0.7, decayRate: 9, attackSec: 0.012 });
    addTone(out, { duration: 0.2, freqStart: 196, gain: 0.7, decayRate: 8, start: 0.11, attackSec: 0.012 });
    return finish(out, 0.5, 0.06, { cutoffHz: 1400 });
  },

  // Muted low thud with a downward bend - disappointment, not alarm.
  "task-fail.wav": () => {
    const out = buffer(0.45);
    addTone(out, { duration: 0.36, freqStart: 147, freqEnd: 87, gain: 0.9, decayRate: 7, attackSec: 0.01 });
    addNoise(out, { duration: 0.05, gain: 0.1, decayRate: 70, lowpass: 0.03, seed: 21 });
    return finish(out, 0.58, 0.07, { cutoffHz: 1200 });
  },

  // Two-note lift, an octave lower than the first pass. Short enough to fire 20
  // times an hour without wearing out.
  "task-completion.wav": () => {
    const out = buffer(0.55);
    addBell(out, { freq: 392, gain: 0.6, decayRate: 7 }); // G4
    addBell(out, { freq: 587.33, gain: 0.5, decayRate: 6.5, start: 0.08 }); // D5
    addTail(out, { gain: 0.14 });
    return finish(out, 0.62, 0.07, { cutoffHz: 3200 });
  },

  // Coin-ish, but pitched down hard from the original 1175Hz - its partials
  // reached 8kHz, which was the second-worst offender after the click.
  "tribute-sent.wav": () => {
    const out = buffer(0.6);
    addBell(out, { freq: 659.25, gain: 0.55, decayRate: 8, partials: [1, 2.4, 4.1] });
    addBell(out, { freq: 880, gain: 0.35, decayRate: 9, start: 0.05, partials: [1, 2.7] });
    addTail(out, { gain: 0.18 });
    return finish(out, 0.66, 0.08, { cutoffHz: 3400 });
  },

  // Soft purchase confirmation - warmer and lower than the tribute cue so the
  // two are never confused.
  "cosmetic-purchased.wav": () => {
    const out = buffer(0.62);
    addBell(out, { freq: 523.25, gain: 0.55, decayRate: 6.5 }); // C5
    addBell(out, { freq: 698.46, gain: 0.38, decayRate: 6, start: 0.09 }); // F5
    addTail(out, { gain: 0.16 });
    return finish(out, 0.62, 0.08, { cutoffHz: 3000 });
  },

  // NOT GENERATED - the cues below keep their original hand-made assets and
  // are absent from this map on purpose, so re-running the script can never
  // overwrite them:
  //   crate_reel_tick, debt_contract_signed, gallery_unlock,
  //   affection_level_up, random_event_activation, crate_reveal,
  //   crate_legendary_reveal
  // Their paths (and extensions - several are .mp3) live in the registry in
  // src/lib/sound.ts.
};

// --------------------------------------------------------------------- main

mkdirSync(OUT_DIR, { recursive: true });

let totalBytes = 0;
for (const [name, render] of Object.entries(sounds)) {
  const result = writeWav(name, render());
  totalBytes += result.bytes;
  console.log(
    `${name.padEnd(30)} ${result.seconds.toFixed(2).padStart(5)}s  ${(result.bytes / 1024).toFixed(0).padStart(4)} KB`,
  );
}
console.log(`\n${Object.keys(sounds).length} files, ${(totalBytes / 1024).toFixed(0)} KB total`);
