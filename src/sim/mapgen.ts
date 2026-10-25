import { DX, DY, cellAt } from './grid';
import { heapPop, heapPush } from './heap';
import { fbm2, hash2 } from './noise';
import type { Rng } from './rng';
import { canPlaceFood, placeFood } from './food';
import { Terrain } from './types';
import type { CellIndex, FoodSource, World } from './types';

export interface GeneratedMap {
  /** start cells, one per mold; the player's is `starts[playerIndex]` */
  starts: CellIndex[];
  playerIndex: number;
}

const OFFSETS4 = [0, 2, 4, 6] as const;

/**
 * Procedural map (R12): dish wall, noise obstacles and rough patches; `startCount` starts spread
 * by best-candidate sampling, each cleared; corridors carved so every start can reach every
 * other; oat flakes scattered, with a few guaranteed near each start and a fairness pass so no
 * start is left poor.
 */
export function generateMap(world: World, rng: Rng, startCount: number): GeneratedMap {
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

  const starts = pickStarts(world, rng, startCount);
  const r = b.startClearRadius;
  for (const s of starts) {
    const sx = s % w;
    const sy = Math.floor(s / w);
    for (let y = sy - r; y <= sy + r; y++) {
      for (let x = sx - r; x <= sx + r; x++) {
        if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
        if ((x - sx) * (x - sx) + (y - sy) * (y - sy) <= r * r) world.terrain[cellAt(w, x, y)] = Terrain.Open;
      }
    }
  }

  connectStarts(world, starts);
  const reach = floodReach(world, starts[0] as number);
  let reachable = 0;
  for (let i = 0; i < reach.length; i++) if (reach[i]) reachable++;
  world.reachableCells = reachable;
  world.reachable = reach;

  scatterFood(world, rng, starts, reach);
  balanceFood(world, rng, starts, reach);
  placeFertile(world, rng, starts, reach);
  return { starts, playerIndex: rng.int(starts.length) };
}

/** Best-candidate sampling: each new start is the sample farthest from the starts so far. */
function pickStarts(world: World, rng: Rng, count: number): CellIndex[] {
  const { width: w, height: h } = world;
  const margin = world.balance.startClearRadius + 3;
  const sample = (): [number, number] => [margin + rng.int(Math.max(1, w - 2 * margin)), margin + rng.int(Math.max(1, h - 2 * margin))];
  const starts: [number, number][] = [sample()];
  while (starts.length < count) {
    let best: [number, number] = sample();
    let bestD = -1;
    for (let k = 0; k < 24; k++) {
      const c = sample();
      let d = Infinity;
      for (const s of starts) d = Math.min(d, (c[0] - s[0]) * (c[0] - s[0]) + (c[1] - s[1]) * (c[1] - s[1]));
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    starts.push(best);
  }
  return starts.map(([x, y]) => cellAt(w, x, y));
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
    for (const k of OFFSETS4) {
      const nx = x + (DX[k] as number);
      const ny = y + (DY[k] as number);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const v = ny * w + nx;
      const t = world.terrain[v];
      if (seen[v] || t === Terrain.Obstacle || t === Terrain.Wall) continue;
      seen[v] = 1;
      stack.push(v);
    }
  }
  return seen;
}

/** Carve a corridor from every start that cannot reach `starts[0]` (R12 step 4). */
function connectStarts(world: World, starts: CellIndex[]): void {
  const { width: w, height: h } = world;
  for (let i = 1; i < starts.length; i++) {
    const reach = floodReach(world, starts[0] as number);
    if (reach[starts[i] as number]) continue;
    // Dijkstra from this start through anything but the wall; obstacles cost extra
    const dist = new Float32Array(w * h).fill(Infinity);
    const from = new Int32Array(w * h).fill(-1);
    const f: number[] = [];
    const n: number[] = [];
    dist[starts[i] as number] = 0;
    heapPush(f, n, 0, starts[i] as number);
    let found = -1;
    while (f.length) {
      const u = heapPop(f, n);
      const du = dist[u] as number;
      if (reach[u]) {
        found = u;
        break;
      }
      const x = u % w;
      const y = Math.floor(u / w);
      for (const k of OFFSETS4) {
        const nx = x + (DX[k] as number);
        const ny = y + (DY[k] as number);
        if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
        const v = ny * w + nx;
        const nd = du + (world.terrain[v] === Terrain.Obstacle ? 4 : 1);
        if (nd < (dist[v] as number)) {
          dist[v] = nd;
          from[v] = u;
          heapPush(f, n, nd, v);
        }
      }
    }
    for (let c = found; c >= 0; c = from[c] as number) {
      if (world.terrain[c] === Terrain.Obstacle) world.terrain[c] = Terrain.Open;
    }
  }
}

