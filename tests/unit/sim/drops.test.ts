import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { createRound, step } from '../../../src/sim';
import { nextDropDelay, pickDropType, tickDrops } from '../../../src/sim/drops';
import { foodCells } from '../../../src/sim/food';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import { Rng } from '../../../src/sim/rng';
import { TICK_DT } from '../../../src/sim/types';
import type { FoodType, World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const warningTicks = Math.round(defaultBalance.dropWarning / TICK_DT);

/** run until the first drop is announced; returns that drop */
function untilFirstWarning(world: World) {
  for (let t = 0; t < 4000 && world.drops.length === 0; t++) step(world);
  return world.drops[0];
}

describe('drop schedule', () => {
  it('announces drops on the 35 s +/- 10 s schedule, scheduling the next as each one enters warning', () => {
    const world = createOpenWorld(100, 60);
    addMold(world, 'player', cellOf(world, 10, 10), 10);
    world.nextDropTick = 5;
    const warnings: number[] = [];
    let lastNext = world.nextDropTick;
    for (let t = 0; t < 20 * 400; t++) {
      step(world);
      if (world.events.some((e) => e.type === 'dropWarning')) {
        warnings.push(world.tick - 1);
        // the next one was scheduled at that moment, within the allowed window
        const gap = world.nextDropTick - (world.tick - 1);
        expect(gap).toBeGreaterThanOrEqual(Math.round((defaultBalance.dropInterval - defaultBalance.dropJitter) / TICK_DT) - 1);
        expect(gap).toBeLessThanOrEqual(Math.round((defaultBalance.dropInterval + defaultBalance.dropJitter) / TICK_DT) + 1);
        lastNext = world.nextDropTick;
      }
    }
    expect(warnings.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < warnings.length; i++) {
      const gap = (warnings[i]! - warnings[i - 1]!) * TICK_DT;
      expect(gap).toBeGreaterThanOrEqual(defaultBalance.dropInterval - defaultBalance.dropJitter - 0.2);
      expect(gap).toBeLessThanOrEqual(defaultBalance.dropInterval + defaultBalance.dropJitter + 0.2);
    }
    expect(lastNext).toBeGreaterThan(0);
  });

  it('nextDropDelay stays inside the window', () => {
    const world = createOpenWorld(60, 40);
    const rng = new Rng(3);
    for (let i = 0; i < 500; i++) {
      const s = nextDropDelay(world, rng) * TICK_DT;
      expect(s).toBeGreaterThanOrEqual(defaultBalance.dropInterval - defaultBalance.dropJitter - 0.05);
      expect(s).toBeLessThanOrEqual(defaultBalance.dropInterval + defaultBalance.dropJitter + 0.05);
    }
  });

  it('lands exactly dropWarning (5 s) after the warning, and the warning is announced to everyone', () => {
    const world = createRound({ runSeed: 4, roundNumber: 1 });
    const drop = untilFirstWarning(world)!;
    expect(drop.state).toBe('warning');
    expect(drop.landTick - drop.warnTick).toBe(warningTicks);
    // the warning is public: every mold's view lists it
    for (const m of world.molds) expect(m.vision[drop.cell]).toBeDefined();
    const before = world.foodSources.length;
    while (world.tick < drop.landTick) step(world);
    expect(drop.state).toBe('warning');
    step(world);
    expect(drop.state).toBe('landed');
    expect(world.foodSources.length).toBe(before + 1);
    const src = world.foodSources[world.foodSources.length - 1]!;
    expect(src.origin).toBe('drop');
    expect(src.type).toBe(drop.type);
  });

  it('every mold knows where a drop landed, even out of sight (remembered, not live)', () => {
    const world = createOpenWorld(100, 60);
    const a = addMold(world, 'player', cellOf(world, 8, 8), 10);
    const b = addMold(world, 'rival', cellOf(world, 90, 50), 10);
    world.nextDropTick = Number.MAX_SAFE_INTEGER;
    world.drops.push({ id: 0, type: 'sugarCube', cell: cellOf(world, 50, 30), warnTick: 0, landTick: 1, state: 'warning' });
    world.tick = 1;
    tickDrops(world);
    const src = world.foodSources[0]!;
    for (const m of [a, b]) {
      for (const c of foodCells(world, src)) {
        expect(m.vision[c]).toBe(1);
        expect(m.memFood[c]!).toBeGreaterThan(0);
      }
    }
  });

  it('emits dropWarning and dropLanded events', () => {
    const world = createRound({ runSeed: 6, roundNumber: 1 });
    const seen = new Set<string>();
    for (let t = 0; t < 20 * 90; t++) {
      step(world);
      for (const e of world.events) seen.add(e.type);
    }
    expect(seen.has('dropWarning')).toBe(true);
    expect(seen.has('dropLanded')).toBe(true);
  });
});

describe('drop placement and type', () => {
  it('footprints fit on walkable, reachable terrain, across many seeds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const world = createRound({ runSeed: seed, roundNumber: 1 + (seed % 4) });
      for (let t = 0; t < 20 * 150; t++) step(world);
      const dropped = world.foodSources.filter((f) => f.origin === 'drop');
      expect(dropped.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const f of dropped) {
        for (const c of foodCells(world, f)) {
          expect(world.terrain[c]!).toBeLessThan(2);
          expect(world.reachable[c]).toBe(1);
        }
      }
    }
  }, 120_000);

  it('picks types by weight: bread crumb 5, sugar cube 3, fruit slice 2', () => {
    const world = createOpenWorld(60, 40);
    const rng = new Rng(11);
    const counts: Record<string, number> = {};
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const t = pickDropType(world, rng);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    expect(counts.oatFlake ?? 0).toBe(0);
    expect(counts.breadCrumb! / n).toBeCloseTo(0.5, 1);
    expect(counts.sugarCube! / n).toBeCloseTo(0.3, 1);
    expect(counts.fruitSlice! / n).toBeCloseTo(0.2, 1);
  });

  it('food values match the data model', () => {
    const t = defaultBalance.foodTypes;
    expect(t.breadCrumb).toMatchObject({ w: 3, h: 3, nutrients: 120, absorbRate: 1.5 });
    expect(t.sugarCube).toMatchObject({ w: 4, h: 4, nutrients: 300, absorbRate: 3.0 });
    expect(t.fruitSlice).toMatchObject({ w: 6, h: 4, nutrients: 500, absorbRate: 1.0 });
  });

  it('is reproducible from the seed', () => {
    const run = (): string => {
      const world = createRound({ runSeed: 8, roundNumber: 1 });
      for (let t = 0; t < 20 * 120; t++) step(world);
      return world.drops.map((d) => `${d.type}@${d.cell}/${d.landTick}`).join(',');
    };
    expect(run()).toBe(run());
  });
});

