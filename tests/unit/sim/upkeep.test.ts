import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { dirBetween, edgeSlot } from '../../../src/sim/grid';
import { addCell } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import { tickUpkeep } from '../../../src/sim/upkeep';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

/** a straight vein of `len` cells east of the core's east arm; returns the last cell */
function extendEast(world: ReturnType<typeof createWorldWithMold>['world'], moldId: number, len: number): number {
  let prev = cellOf(world, 11, 20);
  for (let i = 1; i <= len; i++) {
    const c = cellOf(world, 11 + i, 20);
    addCell(world, moldId, c, prev);
    prev = c;
  }
  return prev;
}

/** a world whose income cannot cover upkeep: no core income, an empty pool */
function brokeWorld(cells: number) {
  const balance = { ...defaultBalance, coreIncome: 0 };
  const made = createWorldWithMold(80, 40, 10, 20, 0, balance);
  const end = extendEast(made.world, made.mold.id, cells);
  return { ...made, end };
}

describe('upkeep', () => {
  it('is paid from the pool and does not kill cells while it can be paid', () => {
    const { world, mold } = createWorldWithMold(80, 40, 10, 20, 100);
    extendEast(world, mold.id, 30);
    const cells = mold.cellCount;
    const comp = [...world.components.values()][0]!;
    const before = comp.pool;
    for (let i = 0; i < 100; i++) step(world);
    expect(mold.cellCount).toBe(cells);
    expect(comp.pool).toBeLessThan(before + defaultBalance.coreIncome * 5);
  });

  it('starves the end of a branch when the piece cannot pay, one cell at a time', () => {
    const { world, mold, end } = brokeWorld(40);
    const cells = mold.cellCount;
    // 45 cells cost 0.18/s with nothing coming in; the weakest leaf loses 0.1 biomass/s
    for (let i = 0; i < 20 * 5; i++) step(world);
    expect(world.biomass[end]!).toBeLessThan(1); // the tip of the branch is the victim
    expect(mold.cellCount).toBe(cells);
    for (let i = 0; i < 20 * 8; i++) step(world);
    expect(mold.cellCount).toBeLessThan(cells);
    expect(world.owner[end]).toBe(0);
    expect(world.owner[mold.core]).toBe(mold.id);
    assertInvariants(world);
  });

  it('never kills the core or splits the piece, however long it starves', () => {
    const { world, mold } = brokeWorld(40);
    for (let i = 0; i < 20 * 400; i++) step(world);
    expect(world.owner[mold.core]).toBe(mold.id);
    expect(world.components.size).toBe(1);
    expect(mold.cellCount).toBeGreaterThanOrEqual(1);
    assertInvariants(world);
  });

  it('starves the leaf on the thinnest vein first', () => {
    const { world, mold } = createWorldWithMold(80, 40, 10, 20, 0, { ...defaultBalance, coreIncome: 0 });
    // two single-cell leaves hanging off the west arm; one is on a much thinner vein, and both are
    // farther out than the core's other arms
    const arm = cellOf(world, 9, 20);
    addCell(world, mold.id, cellOf(world, 8, 19), arm);
    addCell(world, mold.id, cellOf(world, 8, 21), arm);
    const thin = cellOf(world, 8, 19);
    const thick = cellOf(world, 8, 21);
    const slotThin = edgeSlot(world.width, thin, dirBetween(world.width, thin, arm));
    world.conductivity[slotThin] = 0.01;
    for (let i = 0; i < 20; i++) tickUpkeep(world);
    expect(world.biomass[thin]!).toBeLessThan(1);
    expect(world.biomass[thick]!).toBe(1);
  });

  it('a half-starved cell heals once upkeep is covered again', () => {
    const { world, mold, end } = brokeWorld(40);
    for (let i = 0; i < 20 * 5; i++) step(world);
    expect(world.biomass[end]!).toBeLessThan(1);
    for (const c of world.components.values()) c.pool = 100; // a food windfall
    for (let i = 0; i < 20 * 10; i++) step(world);
    expect(world.biomass[end]!).toBe(1);
    expect(mold.targets).toHaveLength(0);
  });
});
