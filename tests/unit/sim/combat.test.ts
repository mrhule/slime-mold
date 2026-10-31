import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { checkEliminations, scanFronts, tickCombat } from '../../../src/sim/combat';
import { addMold } from '../../../src/sim/molds';
import { addCell, removeCell } from '../../../src/sim/network';
import { refreshSources } from '../../../src/sim/network';
import { TICK_DT } from '../../../src/sim/types';
import type { World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const b = defaultBalance;

/** two molds far apart; tests place loose cells to build exact contact geometry */
function twoMolds(): { world: World; a: number; b: number } {
  const world = createOpenWorld(60, 40);
  const a = addMold(world, 'player', cellOf(world, 8, 20), 100);
  const bm = addMold(world, 'rival', cellOf(world, 50, 20), 100);
  return { world, a: a.id, b: bm.id };
}

/** a loose cell for a mold (its own piece), with a pool so it can fight */
function loose(world: World, moldId: number, x: number, y: number, pool = 0): number {
  const cell = cellOf(world, x, y);
  addCell(world, moldId, cell, -1);
  world.components.get(world.component[cell]!)!.pool = pool;
  return cell;
}

describe('scanFronts', () => {
  it('contact is 8-adjacency between different owners, and counts enemies per cell', () => {
    const { world, a, b: bId } = twoMolds();
    const ca = loose(world, a, 25, 20);
    loose(world, bId, 26, 20); // orthogonal
    loose(world, bId, 26, 21); // diagonal
    loose(world, bId, 28, 20); // two cells away: not contact
    scanFronts(world);
    expect(world.molds[a - 1]!.frontCells).toContain(ca);
    expect(world.enemyAdj[ca]).toBe(2);
    expect(world.molds[bId - 1]!.frontCells).toContain(cellOf(world, 26, 20));
    expect(world.molds[bId - 1]!.frontCells).toContain(cellOf(world, 26, 21));
    expect(world.molds[bId - 1]!.frontCells).not.toContain(cellOf(world, 28, 20));
  });

  it('finds nothing when a mold is alone', () => {
    const world = createOpenWorld(60, 40);
    const m = addMold(world, 'player', cellOf(world, 8, 20), 10);
    scanFronts(world);
    expect(m.frontCells).toHaveLength(0);
  });

  it('regrows damaged cells that are supplied and out of contact, but not in contact or orphaned', () => {
    const { world, a, b: bId } = twoMolds();
    const arm = cellOf(world, 9, 20);
    world.biomass[arm] = 0.5;
    scanFronts(world);
    expect(world.biomass[arm]!).toBeCloseTo(0.5 + b.biomassRegen * TICK_DT, 5);

    // in contact: no regrowth
    const ca = loose(world, a, 25, 20);
    loose(world, bId, 26, 20);
    world.biomass[ca] = 0.5;
    refreshSources(world, world.components.get(world.component[ca]!)!);
    scanFronts(world);
    expect(world.biomass[ca]).toBe(0.5);

    // orphaned and out of contact: no regrowth
    const lone = loose(world, a, 30, 5);
    refreshSources(world, world.components.get(world.component[lone]!)!);
    world.biomass[lone] = 0.5;
    scanFronts(world);
    expect(world.biomass[lone]).toBe(0.5);
  });
});

describe('tickCombat', () => {
  it('applies damage pressure * attackEff * dt simultaneously, and is mirror-symmetric', () => {
    const run = (swap: boolean) => {
      const { world, a, b: bId } = twoMolds();
      const left = swap ? bId : a;
      const right = swap ? a : bId;
      const cl = loose(world, left, 25, 20);
      const cr = loose(world, right, 26, 20);
      scanFronts(world);
      tickCombat(world);
      return { l: world.biomass[cl]!, r: world.biomass[cr]! };
    };
    const expected = 1 - b.basePressure * b.attackEff * TICK_DT;
    const plain = run(false);
    const mirrored = run(true);
    expect(plain.l).toBeCloseTo(expected, 6);
    expect(plain.r).toBeCloseTo(expected, 6);
    expect(mirrored).toEqual(plain);
  });

  it('hits harder with more delivered nutrients, and spends them from the pool', () => {
    const { world, a, b: bId } = twoMolds();
    const ca = loose(world, a, 25, 20, 50);
    const cb = loose(world, bId, 26, 20, 0);
    scanFronts(world);
    world.pressure[ca] = 3; // nutrients/s delivered by the last flow solve
    tickCombat(world);
    expect(world.biomass[cb]!).toBeCloseTo(1 - (3 + b.basePressure) * b.attackEff * TICK_DT, 6);
    expect(world.biomass[ca]!).toBeCloseTo(1 - b.basePressure * b.attackEff * TICK_DT, 6);
    expect(world.components.get(world.component[ca]!)!.pool).toBeCloseTo(50 - 3 * TICK_DT, 6);
  });

  it('delivered nutrients are capped by what the pool holds', () => {
    const { world, a, b: bId } = twoMolds();
    const ca = loose(world, a, 25, 20, 0);
    const cb = loose(world, bId, 26, 20, 0);
    scanFronts(world);
    world.pressure[ca] = 5;
    tickCombat(world);
    expect(world.biomass[cb]!).toBeCloseTo(1 - b.basePressure * b.attackEff * TICK_DT, 6); // only base pressure
  });

  it('kills a cell at zero biomass, refunds the attacker, and steps in when it can pay', () => {
    const { world, a, b: bId } = twoMolds();
    const ca = loose(world, a, 25, 20, 10);
    const cb = loose(world, bId, 26, 20, 0);
    world.biomass[cb] = 0.0001;
    const bMold = world.molds[bId - 1]!;
    const killed = bMold.stats.cellsDestroyed;
    scanFronts(world);
    world.events = [];
    tickCombat(world);
    expect(world.events).toContainEqual({ type: 'cellDied', cell: cb, mold: bId, by: a });
    expect(bMold.stats.cellsDestroyed).toBe(killed + 1);
    expect(world.owner[cb]).toBe(a); // stepped into the freed cell
    expect(world.components.get(world.component[ca]!)!.pool).toBeCloseTo(10 + b.consumeRefund * b.cellBuildCost - b.cellBuildCost, 6);
    assertInvariants(world);
  });

  it('two cells that kill each other both die; neither side revives its own cell', () => {
    const { world, a, b: bId } = twoMolds();
    const ca = loose(world, a, 25, 20, 10);
    const cb = loose(world, bId, 26, 20, 10);
    world.biomass[ca] = 0.0001;
    world.biomass[cb] = 0.0001;
    scanFronts(world);
    tickCombat(world);
    expect(world.owner[ca]).toBe(0);
    expect(world.owner[cb]).toBe(0);
    // no refunds or advances either, since neither attacker survived
    expect(world.components.size).toBe(2); // only the two real molds' pieces remain
    assertInvariants(world);
  });

  it('leaves the cell empty when the attacker cannot pay to advance', () => {
    const { world, a, b: bId } = twoMolds();
    loose(world, a, 25, 20, 0);
    const cb = loose(world, bId, 26, 20, 0);
    world.biomass[cb] = 0.0001;
    scanFronts(world);
    tickCombat(world);
    expect(world.owner[cb]).toBe(0);
    assertInvariants(world);
  });

  it('a kill that cuts a mold in two splits its piece and its pool', () => {
    const { world, a, b: bId } = twoMolds();
    // B: a line of five cells in one piece
    const line: number[] = [];
    let prev = -1;
    for (let x = 26; x <= 30; x++) {
      const c = cellOf(world, x, 10);
      addCell(world, bId, c, prev);
      line.push(c);
      prev = c;
    }
    const comp = world.components.get(world.component[line[0]!]!)!;
    comp.pool = 100;
    loose(world, a, 28, 11, 10); // next to the middle cell
    world.biomass[line[2]!] = 0.0001;
    const before = world.components.size;
    scanFronts(world);
    tickCombat(world);
    expect(world.owner[line[2]!]).not.toBe(bId);
    expect(world.components.size).toBeGreaterThan(before);
    const pools = [...world.components.values()].filter((c) => c.moldId === bId && c.cells.some((x) => line.includes(x)));
    expect(pools.length).toBe(2);
    expect(pools.reduce((s, c) => s + c.pool, 0)).toBeCloseTo(100, 4);
    assertInvariants(world);
  });
});

describe('eliminations', () => {
  it('a mold with no cells left is eliminated: event, no targets', () => {
    const { world, b: bId } = twoMolds();
    const bm = world.molds[bId - 1]!;
    bm.targets.push({ id: 1, moldId: bId, cell: 5, path: [5], pos: 0, progress: 0, createdTick: 0, state: 'growing', speed: 1, starvedFor: 0, rate: 0 });
    for (const c of [...world.components.values()].filter((c) => c.moldId === bId)) for (const cell of [...c.cells]) removeCell(world, cell);
    expect(bm.cellCount).toBe(0);
    world.events = [];
    checkEliminations(world);
    expect(bm.status).toBe('eliminated');
    expect(bm.targets).toHaveLength(0);
    expect(world.events).toContainEqual({ type: 'moldEliminated', mold: bId });
    checkEliminations(world);
    expect(world.events.filter((e) => e.type === 'moldEliminated')).toHaveLength(1);
  });
});
