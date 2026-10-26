import { describe, expect, it } from 'vitest';
import { createRound } from '../../../src/sim';
import { winThreshold } from '../../../src/sim/round';
import { TICK_DT } from '../../../src/sim/types';

describe('winThreshold', () => {
  const world = createRound({ runSeed: 5, roundNumber: 1 });
  const at = (seconds: number): number => {
    world.tick = Math.round(seconds / TICK_DT);
    return winThreshold(world);
  };

  it('stays at the full figure early in a round', () => {
    expect(at(0)).toBe(world.balance.victoryControl);
    expect(at(world.balance.victoryEase.startSeconds)).toBeCloseTo(world.balance.victoryControl, 6);
  });

  it('eases down once a round drags on, never rising', () => {
    let last = at(0);
    for (let s = 0; s <= 3600; s += 15) {
      const t = at(s);
      expect(t).toBeLessThanOrEqual(last + 1e-9);
      last = t;
    }
    expect(at(world.balance.victoryEase.startSeconds + 120)).toBeCloseTo(world.balance.victoryControl - 2 * world.balance.victoryEase.perMinute, 6);
  });

  it('stops at the floor', () => {
    expect(at(36000)).toBe(world.balance.victoryEase.floor);
  });
});