/** Does every start sit in one connected region? (used by validation and tests) */
export function startsConnected(world: World, starts: CellIndex[]): boolean {
  const reach = floodReach(world, starts[0] as number);
  return starts.every((s) => reach[s] === 1);
}

function footprintReachable(world: World, reach: Uint8Array, x: number, y: number, fw: number, fh: number): boolean {
  for (let yy = y; yy < y + fh; yy++) {
    for (let xx = x; xx < x + fw; xx++) if (!reach[cellAt(world.width, xx, yy)]) return false;
  }
  return true;
}

function scatterFood(world: World, rng: Rng, starts: CellIndex[], reach: Uint8Array): void {
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

  // a few close to every start so each opening has somewhere to go
  for (const s of starts) {
    const sx = s % w;
    const sy = Math.floor(s / w);
    let guaranteed = 0;
    for (let attempt = 0; attempt < 400 && guaranteed < b.starterFood; attempt++) {
      const x = sx + rng.int(41) - 20;
      const y = sy + rng.int(41) - 20;
      const d2 = (x - sx) * (x - sx) + (y - sy) * (y - sy);
      if (d2 < 100 || d2 > 400) continue; // 10 to 20 cells from the start
      if (tryPlace(x, y, 7)) guaranteed++;
    }
  }

  const target = Math.round((difficulty.foodDensity * w * h) / b.foodAreaPerItem);
  const keepOut = b.startClearRadius + 4;
  for (let attempt = 0; attempt < target * 30 && placed.length < target + starts.length * b.starterFood; attempt++) {
    const x = 2 + rng.int(w - 2 - spec.w - 2);
    const y = 2 + rng.int(h - 2 - spec.h - 2);
    if (starts.some((s) => (x - (s % w)) ** 2 + (y - Math.floor(s / w)) ** 2 < keepOut * keepOut)) continue;
    tryPlace(x, y, b.foodSpacing);
  }
}

/** nutrients of food items within `fairRadius` steps of a start, plus the reached cells */
export function foodNear(world: World, start: CellIndex, radius = world.balance.fairRadius): { value: number; cells: CellIndex[] } {
  const { width: w, height: h } = world;
  const dist = new Int16Array(w * h).fill(-1);
  const queue: number[] = [start];
  dist[start] = 0;
  const sources = new Set<number>();
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head] as number;
    const sid = world.foodSourceId[u] as number;
    if (sid >= 0) sources.add(sid);
    if ((dist[u] as number) >= radius) continue;
    const x = u % w;
    const y = Math.floor(u / w);
    for (const k of OFFSETS4) {
      const nx = x + (DX[k] as number);
      const ny = y + (DY[k] as number);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const v = ny * w + nx;
      const t = world.terrain[v];
      if (dist[v] !== -1 || t === Terrain.Obstacle || t === Terrain.Wall) continue;
      dist[v] = (dist[u] as number) + 1;
      queue.push(v);
    }
  }
  let value = 0;
  for (const id of sources) value += (world.foodSources[id] as FoodSource).total;
  return { value, cells: queue };
}

