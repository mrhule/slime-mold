import { describe, expect, it } from 'vitest';
import { createRound, enqueue, readHud, step } from '../../../src/sim';

describe('nutrient flow report', () => {
  it('reports income, upkeep and growth spending per second', () => {
    const world = createRound({ runSeed: 12345, roundNumber: 1 });
    const mold = world.molds[0]!;
    const cell = (mold.core + 6) % (world.width * world.height);
    enqueue(world, { type: 'grow', mold: mold.id, cell } as never);
    for (let i = 0; i < 200; i++) step(world);
    const { flow } = readHud(world, mold.id);
    expect(flow.income).toBeGreaterThan(0);
    expect(flow.veins).toBeGreaterThan(0);
    expect(flow.buildings).toBe(0);
    expect(flow.fight).toBe(0);
    expect(Number.isFinite(flow.growth)).toBe(true);
  });
});
