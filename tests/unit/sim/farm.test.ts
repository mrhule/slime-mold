import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import type { BalanceConfig } from '../../../src/config/balance';
import { placeBuilding } from '../../../src/sim/buildings';
import { readHud } from '../../../src/sim/hud';
import { addCell, refreshSources, removeCell, removeCellAndSplit } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import type { World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

const farm = defaultBalance.buildings.farm;

/** no core income and no per-cell upkeep, so only farm numbers move the pool */
function isolated(farmOverrides: Partial<typeof farm> = {}): BalanceConfig {
  return { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0, buildings: { ...defaultBalance.buildings, farm: { ...farm, ...farmOverrides } } };
}

function extendEast(world: World, moldId: number, len: number): number[] {
  const cells: number[] = [];
  let prev = cellOf(world, 11, 20);
  for (let i = 1; i <= len; i++) {
    const c = cellOf(world, 11 + i, 20);
    addCell(world, moldId, c, prev);
    cells.push(c);
    prev = c;
  }
  return cells;
}

const poolOf = (world: World, cell: number): number => world.components.get(world.component[cell]!)!.pool;

describe('farm income and upkeep', () => {
  it('adds income * dt to its piece each tick', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 200, isolated({ upkeep: 0 }));
    const cell = cellOf(world, 11, 20);
    placeBuilding(world, mold.id, 'farm', cell);
    const before = poolOf(world, cell);
    step(world);
    expect(poolOf(world, cell) - before).toBeCloseTo(farm.income * TICK_DT, 6);
  });

  it('charges upkeep on top of per-cell upkeep', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 200, isolated({ income: 0 }));
    const cell = cellOf(world, 11, 20);
    placeBuilding(world, mold.id, 'farm', cell);
    const before = poolOf(world, cell);
    step(world);
    expect(before - poolOf(world, cell)).toBeCloseTo(farm.upkeep * TICK_DT, 6);
  });

  it('shows up in the HUD: income, build options, and net income', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 200, isolated());
    placeBuilding(world, mold.id, 'farm', cellOf(world, 11, 20));
    for (let i = 0; i < 20 * 20; i++) step(world); // let the 2 s smoothing settle
    const hud = readHud(world, mold.id);
    expect(hud.buildingIncome).toBeCloseTo(farm.income);
    expect(hud.netIncome).toBeCloseTo(farm.income - farm.upkeep, 1);
    expect(hud.build.map((o) => o.type)).toEqual(['farm', 'booster', 'harvester']);
    expect(hud.build[0]).toEqual({ type: 'farm', cost: farm.cost, upkeep: farm.upkeep, income: farm.income, count: 1, limit: farm.limit, affordable: true });
  });

  it('marks a build option unaffordable when no piece can pay', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, farm.cost - 1);
    expect(readHud(world, mold.id).build[0]!.affordable).toBe(false);
  });
});

describe('farm as a source of supply', () => {
  it('keeps a cut-off piece from being orphaned', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    const cells = extendEast(world, mold.id, 10);
    placeBuilding(world, mold.id, 'farm', cells[9]!);
    removeCellAndSplit(world, cells[4]!);
    expect(world.components.size).toBe(2);
    const pieces = [...world.components.values()];
    for (const p of pieces) refreshSources(world, p);
    expect(pieces.every((p) => !p.orphaned)).toBe(true);
    assertInvariants(world);
  });

  it('without a farm the same cut-off piece is orphaned', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    const cells = extendEast(world, mold.id, 10);
    removeCellAndSplit(world, cells[4]!);
    const far = [...world.components.values()].find((c) => !c.cells.includes(mold.core))!;
    refreshSources(world, far);
    expect(far.orphaned).toBe(true);
  });

  it('keeps feeding the cut-off piece after the split', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500, isolated({ upkeep: 0 }));
    const cells = extendEast(world, mold.id, 10);
    placeBuilding(world, mold.id, 'farm', cells[9]!);
    removeCellAndSplit(world, cells[4]!);
    const before = poolOf(world, cells[9]!);
    for (let i = 0; i < 20; i++) step(world);
    expect(poolOf(world, cells[9]!) - before).toBeCloseTo(farm.income * 20 * TICK_DT, 4);
  });
});

describe('destroying a farm', () => {
  it('is destroyed with its cell, with an event and no refund', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    const cells = extendEast(world, mold.id, 4);
    const cell = cells[3]!;
    placeBuilding(world, mold.id, 'farm', cell);
    const id = world.buildingAt[cell]!;
    const pool = poolOf(world, cells[0]!);
    world.events = [];
    removeCell(world, cell);
    expect(world.buildings[id]!.destroyed).toBe(true);
    expect(world.buildingAt[cell]).toBe(-1);
    expect(world.events).toContainEqual({ type: 'buildingDestroyed', id, building: 'farm', mold: mold.id, cell });
    expect(poolOf(world, cells[0]!)).toBe(pool);
    assertInvariants(world);
  });

  it('a destroyed farm stops paying and stops counting toward the limit', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500, isolated({ upkeep: 0 }));
    const cells = extendEast(world, mold.id, 4);
    placeBuilding(world, mold.id, 'farm', cells[3]!);
    removeCell(world, cells[3]!);
    const before = poolOf(world, cells[0]!);
    step(world);
    expect(poolOf(world, cells[0]!)).toBeCloseTo(before);
    expect(readHud(world, mold.id).build[0]!.count).toBe(0);
  });
});

describe('starvation and buildings', () => {
  it('spares a building cell while another leaf can starve instead', () => {
    // nothing comes in and the pool is empty, so upkeep goes unpaid and a leaf starves
    const balance: BalanceConfig = { ...defaultBalance, coreIncome: 0, buildings: { ...defaultBalance.buildings, farm: { ...farm, income: 0 } } };
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, farm.cost, balance);
    const east = extendEast(world, mold.id, 20);
    const farmCell = east[19]!; // the outermost leaf, which would normally starve first
    placeBuilding(world, mold.id, 'farm', farmCell);
    const west = cellOf(world, 8, 20);
    addCell(world, mold.id, cellOf(world, 9, 20), mold.core);
    addCell(world, mold.id, west, cellOf(world, 9, 20));
    for (let i = 0; i < 20 * 4; i++) step(world);
    expect(world.biomass[farmCell]!).toBe(1);
    expect(world.buildingAt[farmCell]).toBeGreaterThanOrEqual(0);
    const sacrificed = [west, cellOf(world, 10, 19), cellOf(world, 10, 21), cellOf(world, 10, 20 - 0)];
    expect(sacrificed.some((c) => world.owner[c] === 0 || (world.biomass[c] as number) < 1)).toBe(true);
  });

  it('takes a building cell only when no other leaf is left', () => {
    const balance: BalanceConfig = { ...defaultBalance, coreIncome: 0, buildings: { ...defaultBalance.buildings, farm: { ...farm, income: 0 } } };
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, farm.cost, balance);
    const east = extendEast(world, mold.id, 3);
    const farmCell = east[2]!;
    placeBuilding(world, mold.id, 'farm', farmCell);
    // starve long enough that every building-free leaf is gone
    for (let i = 0; i < 20 * 600; i++) step(world);
    expect(world.owner[farmCell]).toBe(0);
    expect(world.owner[mold.core]).toBe(mold.id);
    assertInvariants(world);
  });
});