/** Top up the poorest starts until every start is within `fairTolerance` of the richest (FR-020). */
function balanceFood(world: World, rng: Rng, starts: CellIndex[], reach: Uint8Array): void {
  const { width: w, balance: b } = world;
  const spec = b.foodTypes.oatFlake;
  for (let round = 0; round < 4; round++) {
    const values = starts.map((s) => foodNear(world, s));
    const richest = Math.max(...values.map((v) => v.value));
    const target = (1 - b.fairTolerance) * richest;
    let changed = false;
    for (let i = 0; i < starts.length; i++) {
      const near = values[i] as { value: number; cells: CellIndex[] };
      let value = near.value;
      for (let attempt = 0; attempt < 80 && value < target; attempt++) {
        const c = near.cells[rng.int(near.cells.length)] as number;
        const x = c % w;
        const y = Math.floor(c / w);
        const sx = (starts[i] as number) % w;
        const sy = Math.floor((starts[i] as number) / w);
        if ((x - sx) * (x - sx) + (y - sy) * (y - sy) < 49) continue; // not on top of the start
        if (!canPlaceFood(world, 'oatFlake', x, y) || !footprintReachable(world, reach, x, y, spec.w, spec.h)) continue;
        if (placeFood(world, 'oatFlake', x, y, 'initial')) {
          value += spec.nutrients;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

/** fertile cells within `fairRadius` steps of a start */
export function fertileNear(world: World, start: CellIndex, radius = world.balance.fairRadius): number {
  let n = 0;
  for (const c of foodNear(world, start, radius).cells) if (world.fertile[c]) n++;
  return n;
}

/** mark a rough disk of fertile ground; only on reachable open or rough cells that hold no food */
function paintFertile(world: World, reach: Uint8Array, cx: number, cy: number, r: number): number {
  const { width: w, height: h } = world;
  let added = 0;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      const c = cellAt(w, x, y);
      const t = world.terrain[c];
      if (!reach[c] || (t !== Terrain.Open && t !== Terrain.Rough) || (world.foodSourceId[c] as number) >= 0 || world.fertile[c]) continue;
      // a wobbly edge so patches are blobs, not discs
      const edge = r + (hash2(x, y, world.seed) - 0.5) * 1.6;
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > edge * edge) continue;
      world.fertile[c] = 1;
      added++;
    }
  }
  return added;
}

/**
 * Fertile ground (003 S9): a few patches near every start, a top-up so no start is left poor, and
 * contested patches placed as far from every start as the samples allow.
 */
function placeFertile(world: World, rng: Rng, starts: CellIndex[], reach: Uint8Array): void {
  const { width: w, balance: b } = world;
  const f = b.fertile;
  const radius = (): number => f.patchMin + rng.int(f.patchMax - f.patchMin + 1);
  const nearPatch = (start: CellIndex): number => {
    const sx = start % w;
    const sy = Math.floor(start / w);
    for (let attempt = 0; attempt < 40; attempt++) {
      const dx = rng.int(2 * f.nearRadius + 1) - f.nearRadius;
      const dy = rng.int(2 * f.nearRadius + 1) - f.nearRadius;
      const d2 = dx * dx + dy * dy;
      if (d2 > f.nearRadius * f.nearRadius || d2 < (b.startClearRadius + 2) * (b.startClearRadius + 2)) continue;
      const c = cellAt(w, sx + dx, sy + dy);
      if (!reach[c] || world.terrain[c] === Terrain.Wall) continue;
      const added = paintFertile(world, reach, sx + dx, sy + dy, radius());
      if (added > 0) return added;
    }
    return 0;
  };

  for (const s of starts) for (let i = 0; i < f.nearPatches; i++) nearPatch(s);

  // so no start is left poor next to a rich one
  for (let round = 0; round < 6; round++) {
    const counts = starts.map((s) => fertileNear(world, s));
    const target = Math.max(f.minNear, (1 - 2 * b.fairTolerance) * Math.max(...counts));
    let changed = false;
    for (let i = 0; i < starts.length; i++) {
      let have = counts[i] as number;
      for (let k = 0; k < 4 && have < target; k++) {
        const added = nearPatch(starts[i] as number);
        have += added;
        if (added > 0) changed = true;
      }
    }
    if (!changed) break;
  }

  // contested ground: best-candidate sampling away from every start and earlier patches
  const rivals = starts.length - 1;
  const placed: [number, number][] = [];
  const count = f.contested + Math.floor(rivals / 2);
  for (let n = 0; n < count; n++) {
    let best = -1;
    let bestD = -1;
    for (let k = 0; k < 60; k++) {
      const c = rng.int(world.terrain.length);
      if (!reach[c] || (world.terrain[c] !== Terrain.Open && world.terrain[c] !== Terrain.Rough)) continue;
      const x = c % w;
      const y = Math.floor(c / w);
      let d = Infinity;
      for (const s of starts) d = Math.min(d, (x - (s % w)) ** 2 + (y - Math.floor(s / w)) ** 2);
      for (const [px, py] of placed) d = Math.min(d, (x - px) ** 2 + (y - py) ** 2);
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best < 0) continue;
    const x = best % w;
    const y = Math.floor(best / w);
    if (paintFertile(world, reach, x, y, radius()) > 0) placed.push([x, y]);
  }
}

/** Does the map pass its checks? Used to reject and regenerate (R12 step 6). */
export function validateMap(world: World, starts: CellIndex[]): boolean {
  if (!startsConnected(world, starts)) return false;
  if (world.reachableCells < world.balance.minReachableArea * world.width * world.height) return false;
  const values = starts.map((s) => foodNear(world, s).value);
  const richest = Math.max(...values);
  if (!values.every((v) => v >= (1 - world.balance.fairTolerance) * richest - 1e-6)) return false;
  // every start has fertile ground in reach, in comparable amounts (003 FR-015)
  const fertile = starts.map((s) => fertileNear(world, s));
  const most = Math.max(...fertile);
  return fertile.every((n) => n >= world.balance.fertile.minNear && n >= (1 - 2 * world.balance.fairTolerance) * most - 1e-6);
}
