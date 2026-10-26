import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { canPlace } from '../../../src/sim/buildings';
import { engulfFood, placeFood, poolCounts, poolIncome } from '../../../src/sim/food';
import { readHud } from '../../../src/sim/hud';
import { addMold } from '../../../src/sim/molds';
import { addCell, removeCell, removeCellAndSplit } from '../../../src/sim/network';
import { createRound } from '../../../src/sim';
import { poolsNear } from '../../../src/sim/mapgen';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import type { World } from '../../../src/sim/types';
import { cellOf, createOpenWorld, createWorldWithMold, withStoreHouse } from '../../helpers';

const RATE = defaultBalance.foodTypes.goo.absorbRate; // per cell per second

/** a mold whose east arm reaches a goo pool at (14..17, 19..21); returns the world and the arm's last cell */
function reachPool(): { world: World; mold: { id: number }; arm: number; pool: ReturnType<typeof placeFood> } {
  const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
  const pool = placeFood(world, 'goo', 14, 19, 'initial');
  let prev = cellOf(world, 11, 20);
  for (let x = 12; x <= 13; x++) {
    addCell(world, mold.id, cellOf(world, x, 20), prev);
    prev = cellOf(world, x, 20);
  }
  addCell(world, mold.id, cellOf(world, 14, 20), prev); // touches the pool
  engulfFood(world, mold.id, cellOf(world, 14, 20));
  return { world, mold, arm: prev, pool };
}

describe('goo pools (008)', () => {
  it('a vein that touches a pool engulfs the whole footprint for free', () => {
    const { world, mold } = reachPool();
    let held = 0;
    for (let y = 19; y <= 21; y++) for (let x = 14; x <= 17; x++) if (world.owner[cellOf(world, x, y)] === mold.id) held++;
    expect(held).toBe(12);
  });

  it('pays nothing without a store house, then its rate per cell per second with one', () => {
    const { world, mold, arm } = reachPool();
    expect(poolIncome(world, mold.id)).toBe(0);
    expect(poolCounts(world, mold.id)).toEqual({ held: 1, waiting: 1 });
    const comp = world.components.get(world.component[arm]!)!;
    withStoreHouse(world, mold.id, arm);
    expect(poolIncome(world, mold.id)).toBeCloseTo(12 * RATE);
    expect(poolCounts(world, mold.id)).toEqual({ held: 1, waiting: 0 });
    const before = comp.pool;
    const gained = world.molds[mold.id - 1]!.stats.nutrientsGathered;
    step(world);
    expect(world.molds[mold.id - 1]!.stats.nutrientsGathered - gained).toBeCloseTo(12 * RATE * TICK_DT, 6);
    expect(comp.pool).toBeGreaterThan(before - 1); // pays in, minus a tick of upkeep
  });

  it('income follows the cells held: fewer ring cells, less income', () => {
    const { world, mold, arm } = reachPool();
    withStoreHouse(world, mold.id, arm);
    const full = poolIncome(world, mold.id);
    // lose three cells of the pool's far column
    for (let y = 19; y <= 21; y++) removeCell(world, cellOf(world, 17, y));
    expect(poolIncome(world, mold.id)).toBeCloseTo(full - 3 * RATE);
  });

  it('never runs out: the same income after a very long time, nothing depleted', () => {
    const { world, mold, arm, pool } = reachPool();
    withStoreHouse(world, mold.id, arm);
    const first = poolIncome(world, mold.id);
    for (let i = 0; i < 4000; i++) {
      step(world);
      for (const c of world.components.values()) c.pool = 100; // keep the mold fed so it lives on
    }
    expect(pool!.depleted).toBe(false);
    expect(pool!.remaining).toBe(pool!.total);
    expect(world.food[cellOf(world, 15, 20)]).toBeGreaterThan(0);
    expect(poolIncome(world, mold.id)).toBeCloseTo(first);
  });

  it('stops paying a piece that is cut off from its store house, and pays again with a new one', () => {
    const { world, mold, arm } = reachPool();
    withStoreHouse(world, mold.id, cellOf(world, 11, 20)); // in the core's piece
    expect(poolIncome(world, mold.id)).toBeGreaterThan(0);
    removeCellAndSplit(world, arm); // cuts the pool away from the core and its store house
    expect(poolIncome(world, mold.id)).toBe(0);
    expect(poolCounts(world, mold.id).waiting).toBe(1);
    const piece = world.components.get(world.component[cellOf(world, 14, 20)]!)!;
    withStoreHouse(world, mold.id, cellOf(world, 15, 20));
    expect(world.component[cellOf(world, 15, 20)]).toBe(piece.id);
    expect(poolIncome(world, mold.id)).toBeGreaterThan(0);
  });

  it('a harvester is never placed on a pool', () => {
    const { world, mold, arm } = reachPool();
    for (const c of world.components.values()) c.pool = 500;
    expect(canPlace(world, mold.id, 'harvester', arm)).toEqual({ ok: false, reason: 'no-food-nearby' });
  });

  it('shows in the HUD: income and a pool waiting for a store house', () => {
    const { world, mold, arm } = reachPool();
    expect(readHud(world, mold.id).pools).toEqual({ held: 1, waiting: 1 });
    expect(readHud(world, mold.id).poolIncome).toBe(0);
    withStoreHouse(world, mold.id, arm);
    const hud = readHud(world, mold.id);
    expect(hud.pools).toEqual({ held: 1, waiting: 0 });
    expect(hud.poolIncome).toBeCloseTo(12 * RATE);
  });
});

