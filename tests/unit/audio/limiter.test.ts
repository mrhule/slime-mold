import { describe, expect, it } from 'vitest';
import { CUE_RULES, MAX_VOICES } from '../../../src/audio/cues';
import type { CueName, CueRule } from '../../../src/audio/cues';
import { Limiter } from '../../../src/audio/limiter';

describe('limiter (A4, FR-003)', () => {
  it('drops a cue that comes again inside its minimum interval, and admits it after', () => {
    const lim = new Limiter();
    const gap = CUE_RULES.grow.minIntervalMs;
    expect(lim.admit('grow', 0)).toBe(true);
    expect(lim.admit('grow', gap - 1)).toBe(false);
    expect(lim.admit('grow', gap)).toBe(true);
  });

  it('drops more than the per-second maximum, and recovers as the second slides by', () => {
    const lim = new Limiter();
    const max = CUE_RULES.place.maxPerSecond;
    let admitted = 0;
    for (let i = 0; i < 20; i++) if (lim.admit('place', i * 90)) admitted++; // 20 requests over 1.8 s, spaced past the interval
    expect(admitted).toBeLessThanOrEqual(Math.ceil(max * 1.8) + 1);
    // inside one second never more than max
    const lim2 = new Limiter();
    let inOneSecond = 0;
    for (let i = 0; i < 40; i++) if (lim2.admit('place', i * 20)) inOneSecond++; // 40 requests in 0.8 s
    expect(inOneSecond).toBeLessThanOrEqual(max);
    expect(lim2.admit('place', 1500)).toBe(true);
  });

  it('a bypass cue skips the interval, but the per-second maximum still applies', () => {
    const lim = new Limiter();
    expect(CUE_RULES.warn.bypass).toBe(true);
    expect(lim.admit('warn', 0)).toBe(true);
    expect(lim.admit('warn', 1)).toBe(true); // no interval for warn
    expect(lim.admit('warn', 2)).toBe(false); // but only two a second
    expect(lim.admit('warn', 1100)).toBe(true);
    // a normal cue forced through with bypass = true skips its interval
    const lim2 = new Limiter();
    expect(lim2.admit('refuse', 0)).toBe(true);
    expect(lim2.admit('refuse', 10)).toBe(false);
    expect(lim2.admit('refuse', 20, true)).toBe(true);
  });

  it('caps the global voice count, and recovers as voices end', () => {
    // many cues with generous rates, so only the voice cap bites
    const open: Record<CueName, CueRule> = Object.fromEntries(
      (Object.keys(CUE_RULES) as CueName[]).map((c) => [c, { minIntervalMs: 0, maxPerSecond: 1000, bypass: true, durationMs: 500 }]),
    ) as Record<CueName, CueRule>;
    const lim = new Limiter(open, MAX_VOICES);
    let admitted = 0;
    for (let i = 0; i < MAX_VOICES + 8; i++) if (lim.admit('grow', i)) admitted++;
    expect(admitted).toBe(MAX_VOICES);
    expect(lim.voiceCount(10)).toBe(MAX_VOICES);
    expect(lim.admit('grow', 20)).toBe(false);
    // after the sounds have rung out there is room again
    expect(lim.admit('grow', 700)).toBe(true);
    expect(lim.voiceCount(700)).toBeLessThan(MAX_VOICES);
  });

  it('a dropped request does not use up a voice or count toward the rate', () => {
    const lim = new Limiter();
    expect(lim.admit('squelch', 0)).toBe(true);
    for (let i = 1; i < 50; i++) lim.admit('squelch', i); // all inside the interval
    expect(lim.voiceCount(10)).toBe(1);
  });
});
