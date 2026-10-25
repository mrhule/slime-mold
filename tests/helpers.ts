import { defaultBalance } from '../src/config/balance';
import type { BalanceConfig } from '../src/config/balance';
import { addMold } from '../src/sim/molds';
import { createWorld } from '../src/sim/world';
import { Terrain } from '../src/sim/types';
import type { Mold, World } from '../src/sim/types';

/** An all-open world with a wall border and no molds. */
export function createOpenWorld(width = 60, height = 40, balance: BalanceConfig = defaultBalance, seed = 1): World {
  const world = createWorld(width, height, balance, seed);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) world.terrain[y * width + x] = Terrain.Wall;
    }
  }
  world.reachableCells = (width - 2) * (height - 2);
  return world;
}

/** Open world with one player mold whose core is at (cx, cy). */
export function createWorldWithMold(
  width = 60,
  height = 40,
  cx = 10,
  cy = 20,
  nutrients = 30,
  balance: BalanceConfig = defaultBalance,
): { world: World; mold: Mold } {
  const world = createOpenWorld(width, height, balance);
  const mold = addMold(world, 'player', cy * width + cx, nutrients);
  return { world, mold };
}

export const cellOf = (world: World, x: number, y: number): number => y * world.width + x;
