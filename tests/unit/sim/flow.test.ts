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
      pos: 0, progress: 0, createdTick: 0, state: 'growing', speed: 1, starvedFor: 0, rate: 0,
    });
    solveFlow(world);
    expect(mold.targets[0]!.rate).toBeLessThanOrEqual(defaultBalance.capacityPerD * 0.02);
  });

  it('never retracts idle veins, they only thin to the conductivity floor', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    extendEast(world, mold.id, 6);
    const cells = mold.cellCount;
    const slot = edgeSlot(world.width, cellOf(world, 12, 20), 0);
    for (let i = 0; i < 20 * 120; i++) step(world); // two idle minutes
    expect(mold.cellCount).toBe(cells);
    expect(world.conductivity[slot]!).toBeCloseTo(defaultBalance.minConductivity, 3);
    assertInvariants(world);
  });

  it('thickens a branch that is carrying flow', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    const end = extendEast(world, mold.id, 6);
    addTarget(world, mold.id, cellOf(world, 50, 20));
    for (let i = 0; i < 20 * 3; i++) step(world); // still growing
    expect(mold.targets).toHaveLength(1);
    expect(world.owner[end]).toBe(mold.id);
    const slot = edgeSlot(world.width, cellOf(world, 12, 20), 0);
    expect(world.conductivity[slot]!).toBeGreaterThan(defaultBalance.minConductivity * 4);
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
