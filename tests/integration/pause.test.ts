import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/game/loop';
import { createRound, enqueue, readHud, stateHash, step } from '../../src/sim';

describe('pause (US5, SC-007)', () => {
  it('advances nothing while paused, even with time passing', () => {
    const world = createRound({ runSeed: 11, roundNumber: 1 });
    const loop = new FixedStepLoop(() => step(world));
    loop.speed = 0;
    const before = stateHash(world);
    for (let i = 0; i < 300; i++) loop.advance(1 / 60);
    expect(world.tick).toBe(0);
    expect(stateHash(world)).toBe(before);
  });

  it('applies every order given while paused, in order, on the first tick after resume', () => {
    const world = createRound({ runSeed: 11, roundNumber: 1 });
    const loop = new FixedStepLoop(() => step(world));
    loop.speed = 0;
    const food = world.foodSources[0]!;
    enqueue(world, { type: 'setAllocation', mold: 1, value: 0.9 });
    enqueue(world, { type: 'setTarget', mold: 1, cell: food.y * world.width + food.x });
    enqueue(world, { type: 'setAllocation', mold: 1, value: 0.2 });
    for (let i = 0; i < 120; i++) loop.advance(1 / 60);
    expect(world.molds[0]!.targets).toHaveLength(0);
    expect(world.commandQueue).toHaveLength(3);

    loop.speed = 1;
    loop.advance(0.05);
    expect(world.tick).toBe(1);
    expect(world.commandQueue).toHaveLength(0);
    expect(world.molds[0]!.targets).toHaveLength(1);
    expect(world.molds[0]!.allocation).toBeCloseTo(0.2); // the later order won
    expect(world.replay.entries.map((e) => e.tick)).toEqual([0, 0, 0]);
  });

  it('keeps the HUD readable while paused', () => {
    const world = createRound({ runSeed: 11, roundNumber: 1 });
    const loop = new FixedStepLoop(() => step(world));
    loop.speed = 0;
    enqueue(world, { type: 'setAllocation', mold: 1, value: 0.7 });
    const hud = readHud(world, 1);
    expect(hud.storedNutrients).toBeCloseTo(world.balance.playerStartNutrients);
    expect(hud.elapsedSeconds).toBe(0);
  });
});
