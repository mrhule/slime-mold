/**
 * Generative ambient music (A5): a held drone with sparse plucks from a minor pentatonic scale,
 * eight bars at about 56 BPM, notes picked by a small seeded generator so the loop is the same every
 * time. The pure parts (plan and scheduler) are separate from the Web Audio part so they can be
 * tested without audio; the scheduler is the standard lookahead pattern that keeps timing steady
 * while the main thread is busy.
 */
export const BPM = 56;
export const BEATS_PER_BAR = 4;
export const BARS = 8;
export const LOOP_SECONDS = (BARS * BEATS_PER_BAR * 60) / BPM;
export const BAR_SECONDS = (BEATS_PER_BAR * 60) / BPM;
/** how far ahead of the audio clock notes are queued */
export const LOOKAHEAD_SECONDS = 0.4;
/** how often the scheduler wakes up */
export const TICK_MS = 100;

/** A minor pentatonic over two octaves: A C D E G, in Hz */
export const SCALE_HZ: readonly number[] = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];

export interface PlannedNote {
  /** seconds from the start of the bar */
  at: number;
  freq: number;
  /** seconds */
  dur: number;
  /** 0..1 */
  gain: number;
}

/** small deterministic generator (mulberry32); local so audio stays free of sim imports */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the notes of every bar of the loop: 0 to 3 sparse plucks per bar, always on the scale */
export function planMusic(seed: number): PlannedNote[][] {
  const next = rng(seed);
  const beat = 60 / BPM;
  const bars: PlannedNote[][] = [];
  let degree = 2;
  for (let bar = 0; bar < BARS; bar++) {
    const notes: PlannedNote[] = [];
    const count = bar % 4 === 3 ? 1 + Math.floor(next() * 2) : Math.floor(next() * 4);
    // shuffle the four beats with a seeded Fisher-Yates, so the result does not depend on the engine's sort
    const beats = [0, 1, 2, 3];
    for (let i = beats.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [beats[i], beats[j]] = [beats[j] as number, beats[i] as number];
    }
    const slots = beats.slice(0, count).sort((x, y) => x - y);
    for (const slot of slots) {
      // wander by a step or two so it sounds like a tune, not random notes
      degree = Math.min(SCALE_HZ.length - 1, Math.max(0, degree + Math.floor(next() * 5) - 2));
      notes.push({ at: slot * beat + (next() < 0.3 ? beat / 2 : 0), freq: SCALE_HZ[degree] as number, dur: 1.6 + next() * 1.4, gain: 0.5 + next() * 0.5 });
    }
    bars.push(notes);
  }
  return bars;
}

export interface ScheduledNote {
  /** audio-clock time to start */
  time: number;
  freq: number;
  dur: number;
  gain: number;
}

/**
 * Hands out the notes that fall due before `now + lookahead`, looping the plan forever. It never
 * queues further ahead than the lookahead, however long it was since the last call.
 */
export class MusicScheduler {
  private bar = 0;
  private barTime: number;
  private index = 0;
  private readonly plan: PlannedNote[][];

  constructor(seed: number, startTime: number, private readonly lookahead = LOOKAHEAD_SECONDS) {
    this.plan = planMusic(seed);
    this.barTime = startTime;
  }

  advance(now: number): ScheduledNote[] {
    const out: ScheduledNote[] = [];
    const horizon = now + this.lookahead;
    // a long pause (a hidden tab): skip ahead instead of dumping a backlog of old notes
    if (this.barTime + BAR_SECONDS < now) {
      const skipped = Math.floor((now - this.barTime) / BAR_SECONDS);
      this.barTime += skipped * BAR_SECONDS;
      this.bar = (this.bar + skipped) % BARS;
      this.index = 0;
    }
    for (;;) {
      const notes = this.plan[this.bar] as PlannedNote[];
      while (this.index < notes.length) {
        const n = notes[this.index] as PlannedNote;
        const time = this.barTime + n.at;
        if (time >= horizon) return out;
        if (time >= now - 0.02) out.push({ time, freq: n.freq, dur: n.dur, gain: n.gain });
        this.index++;
      }
      if (this.barTime + BAR_SECONDS >= horizon) return out;
      this.barTime += BAR_SECONDS;
      this.bar = (this.bar + 1) % BARS;
      this.index = 0;
    }
  }
}

/** the Web Audio side: a drone plus the scheduled plucks, on one bus */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private drone: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  private scheduler: MusicScheduler | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly bus: AudioNode,
    private readonly seed = 0x51ed,
  ) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    const ctx = this.ctx;
    // the drone: two detuned saws through a low-pass, breathing slowly
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    const oscs = [110, 110.7, 164.8].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      return o;
    });
    lfo.start();
    oscs.push(lfo);
    lp.connect(gain);
    gain.connect(this.bus);
    this.drone = { oscs, gain };

    this.scheduler = new MusicScheduler(this.seed, ctx.currentTime + 0.1);
    this.timer = setInterval(() => this.pump(), TICK_MS);
    this.pump();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const d = this.drone;
    this.drone = null;
    if (d) {
      try {
        d.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        d.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
        for (const o of d.oscs) o.stop(this.ctx.currentTime + 1.5);
      } catch {
        /* already stopped */
      }
    }
    this.scheduler = null;
  }

  private pump(): void {
    const sched = this.scheduler;
    if (!sched) return;
    const ctx = this.ctx;
    for (const n of sched.advance(ctx.currentTime)) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = n.freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, n.time);
      env.gain.linearRampToValueAtTime(0.14 * n.gain, n.time + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, n.time + n.dur);
      osc.connect(env);
      env.connect(this.bus);
      osc.start(n.time);
      osc.stop(n.time + n.dur + 0.05);
    }
  }
}
