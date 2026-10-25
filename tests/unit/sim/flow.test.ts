import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { applyCommand } from '../../../src/sim/commands';
import { solveFlow } from '../../../src/sim/flow';
import { addTarget } from '../../../src/sim/growth';
import { addCell } from '../../../src/sim/network';
import { edgeSlot } from '../../../src/sim/grid';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

/** a straight vein of `len` cells east of the core's east arm */
function extendEast(world: ReturnType<typeof createWorldWithMold>['world'], moldId: number, len: number): number {
  let prev = cellOf(world, 11, 20);
  for (let i = 1; i <= len; i++) {
    const c = cellOf(world, 11 + i, 20);
    addCell(world, moldId, c, prev);
    prev = c;
  }
  return prev;
}

describe('flow', () => {
  it('conductivity rises on used veins and decays on unused ones', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    extendEast(world, mold.id, 12);
    const used = edgeSlot(world.width, cellOf(world, 11, 20), 0);
    solveFlow(world);
    const idle = world.conductivity[used]!;
    expect(idle).toBeLessThan(defaultBalance.initialConductivity); // no demand: decays
    addTarget(world, mold.id, cellOf(world, 40, 20));
    for (let i = 0; i < 40; i++) step(world);
    expect(world.conductivity[used]!).toBeGreaterThan(idle);
  });

  it('routes the whole budget to growth when there are no fronts, within spend limits', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 1000);
    extendEast(world, mold.id, 4);
    addTarget(world, mold.id, cellOf(world, 40, 20));
    solveFlow(world);
    const tip = mold.targets[0]!;
    expect(tip.rate).toBeGreaterThan(0);
    expect(tip.rate).toBeLessThanOrEqual(defaultBalance.spendRateCap + 1e-6);
  });

  it('delivery to a far tip is capped by the thinnest vein on its path', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 1000);
    const end = extendEast(world, mold.id, 30);
    // make one link very thin
    const thin = edgeSlot(world.width, cellOf(world, 20, 20), 0);
    world.conductivity[thin] = 0.01;
    mold.targets.push({
      id: 77, moldId: mold.id, cell: cellOf(world, 55, 20), path: [end, cellOf(world, end % world.width + 1, 20), cellOf(world, 55, 20)],
      pos: 0, progress: 0, createdTick: 0, state: 'growing', starvedFor: 0, rate: 0,
    });
    solveFlow(world);
    expect(mold.targets[0]!.rate).toBeLessThanOrEqual(defaultBalance.capacityPerD * 0.02);
  });

  it('retracts an unused dead-end branch one cell at a time and refunds half the cost', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 50);
    world.balance = { ...world.balance, coreIncome: 0, upkeepPerCell: 0 };
    extendEast(world, mold.id, 6);
    const startCells = mold.cellCount;
    const comp = world.components.get(world.component[mold.core]!)!;
    const poolBefore = comp.pool;
    for (let i = 0; i < 20 * 20; i++) step(world); // 20 s with nothing carrying flow
    expect(mold.cellCount).toBeLessThan(startCells);
    expect(world.owner[mold.core]).toBe(mold.id); // the core never retracts
    expect(comp.pool).toBeGreaterThan(poolBefore);
    const removed = startCells - mold.cellCount;
    expect(comp.pool - poolBefore).toBeCloseTo(removed * 0.5, 5);
    assertInvariants(world);
  });

  it('does not retract a branch that is carrying flow', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    const end = extendEast(world, mold.id, 6);
    addTarget(world, mold.id, cellOf(world, 50, 20));
    for (let i = 0; i < 20 * 12; i++) step(world);
    expect(world.owner[end]).toBe(mold.id);
  });

  it('never spends more than the pool holds', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 3);
    addTarget(world, mold.id, cellOf(world, 50, 20));
    for (let i = 0; i < 400; i++) {
      step(world);
      for (const c of world.components.values()) expect(c.pool).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('setAllocation rounds to 0.05 steps and clamps', () => {
    const { world, mold } = createWorldWithMold();
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0.337 });
    expect(mold.allocation).toBeCloseTo(0.35);
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 5 });
    expect(mold.allocation).toBe(1);
    void TICK_DT;
  });
});
