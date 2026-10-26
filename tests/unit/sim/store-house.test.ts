import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { canPlace, capOf, placeBuilding, workingStoreHouses } from '../../../src/sim/buildings';
import { addMold } from '../../../src/sim/molds';
import { addCell, linkCells, removeCell, removeCellAndSplit } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import type { Component, World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const base = defaultBalance.pool.baseCap;
const spec = defaultBalance.buildings.storehouse;
const quiet = { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 };

/** a mold with a straight vein of own cells, so store houses have somewhere to stand */
function vein(balance = quiet, length = 14) {
  const world = createOpenWorld(80, 40, balance);
  const mold = addMold(world, 'player', cellOf(world, 10, 20), 500);
  const cells: number[] = [mold.core, cellOf(world, 11, 20)];
  let prev = cellOf(world, 11, 20); // the core already owns its four neighbors
  for (let x = 12; x < 10 + length; x++) {
    const c = cellOf(world, x, 20);
    addCell(world, mold.id, c, prev);
    cells.push(c);
    prev = c;
  }
  const comp = world.components.get(world.component[mold.core] as number) as Component;
  return { world, mold, cells, comp };
}

describe('store house and the pool cap (FR-001..FR-007)', () => {
  it('a piece holds a base cap, and each working store house adds its capacity', () => {
    const { world, mold, cells, comp } = vein();
    expect(capOf(world, comp)).toBe(base);
    expect(placeBuilding(world, mold.id, 'storehouse', cells[3] as number)).toEqual({ ok: true });
    expect(capOf(world, comp)).toBe(base + spec.capacity);
    expect(workingStoreHouses(world, comp)).toBe(1);
  });

  it('placing one costs nutrients from its piece and is refused with no cost when it cannot be afforded', () => {
    const { world, mold, cells, comp } = vein();
    comp.pool = 100;
    placeBuilding(world, mold.id, 'storehouse', cells[3] as number);
    expect(comp.pool).toBeCloseTo(100 - spec.cost);
    comp.pool = spec.cost - 1;
    expect(canPlace(world, mold.id, 'storehouse', cells[5] as number)).toEqual({ ok: false, reason: 'cant-afford' });
    expect(placeBuilding(world, mold.id, 'storehouse', cells[5] as number)).toEqual({ ok: false, reason: 'cant-afford' });
    expect(comp.pool).toBe(spec.cost - 1);
  });

  it('store houses beyond perPiece add no more capacity', () => {
    const { world, mold, cells, comp } = vein(quiet, 20);
    comp.pool = 1000;
    for (let i = 0; i < spec.limit; i++) expect(placeBuilding(world, mold.id, 'storehouse', cells[2 + i * 2] as number)).toEqual({ ok: true });
    expect(spec.limit).toBeGreaterThan(spec.perPiece);
    expect(capOf(world, comp)).toBe(base + spec.capacity * spec.perPiece);
    expect(placeBuilding(world, mold.id, 'storehouse', cells[2 + spec.limit * 2] as number)).toEqual({ ok: false, reason: 'limit-reached' });
  });

  it('a store house in a piece that cannot pay its upkeep adds nothing', () => {
    const { world, mold, cells, comp } = vein();
    placeBuilding(world, mold.id, 'storehouse', cells[3] as number);
    comp.unpaid = true;
    expect(capOf(world, comp)).toBe(base);
    comp.unpaid = false;
    expect(capOf(world, comp)).toBe(base + spec.capacity);
  });

  it('income that would push a pool over its cap is not gained', () => {
    const { world, comp } = vein({ ...defaultBalance, coreIncome: 5, upkeepPerCell: 0 });
    comp.pool = base - 0.2;
    step(world);
    expect(comp.pool).toBeCloseTo(base, 6);
    expect(world.events.some((e) => e.type === 'storeFull')).toBe(true);
    step(world);
    expect(comp.pool).toBeCloseTo(base, 6);
    assertInvariants(world);
  });

  it('a stock can grow past the base cap once a store house stands', () => {
    const { world, mold, cells, comp } = vein({ ...defaultBalance, coreIncome: 5, upkeepPerCell: 0 });
    placeBuilding(world, mold.id, 'storehouse', cells[3] as number);
    comp.pool = base;
    for (let i = 0; i < 40; i++) step(world);
    expect(comp.pool).toBeGreaterThan(base + 5);
    expect(comp.pool).toBeLessThanOrEqual(base + spec.capacity + 1e-6);
  });

  it('destroying a store house drops the cap at once and cuts the stock above it', () => {
    const { world, mold, cells, comp } = vein();
    comp.pool = 1000;
    placeBuilding(world, mold.id, 'storehouse', cells[3] as number);
    comp.pool = base + 100;
    removeCell(world, cells[3] as number);
    expect(comp.pool).toBe(base);
    const lost = world.events.find((e) => e.type === 'capLost');
    expect(lost).toMatchObject({ type: 'capLost', amount: 100 });
  });

  it('a cut-off piece keeps its own stock and cap', () => {
    const { world, mold, cells } = vein();
    const comp0 = world.components.get(world.component[mold.core] as number) as Component;
    comp0.pool = 500;
    placeBuilding(world, mold.id, 'storehouse', cells[11] as number); // far end
    comp0.pool = 200;
    removeCellAndSplit(world, cells[6] as number);
    const near = world.components.get(world.component[cells[2] as number] as number) as Component;
    const far = world.components.get(world.component[cells[11] as number] as number) as Component;
    expect(near.id).not.toBe(far.id);
    expect(capOf(world, near)).toBe(base);
    expect(capOf(world, far)).toBe(base + spec.capacity);
    expect(near.pool + far.pool).toBeCloseTo(200, 5);
    expect(far.pool).toBeGreaterThan(0);
  });

  it('merging two pieces clamps the sum to the merged cap', () => {
    const world = createOpenWorld(60, 30, quiet);
    const mold = addMold(world, 'player', cellOf(world, 10, 10), 100);
    const a = cellOf(world, 11, 10); // owned from the start
    const b = cellOf(world, 14, 10);
    addCell(world, mold.id, b, -1); // a second piece
    const compB = world.components.get(world.component[b] as number) as Component;
    compB.pool = 100;
    const bridge1 = cellOf(world, 12, 10);
    const bridge2 = cellOf(world, 13, 10);
    addCell(world, mold.id, bridge1, a);
    addCell(world, mold.id, bridge2, bridge1);
    linkCells(world, bridge2, b); // merges
    const merged = world.components.get(world.component[mold.core] as number) as Component;
    expect(merged.pool).toBeCloseTo(200, 5);
    step(world);
    expect(merged.pool).toBeLessThanOrEqual(capOf(world, merged) + 1e-6);
    assertInvariants(world);
  });
});
