import { engulfFood } from './food';
import { DX, DY } from './grid';
import { addCell, cutCells, cutKey, linkCells } from './network';
import { moldsInOrder } from './world';
import { Terrain } from './types';
import type { CellIndex, Component, Mold, World } from './types';

/**
 * Veins of one mold that grow close to each other join up on their own, so a mold that spreads in
 * several directions stays one network instead of a handful of cut-off pieces. Every `connectEvery`
 * ticks, for each mold:
 *  - pieces whose cells touch (8-adjacent) are linked for free;
 *  - pieces separated by a single free cell are bridged with one new cell, paid for from the richer
 *    piece (and skipped when it cannot pay);
 *  - inside one piece, two cells that are close in space but at least `loopMinSteps` apart along the
 *    veins are joined the same way, closing a loop so nutrients and boosts have a second way round.
 * None of it happens near an enemy (an enemy cell within two cells): contested ground is never
 * healed, so cutting a rival's vein still works. Nor near a vein the player cut on purpose (within
 * two cells of either end) until it is rejoined.
 * Deterministic: it walks pieces and cells in their stored order and uses no randomness.
 */
export function connectPieces(world: World): void {
  const noHeal = cutZones(world);
  for (const mold of moldsInOrder(world)) {
    if (mold.status !== 'alive') continue;
    connectMold(world, mold, noHeal);
  }
}

/** cells within two of either end of a cut vein; null when nothing was cut. Also forgets cuts whose cells are gone. */
function cutZones(world: World): Uint8Array | null {
  if (world.cuts.size === 0) return null;
  const w = world.width;
  const h = world.height;
  const zone = new Uint8Array(world.owner.length);
  for (const key of [...world.cuts]) {
    const [a, b] = cutCells(world, key);
    if (world.owner[a] === 0 || world.owner[a] !== world.owner[b]) {
      world.cuts.delete(key);
      continue;
    }
    for (const c of [a, b]) {
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (let y = Math.max(0, cy - 2); y <= Math.min(h - 1, cy + 2); y++) for (let x = Math.max(0, cx - 2); x <= Math.min(w - 1, cx + 2); x++) zone[y * w + x] = 1;
    }
  }
  return zone;
}

function piecesOf(world: World, mold: Mold): Component[] {
  const out: Component[] = [];
  for (const comp of world.components.values()) if (comp.moldId === mold.id) out.push(comp);
  return out;
}

function connectMold(world: World, mold: Mold, noHeal: Uint8Array | null): void {
  if (piecesOf(world, mold).length === 0) return;
  // touching pieces first (free), then one-cell gaps, so a bridge is never built where a link will do
  scan(world, mold, 1, noHeal);
  if (world.balance.connectGap >= 2) scan(world, mold, 2, noHeal);
}

/** can a vein run from `from` to `to` in fewer than `limit` steps? A bounded search, so it stays cheap. */
function withinSteps(world: World, from: CellIndex, to: CellIndex, limit: number): boolean {
  const w = world.width;
  const seen = new Set<number>([from]);
  let frontier = [from];
  for (let step = 1; step < limit && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const u of frontier) {
      const bits = world.edges[u] as number;
      for (let k = 0; k < 8; k++) {
        if (!(bits & (1 << k))) continue;
        const v = u + (DX[k] as number) + (DY[k] as number) * w;
        if (v === to) return true;
        if (seen.has(v)) continue;
        seen.add(v);
        next.push(v);
      }
    }
    frontier = next;
  }
  return false;
}

/** visit every cell of the mold's pieces and join it to a cell of another piece (or a far part of its own) exactly `ring` cells away */
function scan(world: World, mold: Mold, ring: 1 | 2, noHeal: Uint8Array | null): void {
  const { width: w, height: h } = world;
  // walk a snapshot of the cells: merging changes the component lists underneath us
  for (const start of piecesOf(world, mold)) {
    const cells = start.cells.slice();
    for (const c of cells) {
      if (world.owner[c] !== mold.id) continue;
      if (noHeal && noHeal[c]) continue;
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const n = y * w + x;
          if (world.owner[n] !== mold.id || (noHeal && noHeal[n])) continue;
          if (world.component[n] === world.component[c]) {
            // inside one piece: only a shortcut worth a loop, never a link between near neighbors along the same vein
            if (n < c || withinSteps(world, c, n, world.balance.loopMinSteps)) continue;
          }
          if (ring === 1) {
            if (!contested(world, mold, cx, cy) && !world.cuts.has(cutKey(world, c, n))) linkCells(world, c, n);
          } else bridge(world, mold, c, n);
        }
      }
    }
  }
}

/** a loop is only built while its piece holds this many cells' worth of nutrients */
const LOOP_RESERVE = 8;

const isOpen = (world: World, cell: CellIndex): boolean => world.terrain[cell] === Terrain.Open || world.terrain[cell] === Terrain.Rough;

/** build one cell between two cells of the mold that are two cells apart, if it is allowed and affordable */
function bridge(world: World, mold: Mold, a: CellIndex, b: CellIndex): void {
  const w = world.width;
  const h = world.height;
  const ax = a % w;
  const ay = Math.floor(a / w);
  const bx = b % w;
  const by = Math.floor(b / w);
  let best = -1;
  let bestScore = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = ax + dx;
      const y = ay + dy;
      if ((dx === 0 && dy === 0) || x < 0 || y < 0 || x >= w || y >= h) continue;
      if (Math.max(Math.abs(x - bx), Math.abs(y - by)) !== 1) continue; // must touch both ends
      const m = y * w + x;
      if (world.owner[m] !== 0 || !isOpen(world, m)) continue;
      // nearest the straight line between the two cells, ties by index
      const score = (2 * x - ax - bx) ** 2 + (2 * y - ay - by) ** 2;
      if (score < bestScore) {
        bestScore = score;
        best = m;
      }
    }
  }
  if (best < 0 || contested(world, mold, best % w, Math.floor(best / w))) return;
  const cost = world.balance.cellBuildCost * (world.terrain[best] === Terrain.Rough ? world.balance.terrainCost.rough : world.balance.terrainCost.open);
  const compA = world.components.get(world.component[a] as number) as Component;
  const compB = world.components.get(world.component[b] as number) as Component;
  const payer = compA.pool >= compB.pool ? compA : compB;
  // a loop inside one piece is a luxury: it leaves a reserve for growth and fighting
  if (payer.pool < (compA === compB ? cost * LOOP_RESERVE : cost)) return;
  payer.pool -= cost;
  addCell(world, mold.id, best, a);
  engulfFood(world, mold.id, best);
  linkCells(world, best, b); // merges the two pieces, or closes a loop inside one
}

/** is any cell within two of (x, y) held by another mold? Contested ground is never healed. */
function contested(world: World, mold: Mold, x: number, y: number): boolean {
  const w = world.width;
  const h = world.height;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const o = world.owner[ny * w + nx] as number;
      if (o !== 0 && o !== mold.id) return true;
    }
  }
  return false;
}
