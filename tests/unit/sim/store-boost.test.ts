import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import type { BalanceConfig } from '../../../src/config/balance';
import { drainStoreHouses, placeBuilding, recomputeSupply } from '../../../src/sim/buildings';
import { addMold } from '../../../src/sim/molds';
import { addCell, removeCell, removeCellAndSplit } from '../../../src/sim/network';
import { TICK_DT } from '../../../src/sim/types';
import type { Component } from '../../../src/sim/types';
import { cellOf, createOpenWorld } from '../../helpers';

const spec = defaultBalance.buildings.storehouse;

function setup(balance: BalanceConfig = defaultBalance, len = 22) {
  const world = createOpenWorld(90, 40, balance);
  const mold = addMold(world, 'player', cellOf(world, 10, 20), 400);
  const cells: number[] = [cellOf(world, 11, 20)];
  for (let x = 12; x < 11 + len; x++) {
    const c = cellOf(world, x, 20);
    addCell(world, mold.id, c, cells[cells.length - 1] as number);
    cells.push(c);
  }
  const comp = () => world.components.get(world.component[mold.core] as number) as Component;
  return { world, mold, cells, comp };
}

describe('store house boost cover (FR-020, FR-024, S7)', () => {
  it('is 1 + bonus * (1 - d/reach) along the vein, and 1 off the vein, in other pieces and for other molds', () => {
    const { world, mold, cells } = setup();
    const store = cells[8] as number;
    expect(placeBuilding(world, mold.id, 'storehouse', store)).toEqual({ ok: true });
    // an unconnected cell of the same mold, a cell of another mold, and bare ground, all close by
    const apart = cellOf(world, 19, 22);
    addCell(world, mold.id, apart, -1);
    const rival = addMold(world, 'rival', cellOf(world, 70, 30), 100);
    const theirs = cellOf(world, 20, 18);
    addCell(world, rival.id, theirs, -1);
    recomputeSupply(world);
    for (let i = 0; i < cells.length; i++) {
      const d = Math.abs(i - 8);
      const want = d < spec.reach ? 1 + spec.bonus * (1 - d / spec.reach) : 1;
      expect(world.supply[cells[i] as number], `cell ${i}`).toBeCloseTo(want, 5);
    }
    expect(world.supply[apart]).toBe(1);
    expect(world.supply[theirs]).toBe(1);
    expect(world.supply[cellOf(world, 19, 19)]).toBe(1);
    expect(world.supply[store]!).toBeGreaterThan(world.supply[cells[0] as number]!);
  });

  it('stacks overlapping store houses and never exceeds 1 + stackCap', () => {
    const tight = { ...defaultBalance, buildings: { ...defaultBalance.buildings, storehouse: { ...spec, stackCap: 0.6 } } };
    const { world, mold, cells, comp } = setup(tight);
    comp().pool = 300;
    placeBuilding(world, mold.id, 'storehouse', cells[8] as number);
    placeBuilding(world, mold.id, 'storehouse', cells[10] as number);
    recomputeSupply(world);
    const one = 1 + spec.bonus * (1 - 1 / spec.reach);
    expect(world.supply[cells[9] as number]!).toBeGreaterThan(one);
    for (const c of cells) expect(world.supply[c]!).toBeLessThanOrEqual(1 + 0.6 + 1e-6);
    expect(world.supply[cells[9] as number]).toBeCloseTo(1.6, 5);
  });

  it('a store house that is not boosting adds nothing: unpaid piece, or stock below lowStock, with hysteresis', () => {
    const { world, mold, cells, comp } = setup();
    placeBuilding(world, mold.id, 'storehouse', cells[8] as number);
    const store = world.buildings[0]!;
    const at = (): number => world.supply[cells[9] as number] as number;
    comp().pool = spec.lowStock - 1;
    recomputeSupply(world);
    expect(at()).toBe(1);
    comp().pool = spec.lowStock + 1; // above low, but not yet at 1.25 x low
    recomputeSupply(world);
    expect(store.boosting).toBe(false);
    comp().pool = spec.lowStock * 1.25 + 1;
    recomputeSupply(world);
    expect(store.boosting).toBe(true);
    expect(at()).toBeGreaterThan(1);
    comp().pool = spec.lowStock + 1; // stays on until it falls below lowStock
    recomputeSupply(world);
    expect(store.boosting).toBe(true);
    comp().pool = spec.lowStock - 1;
    recomputeSupply(world);
    expect(store.boosting).toBe(false);
    comp().pool = 200;
    comp().unpaid = true;
    recomputeSupply(world);
    expect(at()).toBe(1);
  });

  it('ends at once when the store house is destroyed or the vein is cut beyond it', () => {
    const { world, mold, cells } = setup();
    placeBuilding(world, mold.id, 'storehouse', cells[4] as number);
    recomputeSupply(world);
    expect(world.supply[cells[6] as number]!).toBeGreaterThan(1);
    removeCellAndSplit(world, cells[5] as number);
    recomputeSupply(world);
    expect(world.supply[cells[7] as number]).toBe(1); // the far side is another piece
    removeCell(world, cells[4] as number);
    expect(world.supply[cells[3] as number]).toBe(1);
  });
});

describe('store house drain (FR-021, FR-022, S8)', () => {
  it('drains drain per second per boosting store house, only while something in its piece was boosted', () => {
    const { world, mold, cells, comp } = setup();
    comp().pool = 300;
    placeBuilding(world, mold.id, 'storehouse', cells[8] as number);
    recomputeSupply(world);
    const before = comp().pool;
    drainStoreHouses(world); // nothing boosted this tick
    expect(comp().pool).toBe(before);
    world.supplyUse.add(comp().id);
    drainStoreHouses(world);
    expect(before - comp().pool).toBeCloseTo(spec.drain * TICK_DT, 9);
  });

  it('never drains below zero', () => {
    const { world, mold, cells, comp } = setup();
    comp().pool = 300;
    placeBuilding(world, mold.id, 'storehouse', cells[8] as number);
    recomputeSupply(world);
    comp().pool = 0.001;
    world.supplyUse.add(comp().id);
    drainStoreHouses(world);
    expect(comp().pool).toBe(0);
  });
});
