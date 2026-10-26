import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { applyCommand } from '../../../src/sim/commands';
import { connectPieces } from '../../../src/sim/connect';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import type { Component } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const quiet = { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 };

/** a vein east from the core along y = 15 to x = east, up two cells, then back west along y = 13 */
function uShape(east: number) {
  const world = createOpenWorld(80, 30, quiet);
  const mold = addMold(world, 'player', cellOf(world, 10, 15), 400);
  let prev = mold.core;
  const lay = (x: number, y: number): number => {
    const c = cellOf(world, x, y);
    if (world.owner[c] !== mold.id) addCell(world, mold.id, c, prev);
    prev = c;
    return c;
  };
  for (let x = 11; x <= east; x++) lay(x, 15);
  lay(east, 14);
  lay(east, 13);
  for (let x = east - 1; x >= 11; x--) lay(x, 13);
  const comp = world.components.get(world.component[mold.core] as number) as Component;
  comp.pool = 400;
  return { world, mold, comp };
}

describe('loops close inside one piece (connect-pieces)', () => {
  it('bridges two veins that run side by side when the way round is long', () => {
    const { world, mold } = uShape(40);
    const cells = mold.cellCount;
    connectPieces(world);
    expect(mold.cellCount).toBeGreaterThan(cells); // a bridge cell at y = 14
    expect(world.components.size).toBe(1);
    assertInvariants(world);
  });

  it('leaves a short detour alone', () => {
    const { world, mold } = uShape(18);
    const cells = mold.cellCount;
    connectPieces(world);
    expect(mold.cellCount).toBe(cells);
  });

  it('does not bridge when the piece is nearly out of nutrients', () => {
    const { world, mold, comp } = uShape(40);
    comp.pool = 1;
    const cells = mold.cellCount;
    connectPieces(world);
    expect(mold.cellCount).toBe(cells);
  });
});

describe('cutting a vein (toggleLink)', () => {
  function line() {
    const world = createOpenWorld(60, 30, quiet);
    const mold = addMold(world, 'player', cellOf(world, 10, 15), 100);
    const a = cellOf(world, 30, 15);
    const b = cellOf(world, 31, 15);
    addCell(world, mold.id, a, -1);
    addCell(world, mold.id, b, a);
    return { world, mold, a, b };
  }

  it('splits the piece in two, keeps the cells, and is not healed back by connect', () => {
    const { world, mold, a, b } = line();
    applyCommand(world, { type: 'toggleLink', mold: mold.id, a, b });
    expect(world.owner[b]).toBe(mold.id);
    expect(world.component[a]).not.toBe(world.component[b]);
    connectPieces(world);
    expect(world.component[a]).not.toBe(world.component[b]);
    assertInvariants(world);
  });

  it('rejoins when toggled again', () => {
    const { world, mold, a, b } = line();
    applyCommand(world, { type: 'toggleLink', mold: mold.id, a, b });
    applyCommand(world, { type: 'toggleLink', mold: mold.id, a, b });
    expect(world.component[a]).toBe(world.component[b]);
    expect(world.cuts.size).toBe(0);
  });

  it('rejects cells that were never linked, or that are not the mold\'s', () => {
    const { world, mold, a } = line();
    applyCommand(world, { type: 'toggleLink', mold: mold.id, a, b: cellOf(world, 12, 16) });
    applyCommand(world, { type: 'toggleLink', mold: mold.id, a: cellOf(world, 50, 15), b: cellOf(world, 51, 15) });
    expect(world.events.filter((e) => e.type === 'commandRejected')).toHaveLength(2);
  });
});
