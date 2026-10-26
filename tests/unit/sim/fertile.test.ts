import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { createRound } from '../../../src/sim';
import { stateHash } from '../../../src/sim/hash';
import { fertileNear } from '../../../src/sim/mapgen';
import { Terrain } from '../../../src/sim/types';
import type { World } from '../../../src/sim/types';

const f = defaultBalance.fertile;
const startsOf = (world: World): number[] => world.molds.map((m) => m.core);

describe('fertile ground generation (003 FR-008, FR-015, S9)', () => {
  it('across 300 seeds: every start has fertile ground in reach, in comparable amounts, only on open or rough ground', () => {
    let worst = 1;
    let fallbacks = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const round = 1 + (seed % 5) * 2; // 2 to 6 molds
      const world = createRound({ runSeed: seed, roundNumber: round });
      const where = `seed ${seed} round ${round}`;
      if (world.mapFallback) fallbacks++;
      let total = 0;
      for (let i = 0; i < world.fertile.length; i++) {
        if (!world.fertile[i]) continue;
        total++;
        expect([Terrain.Open, Terrain.Rough], `${where} cell ${i}`).toContain(world.terrain[i]);
      }
      expect(total, where).toBeGreaterThan(0);
      if (world.mapFallback) continue;
      const counts = startsOf(world).map((s) => fertileNear(world, s));
      const most = Math.max(...counts);
      worst = Math.min(worst, Math.min(...counts) / most);
      for (const n of counts) {
        expect(n, where).toBeGreaterThanOrEqual(f.minNear);
        expect(n, where).toBeGreaterThanOrEqual((1 - 2 * defaultBalance.fairTolerance) * most - 1e-6);
      }
    }
    expect(worst).toBeGreaterThanOrEqual(1 - 2 * defaultBalance.fairTolerance);
    expect(fallbacks / 300, 'open-map fallback rate').toBeLessThan(0.02);
  }, 240_000);

  it('puts some fertile ground away from every start, to fight over', () => {
    let withContested = 0;
    const seeds = 40;
    for (let seed = 1; seed <= seeds; seed++) {
      const world = createRound({ runSeed: seed, roundNumber: 5 });
      const w = world.width;
      const starts = startsOf(world);
      const far = Math.min(world.width, world.height) / 5;
      let found = false;
      for (let i = 0; i < world.fertile.length && !found; i++) {
        if (!world.fertile[i]) continue;
        const x = i % w;
        const y = Math.floor(i / w);
        if (starts.every((s) => (x - (s % w)) ** 2 + (y - Math.floor(s / w)) ** 2 > far * far)) found = true;
      }
      if (found) withContested++;
    }
    expect(withContested / seeds).toBeGreaterThan(0.8);
  });

  it('is the same for the same seed and round', () => {
    const a = createRound({ runSeed: 42, roundNumber: 3 });
    const b = createRound({ runSeed: 42, roundNumber: 3 });
    expect(Array.from(a.fertile)).toEqual(Array.from(b.fertile));
    expect(stateHash(a)).toBe(stateHash(b));
  });
});
