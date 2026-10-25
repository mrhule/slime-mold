import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../../src/game/loop';

describe('FixedStepLoop', () => {
  it('runs whole ticks and carries the remainder', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    expect(loop.advance(0.02)).toBe(0);
    expect(loop.advance(0.02)).toBe(0);
    expect(loop.advance(0.02)).toBe(1); // 0.06 total -> one 0.05 tick
    expect(n).toBe(1);
  });

  it('does nothing while paused and resumes without a burst', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    loop.speed = 0;
    for (let i = 0; i < 100; i++) loop.advance(0.1);
    expect(n).toBe(0);
    loop.speed = 1;
    loop.advance(0.05);
    expect(n).toBe(1);
  });

  it('speed multiplies ticks per second of real time', () => {
    for (const speed of [1, 2, 3] as const) {
      let n = 0;
      const loop = new FixedStepLoop(() => n++, 0.05, 1000);
      loop.speed = speed;
      for (let i = 0; i < 60; i++) loop.advance(1 / 60); // 1 real second
      expect(n).toBe(20 * speed);
    }
  });

  it('caps ticks per frame and drops the excess', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++, 0.05, 8);
    expect(loop.advance(5)).toBe(8);
    expect(loop.droppedTicks).toBeGreaterThan(0);
    expect(loop.advance(0.05)).toBe(1); // the backlog is gone
  });
});
