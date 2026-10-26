import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { canPlace, harvestTarget, placeBuilding } from '../../../src/sim/buildings';
import { engulfFood, foodCells, placeFood } from '../../../src/sim/food';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import type { World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const spec = defaultBalance.buildings.harvester;
const noIncome = { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0, pool: { baseCap: 1e6 } };

/** a mold with a vein reaching toward a food item, no AI, no other income */
function setup(foodType: 'oatFlake' | 'breadCrumb' | 'sugarCube' | 'fruitSlice' | null, balance = noIncome) {
  const world = createOpenWorld(70, 40, balance);
  const a = addMold(world, 'player', cellOf(world, 10, 20), 200);
  const src = foodType ? placeFood(world, foodType, 20, 18, 'initial')! : null;
  // a vein from the core to the cell just left of the food
  let prev = cellOf(world, 11, 20);
  for (let x = 12; x <= 19; x++) {
    const c = cellOf(world, x, 20);
    addCell(world, a.id, c, prev);
    prev = c;
  }
  return { world, a, src, edge: cellOf(world, 19, 20) };
}

describe('harvester placement (FR-014)', () => {
  it('works on a cell touching a food item big enough', () => {
    const { world, a, edge } = setup('breadCrumb'); // 3x3 = 9 cells = the minimum
    expect(canPlace(world, a.id, 'harvester', edge)).toEqual({ ok: true });
  });

  it('may stand on a food cell itself (the one exception to FR-004)', () => {
    const { world, a } = setup('sugarCube');
    const onFood = cellOf(world, 20, 20);
    addCell(world, a.id, onFood, cellOf(world, 19, 20)); // grown onto the food
    expect(world.food[onFood]!).toBeGreaterThan(0);
    expect(canPlace(world, a.id, 'booster', onFood)).toEqual({ ok: false, reason: 'on-food' });
    expect(canPlace(world, a.id, 'harvester', onFood)).toEqual({ ok: true });
  });

  it('refuses food that is too small, with the reason', () => {
    const { world, a, edge } = setup('oatFlake'); // 2x2 = 4 cells
    expect(canPlace(world, a.id, 'harvester', edge)).toEqual({ ok: false, reason: 'food-too-small' });
  });

  it('refuses a cell with no food next to it', () => {
    const { world, a } = setup('sugarCube');
    expect(canPlace(world, a.id, 'harvester', cellOf(world, 12, 20))).toEqual({ ok: false, reason: 'no-food-nearby' });
  });

  it('only one harvester per mold on one food item; another mold may harvest the same item', () => {
    const { world, a, edge } = setup('sugarCube');
    world.components.get(world.component[edge]!)!.pool = 200;
    expect(placeBuilding(world, a.id, 'harvester', edge)).toEqual({ ok: true });
    const second = cellOf(world, 19, 19);
    addCell(world, a.id, second, edge);
    expect(canPlace(world, a.id, 'harvester', second)).toEqual({ ok: false, reason: 'already-harvested' });
    // a rival holding another cell by the same food can harvest it
    const b = addMold(world, 'player', cellOf(world, 40, 30), 200);
    const theirs = cellOf(world, 24, 19);
    addCell(world, b.id, theirs, -1);
    world.components.get(world.component[theirs]!)!.pool = 100;
    expect(canPlace(world, b.id, 'harvester', theirs)).toEqual({ ok: true });
  });

  it('costs nutrients and upkeep like any building', () => {
    const { world, a, edge } = setup('sugarCube');
    const comp = world.components.get(world.component[edge]!)!;
    const before = comp.pool;
    placeBuilding(world, a.id, 'harvester', edge);
    expect(before - comp.pool).toBeCloseTo(spec.cost);
  });
});

describe('harvester effect (FR-015, FR-016)', () => {
  /** nutrients absorbed per tick by the owner, and total ticks until the item is used up */
  function absorb(withHarvester: boolean) {
    const { world, a, src, edge } = setup('sugarCube', { ...noIncome, buildings: { ...defaultBalance.buildings, harvester: { ...spec, upkeep: 0 } } });
    engulfFood(world, a.id, cellOf(world, 20, 20));
    if (!world.owner[cellOf(world, 20, 20)]) addCell(world, a.id, cellOf(world, 20, 20), edge);
    engulfFood(world, a.id, cellOf(world, 20, 20));
    world.components.get(world.component[edge]!)!.pool = 100;
    if (withHarvester) placeBuilding(world, a.id, 'harvester', edge);
    const comp = world.components.get(world.component[edge]!)!;
    const before = comp.pool;
    const first = comp.pool;
    step(world);
    const perTick = comp.pool - first;
    let ticks = 1;
    while (!src!.depleted && ticks < 3000) {
      step(world);
      ticks++;
    }
    return { perTick, ticks, gained: comp.pool - before, total: src!.total, world, src: src!, cells: foodCells(world, src!).length };
  }

  it('speeds up absorbing by the multiplier, and shortens the time to use the item up', () => {
    const plain = absorb(false);
    const fast = absorb(true);
    expect(fast.perTick).toBeCloseTo(plain.perTick * spec.rateMult, 4);
    expect(fast.ticks).toBeLessThan(plain.ticks * 0.6);
  });

  it('does not change the total nutrients absorbed', () => {
    const plain = absorb(false);
    const fast = absorb(true);
    expect(plain.gained).toBeCloseTo(plain.total, 3);
    expect(fast.gained).toBeCloseTo(fast.total, 3);
  });

  it('only speeds up the harvester owner\'s cells', () => {
    const world = createOpenWorld(70, 40, { ...noIncome, buildings: { ...defaultBalance.buildings, harvester: { ...spec, upkeep: 0 } } });
    const a = addMold(world, 'player', cellOf(world, 10, 20), 0);
    const b = addMold(world, 'player', cellOf(world, 60, 20), 0);
    const src = placeFood(world, 'sugarCube', 30, 18, 'initial')!;
    const ca = cellOf(world, 30, 18);
    const cb = cellOf(world, 33, 21);
    addCell(world, a.id, ca, -1);
    addCell(world, b.id, cb, -1);
    world.components.get(world.component[ca]!)!.pool = 100;
    placeBuilding(world, a.id, 'harvester', ca);
    const pa = world.components.get(world.component[ca]!)!;
    const pb = world.components.get(world.component[cb]!)!;
    const a0 = pa.pool;
    const b0 = pb.pool;
    step(world);
    expect(pa.pool - a0).toBeCloseTo(defaultBalance.foodTypes.sugarCube.absorbRate * TICK_DT * spec.rateMult, 5);
    expect(pb.pool - b0).toBeCloseTo(defaultBalance.foodTypes.sugarCube.absorbRate * TICK_DT, 5);
    expect(src.remaining).toBeLessThan(src.total);
    assertInvariants(world);
  });

  it('goes idle when the food is used up: no target, and no new harvester can be placed there', () => {
    const { world, a, src, edge } = setup('breadCrumb');
    engulfFood(world, a.id, cellOf(world, 20, 20));
    addCell(world, a.id, cellOf(world, 20, 20), edge);
    engulfFood(world, a.id, cellOf(world, 20, 20));
    world.components.get(world.component[edge]!)!.pool = 100;
    placeBuilding(world, a.id, 'harvester', edge);
    for (let i = 0; i < 2000 && !src!.depleted; i++) step(world);
    expect(src!.depleted).toBe(true);
    expect(harvestTarget(world, edge)).toBeNull();
    expect(world.buildings[0]!.destroyed).toBe(false); // still standing, just idle
  });
});

describe('store house boost on harvesting (003 FR-020, FR-023)', () => {
  function perTick(supply: number, withHarvester = true) {
    const { world, a, edge } = setup('sugarCube', { ...noIncome, buildings: { ...defaultBalance.buildings, harvester: { ...spec, upkeep: 0 } } });
    engulfFood(world, a.id, cellOf(world, 20, 20));
    if (!world.owner[cellOf(world, 20, 20)]) addCell(world, a.id, cellOf(world, 20, 20), edge);
    engulfFood(world, a.id, cellOf(world, 20, 20));
    world.components.get(world.component[edge]!)!.pool = 100;
    if (withHarvester) placeBuilding(world, a.id, 'harvester', edge);
    world.supply.fill(supply);
    const comp = world.components.get(world.component[edge]!)!;
    const before = comp.pool;
    step(world);
    return { gain: comp.pool - before, world };
  }

  it('a boosted harvester absorbs base x rateMult x supply per tick, and flags the piece', () => {
    const plain = perTick(1);
    const boosted = perTick(1.5);
    expect(boosted.gain).toBeCloseTo(plain.gain * 1.5, 6);
    expect(boosted.world.supplyUse.size).toBe(1);
    expect(plain.world.supplyUse.size).toBe(0);
  });

  it('only harvester-owned food is sped up, and the item total is unchanged', () => {
    const none = perTick(1.5, false);
    const base = perTick(1, false);
    expect(none.gain).toBeCloseTo(base.gain, 9); // no harvester: the supply multiplier is not used
    const { world, a, src, edge } = setup('sugarCube', { ...noIncome, buildings: { ...defaultBalance.buildings, harvester: { ...spec, upkeep: 0 } } });
    engulfFood(world, a.id, cellOf(world, 20, 20));
    if (!world.owner[cellOf(world, 20, 20)]) addCell(world, a.id, cellOf(world, 20, 20), edge);
    engulfFood(world, a.id, cellOf(world, 20, 20));
    const comp = world.components.get(world.component[edge]!)!;
    comp.pool = 100;
    placeBuilding(world, a.id, 'harvester', edge);
    world.supply.fill(1.5);
    const before = comp.pool;
    for (let t = 0; t < 3000 && !src!.depleted; t++) step(world);
    expect(src!.depleted).toBe(true);
    expect(comp.pool - before).toBeCloseTo(src!.total, 2);
  });
});
