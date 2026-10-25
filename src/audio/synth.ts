import type { CueName } from './cues';

/**
 * The sound of each cue (A1): short oscillator and noise blips with gain envelopes, no samples.
 * Every recipe takes `(ctx, bus, strength, when)`, schedules everything up front on the audio clock,
 * and lets the nodes clean themselves up when they stop. Numbers are first guesses, tuned by ear.
 */
export type Recipe = (ctx: AudioContext, bus: AudioNode, strength: number, when: number) => void;

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** one second of white noise, made once per context and shared by every burst */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // a tiny xorshift generator: audio needs no randomness from the sim
    let s = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      data[i] = ((s >>> 0) / 4294967296) * 2 - 1;
    }
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

interface Tone {
  type: OscillatorType;
  freq: number;
  /** glide to this frequency over the tone's length */
  freqEnd?: number;
  start: number;
  dur: number;
  gain: number;
  /** seconds to reach full gain */
  attack?: number;
  /** a low-pass in front of the gain, in Hz */
  lowpass?: number;
}

function tone(ctx: AudioContext, bus: AudioNode, t: Tone): void {
  const osc = ctx.createOscillator();
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.freq, t.start);
  if (t.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.freqEnd), t.start + t.dur);
  const env = ctx.createGain();
  const attack = t.attack ?? 0.005;
  env.gain.setValueAtTime(0.0001, t.start);
  env.gain.linearRampToValueAtTime(t.gain, t.start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t.start + t.dur);
  let node: AudioNode = osc;
  if (t.lowpass !== undefined) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = t.lowpass;
    osc.connect(lp);
    node = lp;
  }
  node.connect(env);
  env.connect(bus);
  osc.start(t.start);
  osc.stop(t.start + t.dur + 0.02);
}

interface Burst {
  start: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
}

function burst(ctx: AudioContext, bus: AudioNode, b: Burst): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = b.filter;
  filter.frequency.setValueAtTime(b.freq, b.start);
  if (b.freqEnd !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, b.freqEnd), b.start + b.dur);
  filter.Q.value = b.q ?? 1;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, b.start);
  env.gain.linearRampToValueAtTime(b.gain, b.start + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, b.start + b.dur);
  src.connect(filter);
  filter.connect(env);
  env.connect(bus);
  src.start(b.start);
  src.stop(b.start + b.dur + 0.02);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const recipes: Record<CueName, Recipe> = {
  // a short soft tick whose pitch rises a little with how much grew
  grow(ctx, bus, strength, when) {
    tone(ctx, bus, { type: 'triangle', freq: lerp(480, 720, strength), freqEnd: lerp(640, 960, strength), start: when, dur: 0.07, gain: 0.1 + 0.06 * strength });
  },
  // a wet noise burst through a falling low-pass
  squelch(ctx, bus, strength, when) {
    burst(ctx, bus, { start: when, dur: 0.2, gain: 0.16 + 0.12 * strength, filter: 'lowpass', freq: 1100, freqEnd: 220, q: 6 });
    tone(ctx, bus, { type: 'sine', freq: 260, freqEnd: 130, start: when, dur: 0.16, gain: 0.08 });
  },
  // a rising two-tone alarm
  warn(ctx, bus, _strength, when) {
    for (const [i, f] of [660, 990, 660, 990].entries()) {
      tone(ctx, bus, { type: 'square', freq: f, start: when + i * 0.11, dur: 0.1, gain: 0.11, lowpass: 2400 });
    }
  },
  // a low thump plus a pop
  land(ctx, bus, _strength, when) {
    tone(ctx, bus, { type: 'sine', freq: 140, freqEnd: 42, start: when, dur: 0.3, gain: 0.5, attack: 0.003 });
    burst(ctx, bus, { start: when, dur: 0.09, gain: 0.22, filter: 'bandpass', freq: 1600, q: 1.5 });
  },
  // a bright two-note blip
  place(ctx, bus, _strength, when) {
    tone(ctx, bus, { type: 'triangle', freq: 660, start: when, dur: 0.09, gain: 0.16 });
    tone(ctx, bus, { type: 'triangle', freq: 990, start: when + 0.07, dur: 0.12, gain: 0.16 });
  },
  // a flat low buzz
  refuse(ctx, bus, _strength, when) {
    tone(ctx, bus, { type: 'sawtooth', freq: 110, start: when, dur: 0.16, gain: 0.14, lowpass: 420 });
  },
  // a punchy hit with a major chord, scaled by the size of the fight
  frontWon(ctx, bus, strength, when) {
    const g = 0.18 + 0.2 * strength;
    tone(ctx, bus, { type: 'sine', freq: 210, freqEnd: 62, start: when, dur: 0.22, gain: g * 1.4, attack: 0.003 });
    burst(ctx, bus, { start: when, dur: 0.12, gain: g * 0.8, filter: 'highpass', freq: 2200 });
    for (const f of [262, 330, 392]) tone(ctx, bus, { type: 'triangle', freq: f, start: when + 0.02, dur: 0.3, gain: g * 0.35 });
  },
  // the same hit with a minor chord and a heavier low end
  frontLost(ctx, bus, strength, when) {
    const g = 0.18 + 0.2 * strength;
    tone(ctx, bus, { type: 'sine', freq: 180, freqEnd: 48, start: when, dur: 0.28, gain: g * 1.5, attack: 0.003 });
    burst(ctx, bus, { start: when, dur: 0.14, gain: g * 0.7, filter: 'bandpass', freq: 900, q: 0.8 });
    for (const f of [220, 262, 330]) tone(ctx, bus, { type: 'sawtooth', freq: f * 0.5, start: when + 0.02, dur: 0.32, gain: g * 0.22, lowpass: 700 });
  },
  // short jingles
  roundStart(ctx, bus, _strength, when) {
    for (const [i, f] of [523, 659, 784].entries()) tone(ctx, bus, { type: 'triangle', freq: f, start: when + i * 0.11, dur: 0.2, gain: 0.16 });
  },
  roundWin(ctx, bus, _strength, when) {
    for (const [i, f] of [523, 659, 784, 1047].entries()) tone(ctx, bus, { type: 'triangle', freq: f, start: when + i * 0.13, dur: 0.34, gain: 0.17 });
    tone(ctx, bus, { type: 'sine', freq: 262, start: when, dur: 0.9, gain: 0.1, attack: 0.02 });
  },
  roundLose(ctx, bus, _strength, when) {
    for (const [i, f] of [392, 311, 262, 196].entries()) tone(ctx, bus, { type: 'sawtooth', freq: f, start: when + i * 0.18, dur: 0.4, gain: 0.12, lowpass: 900 });
  },
};

/** play one cue on `bus` at audio-clock time `when` */
export function playCue(ctx: AudioContext, bus: AudioNode, cue: CueName, strength: number, when: number): void {
  recipes[cue](ctx, bus, Math.min(1, Math.max(0, strength)), when);
}
