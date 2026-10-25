import { describe, expect, it } from 'vitest';
import { updateVision } from '../../../src/sim/fog';
import { placeFood } from '../../../src/sim/food';
import { addMold } from '../../../src/sim/molds';
import { addCell, removeCell } from '../../../src/sim/network';
import { viewFor } from '../../../src/sim/view';
import type { World } from '../../../src/sim/types';
import { cellOf, createOpenWorld } from '../../helpers';

function setup(): { world: World; me: number; rival: number } {
  const world = createOpenWorld(100, 50);
  const me = addMold(world, 'player', cellOf(world, 15, 25), 10);
  const rival = addMold(world, 'rival', cellOf(world, 85, 25), 10);
  updateVision(world);
  return { world, me: me.id, rival: rival.id };
}

describe('MoldView (the AI fairness surface)', () => {
  it('reveals nothing about cells it has never seen', () => {
    const { world, me, rival } = setup();
    placeFood(world, 'oatFlake', 80, 10, 'initial');
    const far = cellOf(world, 85, 25);
    const view = viewFor(world, me);
    expect(world.owner[far]).toBe(rival); // the world has it, the view does not
    expect(view.visibility(far)).toBe(0);
    expect(view.ownerAt(far)).toBe(0);
    expect(view.biomassAt(far)).toBeNull();
    expect(view.foodAt(cellOf(world, 80, 10))).toBe(0);
    expect(view.visibleEnemyCells()).toHaveLength(0);
    expect(view.knownFood()).toHaveLength(0);
  });

  it('shows live state for visible cells and remembered state for remembered ones', () => {
    const { world, me, rival } = setup();
    placeFood(world, 'oatFlake', 24, 25, 'initial');
    const enemyCell = cellOf(world, 26, 25);
    addCell(world, rival, enemyCell, -1);
    updateVision(world);
    let view = viewFor(world, me);
    expect(view.visibility(enemyCell)).toBe(2);
    expect(view.ownerAt(enemyCell)).toBe(rival);
    expect(view.biomassAt(enemyCell)).toBe(1);
    expect(view.foodAt(cellOf(world, 24, 25))).toBeGreaterThan(0);
    expect(view.visibleEnemyCells()).toContain(enemyCell);
    expect(view.knownFood()).toEqual([{ cell: cellOf(world, 24, 25), amount: 40, stale: false }]);

    // pull back to a far corner
    for (const comp of [...world.components.values()]) {
      if (comp.moldId !== me) continue;
      for (const c of [...comp.cells]) removeCell(world, c);
    }
    addCell(world, me, cellOf(world, 3, 3), -1);
    updateVision(world);
    world.owner[enemyCell] = 0; // changes the real world, unseen
    world.biomass[enemyCell] = 0;
    view = viewFor(world, me);
    expect(view.visibility(enemyCell)).toBe(1);
    expect(view.ownerAt(enemyCell)).toBe(rival); // last known
    expect(view.biomassAt(enemyCell)).toBeNull(); // not visible now
    expect(view.knownFood()).toEqual([{ cell: cellOf(world, 24, 25), amount: 40, stale: true }]);
  });

  it('terrain and drop warnings are global', () => {
    const { world, me } = setup();
    world.drops.push({ id: 0, type: 'sugarCube', cell: cellOf(world, 90, 40), warnTick: 0, landTick: 100, state: 'warning' });
    world.drops.push({ id: 1, type: 'breadCrumb', cell: cellOf(world, 60, 10), warnTick: 500, landTick: 600, state: 'scheduled' });
    const view = viewFor(world, me);
    const far = cellOf(world, 90, 40);
    expect(view.visibility(far)).toBe(0);
    expect(view.terrain).toBe(world.terrain);
    expect(view.dropWarnings()).toEqual([{ cell: far, type: 'sugarCube', landsInTicks: 100 }]); // scheduled ones are not announced
  });

  it('knows its own situation', () => {
    const { world, me } = setup();
    const view = viewFor(world, me);
    expect(view.self.id).toBe(me);
    expect(view.self.cellCount).toBe(5);
    expect(view.self.frontCells).toEqual([]);
    expect(view.nearestOwn(cellOf(world, 30, 25))).toBeGreaterThanOrEqual(0);
    expect(view.pathCost(cellOf(world, 15, 25), cellOf(world, 25, 25))).toBeGreaterThanOrEqual(10);
  });
});
