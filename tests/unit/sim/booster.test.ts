import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { placeBuilding, recomputeBoost } from '../../../src/sim/buildings';
import { scanFronts, tickCombat } from '../../../src/sim/combat';
import { solveFlow } from '../../../src/sim/flow';
import { addTarget } from '../../../src/sim/growth';
import { addMold } from '../../../src/sim/molds';
import { addCell, removeCell } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import type { World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const spec = defaultBalance.buildings.booster;
const b = defaultBalance;

function arena() {
  const world = createOpenWorld(60, 40);
  const a = addMold(world, 'player', cellOf(world, 8, 20), 500);
  const e = addMold(world, 'player', cellOf(world, 52, 20), 500); // no AI
  return { world, a: a.id, e: e.id };
}

/** a line of own cells so a booster can sit a few cells from the front */
function line(world: World, moldId: number, from: [number, number], to: [number, number]): number[] {
  const cells: number[] = [];
  let prev = -1;
  const step = Math.sign(to[0] - from[0]) || 1;
  for (let x = from[0]; x !== to[0] + step; x += step) {
    const c = cellOf(world, x, from[1]);
    addCell(world, moldId, c, prev);
    cells.push(c);
    prev = c;
  }
  return cells;
}

describe('booster factory area (FR-010, FR-012)', () => {
  it('strengthens its own\'s whole vein, fading with distance along it', () => {
    const { world, a, e } = arena();
    const cells = line(world, a, [20, 10], [34, 10]); // 15 cells in a row
    world.components.get(world.component[cells[0]!]!)!.pool = 200;
    const enemy = cellOf(world, 26, 11);
    addCell(world, e, enemy, -1);
    const factory = cells[7]!; // x = 27
    expect(placeBuilding(world, a, 'booster', factory)).toEqual({ ok: true });
    for (const c of cells) {
      const dx = Math.abs((c % world.width) - 27);
      expect(world.boost[c], `cell x=${c % world.width}`).toBeCloseTo(1 + spec.bonus * (1 - dx / spec.reach), 5);
    }
    expect(world.boost[factory]!).toBeGreaterThan(world.boost[cells[0]!]!); // fades along the vein
    const apart = cellOf(world, 27, 14); // same mold, not wired in
    addCell(world, a, apart, -1);
    recomputeBoost(world);
    expect(world.boost[apart]).toBe(1);
    expect(world.boost[enemy]).toBe(1); // not the enemy's cell, even next to the vein
    expect(world.boost[cellOf(world, 27, 20)]).toBe(1); // empty ground
  });

  it('stacks overlapping factories, up to the cap', () => {
    const { world, a } = arena();
    const cells = line(world, a, [20, 10], [30, 10]);
    world.components.get(world.component[cells[0]!]!)!.pool = 500;
    for (let i = 0; i < 4; i++) expect(placeBuilding(world, a, 'booster', cells[3 + i]!)).toEqual({ ok: true });
    const m = world.boost[cells[5]!]!;
    expect(m).toBeGreaterThan(1 + spec.bonus); // more than one factory's worth
    expect(m).toBeLessThanOrEqual(1 + spec.stackCap + 1e-6); // but capped
    expect(m).toBeCloseTo(1 + spec.stackCap);
  });

  it('stops working while its piece cannot pay upkeep, and resumes when it can', () => {
    const { world, a } = arena();
    const cells = line(world, a, [20, 10], [28, 10]);
    const comp = world.components.get(world.component[cells[0]!]!)!;
    comp.pool = 100;
    placeBuilding(world, a, 'booster', cells[4]!);
    expect(world.boost[cells[3]!]).toBeGreaterThan(1);
    comp.unpaid = true;
    recomputeBoost(world);
    expect(world.boost[cells[3]!]).toBe(1);
    comp.unpaid = false;
    recomputeBoost(world);
    expect(world.boost[cells[3]!]).toBeGreaterThan(1);
  });

  it('ends at once when the factory cell is destroyed', () => {
    const { world, a } = arena();
    const cells = line(world, a, [20, 10], [28, 10]);
    world.components.get(world.component[cells[0]!]!)!.pool = 100;
    placeBuilding(world, a, 'booster', cells[8]!);
    expect(world.boost[cells[5]!]).toBeGreaterThan(1);
    removeCell(world, cells[8]!);
    expect(world.boost[cells[5]!]).toBe(1);
    assertInvariants(world);
  });

  it('is paid for like any building: cost, upkeep, and a limit', () => {
    const { world, a } = arena();
    const cells = line(world, a, [20, 10], [34, 10]);
    const comp = world.components.get(world.component[cells[0]!]!)!;
    comp.pool = 1000;
    for (let i = 0; i < spec.limit; i++) expect(placeBuilding(world, a, 'booster', cells[i * 3]!)).toEqual({ ok: true });
    expect(placeBuilding(world, a, 'booster', cells[13]!)).toEqual({ ok: false, reason: 'limit-reached' });
    expect(comp.pool).toBeCloseTo(1000 - spec.cost * spec.limit);
  });
});

describe('booster factory in a fight', () => {
  /** two cells touching; optionally a booster near the left one */
  function fight(withBooster: boolean) {
    const { world, a, e } = arena();
    const left = line(world, a, [24, 20], [26, 20]);
    const right = line(world, e, [27, 20], [29, 20]);
    for (const id of [a, e]) for (const c of world.components.values()) if (c.moldId === id) c.pool = 300;
    if (withBooster) placeBuilding(world, a, 'booster', left[0]!);
    scanFronts(world);
    tickCombat(world);
    return { world, front: left[2]!, enemyFront: right[0]! };
  }

  it('a covered front hits harder and takes less damage than an uncovered one', () => {
    const plain = fight(false);
    const boosted = fight(true);
    const base = b.basePressure * b.attackEff * TICK_DT;
    const m = 1 + spec.bonus * (1 - 2 / spec.reach); // the front cell is two cells down the vein
    // plain: both lose the same
    expect(plain.world.biomass[plain.front]!).toBeCloseTo(1 - base, 6);
    expect(plain.world.biomass[plain.enemyFront]!).toBeCloseTo(1 - base, 6);
    // boosted: the enemy loses m times as much; the boosted cell loses 1/m as much
    expect(1 - boosted.world.biomass[boosted.enemyFront]!).toBeCloseTo(base * m, 6);
    expect(1 - boosted.world.biomass[boosted.front]!).toBeCloseTo(base / m, 6);
  });

  it('a front outside every factory\'s area plays out as in the core game', () => {
    const { world, a, e } = arena();
    const left = line(world, a, [24, 20], [26, 20]);
    const right = line(world, e, [27, 20], [29, 20]);
    const far = line(world, a, [8, 5], [10, 5]);
    for (const c of world.components.values()) c.pool = 300;
    placeBuilding(world, a, 'booster', far[0]!); // far from the front
    scanFronts(world);
    tickCombat(world);
    const base = b.basePressure * b.attackEff * TICK_DT;
    expect(1 - world.biomass[right[0]!]!).toBeCloseTo(base, 6);
    expect(1 - world.biomass[left[2]!]!).toBeCloseTo(base, 6);
  });

  it('does not change growth speed or income (combat only)', () => {
    const rate = (withBooster: boolean): number => {
      const { world, a } = arena();
      const cells = line(world, a, [9, 20], [14, 20]);
      void cells;
      const mold = world.molds[0]!;
      const comp = world.components.get(world.component[mold.core]!)!;
      comp.pool = 300;
      if (withBooster) placeBuilding(world, a, 'booster', cellOf(world, 12, 20));
      world.conductivity.fill(20);
      addTarget(world, a, cellOf(world, 40, 25));
      solveFlow(world);
      const income = mold.netIncome;
      expect(income).toBe(0);
      return mold.targets[0]!.rate;
    };
    // the booster costs upkeep but does not speed up or slow down growth at the same stock
    expect(rate(true)).toBeCloseTo(rate(false), 1);
  });

  it('is deterministic with boosters in play', () => {
    const run = (): number => {
      const { world, a, e } = arena();
      line(world, a, [24, 20], [26, 20]);
      line(world, e, [27, 20], [29, 20]);
      for (const c of world.components.values()) c.pool = 300;
      placeBuilding(world, a, 'booster', cellOf(world, 24, 20));
      for (let i = 0; i < 400; i++) step(world);
      return world.molds[0]!.cellCount * 1000 + world.molds[1]!.cellCount;
    };
    expect(run()).toBe(run());
  });
});
