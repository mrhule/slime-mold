import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { canPlaceFood, engulfFood, foodCells, placeFood, tickFood } from '../../../src/sim/food';
import { addCell } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import { Terrain, TICK_DT } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

describe('food', () => {
  it('places an oat flake as 2x2 with 40 nutrients spread over its cells', () => {
    const { world } = createWorldWithMold();
    const src = placeFood(world, 'oatFlake', 30, 20, 'initial')!;
    expect(src.w * src.h).toBe(4);
    const cells = foodCells(world, src);
    expect(cells).toHaveLength(4);
    for (const c of cells) expect(world.food[c]).toBeCloseTo(10);
    expect(src.remaining).toBe(40);
  });

  it('refuses overlapping, off-map, and obstructed footprints', () => {
    const { world } = createWorldWithMold();
    placeFood(world, 'oatFlake', 30, 20, 'initial');
    expect(canPlaceFood(world, 'oatFlake', 31, 21)).toBe(false);
    expect(canPlaceFood(world, 'oatFlake', -1, 5)).toBe(false);
    world.terrain[cellOf(world, 40, 20)] = Terrain.Obstacle;
    expect(canPlaceFood(world, 'oatFlake', 39, 19)).toBe(false);
  });

  it('transfers min(food, rate*dt) per owned food cell into the pool', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 0);
    const src = placeFood(world, 'oatFlake', 12, 20, 'initial')!;
    addCell(world, mold.id, cellOf(world, 12, 20), cellOf(world, 11, 20));
    const comp = world.components.get(world.component[mold.core]!)!;
    const before = comp.pool;
    tickFood(world);
    expect(comp.pool - before).toBeCloseTo(defaultBalance.foodTypes.oatFlake.absorbRate * TICK_DT);
    expect(src.remaining).toBeCloseTo(40 - 0.1);
  });

  it('retires food when used up and reports it', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 0);
    const src = placeFood(world, 'oatFlake', 12, 20, 'initial')!;
    addCell(world, mold.id, cellOf(world, 12, 20), cellOf(world, 11, 20));
    engulfFood(world, mold.id, cellOf(world, 12, 20));
    let depleted = false;
    for (let i = 0; i < 400 && !src.depleted; i++) {
      step(world);
      if (world.events.some((e) => e.type === 'foodDepleted')) depleted = true;
    }
    expect(src.depleted).toBe(true);
    expect(depleted).toBe(true);
    expect(src.remaining).toBe(0);
    for (const c of foodCells(world, src)) expect(world.food[c]).toBe(0);
    assertInvariants(world);
  });

  it('touching one cell engulfs the whole footprint for free', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 0);
    const src = placeFood(world, 'breadCrumb', 12, 19, 'initial')!;
    const before = mold.cellCount;
    addCell(world, mold.id, cellOf(world, 12, 20), cellOf(world, 11, 20));
    engulfFood(world, mold.id, cellOf(world, 12, 20));
    for (const c of foodCells(world, src)) expect(world.owner[c]).toBe(mold.id);
    expect(mold.cellCount).toBe(before + 9);
    assertInvariants(world);
  });
});
