import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import type { BalanceConfig } from '../../../src/config/balance';
import { canPlace, farmLinked, farmOutput, placeBuilding } from '../../../src/sim/buildings';
import { refreshSources, removeCell, removeCellAndSplit } from '../../../src/sim/network';
import { addCell } from '../../../src/sim/network';
import { addMold } from '../../../src/sim/molds';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import type { Component, World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld, withStoreHouse } from '../../helpers';

const farm = defaultBalance.buildings.farm;
/** only farm numbers move the pool: no core income, no per-cell or building upkeep */
const quiet: BalanceConfig = {
  ...defaultBalance,
  coreIncome: 0,
  upkeepPerCell: 0,
  pool: { baseCap: 100000 },
  buildings: { ...defaultBalance.buildings, farm: { ...farm, upkeep: 0 }, storehouse: { ...defaultBalance.buildings.storehouse, upkeep: 0 } },
};

function setup(fertile = true, len = 16) {
  const world = createOpenWorld(80, 40, quiet, 1, { fertile });
  const mold = addMold(world, 'player', cellOf(world, 10, 20), 300);
  const cells: number[] = [cellOf(world, 11, 20)];
  for (let x = 12; x < 11 + len; x++) {
    const c = cellOf(world, x, 20);
    addCell(world, mold.id, c, cells[cells.length - 1] as number);
    cells.push(c);
  }
  const comp = () => world.components.get(world.component[mold.core] as number) as Component;
  return { world, mold, cells, comp };
}

const poolAt = (world: World, cell: number): number => (world.components.get(world.component[cell] as number) as Component).pool;

describe('farms need fertile ground (FR-009)', () => {
  it('canPlace refuses a farm off fertile ground, with the reason', () => {
    const { world, mold, cells } = setup(false);
    expect(canPlace(world, mold.id, 'farm', cells[3] as number)).toEqual({ ok: false, reason: 'not-fertile' });
    const fertile = setup(true);
    expect(canPlace(fertile.world, fertile.mold.id, 'farm', fertile.cells[3] as number)).toEqual({ ok: true });
  });

  it('other buildings may stand on fertile ground', () => {
    const { world, mold, cells } = setup(true);
    expect(canPlace(world, mold.id, 'storehouse', cells[3] as number)).toEqual({ ok: true });
  });

  it('a refused farm placement costs nothing', () => {
    const { world, mold, cells } = setup(false);
    const before = poolAt(world, cells[3] as number);
    expect(placeBuilding(world, mold.id, 'farm', cells[3] as number)).toEqual({ ok: false, reason: 'not-fertile' });
    expect(poolAt(world, cells[3] as number)).toBe(before);
  });
});

describe('linked and unlinked farms (FR-010, FR-011, FR-014)', () => {
  it('an unlinked farm pays nothing and reports it', () => {
    const { world, mold, cells } = setup();
    placeBuilding(world, mold.id, 'farm', cells[3] as number);
    const farmB = world.buildings[0]!;
    expect(farmLinked(world, farmB)).toBe(false);
    expect(farmOutput(world, farmB)).toBe(0);
    const before = poolAt(world, cells[3] as number);
    for (let i = 0; i < 20; i++) step(world);
    expect(poolAt(world, cells[3] as number)).toBeCloseTo(before, 6);
  });

  it('a linked farm pays its income at any distance along the same piece', () => {
    const { world, mold, cells } = setup();
    placeBuilding(world, mold.id, 'farm', cells[2] as number);
    withStoreHouse(world, mold.id, cells[14] as number); // twelve cells away
    const farmB = world.buildings[0]!;
    expect(farmLinked(world, farmB)).toBe(true);
    const before = poolAt(world, cells[2] as number);
    step(world);
    expect(poolAt(world, cells[2] as number) - before).toBeCloseTo(farm.income * TICK_DT, 6);
  });

  it('cutting the vein between a farm and its store house unlinks it, with an event', () => {
    const { world, mold, cells } = setup();
    placeBuilding(world, mold.id, 'farm', cells[2] as number);
    withStoreHouse(world, mold.id, cells[14] as number);
    step(world);
    expect(world.events).toContainEqual({ type: 'farmLinkChanged', building: 0, linked: true });
    removeCellAndSplit(world, cells[8] as number);
    expect(farmLinked(world, world.buildings[0]!)).toBe(false);
    world.events = [];
    const before = poolAt(world, cells[2] as number);
    step(world);
    expect(world.events).toContainEqual({ type: 'farmLinkChanged', building: 0, linked: false });
    expect(poolAt(world, cells[2] as number)).toBeCloseTo(before, 6);
    assertInvariants(world);
  });

  it('destroying the store house unlinks every farm that used it at once', () => {
    const { world, mold, cells } = setup();
    placeBuilding(world, mold.id, 'farm', cells[2] as number);
    placeBuilding(world, mold.id, 'farm', cells[5] as number);
    withStoreHouse(world, mold.id, cells[9] as number);
    expect(world.buildings.filter((b) => b.type === 'farm').every((b) => farmLinked(world, b))).toBe(true);
    removeCell(world, cells[9] as number);
    expect(world.buildings.filter((b) => b.type === 'farm').every((b) => !farmLinked(world, b))).toBe(true);
  });

  it('a piece whose only source is an unlinked farm still counts as supplied (not orphaned)', () => {
    const { world, mold, cells } = setup();
    placeBuilding(world, mold.id, 'farm', cells[12] as number);
    removeCellAndSplit(world, cells[6] as number);
    const far = world.components.get(world.component[cells[12] as number] as number) as Component;
    refreshSources(world, far);
    expect(far.sources).toContain(cells[12]);
    expect(far.orphaned).toBe(false);
  });
});
