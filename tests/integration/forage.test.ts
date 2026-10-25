import { describe, expect, it } from 'vitest';
import { assertInvariants, createRound, enqueue, readHud, stateHash, step } from '../../src/sim';
import type { FoodSource, World } from '../../src/sim';

function nearestFood(world: World): FoodSource {
  const core = world.molds[0]!.core;
  const cx = core % world.width;
  const cy = Math.floor(core / world.width);
  let best: FoodSource | undefined;
  let bestD = Infinity;
  for (const f of world.foodSources) {
    const d = (f.x - cx) * (f.x - cx) + (f.y - cy) * (f.y - cy);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best!;
}

describe('forage (US1)', () => {
  it('a mold reaches the nearest food, absorbs it, and ends richer', () => {
    for (const seed of [1, 7, 42, 2024]) {
      const world = createRound({ runSeed: seed, roundNumber: 1 });
      expect(world.molds).toHaveLength(1);
      const food = nearestFood(world);
      const start = readHud(world, 1).storedNutrients;
      enqueue(world, { type: 'setTarget', mold: 1, cell: food.y * world.width + food.x });
      let reachedTick = -1;
      for (let t = 0; t < 1200; t++) {
        step(world);
        assertInvariants(world);
        if (reachedTick < 0 && world.owner[food.y * world.width + food.x] === 1) reachedTick = t;
      }
      expect(reachedTick, `seed ${seed} reached food`).toBeGreaterThanOrEqual(0);
      expect(food.depleted || food.remaining < food.total, `seed ${seed} absorbed`).toBe(true);
      expect(readHud(world, 1).storedNutrients, `seed ${seed} richer`).toBeGreaterThan(start);
    }
  });

  it('is deterministic: same seed and commands give the same state hash', () => {
    const run = (): number => {
      const world = createRound({ runSeed: 99, roundNumber: 1 });
      const food = nearestFood(world);
      enqueue(world, { type: 'setTarget', mold: 1, cell: food.y * world.width + food.x });
      for (let t = 0; t < 600; t++) step(world);
      return stateHash(world);
    };
    expect(run()).toBe(run());
  });

  it('generates sane maps: some obstacles, reachable food near the start', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const world = createRound({ runSeed: seed, roundNumber: 1 });
      let obstacles = 0;
      for (const t of world.terrain) if (t === 2) obstacles++;
      const frac = obstacles / world.terrain.length;
      expect(frac, `obstacle fraction seed ${seed}`).toBeGreaterThan(0.02);
      expect(frac, `obstacle fraction seed ${seed}`).toBeLessThan(0.3);
      expect(world.foodSources.length).toBeGreaterThanOrEqual(3);
      expect(world.reachableCells).toBeGreaterThan(world.terrain.length * 0.4);
    }
  });
});
