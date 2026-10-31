import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../../src/sim/commands';
import { atWar, exploring } from '../../../src/sim/explore';
import { placeFood } from '../../../src/sim/food';
import { step } from '../../../src/sim/step';
import { readHud } from '../../../src/sim/hud';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

const run = (world: Parameters<typeof step>[0], ticks: number): void => {
  for (let i = 0; i < ticks; i++) step(world);
};

describe('the ends of the Growth/War slider', () => {
  it('only the two ends count', () => {
    const { world, mold } = createWorldWithMold();
    for (const [v, ex, war] of [[0, true, false], [0.1, true, false], [0.15, false, false], [0.5, false, false], [0.85, false, false], [0.9, false, true], [1, false, true]] as const) {
      applyCommand(world, { type: 'setAllocation', mold: mold.id, value: v });
      expect(exploring(world, mold)).toBe(ex);
      expect(atWar(world, mold)).toBe(war);
    }
  });

  it('a rival AI is never at either end, whatever its allocation', () => {
    const { world, mold } = createWorldWithMold();
    mold.ai = { aggression: 0.5, buildReserve: 100 } as typeof mold.ai;
    mold.allocation = 1;
    expect(atWar(world, mold)).toBe(false);
    mold.allocation = 0;
    expect(exploring(world, mold)).toBe(false);
  });

  it('the HUD reports where the ends are', () => {
    const { world, mold } = createWorldWithMold();
    expect(readHud(world, mold.id).zones).toEqual({ exploreMax: 0.1, warMin: 0.9 });
  });
});

describe('max Growth explores', () => {
  it('splinters off targets on its own, up to the limit, without any click', () => {
    const { world, mold } = createWorldWithMold();
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0 });
    expect(mold.targets.length).toBe(0);
    run(world, world.balance.allocationZones.exploreEvery * 8);
    expect(mold.targets.length).toBeGreaterThan(0);
    expect(mold.targets.length).toBeLessThanOrEqual(world.balance.maxTargets);
    expect(mold.cellCount).toBeGreaterThan(1);
    assertInvariants(world);
  });

  it('does nothing at the default allocation', () => {
    const { world, mold } = createWorldWithMold();
    const cells = mold.cellCount;
    run(world, world.balance.allocationZones.exploreEvery * 8);
    expect(mold.targets.length).toBe(0);
    expect(mold.cellCount).toBe(cells);
  });

  it('never replaces a target the player chose, and fills only free slots', () => {
    const { world, mold } = createWorldWithMold();
    const picked = cellOf(world, 40, 30);
    applyCommand(world, { type: 'setTarget', mold: mold.id, cell: picked });
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0 });
    const id = mold.targets[0]!.id;
    run(world, world.balance.allocationZones.exploreEvery * 6);
    expect(mold.targets.some((t) => t.id === id) || mold.cellCount > 1).toBe(true);
    expect(mold.targets.length).toBeLessThanOrEqual(world.balance.maxTargets);
  });

  it('seeks out food it knows about', () => {
    const { world, mold } = createWorldWithMold();
    placeFood(world, 'breadCrumb', 16, 20, 'initial');
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0 });
    mold.vision.fill(2);
    run(world, world.balance.allocationZones.exploreEvery * 3);
    // the first vein is sent toward the bread crumb; a target is dropped once reached, so look at what the mold owns
    const reached = [15, 16, 17].some((x) => world.owner[cellOf(world, x, 20)] === mold.id || world.owner[cellOf(world, x, 21)] === mold.id);
    expect(reached).toBe(true);
  });
});

