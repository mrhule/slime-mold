import { describe, expect, it } from 'vitest';
import { enqueue, step } from '../../src/sim';
import { addMold } from '../../src/sim/molds';
import type { World } from '../../src/sim/types';
import { assertInvariants } from '../../src/sim/world';
import { cellOf, createOpenWorld } from '../helpers';

/**
 * Two identical molds with identical stock push toward each other. They differ only in the
 * growth/fight slider. Playing it twice with the sides swapped shows the slider, not the
 * position, decides the front.
 */
function duel(allocLeft: number, allocRight: number, ticks = 2400): { left: number; right: number; world: World } {
  const world = createOpenWorld(91, 41);
  const left = addMold(world, 'player', cellOf(world, 18, 20), 300);
  const right = addMold(world, 'player', cellOf(world, 72, 20), 300);
  enqueue(world, { type: 'setAllocation', mold: left.id, value: allocLeft });
  enqueue(world, { type: 'setAllocation', mold: right.id, value: allocRight });
  enqueue(world, { type: 'setTarget', mold: left.id, cell: cellOf(world, 72, 20) });
  enqueue(world, { type: 'setTarget', mold: right.id, cell: cellOf(world, 18, 20) });
  for (let t = 0; t < ticks; t++) {
    step(world);
    if (t % 400 === 0) assertInvariants(world);
  }
  assertInvariants(world);
  return { left: left.cellCount, right: right.cellCount, world };
}

describe('the growth/fight slider (US2 independent test)', () => {
  it('a front forms where the molds meet', () => {
    const { world } = duel(0.5, 0.5, 1500);
    const fronts = world.molds.reduce((s, m) => s + m.frontCells.length, 0);
    expect(fronts).toBeGreaterThan(0);
  });

  it('the side that sends more nutrients to the front wins it', () => {
    const fightLeft = duel(0.9, 0.1);
    expect(fightLeft.left).toBeGreaterThan(fightLeft.right);
  });

  it('decides the front from either side of the map', () => {
    // pathfinding breaks ties toward lower cell indices, so mirrored duels are not exactly equal;
    // what matters is that the side sending more nutrients to the front wins in both orientations
    const a = duel(0.9, 0.1);
    const b = duel(0.1, 0.9);
    expect(a.left).toBeGreaterThan(a.right);
    expect(b.right).toBeGreaterThan(b.left);
  });

  it('with even settings both molds survive the fight', () => {
    const even = duel(0.5, 0.5);
    expect(even.left).toBeGreaterThan(10);
    expect(even.right).toBeGreaterThan(10);
  });

  it('moving the slider toward Fight turns a losing front around', () => {
    // start with the right side winning (left on all-growth), then the left switches to fight
    const world = createOpenWorld(91, 41);
    const left = addMold(world, 'player', cellOf(world, 18, 20), 300);
    const right = addMold(world, 'player', cellOf(world, 72, 20), 300);
    enqueue(world, { type: 'setAllocation', mold: left.id, value: 0 });
    enqueue(world, { type: 'setAllocation', mold: right.id, value: 0.8 });
    enqueue(world, { type: 'setTarget', mold: left.id, cell: cellOf(world, 72, 20) });
    enqueue(world, { type: 'setTarget', mold: right.id, cell: cellOf(world, 18, 20) });
    for (let t = 0; t < 1800; t++) step(world);
    const leftBefore = left.cellCount;
    const rightBefore = right.cellCount;
    expect(rightBefore).toBeGreaterThan(leftBefore); // the left was losing

    // a windfall for both sides, so the slider has nutrients to send
    for (const comp of world.components.values()) comp.pool = 300;
    enqueue(world, { type: 'setAllocation', mold: left.id, value: 1 });
    enqueue(world, { type: 'setAllocation', mold: right.id, value: 0 });
    for (let t = 0; t < 1800; t++) step(world);
    const swing = left.cellCount - right.cellCount - (leftBefore - rightBefore);
    expect(swing).toBeGreaterThan(0); // the balance moved toward the side that now fights
  });
});
