import { describe, expect, it } from 'vitest';
import { createRound, readHud } from '../../../src/sim';
import { floodReach } from '../../../src/sim/mapgen';
import { evaluateOutcome, mapControl } from '../../../src/sim/round';
import { addMold } from '../../../src/sim/molds';
import { removeCell } from '../../../src/sim/network';
import { createOpenWorld } from '../../helpers';
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

function eliminate(world: ReturnType<typeof createOpenWorld>, moldId: number): void {
  for (const c of [...world.components.values()]) {
    if (c.moldId !== moldId) continue;
    for (const cell of [...c.cells]) removeCell(world, cell);
  }
  world.molds[moldId - 1]!.status = 'eliminated';
}

describe('round outcome (FR-022)', () => {
  function duel() {
    const world = createOpenWorld(60, 40);
    addMold(world, 'player', cellOf(world, 10, 20), 10);
    addMold(world, 'rival', cellOf(world, 50, 20), 10);
    addMold(world, 'rival', cellOf(world, 30, 5), 10);
    return world;
  }

  it('is still playing while rivals survive and control is low', () => {
    const world = duel();
    evaluateOutcome(world);
    expect(world.outcome).toBe('playing');
  });

  it('victory by eliminating every rival', () => {
    const world = duel();
    eliminate(world, 2);
    evaluateOutcome(world);
    expect(world.outcome).toBe('playing');
    eliminate(world, 3);
    evaluateOutcome(world);
    expect(world.outcome).toBe('victory');
    expect(world.victoryReason).toBe('eliminated-all');
  });

  it('victory by holding 75% of the reachable map', () => {
    const world = duel();
    world.reachableCells = 100;
    world.molds[0]!.cellCount = 74;
    evaluateOutcome(world);
    expect(world.outcome).toBe('playing');
    world.molds[0]!.cellCount = 75;
    evaluateOutcome(world);
    expect(world.outcome).toBe('victory');
    expect(world.victoryReason).toBe('map-control');
  });

  it('defeat when the player is eliminated', () => {
    const world = duel();
    eliminate(world, 1);
    evaluateOutcome(world);
    expect(world.outcome).toBe('defeat');
  });

  it('when both happen in the same tick, defeat wins', () => {
    const world = duel();
    eliminate(world, 2);
    eliminate(world, 3);
    eliminate(world, 1);
    evaluateOutcome(world);
    expect(world.outcome).toBe('defeat');
  });

  it('a decided outcome sticks', () => {
    const world = duel();
    eliminate(world, 2);
    eliminate(world, 3);
    evaluateOutcome(world);
    expect(world.outcome).toBe('victory');
    eliminate(world, 1);
    evaluateOutcome(world);
    expect(world.outcome).toBe('victory');
  });

  it('a solo world is not won just because there are no rivals', () => {
    const world = createOpenWorld(60, 40);
    addMold(world, 'player', cellOf(world, 10, 20), 10);
    evaluateOutcome(world);
    expect(world.outcome).toBe('playing');
  });
});
