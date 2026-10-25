import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import type { BalanceConfig } from '../../../src/config/balance';
import { buildingUpkeep, farmIncomeAt, farmOutput, farmUpkeepAt, placeBuilding } from '../../../src/sim/buildings';
import { applyCommand, enqueue } from '../../../src/sim/commands';
import { stateHash } from '../../../src/sim/hash';
import { addMold } from '../../../src/sim/molds';
import { addCell, refreshSources } from '../../../src/sim/network';
import { step } from '../../../src/sim/step';
import { TICK_DT } from '../../../src/sim/types';
import type { Component, World } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld, withStoreHouse } from '../../helpers';

const farm = defaultBalance.buildings.farm;
const quiet: BalanceConfig = {
  ...defaultBalance,
  coreIncome: 0,
  upkeepPerCell: 0,
  pool: { baseCap: 100000 },
  buildings: { ...defaultBalance.buildings, storehouse: { ...defaultBalance.buildings.storehouse, upkeep: 0 } },
};

function setup() {
  const world = createOpenWorld(60, 30, quiet, 1, { fertile: true });
  const mold = addMold(world, 'player', cellOf(world, 10, 15), 200);
  let prev = cellOf(world, 11, 15);
  const cells = [prev];
  for (let x = 12; x < 18; x++) {
    const c = cellOf(world, x, 15);
    addCell(world, mold.id, c, prev);
    cells.push(c);
    prev = c;
  }
  placeBuilding(world, mold.id, 'farm', cells[2] as number);
  withStoreHouse(world, mold.id, cells[5] as number);
  const farmB = world.buildings[0]!;
  const comp = world.components.get(world.component[mold.core] as number) as Component;
  return { world, mold, cells, farmB, comp };
}

const run = (world: World, ticks: number): void => {
  for (let i = 0; i < ticks; i++) step(world);
};

describe('farm output levels (FR-016..FR-018, S6)', () => {
  it('income is income * o * (1.5 - 0.5 * o) and upkeep is upkeep * o, with o = level * levelStep', () => {
    const { world, farmB } = setup();
    for (let level = 0; level <= farm.maxLevel; level++) {
      farmB.level = level;
      const o = level * farm.levelStep;
      expect(farmIncomeAt(world, level)).toBeCloseTo(farm.income * o * (1.5 - 0.5 * o), 9);
      expect(farmUpkeepAt(world, level)).toBeCloseTo(farm.upkeep * o, 9);
      expect(farmOutput(world, farmB)).toBeCloseTo(farmIncomeAt(world, level), 9);
      expect(buildingUpkeep(world, world.component[farmB.cell] as number)).toBeCloseTo(farmUpkeepAt(world, level), 9);
    }
  });

  it('level 4 (the default) equals the plain income and upkeep', () => {
    const { world, farmB } = setup();
    expect(farmB.level).toBe(farm.defaultLevel);
    expect(farmOutput(world, farmB)).toBeCloseTo(farm.income, 9);
    expect(farmUpkeepAt(world, farmB.level)).toBeCloseTo(farm.upkeep, 9);
  });

  it('income per upkeep falls as the level rises', () => {
    const { world } = setup();
    let last = Infinity;
    for (let level = 1; level <= farm.maxLevel; level++) {
      const ratio = farmIncomeAt(world, level) / farmUpkeepAt(world, level);
      expect(ratio).toBeLessThan(last);
      last = ratio;
    }
  });

  it('level 0 pays nothing, costs no upkeep, and the farm still counts as a source of supply', () => {
    const { world, farmB, cells, comp } = setup();
    farmB.level = 0;
    const before = comp.pool;
    run(world, 20);
    expect(comp.pool).toBeCloseTo(before, 9);
    expect(farmB.destroyed).toBe(false);
    refreshSources(world, comp);
    expect(comp.sources).toContain(cells[2]);
  });

  it('a running farm moves the pool by output minus upkeep each tick', () => {
    const { world, farmB, comp } = setup();
    farmB.level = 6;
    const before = comp.pool;
    run(world, 1);
    expect(comp.pool - before).toBeCloseTo((farmIncomeAt(world, 6) - farmUpkeepAt(world, 6)) * TICK_DT, 6);
  });
});

describe('setFarmOutput command (FR-019)', () => {
  it('is accepted for an own farm, also while queued (paused), and takes effect on the next tick', () => {
    const { world, mold, farmB } = setup();
    enqueue(world, { type: 'setFarmOutput', mold: mold.id, building: farmB.id, level: 2 });
    expect(farmB.level).toBe(farm.defaultLevel);
    step(world);
    expect(farmB.level).toBe(2);
  });

  it('is rejected with a reason and changes nothing', () => {
    const { world, mold, farmB } = setup();
    const rival = addMold(world, 'rival', cellOf(world, 50, 15), 100);
    const store = world.buildings[1]!;
    const reject = (cmd: Parameters<typeof applyCommand>[1], reason: string): void => {
      world.events = [];
      applyCommand(world, cmd);
      expect(world.events).toContainEqual({ type: 'commandRejected', mold: cmd.mold, reason });
    };
    reject({ type: 'setFarmOutput', mold: mold.id, building: 99, level: 3 }, 'unknown-building');
    reject({ type: 'setFarmOutput', mold: rival.id, building: farmB.id, level: 3 }, 'not-your-building');
    reject({ type: 'setFarmOutput', mold: mold.id, building: store.id, level: 3 }, 'not-a-farm');
    reject({ type: 'setFarmOutput', mold: mold.id, building: farmB.id, level: 2.5 }, 'bad-level');
    reject({ type: 'setFarmOutput', mold: mold.id, building: farmB.id, level: -1 }, 'bad-level');
    reject({ type: 'setFarmOutput', mold: mold.id, building: farmB.id, level: farm.maxLevel + 1 }, 'bad-level');
    expect(farmB.level).toBe(farm.defaultLevel);
    rival.status = 'eliminated';
    reject({ type: 'setFarmOutput', mold: rival.id, building: farmB.id, level: 1 }, 'mold-eliminated');
  });

  it('a destroyed farm cannot be set', () => {
    const { world, mold, farmB } = setup();
    farmB.destroyed = true;
    world.buildingAt[farmB.cell] = -1;
    world.events = [];
    applyCommand(world, { type: 'setFarmOutput', mold: mold.id, building: farmB.id, level: 1 });
    expect(world.events).toContainEqual({ type: 'commandRejected', mold: mold.id, reason: 'unknown-building' });
  });
});

describe('determinism with output commands (S6)', () => {
  it('the same commands give the same hash, and a replay of the log reproduces it', () => {
    const play = () => {
      const { world, mold, farmB } = setup();
      for (let t = 0; t < 200; t++) {
        if (t === 20) enqueue(world, { type: 'setFarmOutput', mold: mold.id, building: farmB.id, level: 6 });
        if (t === 90) enqueue(world, { type: 'setFarmOutput', mold: mold.id, building: farmB.id, level: 1 });
        step(world);
      }
      assertInvariants(world);
      return world;
    };
    const a = play();
    const b = play();
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.replay.entries.map((e) => e.tick)).toEqual([20, 90]);

    const replay = setup().world;
    let next = 0;
    for (let t = 0; t < 200; t++) {
      while (next < a.replay.entries.length && a.replay.entries[next]!.tick === t) enqueue(replay, a.replay.entries[next++]!.cmd);
      step(replay);
    }
    expect(stateHash(replay)).toBe(stateHash(a));
  });
});
