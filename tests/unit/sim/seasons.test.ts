import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import type { Season, Weather } from '../../../src/config/balance';
import { applyCommand } from '../../../src/sim/commands';
import { Run } from '../../../src/game/run';
import { createRound } from '../../../src/sim';
import { readHud } from '../../../src/sim/hud';
import { nextSeasonOffset, seasonStatus } from '../../../src/sim/seasons';
import { stateHash } from '../../../src/sim/hash';
import { step } from '../../../src/sim/step';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

const SECOND = 20; // ticks
const LEN = defaultBalance.seasons.length; // seconds in a season
const run = (world: Parameters<typeof step>[0], ticks: number): void => {
  for (let i = 0; i < ticks; i++) step(world);
};
type TestWorld = ReturnType<typeof createWorldWithMold>['world'];
const withWeather = (world: TestWorld, kind: Weather): void => {
  // hold one kind of weather for the whole test
  world.weather = { kind, untilTick: Number.MAX_SAFE_INTEGER };
};
const inSeason = (world: TestWorld, season: Season): void => {
  world.seasonOffset = ['spring', 'summer', 'fall', 'winter'].indexOf(season) * LEN;
  world.season = season;
};

describe('the season clock', () => {
  it('runs spring, summer, fall, winter for 120 seconds each and then starts over', () => {
    const { world } = createWorldWithMold();
    const seen: Season[] = [];
    for (let s = 0; s < 8 * LEN - 15; s += 15) {
      run(world, 15 * SECOND);
      const now = seasonStatus(world).season;
      if (seen[seen.length - 1] !== now) seen.push(now);
    }
    expect(seen).toEqual(['spring', 'summer', 'fall', 'winter', 'spring', 'summer', 'fall', 'winter']);
  });

  it('starts in spring and reports how long is left of the season', () => {
    const { world } = createWorldWithMold();
    expect(seasonStatus(world).season).toBe('spring');
    expect(LEN).toBe(120);
    expect(seasonStatus(world).secondsLeft).toBeCloseTo(LEN);
    run(world, 30 * SECOND);
    expect(seasonStatus(world).secondsLeft).toBeCloseTo(LEN - 30);
  });

  it('can start part way through the year', () => {
    const { world } = createWorldWithMold();
    world.seasonOffset = 2 * LEN + 20; // 20 seconds into fall
    expect(seasonStatus(world).season).toBe('fall');
    expect(seasonStatus(world).secondsLeft).toBeCloseTo(LEN - 20);
  });

  it('carries the year over between rounds', () => {
    const { world } = createWorldWithMold();
    run(world, (LEN + 10) * SECOND); // 10 seconds into summer
    const offset = nextSeasonOffset(world);
    expect(offset).toBeCloseTo(LEN + 10);
    const next = createRound({ runSeed: 5, roundNumber: 2, seasonOffset: offset });
    expect(seasonStatus(next).season).toBe('summer');
    expect(seasonStatus(next).secondsLeft).toBeCloseTo(LEN - 10);
    // and the offset wraps at the end of a year
    const late = createWorldWithMold().world;
    late.seasonOffset = 4 * LEN - 60;
    run(late, 100 * SECOND);
    expect(nextSeasonOffset(late)).toBeCloseTo(40);
  });

  it('the run carries the offset into the next round, and a new run starts in spring', () => {
    const offsets: (number | undefined)[] = [];
    const worlds = [] as ReturnType<typeof createRound>[];
    const r = new Run({
      runSeed: 1,
      newSeed: () => 2,
      createWorld: (seed, round, offset) => {
        offsets.push(offset);
        const w = createRound({ runSeed: seed, roundNumber: round, ...(offset ? { seasonOffset: offset } : {}) });
        worlds.push(w);
        return w;
      },
    });
    r.start();
    for (let i = 0; i < 130 * SECOND; i++) step(r.world);
    r.finishRound('victory');
    r.nextRound();
    expect(offsets[1]).toBeCloseTo(130);
    expect(seasonStatus(r.world).season).toBe('summer');
    r.finishRound('defeat');
    r.newRun();
    expect(seasonStatus(r.world).season).toBe('spring');
  });
});

