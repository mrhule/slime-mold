import { defaultBalance } from '../config/balance';
import type { BalanceConfig } from '../config/balance';
import { difficultyFor } from './difficulty';
import { generateMap } from './mapgen';
import { addMold } from './molds';
import { deriveSeed } from './rng';
import { createWorld } from './world';
import type { DifficultyProfile, MoldId, MoldView, RoundOutcome, World } from './types';

export { canPlace } from './buildings';
export { enqueue, pendingAllocation } from './commands';
export { stateHash } from './hash';
export { readHud } from './hud';
export { step } from './step';
export { difficultyFor } from './difficulty';
export { assertInvariants } from './world';
export * from './types';

export interface CreateRoundOptions {
  runSeed: number;
  roundNumber: number;
  balance?: BalanceConfig;
  difficulty?: DifficultyProfile;
  /** number of rival molds; rivals arrive with the rivals story, so this defaults to none */
  rivals?: number;
}

/** Build a fresh round: generate the map and place the player's mold. */
export function createRound(opts: CreateRoundOptions): World {
  const balance = opts.balance ?? defaultBalance;
  const difficulty = opts.difficulty ?? difficultyFor(opts.roundNumber, balance);
  const seed = deriveSeed(opts.runSeed, opts.roundNumber);
  const world = createWorld(difficulty.mapWidth, difficulty.mapHeight, balance, seed, opts.roundNumber, difficulty);
  world.replay.runSeed = opts.runSeed;
  const start = generateMap(world, world.rng.get('mapgen'));
  addMold(world, 'player', start, balance.playerStartNutrients);
  return world;
}

/** Outcome of the round so far. Win and loss rules arrive with the rivals story. */
export function roundOutcome(_world: World): RoundOutcome {
  return 'playing';
}

/** Fog-filtered view for the AI; implemented with the rivals story. */
export function viewFor(_world: World, _mold: MoldId): MoldView {
  throw new Error('viewFor is implemented in the rivals story');
}
