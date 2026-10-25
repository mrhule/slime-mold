import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { connectPieces } from '../../../src/sim/connect';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import type { Component } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const quiet = { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 };

/** a mold at the left and a second piece of the same mold at (x, y) */
function twoPieces(x: number, y: number, pool = 50) {
  const world = createOpenWorld(60, 30, quiet);
  const mold = addMold(world, 'player', cellOf(world, 10, 15), 100);
  const far = cellOf(world, x, y);
  addCell(world, mold.id, far, -1);
  const compOf = (c: number) => world.components.get(world.component[c] as number) as Component;
  compOf(far).pool = pool;
  return { world, mold, far, compOf, core: mold.core, arm: cellOf(world, 11, 15) };
}

describe('pieces of one mold that grow close join up (connect-pieces)', () => {
  it('links pieces whose cells touch, for free', () => {
    const { world, far, compOf, arm } = twoPieces(12, 15); // (12,15) touches the arm at (11,15)
    expect(compOf(far).id).not.toBe(compOf(arm).id);
    const cells = world.molds[0]!.cellCount;
    connectPieces(world);
    expect(compOf(far).id).toBe(compOf(arm).id);
    expect(world.molds[0]!.cellCount).toBe(cells); // no bridge cell needed
    assertInvariants(world);
  });

  it('bridges a gap of one free cell with one new cell, paid from the richer piece', () => {
    const { world, far, compOf, arm, core } = twoPieces(13, 15, 50);
    const coreComp = compOf(core);
    coreComp.pool = 5;
    const cells = world.molds[0]!.cellCount;
    connectPieces(world);
    expect(world.owner[cellOf(world, 12, 15)]).toBe(1);
    expect(compOf(far).id).toBe(compOf(arm).id);
    expect(world.molds[0]!.cellCount).toBe(cells + 1);
    expect(compOf(far).pool).toBeCloseTo(50 + 5 - defaultBalance.cellBuildCost, 6); // pools merged, one cell paid
    assertInvariants(world);
  });

  it('bridges across a knight-move gap too', () => {
    const { world, far, compOf, arm } = twoPieces(13, 16, 50);
    connectPieces(world);
    expect(compOf(far).id).toBe(compOf(arm).id);
    assertInvariants(world);
  });

  it('leaves pieces two or more free cells apart alone', () => {
    const { world, far, compOf, arm } = twoPieces(14, 15);
    connectPieces(world);
    expect(compOf(far).id).not.toBe(compOf(arm).id);
    expect(world.owner[cellOf(world, 12, 15)]).toBe(0);
    expect(world.owner[cellOf(world, 13, 15)]).toBe(0);
  });

  it('does not bridge when neither piece can pay', () => {
    const { world, far, compOf, arm, core } = twoPieces(13, 15, 0);
    compOf(core).pool = 0;
    connectPieces(world);
    expect(compOf(far).id).not.toBe(compOf(arm).id);
    expect(world.owner[cellOf(world, 12, 15)]).toBe(0);
  });

  it('never joins pieces of different molds, and does not heal a cut next to an enemy cell', () => {
    const { world, far, compOf, arm } = twoPieces(13, 15, 50);
    const rival = addMold(world, 'rival', cellOf(world, 50, 25), 10);
    addCell(world, rival.id, cellOf(world, 12, 14), -1); // touches the gap cell (12,15)
    connectPieces(world);
    expect(world.owner[cellOf(world, 12, 15)]).toBe(0);
    expect(compOf(far).id).not.toBe(compOf(arm).id);
    expect(world.owner[cellOf(world, 12, 14)]).toBe(rival.id);
  });

  it('does not bridge over an obstacle, and does nothing for a mold with one piece', () => {
    const { world, far, compOf, arm } = twoPieces(13, 15, 50);
    world.terrain[cellOf(world, 12, 14)] = 2;
    world.terrain[cellOf(world, 12, 15)] = 2;
    world.terrain[cellOf(world, 12, 16)] = 2;
    connectPieces(world);
    expect(compOf(far).id).not.toBe(compOf(arm).id);
    const single = createOpenWorld(40, 20, quiet);
    addMold(single, 'player', cellOf(single, 10, 10), 10);
    expect(() => connectPieces(single)).not.toThrow();
  });

  it('runs on its own every connectEvery ticks and replays identically', () => {
    const hashRun = () => {
      const { world, far, compOf, arm } = twoPieces(13, 15, 50);
      for (let t = 0; t <= defaultBalance.connectEvery; t++) step(world);
      expect(compOf(far).id).toBe(compOf(arm).id);
      return Array.from(world.owner).join('');
    };
    expect(hashRun()).toBe(hashRun());
  });
});
