import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import type { BalanceConfig } from '../../../src/config/balance';
import { capOf, placeBuilding } from '../../../src/sim/buildings';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import type { Component } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld, withStoreHouse } from '../../helpers';

const farm = defaultBalance.buildings.farm;
const balance: BalanceConfig = {
  ...defaultBalance,
  coreIncome: 0,
  upkeepPerCell: 0,
  buildings: { ...defaultBalance.buildings, storehouse: { ...defaultBalance.buildings.storehouse, upkeep: 0 } },
};

function setup() {
  const world = createOpenWorld(60, 30, balance, 1, { fertile: true });
  const mold = addMold(world, 'player', cellOf(world, 10, 15), 200);
  let prev = cellOf(world, 11, 15);
  const cells = [prev];
  for (let x = 12; x < 20; x++) {
    const c = cellOf(world, x, 15);
    addCell(world, mold.id, c, prev);
    cells.push(c);
    prev = c;
  }
  placeBuilding(world, mold.id, 'farm', cells[2] as number);
  withStoreHouse(world, mold.id, cells[6] as number);
  const comp = world.components.get(world.component[mold.core] as number) as Component;
  return { world, mold, cells, comp };
}

describe('farms throttle at the cap (FR-012, S5)', () => {
  it('pays nothing while the stock is at its cap, and the pool never goes over', () => {
    const { world, comp } = setup();
    comp.pool = capOf(world, comp);
    for (let i = 0; i < 30; i++) {
      step(world);
      expect(comp.pool).toBeLessThanOrEqual(capOf(world, comp) + 1e-6);
    }
    expect(comp.pool).toBeCloseTo(capOf(world, comp) - farm.upkeep * TICK_DT * 0, 1);
    assertInvariants(world);
  });

  it('pays exactly the headroom when less than a tick of output fits', () => {
    const { world, comp } = setup();
    const cap = capOf(world, comp);
    comp.pool = cap - 0.02;
    // upkeep is paid after income, so the farm sees 0.02 of headroom
    step(world);
    const upkeep = farm.upkeep * TICK_DT;
    expect(comp.pool).toBeCloseTo(cap - upkeep, 6);
  });

  it('pays its full output with plenty of headroom, and resumes after spending', () => {
    const { world, comp } = setup();
    const cap = capOf(world, comp);
    comp.pool = cap - 50;
    const before = comp.pool;
    step(world);
    expect(comp.pool - before).toBeCloseTo(farm.income * TICK_DT - farm.upkeep * TICK_DT, 6);
    comp.pool = cap;
    step(world);
    comp.pool = cap - 10; // the player spends some
    const mid = comp.pool;
    step(world);
    expect(comp.pool).toBeGreaterThan(mid);
  });

  it('does not reduce upkeep while throttled', () => {
    const { world, comp } = setup();
    const cap = capOf(world, comp);
    comp.pool = cap;
    step(world);
    expect(comp.pool).toBeCloseTo(cap - farm.upkeep * TICK_DT, 6);
  });
});
