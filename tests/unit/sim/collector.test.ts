import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { canPlace, demolishBuilding, placeBuilding } from '../../../src/sim/buildings';
import { engulfFood, placeFood, poolIncome } from '../../../src/sim/food';
import { addCell } from '../../../src/sim/network';
import { evolve } from '../../../src/sim/tiers';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import { cellOf, createWorldWithMold, withStoreHouse } from '../../helpers';

const spec = defaultBalance.buildings.collector;
const noIncome = { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 };

/** a straight vein of own cells east of the core at (10, 20), out to x = 10 + n */
function vein(n: number) {
  const { world, mold } = createWorldWithMold(80, 40, 10, 20, 500);
  world.balance = noIncome;
  let prev = cellOf(world, 10, 20);
  for (let x = 11; x <= 10 + n; x++) {
    addCell(world, mold.id, cellOf(world, x, 20), prev);
    prev = cellOf(world, x, 20);
  }
  return { world, mold };
}

describe('building tiers', () => {
  it('the collector opens at tier 2 and the harvester at tier 3', () => {
    const { world, mold } = vein(6);
    const cell = cellOf(world, 14, 20);
    expect(spec.minTier).toBe(2);
    expect(defaultBalance.buildings.harvester.minTier).toBe(3);
    expect(canPlace(world, mold.id, 'collector', cell)).toEqual({ ok: false, reason: 'locked' });
    expect(canPlace(world, mold.id, 'harvester', cell)).toEqual({ ok: false, reason: 'locked' });
    world.components.get(world.component[mold.core] as number)!.pool = 900;
    expect(evolve(world, mold.id).ok).toBe(true);
    expect(canPlace(world, mold.id, 'collector', cell)).toEqual({ ok: true });
    expect(canPlace(world, mold.id, 'harvester', cell)).toEqual({ ok: false, reason: 'locked' });
    world.components.get(world.component[mold.core] as number)!.pool = 900;
    expect(evolve(world, mold.id).ok).toBe(true);
    expect(world.molds[0]!.tier).toBe(3);
  });
});

describe('collector', () => {
  it('adds sunlight income to its piece', () => {
    const { world, mold } = vein(6);
    mold.tier = 2;
    const comp = world.components.get(world.component[mold.core] as number)!;
    placeBuilding(world, mold.id, 'collector', cellOf(world, 14, 20));
    comp.pool = 100;
    const before = comp.pool;
    step(world);
    expect(comp.pool - before).toBeCloseTo(spec.income * TICK_DT - spec.upkeep * TICK_DT, 4);
  });

  it('powers cells along the veins within its reach, tapering, and not beyond', () => {
    const { world, mold } = vein(30);
    mold.tier = 2;
    placeBuilding(world, mold.id, 'collector', cellOf(world, 12, 20));
    expect(world.power[cellOf(world, 12, 20)]).toBeCloseTo(1 + spec.bonus);
    expect(world.power[cellOf(world, 18, 20)]).toBeLessThan(world.power[cellOf(world, 14, 20)]!);
    expect(world.power[cellOf(world, 12 + spec.reach, 20)]).toBe(1);
    demolishBuilding(world, mold.id, cellOf(world, 12, 20));
    expect(world.power[cellOf(world, 12, 20)]).toBe(1);
  });

  it('raises a powered factory\'s growth boost', () => {
    const { world, mold } = vein(14);
    mold.tier = 2;
    withStoreHouse(world, mold.id, cellOf(world, 16, 20));
    world.components.get(world.component[mold.core] as number)!.pool = 400;
    step(world);
    const plain = world.supply[cellOf(world, 16, 20)]!;
    placeBuilding(world, mold.id, 'collector', cellOf(world, 15, 20));
    step(world);
    expect(world.supply[cellOf(world, 16, 20)]!).toBeGreaterThan(plain);
  });
});

describe('factory near a goo pool', () => {
  function pool(factoryX: number) {
    const { world, mold } = createWorldWithMold(80, 40, 10, 20, 500);
    world.balance = noIncome;
    const src = placeFood(world, 'goo', 14, 19, 'initial')!;
    let prev = cellOf(world, 11, 20);
    for (let x = 12; x <= 13; x++) {
      addCell(world, mold.id, cellOf(world, x, 20), prev);
      prev = cellOf(world, x, 20);
    }
    addCell(world, mold.id, cellOf(world, 14, 20), prev);
    engulfFood(world, mold.id, cellOf(world, 14, 20));
    withStoreHouse(world, mold.id, cellOf(world, factoryX, 20));
    return { world, mold, src };
  }

  it('pays more per goo cell when a factory is within range of the pool', () => {
    const rate = defaultBalance.foodTypes.goo.absorbRate * 12;
    const { world: near, mold: a } = pool(12);
    expect(poolIncome(near, a.id)).toBeCloseTo(rate * (1 + defaultBalance.gooFactory.bonus));
    const gained = near.molds[0]!.stats.nutrientsGathered;
    step(near);
    expect(near.molds[0]!.stats.nutrientsGathered - gained).toBeCloseTo(rate * (1 + defaultBalance.gooFactory.bonus) * TICK_DT, 6);
  });

  it('pays the plain rate when the factory is out of range', () => {
    const { world, mold } = pool(12);
    world.balance = { ...world.balance, gooFactory: { range: 0, bonus: defaultBalance.gooFactory.bonus } };
    expect(poolIncome(world, mold.id)).toBeCloseTo(defaultBalance.foodTypes.goo.absorbRate * 12);
  });
});
