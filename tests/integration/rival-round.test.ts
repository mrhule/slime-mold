import { describe, expect, it } from 'vitest';
import { think } from '../../src/sim/ai/rival-ai';
import { Rng } from '../../src/sim/rng';
import { assertInvariants, createRound, enqueue, step, viewFor } from '../../src/sim';
import type { AiState, World } from '../../src/sim';

const TWENTY_MINUTES = 20 * 60 * 20;

/** An AI-driven "player" (acting only through ordinary commands) against the round's rivals. */
function playToTheEnd(seed: number, round: number): { world: World; ticks: number } {
  const world = createRound({ runSeed: seed, roundNumber: round });
  const state: AiState = { aggression: 0.5, debug: [] };
  const rng = new Rng(seed ^ 0x5a5a);
  const interval = Math.round(1.2 / 0.05);
  let ticks = 0;
  while (ticks < TWENTY_MINUTES && world.outcome === 'playing') {
    if (ticks % interval === 0 && world.molds[0]!.status === 'alive') {
      for (const cmd of think(viewFor(world, 1), state, rng, world.balance.aiCommandsPerThink)) enqueue(world, cmd);
    }
    step(world);
    ticks++;
    if (ticks % 1200 === 0) assertInvariants(world);
  }
  assertInvariants(world);
  return { world, ticks };
}

describe('a round against a rival (US2 independent test)', () => {
  it('is decided within 20 game minutes, and the invariants hold throughout', () => {
    const outcomes: string[] = [];
    for (const seed of [1000, 1001, 1002, 1003, 1004, 1005]) {
      const { world, ticks } = playToTheEnd(seed, 1);
      expect(world.outcome, `seed ${seed} still undecided after ${ticks} ticks`).not.toBe('playing');
      outcomes.push(world.outcome);
    }
    // eliminating the rival ends the round in victory; losing every cell ends it in defeat
    expect(outcomes.every((o) => o === 'victory' || o === 'defeat')).toBe(true);
  }, 240_000);

  it('victory by elimination and defeat set the round outcome and the reason', () => {
    for (const seed of [1000, 1001, 1002, 1003]) {
      const { world } = playToTheEnd(seed, 1);
      if (world.outcome === 'victory') {
        expect(world.molds.slice(1).every((m) => m.status === 'eliminated') || world.victoryReason === 'map-control').toBe(true);
        expect(world.victoryReason).not.toBeNull();
      } else {
        expect(world.molds[0]!.status).toBe('eliminated');
      }
    }
  }, 240_000);
});

describe('rivals use store houses and fertile farms (003 US5)', () => {
  it('over several seeds rivals build store houses and linked farms, only legally', () => {
    let storeHouses = 0;
    let farms = 0;
    let linkedFarms = 0;
    // a rich start so the build reserve is met early (difficulty changes timing only)
    for (const seed of [2001, 2002, 2003, 2004]) {
      const world = createRound({ runSeed: seed, roundNumber: 6 });
      const state: AiState = { aggression: 0.5, debug: [] };
      const rng = new Rng(seed ^ 0x77);
      const interval = Math.round(1.2 / 0.05);
      for (let t = 0; t < 20 * 60 * 6; t++) {
        if (t % interval === 0 && world.molds[0]!.status === 'alive') {
          for (const cmd of think(viewFor(world, 1), state, rng, world.balance.aiCommandsPerThink)) enqueue(world, cmd);
        }
        step(world);
        if (world.outcome !== 'playing') break;
      }
      assertInvariants(world); // includes: every farm stands on fertile ground, levels are 0..6
      for (const b of world.buildings) {
        if (b.destroyed) continue;
        if (b.type === 'storehouse') storeHouses++;
        if (b.type === 'farm') {
          farms++;
          expect(world.fertile[b.cell]).toBe(1);
          if (b.linked) linkedFarms++;
        }
      }
      // the rivals of the round (molds 2..) obey the same rules; their records are in the same list
      expect(world.molds.length).toBeGreaterThan(1);
    }
    expect(storeHouses).toBeGreaterThan(0);
    expect(farms).toBeGreaterThan(0);
    expect(linkedFarms).toBeGreaterThan(0);
  }, 120_000);
});
