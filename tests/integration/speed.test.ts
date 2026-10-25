import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/game/loop';
import type { Speed } from '../../src/game/loop';
import { createRound, enqueue, stateHash, step } from '../../src/sim';

/** Play `ticks` ticks through the loop at a given speed, with commands injected at fixed ticks. */
function play(speed: Speed, ticks: number, frameSeconds: number): number {
  const world = createRound({ runSeed: 33, roundNumber: 1 });
  const food = world.foodSources[0]!;
  const loop = new FixedStepLoop(() => {
    if (world.tick === 10) enqueue(world, { type: 'setTarget', mold: 1, cell: food.y * world.width + food.x });
    if (world.tick === 120) enqueue(world, { type: 'setAllocation', mold: 1, value: 0.6 });
    step(world);
  });
  loop.speed = speed;
  while (world.tick < ticks) loop.advance(frameSeconds);
  expect(world.tick).toBe(ticks);
  return stateHash(world);
}

describe('speed (US5)', () => {
  it('gives the same result at 1x, 2x and 3x for the same game time', () => {
    const ticks = 400; // 20 game seconds
    const one = play(1, ticks, 1 / 60);
    expect(play(2, ticks, 1 / 60)).toBe(one);
    expect(play(3, ticks, 1 / 60)).toBe(one);
  });

  it('does not depend on frame pacing either', () => {
    const ticks = 400;
    expect(play(3, ticks, 1 / 144)).toBe(play(1, ticks, 1 / 30));
  });
});
