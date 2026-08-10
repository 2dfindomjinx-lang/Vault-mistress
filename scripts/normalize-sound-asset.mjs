// Loudness-normalises a WAV asset in place.
//
//   node scripts/normalize-sound-asset.mjs public/sounds/debt-contract-signed.wav -30.5
//
// WHY THIS EXISTS
//
// Peak normalisation does not match perceived loudness. A short bell and a
// sustained low tone at the same peak are nowhere near the same volume to the
// ear, which is how the palette ended up with a 25dB spread between its
// quietest and loudest cue - a gap no master-volume slider can fix, because the
// setting that makes the quiet ones audible makes the loud ones painful.
//
// So levels are measured, not guessed: ITU-R BS.1770 K-weighting, then the
// loudest 300ms window. Integrated loudness is the wrong tool for one-shots -
// it averages in the tail and reports a long decaying bell as quiet.
//
// IDEMPOTENT: it measures, then scales to the target. Running it twice changes
// nothing the second time. Safe to re-run after a `git checkout` of the asset.
//
// MP3s cannot be handled here - re-encoding needs a decoder this project does
// not ship. Those are balanced with the `volume` field in the sound registry
// instead, which is exactly what that field is for.

import { readFileSync, writeFileSync } from "node:fs";

const [, , path, targetArg] = process.argv;
if (!path) {
  console.error("usage: node scripts/normalize-sound-asset.mjs <file.wav> [targetLufs]");
  process.exit(1);
}
const TARGET_LUFS = Number(targetArg ?? -30.5);

// ---------------------------------------------------------------- wav parsing

const buf = readFileSync(path);
if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
  console.error(`${path} is not a RIFF/WAVE file.`);
  process.exit(1);
}

let format = null;
let dataOffset = 0;
let dataLength = 0;
for (let pos = 12; pos < buf.length - 8; ) {
  const id = buf.toString("ascii", pos, pos + 4);
  const size = buf.readUInt32LE(pos + 4);
  if (id === "fmt ") {
    format = {
      channels: buf.readUInt16LE(pos + 10),
      sampleRate: buf.readUInt32LE(pos + 12),
      bits: buf.readUInt16LE(pos + 22),
      tag: buf.readUInt16LE(pos + 8),
    };
  }
  if (id === "data") {
    dataOffset = pos + 8;
    dataLength = size;
    break;
  }
  pos += 8 + size + (size % 2);
}

if (!format || !dataOffset) {
  console.error("Could not find fmt/data chunks.");
  process.exit(1);
}
if (format.tag !== 1) {
  console.error(`Only uncompressed PCM is supported (format tag ${format.tag}).`);
  process.exit(1);
}

const bytesPerSample = format.bits / 8;
const totalSamples = Math.floor(dataLength / bytesPerSample);
const frames = Math.floor(totalSamples / format.channels);
const fullScale = 2 ** (format.bits - 1);

// ------------------------------------------------------------- measurement

function biquad(input, b, a) {
  const output = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const value = b[0] * input[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = input[i];
    y2 = y1; y1 = value;
    output[i] = value;
  }
  return output;
}

// Mono downmix at unity, plus the current peak.
let mono = new Float32Array(frames);
let peak = 0;
for (let frame = 0; frame < frames; frame++) {
  let sum = 0;
  for (let channel = 0; channel < format.channels; channel++) {
    const offset = dataOffset + (frame * format.channels + channel) * bytesPerSample;
    const value = buf.readIntLE(offset, bytesPerSample) / fullScale;
    sum += value;
    peak = Math.max(peak, Math.abs(value));
  }
  mono[frame] = sum / format.channels;
}

// K-weighting: high-shelf then high-pass. Coefficients are the BS.1770 48kHz
// set; at other rates the curve shifts slightly but this is only ever used to
// compare assets against each other, never as an absolute broadcast figure.
mono = biquad(mono, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
mono = biquad(mono, [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]);

const window = Math.round(0.3 * format.sampleRate);
let loudestMeanSquare = 0;
if (frames <= window) {
  let sum = 0;
  for (let i = 0; i < frames; i++) sum += mono[i] * mono[i];
  loudestMeanSquare = sum / Math.max(1, frames);
} else {
  let sum = 0;
  for (let i = 0; i < window; i++) sum += mono[i] * mono[i];
  loudestMeanSquare = sum / window;
  for (let i = window; i < frames; i++) {
    sum += mono[i] * mono[i] - mono[i - window] * mono[i - window];
    loudestMeanSquare = Math.max(loudestMeanSquare, sum / window);
  }
}

const currentLufs = -0.691 + 10 * Math.log10(loudestMeanSquare + 1e-12);
let gain = 10 ** ((TARGET_LUFS - currentLufs) / 20);

// Never clip. If the target would push the peak over full scale, take what
// headroom there is and say so rather than silently distorting.
const maxGain = peak > 0 ? 0.98 / peak : gain;
let clamped = false;
if (gain > maxGain) {
  gain = maxGain;
  clamped = true;
}

console.log(`${path}`);
console.log(`  format   ${format.bits}-bit ${format.sampleRate}Hz ${format.channels}ch, ${(frames / format.sampleRate).toFixed(2)}s`);
console.log(`  measured ${currentLufs.toFixed(1)} LUFS, peak ${peak.toFixed(4)} (${(20 * Math.log10(1 / peak)).toFixed(1)}dB headroom)`);
console.log(`  target   ${TARGET_LUFS.toFixed(1)} LUFS -> gain x${gain.toFixed(3)}${clamped ? " (CLAMPED to avoid clipping)" : ""}`);

if (Math.abs(20 * Math.log10(gain)) < 0.1) {
  console.log("  already at target, nothing written");
  process.exit(0);
}

// ------------------------------------------------------------------ rewrite

const limit = fullScale - 1;
for (let i = 0; i < totalSamples; i++) {
  const offset = dataOffset + i * bytesPerSample;
  const scaled = Math.round(buf.readIntLE(offset, bytesPerSample) * gain);
  buf.writeIntLE(Math.max(-limit, Math.min(limit, scaled)), offset, bytesPerSample);
}
writeFileSync(path, buf);
console.log(`  written  new peak ${(peak * gain).toFixed(4)}`);
