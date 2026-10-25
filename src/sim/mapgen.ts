import { cellAt } from './grid';
import { fbm2 } from './noise';
import type { Rng } from './rng';
import { canPlaceFood, placeFood } from './food';
import { Terrain } from './types';
import type { CellIndex, World } from './types';

/**
 * Basic single-start map: dish wall, noise obstacles and rough patches, a cleared start area,
 * and scattered oat flakes with a few guaranteed near the start. Connectivity repair, multiple
 * starts and fairness balancing arrive with the rivals and escalation stories.
 */
export function generateMap(world: World, rng: Rng): CellIndex {
  const { width: w, height: h, balance: b } = world;
  const noiseSeed = rng.int(0x7fffffff);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = cellAt(w, x, y);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        world.terrain[i] = Terrain.Wall;
        continue;
      }
      const n = fbm2(x, y, noiseSeed);
      world.terrain[i] = n > b.obstacleThreshold ? Terrain.Obstacle : n > b.roughThreshold ? Terrain.Rough : Terrain.Open;
    }
  }

  // start somewhere in the left third; clear a round area around it
  const sx = Math.floor(rng.range(w * 0.12, w * 0.3));
  const sy = Math.floor(rng.range(h * 0.25, h * 0.75));
  const r = b.startClearRadius;
  for (let y = sy - r; y <= sy + r; y++) {
    for (let x = sx - r; x <= sx + r; x++) {
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      if ((x - sx) * (x - sx) + (y - sy) * (y - sy) <= r * r) world.terrain[cellAt(w, x, y)] = Terrain.Open;
    }
  }
  const start = cellAt(w, sx, sy);

  const reach = floodReach(world, start);
  let reachable = 0;
  for (let i = 0; i < reach.length; i++) if (reach[i]) reachable++;
  world.reachableCells = reachable;

  scatterFood(world, rng, sx, sy, reach);
  return start;
}

/** 4-connected fill over walkable terrain from `start`. */
export function floodReach(world: World, start: CellIndex): Uint8Array {
  const { width: w, height: h } = world;
  const seen = new Uint8Array(w * h);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const u = stack.pop() as number;
    const x = u % w;
    const y = Math.floor(u / w);
    const tryCell = (nx: number, ny: number): void => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const v = ny * w + nx;
      const t = world.terrain[v];
      if (seen[v] || t === Terrain.Obstacle || t === Terrain.Wall) return;
      seen[v] = 1;
      stack.push(v);
    };
    tryCell(x + 1, y);
    tryCell(x - 1, y);
    tryCell(x, y + 1);
    tryCell(x, y - 1);
  }
  return seen;
}

function footprintReachable(world: World, reach: Uint8Array, x: number, y: number, fw: number, fh: number): boolean {
  for (let yy = y; yy < y + fh; yy++) {
    for (let xx = x; xx < x + fw; xx++) if (!reach[cellAt(world.width, xx, yy)]) return false;
  }
  return true;
}

function scatterFood(world: World, rng: Rng, sx: number, sy: number, reach: Uint8Array): void {
  const { width: w, height: h, balance: b, difficulty } = world;
  const spec = b.foodTypes.oatFlake;
  const placed: [number, number][] = [];
  const tryPlace = (x: number, y: number, minDist: number): boolean => {
    if (!canPlaceFood(world, 'oatFlake', x, y)) return false;
    if (!footprintReachable(world, reach, x, y, spec.w, spec.h)) return false;
    for (const [px, py] of placed) if ((px - x) * (px - x) + (py - y) * (py - y) < minDist * minDist) return false;
    if (placeFood(world, 'oatFlake', x, y, 'initial') === null) return false;
    placed.push([x, y]);
    return true;
  };

  // a few close to the start so the opening always has somewhere to go
  let guaranteed = 0;
  for (let attempt = 0; attempt < 400 && guaranteed < b.starterFood; attempt++) {
    const x = sx + rng.int(41) - 20;
    const y = sy + rng.int(41) - 20;
    const d2 = (x - sx) * (x - sx) + (y - sy) * (y - sy);
    if (d2 < 100 || d2 > 400) continue; // 10 to 20 cells from the start
    if (tryPlace(x, y, 7)) guaranteed++;
  }

  const target = Math.round((difficulty.foodDensity * w * h) / b.foodAreaPerItem);
  for (let attempt = 0; attempt < target * 30 && placed.length < target + guaranteed; attempt++) {
    const x = 2 + rng.int(w - 2 - spec.w - 2);
    const y = 2 + rng.int(h - 2 - spec.h - 2);
    const keepOut = b.startClearRadius + 4;
    if ((x - sx) * (x - sx) + (y - sy) * (y - sy) < keepOut * keepOut) continue;
    tryPlace(x, y, b.foodSpacing);
  }
}
