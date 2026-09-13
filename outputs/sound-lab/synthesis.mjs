// Standalone DSP helpers copied from the first audition generator. No filesystem side effects.
const SR=48000, TAU=Math.PI*2;
function random(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; };
}
function seedOf(text) { let seed = 2166136261; for (const c of text) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619); return seed >>> 0; }
const frames = seconds => Math.max(1, Math.round(seconds * SR));
const fade = (t, duration, attack = .002, release = .025) =>
  Math.sin(Math.min(1, t / attack) * Math.PI / 2) ** 2 *
  Math.sin(Math.min(1, Math.max(0, duration - t) / release) * Math.PI / 2) ** 2;

class Scene {
  constructor(seconds, seed) {
    this.left = new Float32Array(frames(seconds));
    this.right = new Float32Array(this.left.length);
    this.random = random(seed);
  }
  mix(mono, start = 0, pan = 0, gain = 1) {
    const shift = Math.round(start * SR);
    const l = Math.cos((pan + 1) * Math.PI / 4) * gain;
    const r = Math.sin((pan + 1) * Math.PI / 4) * gain;
    for (let i = 0; i < mono.length && i + shift < this.left.length; i++) {
      if (i + shift < 0) continue;
      this.left[i + shift] += mono[i] * l;
      this.right[i + shift] += mono[i] * r;
    }
  }
  tone(at, hz, duration, gain, { end = hz, pan = 0, decay = 5, attack = .006, harmonic = .08, fm = 0 } = {}) {
    const out = new Float32Array(frames(duration));
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const freq = end + (hz - end) * Math.exp(-t * 13);
      phase += TAU * freq / SR;
      const mod = fm * Math.exp(-t * 9) * Math.sin(phase * 2.007);
      out[i] = (Math.sin(phase + mod) + harmonic * Math.sin(phase * 2)) * Math.exp(-t * decay) * fade(t, duration, attack);
    }
    this.mix(out, at, pan, gain);
  }
  modal(at, hz, duration, gain, { pan = 0, metal = false, muted = false } = {}) {
    const out = new Float32Array(frames(duration));
    const ratios = metal ? [1, 1.491, 2.136, 3.069, 4.25, 5.18] : [1, 2.756, 5.404];
    for (let p = 0; p < ratios.length; p++) {
      const freq = hz * ratios[p];
      if (freq > 6200) continue;
      const amp = 1 / (p + 1) ** (metal ? 1.9 : 2.1);
      const decay = (muted ? 24 : 5) * (1 + p * .45);
      for (let i = 0; i < out.length; i++) {
        const t = i / SR;
        out[i] += Math.sin(TAU * freq * t) * amp * Math.exp(-decay * t) * fade(t, duration, .0018, .03);
      }
    }
    this.mix(out, at, pan, gain);
  }
  friction(at, duration, gain, { pan = 0, low = 300, high = 3800, swell = false, flutter = 0, decay = 5 } = {}) {
    const out = new Float32Array(frames(duration));
    let lo = 0, hi = 0;
    const a = 1 - Math.exp(-TAU * high / SR), b = 1 - Math.exp(-TAU * low / SR);
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const n = this.random();
      hi += a * (n - hi); lo += b * (n - lo);
      const shape = swell ? Math.sin(Math.PI * t / duration) ** 1.4 : Math.exp(-decay * t);
      const flutterShape = flutter ? .3 + .7 * Math.sin(TAU * flutter * t + .5 * Math.sin(27 * t)) ** 2 : 1;
      out[i] = (hi - lo) * shape * flutterShape * fade(t, duration, .003, .025);
    }
    this.mix(out, at, pan, gain);
  }
  pluck(at, hz, duration, gain, pan = 0, dark = .55) {
    const out = new Float32Array(frames(duration));
    // Fractional-delay Karplus–Strong string; interpolated for accurate tuning.
    const delay = SR / hz - .5;
    const ring = new Float32Array(Math.ceil(delay) + 2);
    for (let i = 0; i < ring.length; i++) ring[i] = this.random() * .7;
    let cursor = 0, previous = 0;
    const read = pos => { pos = (pos + ring.length * 2) % ring.length; const a = Math.floor(pos); return ring[a] * (1 - pos + a) + ring[(a + 1) % ring.length] * (pos - a); };
    for (let i = 0; i < out.length; i++) {
      const sample = read(cursor - delay);
      const filtered = (sample * (1 - dark) + previous * dark) * .994;
      ring[cursor] = filtered;
      previous = sample;
      cursor = (cursor + 1) % ring.length;
      out[i] = sample * fade(i / SR, duration, .003, .08);
    }
    this.mix(out, at, pan, gain);
  }
  pad(at, notes, duration, gain, { attack = .15, pan = 0 } = {}) {
    const out = new Float32Array(frames(duration));
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      let value = 0;
      for (let n = 0; n < notes.length; n++) {
        const f = notes[n];
        value += Math.sin(TAU * f * t + .022 * Math.sin(TAU * 4.4 * t + n)) * .7;
        value += Math.sin(TAU * f * 1.0018 * t) * .2 + Math.sin(TAU * f * 2 * t) * .07;
      }
      out[i] = value / notes.length * fade(t, duration, attack, Math.min(.65, duration * .7)) * Math.exp(-t * .5);
    }
    this.mix(out, at, pan, gain);
  }
  impact(at, hz, gain = 1, pan = 0) {
    this.tone(at, hz * 1.8, .27, gain, { end: hz, decay: 19, pan, harmonic: .03, attack: .002 });
    this.friction(at, .055, gain * .36, { low: 400, high: 4400, decay: 70, pan });
  }
  room(wet = .12, size = 1) {
    // Parallel diffused reflections from a dry snapshot, with frequency loss on every tap.
    const dry = [this.left.slice(), this.right.slice()];
    const times = [.029, .043, .061, .083, .113, .151, .197, .257, .337, .419, .523, .653, .797];
    for (let k = 0; k < times.length; k++) {
      const shift = frames(times[k] * size);
      const attenuation = wet * Math.exp(-times[k] * 3.6 / size) / Math.sqrt(k + 1);
      for (let c = 0; c < 2; c++) {
        const source = dry[(c + k) % 2];
        const dest = c ? this.right : this.left;
        const delay = shift + (c ? frames(.0023 * ((k % 3) + 1)) : 0);
        let smoothed = 0;
        const alpha = 1 - Math.exp(-TAU * (4200 / (1 + k * .16)) / SR);
        for (let i = delay; i < dest.length; i++) {
          smoothed += alpha * (source[i - delay] - smoothed);
          dest[i] += smoothed * attenuation;
        }
      }
    }
    return this;
  }
}

