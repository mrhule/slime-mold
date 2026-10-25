import { BUILDING_CODE } from './types';
import type { BuildingType, Mold, World } from './types';

/**
 * Fog of war (R7). Each live mold sees every cell within `visionRadius` (Chebyshev) of its own
 * cells; cells it has seen before stay "remembered" with the last-seen owner and food. Terrain
 * and drop warnings are not fogged. Recomputed from scratch with a separable dilation, which is
 * O(cells) per mold and cheap enough to run at 4 Hz.
 */
export function updateVision(world: World): void {
  for (const mold of world.molds) {
    if (mold.status === 'alive') visionFor(world, mold);
  }
}

function visionFor(world: World, mold: Mold): void {
  const { width: w, height: h } = world;
  const r = world.balance.visionRadius;
  const owner = world.owner;
  const tmp = world.scratch.fogTmp;
  const prefix = world.scratch.prefix;
  const id = mold.id;

  // horizontal: is any own cell within r columns?
  for (let y = 0; y < h; y++) {
    const row = y * w;
    prefix[0] = 0;
    for (let x = 0; x < w; x++) prefix[x + 1] = (prefix[x] as number) + (owner[row + x] === id ? 1 : 0);
    for (let x = 0; x < w; x++) {
      const lo = x - r < 0 ? 0 : x - r;
      const hi = x + r + 1 > w ? w : x + r + 1;
      tmp[row + x] = (prefix[hi] as number) - (prefix[lo] as number) > 0 ? 1 : 0;
    }
  }

  // vertical pass over the horizontal result, then fold into vision and memory
  const seen = mold.seenCells;
  seen.fill(0);
  const { vision, memOwner, memFood, memBuilding } = mold;
  const food = world.food;
  for (let x = 0; x < w; x++) {
    prefix[0] = 0;
    for (let y = 0; y < h; y++) prefix[y + 1] = (prefix[y] as number) + (tmp[y * w + x] as number);
    for (let y = 0; y < h; y++) {
      const lo = y - r < 0 ? 0 : y - r;
      const hi = y + r + 1 > h ? h : y + r + 1;
      const i = y * w + x;
      if ((prefix[hi] as number) - (prefix[lo] as number) > 0) {
        vision[i] = 2;
        const o = owner[i] as number;
        memOwner[i] = o;
        memFood[i] = food[i] as number;
        const bid = world.buildingAt[i] as number;
        memBuilding[i] = bid >= 0 ? BUILDING_CODE[(world.buildings[bid] as { type: BuildingType }).type] : 0;
        if (o !== 0 && o !== id) seen[o] = (seen[o] as number) + 1;
      } else if (vision[i] === 2) {
        vision[i] = 1;
      }
    }
  }
}
