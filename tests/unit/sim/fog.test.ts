import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { updateVision } from '../../../src/sim/fog';
import { placeFood } from '../../../src/sim/food';
import { addMold } from '../../../src/sim/molds';
import { addCell, removeCell } from '../../../src/sim/network';
import type { World } from '../../../src/sim/types';
import { cellOf, createOpenWorld } from '../../helpers';

const R = defaultBalance.visionRadius;

/** brute-force Chebyshev vision from every cell a mold owns */
function expectedVisible(world: World, moldId: number): Uint8Array {
  const out = new Uint8Array(world.width * world.height);
  for (let i = 0; i < world.owner.length; i++) {
    if (world.owner[i] !== moldId) continue;
    const x = i % world.width;
    const y = Math.floor(i / world.width);
    for (let yy = Math.max(0, y - R); yy <= Math.min(world.height - 1, y + R); yy++) {
      for (let xx = Math.max(0, x - R); xx <= Math.min(world.width - 1, x + R); xx++) out[yy * world.width + xx] = 1;
    }
  }
  return out;
}

describe('fog of war', () => {
  it('sees exactly the cells within the Chebyshev radius of its own cells', () => {
    const world = createOpenWorld(80, 50);
    const m = addMold(world, 'player', cellOf(world, 20, 20), 10);
    updateVision(world);
    const want = expectedVisible(world, m.id);
    for (let i = 0; i < want.length; i++) expect(m.vision[i] === 2, `cell ${i}`).toBe(want[i] === 1);
    expect(m.vision[cellOf(world, 20 + R + 1, 20)]).toBe(2); // the east arm at x=21 sees to x=31
    expect(m.vision[cellOf(world, 20 + R + 2, 20)]).toBe(0);
  });

  it('matches brute force for scattered pieces near the edges too', () => {
    const world = createOpenWorld(60, 40);
    const m = addMold(world, 'player', cellOf(world, 2, 2), 10);
    addCell(world, m.id, cellOf(world, 57, 37), -1);
    addCell(world, m.id, cellOf(world, 30, 20), -1);
    updateVision(world);
    const want = expectedVisible(world, m.id);
    for (let i = 0; i < want.length; i++) expect(m.vision[i] === 2).toBe(want[i] === 1);
  });

  it('keeps what it has seen as remembered, with the last-seen owner and food', () => {
    const world = createOpenWorld(80, 50);
    const m = addMold(world, 'player', cellOf(world, 20, 20), 10);
    const rival = addMold(world, 'rival', cellOf(world, 60, 40), 10);
    placeFood(world, 'oatFlake', 28, 24, 'initial');
    const seenEnemy = cellOf(world, 29, 20);
    addCell(world, rival.id, seenEnemy, -1);
    updateVision(world);
    expect(m.vision[seenEnemy]).toBe(2);
    expect(m.memOwner[seenEnemy]).toBe(rival.id);
    expect(m.memFood[cellOf(world, 28, 24)]).toBeGreaterThan(0);
    expect(m.seenCells[rival.id]).toBeGreaterThan(0);

    // the player pulls back to a far corner: that area is remembered, not visible
    for (const comp of [...world.components.values()]) {
      if (comp.moldId !== m.id) continue;
      for (const c of [...comp.cells]) removeCell(world, c);
    }
    addCell(world, m.id, cellOf(world, 5, 5), -1);
    updateVision(world);
    expect(m.vision[seenEnemy]).toBe(1);
    expect(m.memOwner[seenEnemy]).toBe(rival.id);
    world.owner[seenEnemy] = 0; // the real world changes, but the player cannot see it
    updateVision(world);
    expect(m.memOwner[seenEnemy]).toBe(rival.id);
    expect(m.vision[cellOf(world, 70, 45)]).toBe(0); // never seen
  });

  it('is independent per mold', () => {
    const world = createOpenWorld(80, 50);
    const a = addMold(world, 'player', cellOf(world, 10, 10), 10);
    const b = addMold(world, 'rival', cellOf(world, 70, 40), 10);
    updateVision(world);
    expect(a.vision[cellOf(world, 70, 40)]).toBe(0);
    expect(b.vision[cellOf(world, 10, 10)]).toBe(0);
    expect(b.vision[cellOf(world, 70, 40)]).toBe(2);
  });
});

describe('remembered buildings (US4)', () => {
  it('an enemy building seen once stays on the map as last known, even after it is gone or out of sight', async () => {
    const { placeBuilding } = await import('../../../src/sim/buildings');
    const world = createOpenWorld(80, 50);
    const me = addMold(world, 'player', cellOf(world, 20, 20), 10);
    const rival = addMold(world, 'rival', cellOf(world, 60, 40), 10);
    const theirs = cellOf(world, 28, 20);
    addCell(world, rival.id, theirs, -1);
    world.components.get(world.component[theirs]!)!.pool = 100;
    placeBuilding(world, rival.id, 'farm', theirs);
    updateVision(world);
    expect(me.memBuilding[theirs]).toBe(1); // a farm
    // the player pulls back; the farm is destroyed meanwhile, but the player does not know
    for (const comp of [...world.components.values()]) {
      if (comp.moldId !== me.id) continue;
      for (const c of [...comp.cells]) removeCell(world, c);
    }
    addCell(world, me.id, cellOf(world, 5, 5), -1);
    removeCell(world, theirs);
    updateVision(world);
    expect(me.vision[theirs]).toBe(1);
    expect(me.memBuilding[theirs]).toBe(1); // stale, until the player looks again
    for (let x = 6; x < 30; x++) addCell(world, me.id, cellOf(world, x, 5), cellOf(world, x - 1, 5));
    addCell(world, me.id, cellOf(world, 28, 6), cellOf(world, 28, 5));
    for (let y = 7; y <= 19; y++) addCell(world, me.id, cellOf(world, 28, y), cellOf(world, 28, y - 1));
    updateVision(world);
    expect(me.vision[theirs]).toBe(2);
    expect(me.memBuilding[theirs]).toBe(0); // seen again: it is gone
  });
});
