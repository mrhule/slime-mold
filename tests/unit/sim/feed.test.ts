import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { placeBuilding, recomputeFeed, recomputeSupply } from '../../../src/sim/buildings';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import type { Component } from '../../../src/sim/types';
import { cellOf, createOpenWorld } from '../../helpers';

const { coreReach, trickle } = defaultBalance.feed;
const reach = defaultBalance.buildings.storehouse.reach;

/** a straight vein east from the core, long enough to run past the core's reach */
function setup(len = 60) {
  const world = createOpenWorld(100, 40, defaultBalance);
  const mold = addMold(world, 'player', cellOf(world, 10, 20), 400);
  const cells: number[] = [cellOf(world, 11, 20)];
  for (let x = 12; x < 11 + len; x++) {
    const c = cellOf(world, x, 20);
    addCell(world, mold.id, c, cells[cells.length - 1] as number);
    cells.push(c);
  }
  return { world, mold, cells };
}

describe('feed: growth speed falls off with distance from supply', () => {
  it('is 1 at the core, tapers linearly along the vein, and holds the trickle past the reach', () => {
    const { world, mold, cells } = setup();
    recomputeFeed(world);
    expect(world.feed[mold.core]).toBeCloseTo(1, 6);
    for (let i = 0; i < cells.length; i++) {
      const d = i + 1;
      const want = d < coreReach ? trickle + (1 - trickle) * (1 - d / coreReach) : trickle;
      expect(world.feed[cells[i] as number], `cell ${i}`).toBeCloseTo(want, 5);
    }
  });

  it('a working store house restores full feed around itself', () => {
    const { world, mold, cells } = setup();
    const store = cells[50] as number;
    expect(placeBuilding(world, mold.id, 'storehouse', store)).toEqual({ ok: true });
    (world.components.get(world.component[store] as number) as Component).pool = 200;
    recomputeSupply(world);
    recomputeFeed(world);
    expect(world.feed[store]).toBeCloseTo(1, 6);
    expect(world.feed[cells[50 + 5] as number]).toBeCloseTo(trickle + (1 - trickle) * (1 - 5 / reach), 5);
    expect(world.feed[cells[50 - 5] as number]).toBeCloseTo(trickle + (1 - trickle) * (1 - 5 / reach), 5);
  });

  it('a store house that is not boosting gives no feed', () => {
    const { world, mold, cells } = setup();
    const store = cells[50] as number;
    placeBuilding(world, mold.id, 'storehouse', store);
    (world.components.get(world.component[store] as number) as Component).pool = 0;
    recomputeSupply(world);
    recomputeFeed(world);
    expect(world.feed[store]).toBeCloseTo(trickle, 6);
  });
});