describe('the weather', () => {
  it('is random, fits the season, and changes within a season', () => {
    const { world } = createWorldWithMold();
    const bySeason: Record<Season, Set<Weather>> = { spring: new Set(), summer: new Set(), fall: new Set(), winter: new Set() };
    for (let s = 0; s < 6 * LEN; s += 5) {
      run(world, 5 * SECOND);
      bySeason[world.season].add(world.weather.kind);
    }
    for (const season of Object.keys(bySeason) as Season[]) {
      const allowed = new Set(defaultBalance.seasons.weather[season].map((o) => o.kind));
      for (const kind of bySeason[season]) expect(allowed.has(kind)).toBe(true);
      expect(bySeason[season].size).toBeGreaterThan(1);
    }
  });

  it('is the same for the same seed, so a replay sees the same skies', () => {
    const a = createRound({ runSeed: 11, roundNumber: 1 });
    const b = createRound({ runSeed: 11, roundNumber: 1 });
    const kinds = (w: typeof a): string => {
      const out: string[] = [];
      for (let i = 0; i < 200 * SECOND; i += 20) {
        run(w, 20);
        out.push(`${w.season}:${w.weather.kind}`);
      }
      return out.join(',');
    };
    expect(kinds(a)).toBe(kinds(b));
    expect(stateHash(a)).toBe(stateHash(b));
    const c = createRound({ runSeed: 12, roundNumber: 1 });
    expect(kinds(c)).not.toBe(kinds(createRound({ runSeed: 11, roundNumber: 1 })));
  }, 60_000);

  it('reports the season and weather to the HUD', () => {
    const { world, mold } = createWorldWithMold();
    run(world, 2);
    const hud = readHud(world, mold.id);
    expect(hud.climate.season).toBe('spring');
    expect(hud.climate.weather).toBe(world.weather.kind);
    expect(hud.climate.secondsLeft).toBeGreaterThan(80);
  });
});

describe('how the seasons change the economy', () => {
  /** cells grown a few seconds after a target is set, before any target is reached */
  const grown = (season: Season, weather: Weather): number => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 400);
    inSeason(world, season);
    withWeather(world, weather);
    applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 55, 20) });
    run(world, 8 * SECOND);
    return mold.cellCount;
  };

  it('veins grow faster in spring than in winter', () => {
    expect(grown('spring', 'clear')).toBeGreaterThan(grown('winter', 'clear'));
  });

  it('upkeep is higher in winter', () => {
    // same veins, more upkeep: compare per cell (the winter mold grew fewer cells)
    const perCell = (season: Season): number => {
      const { world, mold } = createWorldWithMold(60, 40, 10, 20, 400);
      inSeason(world, season);
      withWeather(world, 'clear');
      applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 40, 20) });
      run(world, 600);
      applyCommand(world, { type: 'clearTargets', mold: mold.id });
      run(world, 200);
      return mold.flow.veins / mold.cellCount;
    };
    expect(perCell('winter')).toBeGreaterThan(perCell('summer') * 1.3);
  });

  it('a blizzard shrinks how far molds see', () => {
    const sight = (weather: Weather): number => {
      const { world, mold } = createWorldWithMold();
      withWeather(world, weather);
      run(world, 12);
      return mold.vision.reduce((n, v) => n + (v === 2 ? 1 : 0), 0);
    };
    expect(sight('blizzard')).toBeLessThan(sight('clear') * 0.5);
  });

  it('rain pays more from goo pools than clear weather does, and collectors earn more in summer', () => {
    expect(defaultBalance.seasons.weatherEffects.rain.pool).toBeGreaterThan(1);
    expect(defaultBalance.seasons.effects.summer.collector).toBeGreaterThan(defaultBalance.seasons.effects.winter.collector);
    const { world } = createWorldWithMold();
    withWeather(world, 'rain');
    run(world, 2);
    expect(world.climate.pool).toBeCloseTo(defaultBalance.seasons.effects.spring.pool * defaultBalance.seasons.weatherEffects.rain.pool);
    expect(world.climate.growth).toBeCloseTo(defaultBalance.seasons.effects.spring.growth * defaultBalance.seasons.weatherEffects.rain.growth);
  });

  it('frost slows growth', () => {
    expect(grown('fall', 'frost')).toBeLessThan(grown('fall', 'clear'));
  });
});

describe('storms', () => {
  it('strike with lightning that hurts the cells they land on, and the world stays consistent', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 600);
    withWeather(world, 'storm');
    applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 45, 20) });
    run(world, 600);
    const cells = mold.cellCount;
    let strikes = 0;
    let deaths = 0;
    let damaged = 0;
    for (let i = 0; i < 1200 * 3; i++) {
      step(world);
      for (const e of world.events) {
        if (e.type === 'lightning') strikes++;
        if (e.type === 'cellDied' && e.by === 0 && e.mold === mold.id) deaths++;
      }
      if (i % 600 === 0) assertInvariants(world);
    }
    for (const c of world.components.values()) for (const cell of c.cells) if ((world.biomass[cell] as number) < 1) damaged++;
    expect(strikes).toBeGreaterThan(3);
    expect(deaths + damaged).toBeGreaterThan(0);
    expect(cells).toBeGreaterThan(5);
    assertInvariants(world);
  });
});
