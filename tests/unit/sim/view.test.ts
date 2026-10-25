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

describe('MoldView and the new buildings (003 US5)', () => {
  it('fertile ground is global terrain, like obstacles', () => {
    const { world, me } = setup();
    world.fertile.fill(0);
    const far = cellOf(world, 90, 40);
    world.fertile[far] = 1;
    const view = viewFor(world, me);
    expect(view.visibility(far)).toBe(0);
    expect(view.fertileAt(far)).toBe(true);
    expect(view.fertileAt(cellOf(world, 91, 40))).toBe(false);
  });

  it('exposes own farms, caps, and levels, and nothing about an opponent', async () => {
    const { placeBuilding } = await import('../../../src/sim/buildings');
    const { withStoreHouse } = await import('../../helpers');
    const { world, me, rival } = setup();
    world.fertile[cellOf(world, 16, 25)] = 1;
    world.fertile[cellOf(world, 84, 25)] = 1;
    for (const c of world.components.values()) c.pool = 150;
    expect(placeBuilding(world, me, 'farm', cellOf(world, 16, 25))).toEqual({ ok: true });
    expect(placeBuilding(world, rival, 'farm', cellOf(world, 84, 25))).toEqual({ ok: true });
    withStoreHouse(world, me, cellOf(world, 14, 25));
    const view = viewFor(world, me);
    const farms = view.farms();
    expect(farms).toHaveLength(1); // not the rival's
    expect(farms[0]).toMatchObject({ cell: cellOf(world, 16, 25), level: world.balance.buildings.farm.defaultLevel, linked: true });
    expect(farms[0]!.cap).toBe(world.balance.pool.baseCap + world.balance.buildings.storehouse.capacity);
    expect(view.farmLevel(farms[0]!.id)).toBe(farms[0]!.level);
    const rivalFarm = world.buildings.find((b) => b.type === 'farm' && b.moldId === rival)!;
    expect(view.farmLevel(rivalFarm.id)).toBe(-1);
    const piece = view.self.components[0]!;
    expect(piece).toMatchObject({ storeHouses: 1, linkedFarms: 1 });
    expect(view.pieceOf(cellOf(world, 16, 25))).toBe(piece.id);
    expect(view.pieceOf(cellOf(world, 84, 25))).toBe(-1);
  });

  it('canBuild reflects fertile ground and cost for farms', () => {
    const { world, me } = setup();
    world.fertile.fill(0);
    const own = cellOf(world, 16, 25);
    for (const c of world.components.values()) c.pool = 100;
    expect(viewFor(world, me).canBuild('farm', own)).toBe(false); // not fertile
    world.fertile[own] = 1;
    expect(viewFor(world, me).canBuild('farm', own)).toBe(true);
    for (const c of world.components.values()) c.pool = 1;
    expect(viewFor(world, me).canBuild('farm', own)).toBe(false); // cannot pay
  });
});