describe('landing on molds', () => {
  function landing(type: FoodType, x: number, y: number) {
    // no core income and no upkeep: only food moves the pools
    const world = createOpenWorld(60, 40, { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 });
    const a = addMold(world, 'player', cellOf(world, 10, 20), 0);
    const b = addMold(world, 'player', cellOf(world, 50, 20), 0); // no AI, so only food moves the pools
    world.nextDropTick = Number.MAX_SAFE_INTEGER;
    world.drops.push({ id: 0, type, cell: cellOf(world, x, y), warnTick: 0, landTick: 1, state: 'warning' });
    return { world, a, b };
  }

  it('a mold under the landing spot feeds on it at once and spreads over the whole footprint', () => {
    const { world, a } = landing('breadCrumb', 11, 19);
    world.tick = 1;
    tickDrops(world);
    const src = world.foodSources[0]!;
    const cells = foodCells(world, src);
    for (const c of cells) expect(world.owner[c]).toBe(a.id); // engulfed for free
    const pool = (): number => [...world.components.values()].filter((c) => c.moldId === a.id).reduce((s, c) => s + c.pool, 0);
    const before = pool();
    step(world);
    expect(pool() - before).toBeGreaterThan(cells.length * defaultBalance.foodTypes.breadCrumb.absorbRate * TICK_DT * 0.9);
    assertInvariants(world);
  });

  it('contested food is split by who covers what: each cell pays its own holder', () => {
    const { world, a, b } = landing('breadCrumb', 30, 19);
    // two molds each hold part of the landing footprint (separate pieces, so no engulfing across)
    const cellsA = [cellOf(world, 30, 19), cellOf(world, 31, 19), cellOf(world, 30, 20)];
    const cellsB = [cellOf(world, 32, 21)];
    for (const c of cellsA) world.owner[c] = 0;
    world.tick = 1;
    tickDrops(world); // lands on empty cells
    const src = world.foodSources[0]!;
    expect(src).toBeDefined();
    // claim cells by hand to build a contested layout
    addCell(world, a.id, cellsA[0]!, -1);
    addCell(world, a.id, cellsA[1]!, cellsA[0]!);
    addCell(world, a.id, cellsA[2]!, cellsA[0]!);
    addCell(world, b.id, cellsB[0]!, -1);
    const poolOf = (id: number): number => [...world.components.values()].filter((c) => c.moldId === id).reduce((s, c) => s + c.pool, 0);
    const a0 = poolOf(a.id);
    const b0 = poolOf(b.id);
    for (let i = 0; i < 20; i++) step(world);
    const rate = defaultBalance.foodTypes.breadCrumb.absorbRate * TICK_DT * 20;
    expect(poolOf(a.id) - a0).toBeCloseTo(rate * 3, 3); // A holds three food cells
    expect(poolOf(b.id) - b0).toBeCloseTo(rate, 3); // B holds one
  });
});

