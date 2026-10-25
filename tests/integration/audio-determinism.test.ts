import { describe, expect, it } from 'vitest';
import { Director } from '../../src/audio/director';
import { AudioEngine } from '../../src/audio/engine';
import { visibleDeaths } from '../../src/game/frame-events';
import { createRound, enqueue, stateHash, step } from '../../src/sim';
import type { World } from '../../src/sim';

const TICKS = 600;

/** a fixed round with the player growing toward food, so growth, food and events all happen */
function start(): World {
  const world = createRound({ runSeed: 31, roundNumber: 2 });
  const core = world.molds[0]!.core;
  const cx = core % world.width;
  const cy = Math.floor(core / world.width);
  const near = [...world.foodSources]
    .sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2))
    .slice(0, 2);
  for (const f of near) enqueue(world, { type: 'setTarget', mold: 1, cell: f.y * world.width + f.x });
  return world;
}

describe('audio never changes the simulation (SC-006, Constitution I)', () => {
  it('the same round with a director and engine attached has the identical state hash', () => {
    const plain = start();
    for (let t = 0; t < TICKS; t++) step(plain);

    const withAudio = start();
    const director = new Director();
    const engine = new AudioEngine(() => null); // no audio device: the engine is a no-op
    let cues = 0;
    for (let t = 0; t < TICKS; t++) {
      step(withAudio);
      const player = withAudio.molds[0]!;
      const check = t % 40 === 0; // hashing the whole world every tick would be slow
      const before = check ? stateHash(withAudio) : 0;
      const requests = director.update({
        playerId: 1,
        nowMs: t * 50,
        playerCells: player.cellCount,
        playerGathered: player.stats.nutrientsGathered,
        runState: 'playing',
        outcome: null,
        visibleDeaths: visibleDeaths(withAudio, withAudio.events, 1),
        events: withAudio.events,
      });
      for (const r of requests) engine.play(r);
      cues += requests.length;
      if (check) expect(stateHash(withAudio), `the director changed the world at tick ${t}`).toBe(before);
    }
    expect(cues).toBeGreaterThan(0); // the round really did produce sounds to ask for
    expect(stateHash(withAudio)).toBe(stateHash(plain));
  }, 60_000);

  it('the director leaves cells, pools and events untouched', () => {
    const world = start();
    for (let t = 0; t < 200; t++) step(world);
    const owner = Array.from(world.owner);
    const pools = [...world.components.values()].map((c) => c.pool);
    const events = JSON.stringify(world.events);
    const director = new Director();
    director.update({ playerId: 1, nowMs: 0, playerCells: 1, playerGathered: 0, runState: 'playing', outcome: null, visibleDeaths: visibleDeaths(world, world.events, 1), events: world.events });
    expect(Array.from(world.owner)).toEqual(owner);
    expect([...world.components.values()].map((c) => c.pool)).toEqual(pools);
    expect(JSON.stringify(world.events)).toBe(events);
  });
});
