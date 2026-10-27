import { defaultBalance } from '../config/balance';
import type { BalanceConfig } from '../config/balance';
import { difficultyFor } from './difficulty';
import { firstDropTick } from './drops';
import { updateVision } from './fog';
import { generateMap, validateMap } from './mapgen';
import type { GeneratedMap } from './mapgen';
import { addMold } from './molds';
import { deriveSeed } from './rng';
import { createWorld } from './world';
import type { DifficultyProfile, World } from './types';

export { collectorCover, fortressCover, canPlace, countBuildings, capOf, drainStoreHouses, placePreview, demolishBuilding, reachOf, upgradeSpec, recomputeFeed, recomputeSupply, storeCover, upgradeBuilding, veinCover, workingStoreHouses } from './buildings';
export { enqueue, pendingAllocation } from './commands';
export { gooBoost, knownFoodLeft, poolFactories } from './food';
export { burstStatus, blooming } from './bloom';
export { stateHash } from './hash';
export { readHud } from './hud';
export { step } from './step';
export { difficultyFor } from './difficulty';
export { roundOutcome } from './round';
export { viewFor } from './view';
export { assertInvariants } from './world';
export * from './types';

export interface CreateRoundOptions {
  runSeed: number;
  roundNumber: number;
  balance?: BalanceConfig;
  difficulty?: DifficultyProfile;
  /** screen shape (width over height) to shape the map to; omitted keeps the standard 4:3 map */
  aspect?: number;
  /** number of rival molds; defaults to the difficulty profile's rival count */
  rivals?: number;
}

/** Build a fresh round: generate a valid map and place the player's and the rivals' molds. */
export function createRound(opts: CreateRoundOptions): World {
  const balance = opts.balance ?? defaultBalance;
  const difficulty = opts.difficulty ?? difficultyFor(opts.roundNumber, balance, opts.aspect);
  const rivals = opts.rivals ?? difficulty.rivalCount;
  const seed = deriveSeed(opts.runSeed, opts.roundNumber);

  let world: World | null = null;
  let map: GeneratedMap | null = null;
  let attempts = 0;
  for (let attempt = 0; attempt < balance.mapgenAttempts; attempt++) {
    attempts = attempt + 1;
    const candidate = createWorld(difficulty.mapWidth, difficulty.mapHeight, balance, seed, opts.roundNumber, difficulty);
    const generated = generateMap(candidate, candidate.rng.get(attempt === 0 ? 'mapgen' : `mapgen:${attempt}`), rivals + 1);
    if (validateMap(candidate, generated.starts)) {
      world = candidate;
      map = generated;
      break;
    }
  }
  if (!world || !map) {
    // every attempt failed: fall back to an open map (never expected in practice)
    const flat = { ...balance, obstacleThreshold: 2, roughThreshold: 2 };
    world = createWorld(difficulty.mapWidth, difficulty.mapHeight, flat, seed, opts.roundNumber, difficulty);
    map = generateMap(world, world.rng.get('mapgen:fallback'), rivals + 1);
    world.balance = balance;
    world.mapFallback = true;
  }
  world.mapAttempts = attempts;

  world.replay.runSeed = opts.runSeed;
  const { starts, playerIndex } = map;
  addMold(world, 'player', starts[playerIndex] as number, balance.playerStartNutrients);
  starts.forEach((cell, i) => {
    if (i === playerIndex) return;
    addMold(world as World, 'rival', cell, balance.rivalStartNutrientsBase * difficulty.rivalStartNutrients, difficulty.rivalAggression, difficulty.rivalBuildReserve);
  });
  const jitter = world.rng.get('jitter');
  for (const m of world.molds) if (m.ai) m.aiNext = Math.floor(jitter.range(10, 30));
  world.nextDropTick = firstDropTick(world, world.rng.get('drops'));
  updateVision(world);
  return world;
}
export { cutCells, cutKey } from './network';
export { evolve, evolveStatus } from './tiers';
