import { describe, expect, it } from 'vitest';
import { BAR_SECONDS, BARS, LOOKAHEAD_SECONDS, LOOP_SECONDS, MusicScheduler, SCALE_HZ, planMusic } from '../../../src/audio/music';

describe('generative music (A5)', () => {
  it('the same seed gives the same notes; another seed gives different ones', () => {
    expect(planMusic(1234)).toEqual(planMusic(1234));
    expect(planMusic(1234)).not.toEqual(planMusic(4321));
  });

  it('every note belongs to the scale, with sensible timing and level', () => {
    for (const seed of [1, 2, 3, 99, 0x51ed]) {
      for (const bar of planMusic(seed)) {
        expect(bar.length).toBeLessThanOrEqual(3);
        for (const n of bar) {
          expect(SCALE_HZ).toContain(n.freq);
          expect(n.at).toBeGreaterThanOrEqual(0);
          expect(n.at).toBeLessThan(BAR_SECONDS);
          expect(n.dur).toBeGreaterThan(0);
          expect(n.gain).toBeGreaterThan(0);
          expect(n.gain).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('the loop is eight bars of about 56 BPM', () => {
    expect(planMusic(7)).toHaveLength(BARS);
    expect(BARS).toBe(8);
    expect(LOOP_SECONDS).toBeCloseTo((8 * 4 * 60) / 56, 6);
  });

  it('the scheduler never queues notes further ahead than the lookahead', () => {
    const sched = new MusicScheduler(5, 0);
    for (let now = 0; now < 120; now += 0.1) {
      for (const n of sched.advance(now)) {
        expect(n.time).toBeLessThan(now + LOOKAHEAD_SECONDS + 1e-9);
        expect(n.time).toBeGreaterThanOrEqual(now - 0.02 - 1e-9);
      }
    }
  });

  it('plays every planned note once per loop, in order, and loops forever', () => {
    const plan = planMusic(5);
    const total = plan.reduce((s, b) => s + b.length, 0);
    const sched = new MusicScheduler(5, 0);
    const times: number[] = [];
    for (let now = 0; now < LOOP_SECONDS * 2 + 1; now += 0.05) for (const n of sched.advance(now)) times.push(n.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.filter((t) => t < LOOP_SECONDS - 1e-6)).toHaveLength(total);
    expect(times.filter((t) => t >= LOOP_SECONDS - 1e-6 && t < 2 * LOOP_SECONDS - 1e-6)).toHaveLength(total);
  });

  it('after a long pause it skips ahead instead of dumping a backlog', () => {
    const sched = new MusicScheduler(5, 0);
    sched.advance(0.1);
    const burst = sched.advance(500); // a hidden tab came back
    expect(burst.length).toBeLessThan(6);
    for (const n of burst) expect(n.time).toBeGreaterThanOrEqual(500 - 0.02);
  });
});
