import type { Season, Weather } from '../config/balance';
import { removeCellAndSplit } from './network';
import { neighbor } from './grid';
import { moldOf } from './world';
import { TICK_DT } from './types';
import type { ClimateEffects, World } from './types';

export const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];

/** where the four-season year stands: which season, and how long is left of it */
export function seasonStatus(world: Readonly<World>, tick = world.tick): { season: Season; index: number; secondsLeft: number; yearSeconds: number } {
  const length = world.balance.seasons.length;
  const elapsed = tick * TICK_DT + world.seasonOffset;
  const index = Math.floor(elapsed / length) % SEASONS.length;
  return { season: SEASONS[index] as Season, index, secondsLeft: length - (elapsed % length), yearSeconds: length * SEASONS.length };
}

/** the year offset the next round starts at, so the seasons carry on as if the game never stopped */
export function nextSeasonOffset(world: Readonly<World>): number {
  const year = world.balance.seasons.length * SEASONS.length;
  return (world.seasonOffset + world.tick * TICK_DT) % year;
}

const multiply = (a: ClimateEffects, b: ClimateEffects): ClimateEffects => ({
  growth: a.growth * b.growth,
  upkeep: a.upkeep * b.upkeep,
  collector: a.collector * b.collector,
  pool: a.pool * b.pool,
  vision: a.vision * b.vision,
});

/** pick the next spell of weather for a season, by weight */
function rollWeather(world: World, season: Season): Weather {
  const options = world.balance.seasons.weather[season];
  const rng = world.rng.get('weather');
  let pick = rng.range(0, options.reduce((sum, o) => sum + o.weight, 0));
  for (const o of options) {
    pick -= o.weight;
    if (pick < 0) return o.kind;
  }
  return (options[options.length - 1] as { kind: Weather }).kind;
}

/**
 * Advance the season clock and the weather, and refresh `world.climate` (the multipliers the rest
 * of the sim reads). Seasons are fixed in length; the weather inside each is random but seeded, so
 * a replay sees the same skies. A new season always starts a new spell of weather.
 */
export function tickSeasons(world: World): void {
  const cfg = world.balance.seasons;
  const status = seasonStatus(world);
  let reroll = world.weather.untilTick === 0 || world.tick >= world.weather.untilTick;
  if (status.season !== world.season) {
    world.season = status.season;
    world.events.push({ type: 'seasonChanged', season: status.season });
    reroll = true;
  }
  if (reroll) {
    const kind = rollWeather(world, world.season);
    const seconds = world.rng.get('weather').range(cfg.spellSeconds.min, cfg.spellSeconds.max);
    const changed = kind !== world.weather.kind || world.weather.untilTick === 0;
    world.weather = { kind, untilTick: world.tick + Math.max(1, Math.round(seconds / TICK_DT)) };
    if (changed) world.events.push({ type: 'weatherChanged', weather: kind });
  }
  world.climate = multiply(cfg.effects[world.season], cfg.weatherEffects[world.weather.kind]);
  if (world.weather.kind === 'storm') strike(world);
}

/**
 * A storm now and then drops lightning on the map. Most strikes pick a cell some mold holds, so
 * it matters; the struck cell is badly hurt and its neighbours a little, whoever they belong to.
 */
function strike(world: World): void {
  const cfg = world.balance.seasons.lightning;
  const rng = world.rng.get('storm');
  if (!rng.chance(TICK_DT / cfg.every)) return;
  const owned: number[] = [];
  if (rng.chance(cfg.onMoldChance)) {
    for (const comp of world.components.values()) for (const c of comp.cells) owned.push(c);
  }
  let cell: number;
  if (owned.length > 0) {
    owned.sort((a, b) => a - b);
    cell = owned[rng.int(owned.length)] as number;
  } else {
    const x = 1 + rng.int(world.width - 2);
    const y = 1 + rng.int(world.height - 2);
    cell = y * world.width + x;
  }
  world.events.push({ type: 'lightning', cell });
  const hurt: [number, number][] = [[cell, cfg.hit]];
  for (let k = 0; k < 8; k++) {
    const n = neighbor(world.width, world.height, cell, k);
    if (n >= 0) hurt.push([n, cfg.splash]);
  }
  for (const [c, damage] of hurt) {
    const ownerId = world.owner[c] as number;
    if (ownerId === 0) continue;
    const left = (world.biomass[c] as number) - damage;
    if (left > 0) {
      world.biomass[c] = left;
      continue;
    }
    world.events.push({ type: 'cellDied', cell: c, mold: ownerId, by: 0 });
    moldOf(world, ownerId).stats.cellsDestroyed++;
    removeCellAndSplit(world, c);
  }
}