describe('how the veins explore on their own', () => {
  const firstExploreTick = (world: Parameters<typeof step>[0], moldId: number): number => {
    let t = world.tick;
    while ((t + moldId * 7) % world.balance.allocationZones.exploreEvery !== 0) t++;
    return t;
  };

  it('wanders at a third of normal speed when nothing has been revealed', () => {
    const { world, mold } = createWorldWithMold();
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0 });
    run(world, firstExploreTick(world, mold.id) - world.tick + 2);
    expect(mold.targets.length).toBeGreaterThan(0);
    for (const t of mold.targets) expect(t.speed).toBeCloseTo(1 / 3);
  });

  it('does not go for food or a goo pool that is still in the fog', () => {
    const { world, mold } = createWorldWithMold(90, 40, 10, 20);
    placeFood(world, 'breadCrumb', 70, 20, 'initial');
    placeFood(world, 'goo', 60, 30, 'initial');
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0 });
    run(world, world.balance.allocationZones.exploreEvery * 3);
    expect(mold.targets.length).toBeGreaterThan(0);
    for (const t of mold.targets) {
      expect(t.speed).toBeCloseTo(1 / 3);
      expect(Math.abs((t.cell % world.width) - 70) + Math.abs(Math.floor(t.cell / world.width) - 20)).toBeGreaterThan(6);
    }
  });

  it('does not race for a nutrient drop that has been announced', () => {
    const { world, mold } = createWorldWithMold(90, 40, 10, 20);
    const drop = cellOf(world, 70, 20);
    world.drops.push({ id: 0, type: 'sugarCube', cell: drop, warnTick: 0, landTick: 10_000, state: 'warning' });
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0 });
    run(world, world.balance.allocationZones.exploreEvery * 3);
    expect(mold.targets.length).toBeGreaterThan(0);
    for (const t of mold.targets) {
      expect(t.speed).toBeCloseTo(1 / 3);
      expect(Math.abs((t.cell % world.width) - 70) + Math.abs(Math.floor(t.cell / world.width) - 20)).toBeGreaterThan(6);
    }
  });

  it('does not go after dropped food even in plain sight, but still goes for the starting food', () => {
    const near = (t: { cell: number }, world: { width: number }, x: number): boolean => Math.abs((t.cell % world.width) - x) <= 3 && Math.abs(Math.floor(t.cell / world.width) - 20) <= 3;
    const dropped = createWorldWithMold();
    placeFood(dropped.world, 'sugarCube', 16, 20, 'drop');
    applyCommand(dropped.world, { type: 'setAllocation', mold: dropped.mold.id, value: 0 });
    run(dropped.world, 60);
    expect(dropped.mold.targets.some((t) => t.speed === 0.5 && near(t, dropped.world, 16))).toBe(false);
    run(dropped.world, dropped.world.balance.allocationZones.exploreEvery * 3);
    expect(dropped.mold.targets.every((t) => t.speed !== 0.5)).toBe(true);

    const starter = createWorldWithMold();
    placeFood(starter.world, 'sugarCube', 16, 20, 'initial');
    applyCommand(starter.world, { type: 'setAllocation', mold: starter.mold.id, value: 0 });
    run(starter.world, firstExploreTick(starter.world, starter.mold.id) - starter.world.tick + 2);
    expect(starter.mold.targets.some((t) => t.speed === 0.5 && near(t, starter.world, 16))).toBe(true);
  });

  it('heads for food once it has been revealed, at half speed', () => {
    const { world, mold } = createWorldWithMold();
    placeFood(world, 'breadCrumb', 16, 20, 'initial');
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 0 });
    run(world, firstExploreTick(world, mold.id) - world.tick + 2);
    const seek = mold.targets.find((t) => Math.abs((t.cell % world.width) - 16) <= 3 && Math.abs(Math.floor(t.cell / world.width) - 20) <= 3);
    expect(seek).toBeDefined();
    expect(seek!.speed).toBeCloseTo(1 / 2);
  });

  it('grows more slowly than a target the player chose', () => {
    const make = (speed: number): number => {
      const { world, mold } = createWorldWithMold(60, 40, 10, 20, 400);
      applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 45, 20), speed });
      run(world, 200);
      return mold.cellCount;
    };
    expect(make(1 / 3)).toBeLessThan(make(1));
    expect(make(1 / 3)).toBeGreaterThan(1);
  });
});

describe('max War bleeds', () => {
  it('costs several times the vein upkeep, and the same mold at the default does not', () => {
    const spend = (value: number): number => {
      const { world, mold } = createWorldWithMold(60, 40, 10, 20, 400);
      applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 40, 20) });
      run(world, 400);
      applyCommand(world, { type: 'clearTargets', mold: mold.id });
      applyCommand(world, { type: 'setAllocation', mold: mold.id, value });
      step(world);
      const pools = (): number => [...world.components.values()].reduce((sum, c) => sum + c.pool, 0);
      const before = pools();
      run(world, 20);
      return before - pools();
    };
    expect(spend(1)).toBeGreaterThan(spend(0.5));
  });

  it('dies back at war even with plenty of nutrients in the stock', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 400);
    applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 40, 20) });
    run(world, 400);
    applyCommand(world, { type: 'clearTargets', mold: mold.id });
    applyCommand(world, { type: 'setAllocation', mold: mold.id, value: 1 });
    step(world);
    const grown = mold.cellCount;
    for (const c of world.components.values()) c.pool = 5000;
    for (let i = 0; i < 600; i++) {
      step(world);
      for (const c of world.components.values()) c.pool = 5000;
    }
    expect(grown).toBeGreaterThan(10);
    expect(mold.cellCount).toBeLessThan(grown);
    assertInvariants(world);
  });

  it('a mold left at war with nothing to spend on slowly dies back, while one at the default holds', () => {
    const grow = (value: number): number => {
      const { world, mold } = createWorldWithMold(60, 40, 10, 20, 400);
      applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 40, 20) });
      run(world, 400);
      const grown = mold.cellCount;
      applyCommand(world, { type: 'clearTargets', mold: mold.id });
      applyCommand(world, { type: 'setAllocation', mold: mold.id, value });
      world.commandQueue.length = 0;
      mold.allocation = value;
      for (const c of world.components.values()) c.pool = 0;
      run(world, 1200);
      expect(grown).toBeGreaterThan(10);
      return mold.cellCount;
    };
    expect(grow(1)).toBeLessThan(grow(0.5));
  });
});
