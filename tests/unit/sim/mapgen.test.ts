import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { createRound } from '../../../src/sim';
import { floodReach, foodNear, startsConnected } from '../../../src/sim/mapgen';
import { stateHash } from '../../../src/sim/hash';
import type { World } from '../../../src/sim/types';

const startsOf = (world: World): number[] => world.molds.map((m) => m.core);

describe('map generation (R12, US4)', () => {
  it('across 500 seeds: connected starts, fair food, enough open ground, rare fallback', () => {
    let worstFairness = 1;
    let fallbacks = 0;
    let retried = 0;
    const n = 500;
    for (let seed = 1; seed <= n; seed++) {
      const round = 1 + (seed % 5) * 2; // rounds 1, 3, 5, 7, 9: 2 to 6 molds
      const world = createRound({ runSeed: seed, roundNumber: round });
      const starts = startsOf(world);
      const where = `seed ${seed} round ${round}`;

      // every start can reach every other
      expect(startsConnected(world, starts), where).toBe(true);

      // every start has about the same food nearby (FR-020)
      const values = starts.map((s) => foodNear(world, s).value);
      const richest = Math.max(...values);
      const poorest = Math.min(...values);
      worstFairness = Math.min(worstFairness, poorest / richest);
      expect(poorest, where).toBeGreaterThanOrEqual((1 - defaultBalance.fairTolerance) * richest - 1e-6);

      // enough of the map is open ground that can be reached
      expect(world.reachableCells, where).toBeGreaterThanOrEqual(defaultBalance.minReachableArea * world.width * world.height);
      if (seed <= 50) {
        const reach = floodReach(world, world.molds[0]!.core);
        let count = 0;
        for (const v of reach) count += v;
        expect(count, where).toBe(world.reachableCells);
      }

      if (world.mapFallback) fallbacks++;
      if (world.mapAttempts > 1) retried++;
    }
    expect(worstFairness).toBeGreaterThanOrEqual(0.9);
    expect(fallbacks / n, 'open-map fallback rate').toBeLessThan(0.01);
    expect(retried / n, 'maps that needed a retry').toBeLessThan(0.25);
  }, 180_000);

  it('is identical for the same seed and round, and different for another seed', () => {
    const a = createRound({ runSeed: 42, roundNumber: 3 });
    const b = createRound({ runSeed: 42, roundNumber: 3 });
    expect(Buffer.from(a.terrain).equals(Buffer.from(b.terrain))).toBe(true);
    expect(a.foodSources.map((f) => [f.x, f.y, f.type])).toEqual(b.foodSources.map((f) => [f.x, f.y, f.type]));
    expect(startsOf(a)).toEqual(startsOf(b));
    expect(stateHash(a)).toBe(stateHash(b));
    const c = createRound({ runSeed: 43, roundNumber: 3 });
    expect(Buffer.from(a.terrain).equals(Buffer.from(c.terrain))).toBe(false);
    const d = createRound({ runSeed: 42, roundNumber: 4 });
    expect(d.width).not.toBe(a.width - 1000); // a different round is a different map (size or layout)
    expect(stateHash(d)).not.toBe(stateHash(a));
  });

  it('places one start per mold, far enough apart, and clear of obstacles', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const world = createRound({ runSeed: seed, roundNumber: 1 + (seed % 5) * 2 });
      const starts = startsOf(world);
      expect(starts.length).toBe(world.difficulty.rivalCount + 1);
      for (let i = 0; i < starts.length; i++) {
        expect(world.terrain[starts[i]!]).toBe(0);
        for (let j = i + 1; j < starts.length; j++) {
          const dx = (starts[i]! % world.width) - (starts[j]! % world.width);
          const dy = Math.floor(starts[i]! / world.width) - Math.floor(starts[j]! / world.width);
          expect(Math.hypot(dx, dy), `seed ${seed}`).toBeGreaterThan(defaultBalance.startClearRadius * 2);
        }
      }
    }
  }, 60_000);
});
