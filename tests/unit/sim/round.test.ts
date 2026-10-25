import { describe, expect, it } from 'vitest';
import { createRound, readHud } from '../../../src/sim';
import { floodReach } from '../../../src/sim/mapgen';
import { mapControl } from '../../../src/sim/round';
import { addCell } from '../../../src/sim/network';
import { cellOf, createWorldWithMold } from '../../helpers';

describe('mapControl', () => {
  it('is owned cells over reachable cells', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20);
    // helpers set reachableCells = (60-2)*(40-2)
    expect(world.reachableCells).toBe(58 * 38);
    expect(mapControl(world, mold.id)).toBeCloseTo(mold.cellCount / (58 * 38));
    addCell(world, mold.id, cellOf(world, 11, 20), cellOf(world, 10, 20));
    expect(mapControl(world, mold.id)).toBeCloseTo(mold.cellCount / (58 * 38));
  });

  it('is exposed through the HUD', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20);
    expect(readHud(world, mold.id).mapControl).toBeCloseTo(mapControl(world, mold.id));
  });

  it('is 0 when nothing is reachable', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20);
    world.reachableCells = 0;
    expect(mapControl(world, mold.id)).toBe(0);
  });

  it('a generated round counts only walkable cells reachable from the start', () => {
    for (const seed of [1, 2, 3]) {
      const world = createRound({ runSeed: seed, roundNumber: 1 });
      const reach = floodReach(world, world.molds[0]!.core);
      let n = 0;
      for (let i = 0; i < reach.length; i++) if (reach[i]) n++;
      expect(world.reachableCells).toBe(n);
      let walkable = 0;
      for (const t of world.terrain) if (t < 2) walkable++;
      expect(world.reachableCells).toBeLessThanOrEqual(walkable);
      expect(mapControl(world, 1)).toBeGreaterThan(0);
      expect(mapControl(world, 1)).toBeLessThan(0.01);
    }
  });
});
