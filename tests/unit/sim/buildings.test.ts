import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { canPlace, placeBuilding } from '../../../src/sim/buildings';
import { enqueue } from '../../../src/sim/commands';
import { placeFood } from '../../../src/sim/food';
import { stateHash } from '../../../src/sim/hash';
import { addCell } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import type { BuildingType, World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

const COST = defaultBalance.buildings.farm.cost;

/** `len` cells east of the core's east arm; returns them in order */
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

const poolAt = (world: World, cell: number): number => world.components.get(world.component[cell]!)!.pool;

describe('canPlace', () => {
  it('accepts an own cell when affordable', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    expect(canPlace(world, mold.id, 'farm', cellOf(world, 11, 20))).toEqual({ ok: true });
  });

  it('reports each reason', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    const own = cellOf(world, 11, 20);
    expect(canPlace(world, mold.id, 'castle' as BuildingType, own)).toEqual({ ok: false, reason: 'unknown-building' });
    expect(canPlace(world, 9, 'farm', own)).toEqual({ ok: false, reason: 'mold-eliminated' });
    expect(canPlace(world, mold.id, 'farm', -1)).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(canPlace(world, mold.id, 'farm', world.width * world.height)).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(canPlace(world, mold.id, 'farm', cellOf(world, 30, 20))).toEqual({ ok: false, reason: 'not-your-cell' });
    placeBuilding(world, mold.id, 'farm', own);
    expect(canPlace(world, mold.id, 'farm', own)).toEqual({ ok: false, reason: 'occupied' });
    mold.status = 'eliminated';
    expect(canPlace(world, mold.id, 'farm', cellOf(world, 9, 20))).toEqual({ ok: false, reason: 'mold-eliminated' });
  });

  it('refuses food cells', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    placeFood(world, 'oatFlake', 12, 20, 'initial');
    addCell(world, mold.id, cellOf(world, 12, 20), cellOf(world, 11, 20));
    expect(canPlace(world, mold.id, 'farm', cellOf(world, 12, 20))).toEqual({ ok: false, reason: 'on-food' });
  });

  it('refuses when the piece cannot pay', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, COST - 1);
    expect(canPlace(world, mold.id, 'farm', cellOf(world, 11, 20))).toEqual({ ok: false, reason: 'cant-afford' });
  });

  it('checks reasons in order: a far click is not-your-cell even when broke', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 0);
    expect(canPlace(world, mold.id, 'farm', cellOf(world, 40, 20))).toEqual({ ok: false, reason: 'not-your-cell' });
  });

  it('enforces the per-mold limit', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 10_000);
    const cells = extendEast(world, mold.id, 8);
    const limit = defaultBalance.buildings.farm.limit;
    for (let i = 0; i < limit; i++) expect(placeBuilding(world, mold.id, 'farm', cells[i]!)).toEqual({ ok: true });
    expect(canPlace(world, mold.id, 'farm', cells[limit]!)).toEqual({ ok: false, reason: 'limit-reached' });
  });
});

describe('placeBuilding', () => {
  it('deducts the cost and creates a building on the cell', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    const cell = cellOf(world, 11, 20);
    const before = poolAt(world, cell);
    expect(placeBuilding(world, mold.id, 'farm', cell)).toEqual({ ok: true });
    expect(poolAt(world, cell)).toBeCloseTo(before - COST);
    const b = world.buildings[world.buildingAt[cell]!]!;
    expect(b).toMatchObject({ type: 'farm', moldId: mold.id, cell, destroyed: false });
    expect(world.events).toContainEqual({ type: 'buildingPlaced', id: b.id, building: 'farm', mold: mold.id, cell });
    assertInvariants(world);
  });

  it('pays from the piece that holds the cell, not another piece', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    const far = cellOf(world, 40, 20);
    addCell(world, mold.id, far, -1); // a separate piece with an empty pool
    expect(canPlace(world, mold.id, 'farm', far)).toEqual({ ok: false, reason: 'cant-afford' });
    const home = cellOf(world, 11, 20);
    const farPool = poolAt(world, far);
    expect(placeBuilding(world, mold.id, 'farm', home)).toEqual({ ok: true });
    expect(poolAt(world, far)).toBe(farPool);
  });

  it('changes nothing when refused', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 5);
    const before = stateHash(world);
    expect(placeBuilding(world, mold.id, 'farm', cellOf(world, 11, 20))).toEqual({ ok: false, reason: 'cant-afford' });
    expect(stateHash(world)).toBe(before);
    expect(world.buildings).toHaveLength(0);
  });
});

describe('placeBuilding command', () => {
  it('is queued, applied on the next tick, and recorded in the replay log', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    const cell = cellOf(world, 11, 20);
    enqueue(world, { type: 'placeBuilding', mold: mold.id, building: 'farm', cell });
    expect(world.buildings).toHaveLength(0);
    step(world);
    expect(world.buildings).toHaveLength(1);
    expect(world.replay.entries).toEqual([{ tick: 0, cmd: { type: 'placeBuilding', mold: mold.id, building: 'farm', cell } }]);
  });

  it('gives two orders for one cell in a tick to the earlier one', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 200);
    const cell = cellOf(world, 11, 20);
    enqueue(world, { type: 'placeBuilding', mold: mold.id, building: 'farm', cell });
    enqueue(world, { type: 'placeBuilding', mold: mold.id, building: 'farm', cell });
    step(world);
    expect(world.buildings).toHaveLength(1);
    expect(world.events).toContainEqual({ type: 'commandRejected', mold: mold.id, reason: 'occupied', cell });
  });

  it('reports the reason and the cell when refused', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    const cell = cellOf(world, 40, 20);
    enqueue(world, { type: 'placeBuilding', mold: mold.id, building: 'farm', cell });
    step(world);
    expect(world.events).toContainEqual({ type: 'commandRejected', mold: mold.id, reason: 'not-your-cell', cell });
  });
});
