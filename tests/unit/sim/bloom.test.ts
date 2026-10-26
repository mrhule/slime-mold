import { describe, expect, it } from 'vitest';
import { assertInvariants, createRound, enqueue, readHud, step } from '../../../src/sim';
import { burstStatus } from '../../../src/sim/bloom';
import { TICK_DT } from '../../../src/sim/types';
import type { World } from '../../../src/sim/types';

/** a fresh round, moved on to `seconds` of game time with a full stock */
function worldAt(seconds: number, over: Record<string, number> = {}): World {
  const world = createRound({ runSeed: 4242, roundNumber: 2 });
  world.tick = Math.round(seconds / TICK_DT);
  for (const c of world.components.values()) c.pool = 200;
  Object.assign(world.balance.burst, over);
  return world;
}

const burst = (world: World): void => {
  enqueue(world, { type: 'sporeBurst', mold: 1 });
  step(world);
};

describe('spore burst', () => {
  it('is locked until the round has run a while', () => {
    const world = worldAt(60);
    expect(burstStatus(world, 1).state).toBe('locked');
    burst(world);
    expect(world.molds[0]!.burstUsed).toBe(false);
    expect(world.events.some((e) => e.type === 'commandRejected' && e.reason === 'burst-locked')).toBe(true);
  });

  it('needs the nutrients to pay for it', () => {
    const world = worldAt(300);
    for (const c of world.components.values()) c.pool = 5;
    expect(burstStatus(world, 1).state).toBe('poor');
    burst(world);
    expect(world.molds[0]!.burstUsed).toBe(false);
  });

  it('pays, scatters spores, and blooms', () => {
    const world = worldAt(300);
    const before = world.molds[0]!.cellCount;
    const stock = [...world.components.values()].reduce((a, c) => a + c.pool, 0);
    burst(world);
    const mold = world.molds[0]!;
    expect(mold.burstUsed).toBe(true);
    expect(mold.cellCount).toBeGreaterThan(before + 10);
    expect(world.events.find((e) => e.type === 'sporeBurst')).toMatchObject({ mold: 1 });
    expect(stock).toBeGreaterThan(0);
    expect(readHud(world, 1).burst.state).toBe('blooming');
    assertInvariants(world);
  });

  it('can only be used once a round', () => {
    const world = worldAt(300);
    burst(world);
    const cells = world.molds[0]!.cellCount;
    burst(world);
    expect(world.events.some((e) => e.type === 'commandRejected' && e.reason === 'burst-used')).toBe(true);
    expect(world.molds[0]!.cellCount).toBeGreaterThanOrEqual(cells);
  });

  it('spreads while it blooms and keeps its spores alive', () => {
    const world = worldAt(300, { spreadChance: 0.3 });
    burst(world);
    const start = world.molds[0]!.cellCount;
    for (let i = 0; i < 200; i++) step(world);
    expect(world.molds[0]!.cellCount).toBeGreaterThan(start * 1.5);
    assertInvariants(world);
  });

  it('wins the round when the bloom reaches the target, and loses it when it does not', () => {
    const won = worldAt(300, { winControl: 0.0001, bloomSeconds: 4 });
    burst(won);
    for (let i = 0; i < 400 && won.outcome === 'playing'; i++) step(won);
    expect(won.outcome).toBe('victory');

    const lost = worldAt(300, { winControl: 2, spreadChance: 0, bloomSeconds: 4 });
    burst(lost);
    for (let i = 0; i < 400 && lost.outcome === 'playing'; i++) step(lost);
    expect(lost.outcome).toBe('defeat');
    expect(lost.defeatReason).toBe('burst-failed');
  });
});