describe('contested goo pools (008 US3)', () => {
  /** two molds, each holding one half of a pool, each on its own piece */
  function contested(): { world: World; a: number; b: number; cellA: number; cellB: number } {
    const world = createOpenWorld(60, 40);
    const ma = addMold(world, 'player', cellOf(world, 10, 20), 100);
    const mb = addMold(world, 'rival', cellOf(world, 30, 20), 100);
    placeFood(world, 'goo', 17, 19, 'initial');
    let prevA = cellOf(world, 11, 20);
    for (let x = 12; x <= 16; x++) {
      addCell(world, ma.id, cellOf(world, x, 20), prevA);
      prevA = cellOf(world, x, 20);
    }
    let prevB = cellOf(world, 29, 20);
    for (let x = 28; x >= 21; x--) {
      addCell(world, mb.id, cellOf(world, x, 20), prevB);
      prevB = cellOf(world, x, 20);
    }
    // a holds the two west columns of the pool, b the two east columns
    for (const x of [17, 18]) for (let y = 19; y <= 21; y++) addCell(world, ma.id, cellOf(world, x, y), y === 19 ? cellOf(world, x - 1, 20) : cellOf(world, x, y - 1));
    for (const x of [20, 19]) for (let y = 19; y <= 21; y++) addCell(world, mb.id, cellOf(world, x, y), y === 19 ? cellOf(world, x + 1, 20) : cellOf(world, x, y - 1));
    return { world, a: ma.id, b: mb.id, cellA: prevA, cellB: prevB };
  }

  it('each mold earns for the cells it holds, and only on a piece with its own store house', () => {
    const { world, a, b } = contested();
    expect(poolIncome(world, a)).toBe(0);
    expect(poolIncome(world, b)).toBe(0);
    withStoreHouse(world, a, cellOf(world, 12, 20));
    expect(poolIncome(world, a)).toBeCloseTo(6 * RATE);
    expect(poolIncome(world, b)).toBe(0);
    withStoreHouse(world, b, cellOf(world, 27, 20));
    expect(poolIncome(world, b)).toBeCloseTo(6 * RATE);
  });

  it('a front that moves cells moves income to the winner on the next tick', () => {
    const { world, a, b } = contested();
    withStoreHouse(world, a, cellOf(world, 12, 20));
    withStoreHouse(world, b, cellOf(world, 27, 20));
    // b loses a column to a
    for (let y = 19; y <= 21; y++) {
      removeCell(world, cellOf(world, 19, y));
      addCell(world, a, cellOf(world, 19, y), y === 19 ? cellOf(world, 18, 20) : cellOf(world, 19, y - 1));
    }
    step(world);
    expect(poolIncome(world, a)).toBeCloseTo(9 * RATE);
    expect(poolIncome(world, b)).toBeCloseTo(3 * RATE);
  });

  it('nobody earns from a pool nobody holds', () => {
    const world = createOpenWorld(60, 40);
    const m = addMold(world, 'player', cellOf(world, 10, 20), 100);
    placeFood(world, 'goo', 30, 10, 'initial');
    withStoreHouse(world, m.id, cellOf(world, 10, 20));
    expect(poolIncome(world, m.id)).toBe(0);
    expect(poolCounts(world, m.id)).toEqual({ held: 0, waiting: 0 });
  });
});

describe('goo pool placement (008 FR-001, FR-010)', () => {
  it('every start has a pool within reach, starts differ by at most one, and contested pools exist', () => {
    for (const round of [1, 2, 3, 4]) {
      for (let seed = 1; seed <= 12; seed++) {
        const world = createRound({ runSeed: seed * 7919, roundNumber: round });
        const starts = world.molds.map((m) => m.core);
        const counts = starts.map((s) => poolsNear(world, s));
        expect(Math.min(...counts), `seed ${seed} round ${round}`).toBeGreaterThanOrEqual(1);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        const pools = world.foodSources.filter((f) => world.balance.foodTypes[f.type].infinite);
        expect(pools.length).toBeGreaterThanOrEqual(starts.length + world.balance.pools.contested);
      }
    }
  });

  it('pools never overlap other food and are on reachable ground', () => {
    const world = createRound({ runSeed: 4242, roundNumber: 3 });
    for (const f of world.foodSources) {
      if (!world.balance.foodTypes[f.type].infinite) continue;
      for (let y = f.y; y < f.y + f.h; y++) {
        for (let x = f.x; x < f.x + f.w; x++) {
          const c = cellOf(world, x, y);
          expect(world.foodSourceId[c]).toBe(f.id);
          expect(world.reachable[c]).toBe(1);
        }
      }
    }
  });
});