function biquad(input, b, a) {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const y = b[0] * input[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = input[i]; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}
function loudness(channels) {
  const weighted = channels.map(ch => biquad(biquad(ch,
    [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, .73248077421585]),
    [1, -2, 1], [1, -1.99004745483398, .99007225036621]));
  const count = channels[0].length, window = Math.min(frames(.3), count);
  let sum = 0, maximum = 0;
  for (let i = 0; i < count; i++) {
    for (const ch of weighted) sum += ch[i] ** 2 - (i >= window ? ch[i - window] ** 2 : 0);
    if (i >= window - 1) maximum = Math.max(maximum, sum / window);
  }
  return -.691 + 10 * Math.log10(maximum + 1e-15);
}
function finish(scene, target) {
  const channels = [scene.left, scene.right];
  // DC blocking, two gentle low-passes, and exact-zero edges on every export.
  for (const channel of channels) {
    let x1 = 0, y1 = 0, low1 = 0, low2 = 0;
    const alpha = 1 - Math.exp(-TAU * 6900 / SR);
    for (let i = 0; i < channel.length; i++) {
      const x = channel[i], hp = x - x1 + .995 * y1;
      x1 = x; y1 = hp; low1 += alpha * (hp - low1); low2 += alpha * (low1 - low2);
      channel[i] = low2 * fade(i / SR, (channel.length - 1) / SR, .001, Math.min(.12, channel.length / SR * .23));
    }
  }
  let peak = 0;
  for (const ch of channels) for (const v of ch) { if (!Number.isFinite(v)) throw new Error('Non-finite audio'); peak = Math.max(peak, Math.abs(v)); }
  const measured = loudness(channels);
  const gain = Math.min(10 ** ((target - measured) / 20), .84 / Math.max(peak, 1e-9));
  for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] *= gain;
  const waveform = Array.from({ length: 64 }, (_, j) => {
    let max = 0;
    for (let i = Math.floor(j * channels[0].length / 64); i < Math.floor((j + 1) * channels[0].length / 64); i++) max = Math.max(max, Math.abs(channels[0][i]), Math.abs(channels[1][i]));
    return Math.round(max / (peak * gain) * 1000) / 1000;
  });
  return { channels, peak: peak * gain, lufs: measured + 20 * Math.log10(gain), waveform };
}
function wav(channels) {
  const size = channels[0].length * 4;
  const buf = Buffer.alloc(44 + size);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + size, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(size, 40);
  const dither = random(784933);
  for (let i = 0; i < channels[0].length; i++) for (let ch = 0; ch < 2; ch++) {
    const sample = channels[ch][i];
    const value = sample === 0 ? 0 : Math.round(sample * 32767 + (dither() + dither()) * .5);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, value)), 44 + (i * 2 + ch) * 2);
  }
  return buf;
}


export { Scene, finish, wav, loudness, SR, TAU, seedOf, frames, fade, random };
