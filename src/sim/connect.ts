import { engulfFood } from './food';
import { addCell, linkCells } from './network';
import { moldsInOrder } from './world';
import { Terrain } from './types';
import type { CellIndex, Component, Mold, World } from './types';

/**
 * Veins of one mold that grow close to each other join up on their own, so a mold that spreads in
 * several directions stays one network instead of a handful of cut-off pieces. Every `connectEvery`
 * ticks, for each mold with more than one piece:
 *  - pieces whose cells touch (8-adjacent) are linked for free;
 *  - pieces separated by a single free cell are bridged with one new cell, paid for from the richer
 *    piece (and skipped when it cannot pay). Neither happens near an enemy (an enemy cell within two
 *    cells): contested ground is never healed, so cutting a rival's vein still works.
 * Deterministic: it walks pieces and cells in their stored order and uses no randomness.
 */
export function connectPieces(world: World): void {
  for (const mold of moldsInOrder(world)) {
    if (mold.status !== 'alive') continue;
    connectMold(world, mold);
  }
}

function piecesOf(world: World, mold: Mold): Component[] {
  const out: Component[] = [];
  for (const comp of world.components.values()) if (comp.moldId === mold.id) out.push(comp);
  return out;
}

function connectMold(world: World, mold: Mold): void {
  if (piecesOf(world, mold).length < 2) return;
  // touching pieces first (free), then one-cell gaps, so a bridge is never built where a link will do
  scan(world, mold, 1);
  if (world.balance.connectGap >= 2) scan(world, mold, 2);
}

/** visit every cell of the mold's pieces and join it to a cell of another piece exactly `ring` cells away */
function scan(world: World, mold: Mold, ring: 1 | 2): void {
  const { width: w, height: h } = world;
  // walk a snapshot of the cells: merging changes the component lists underneath us
  for (const start of piecesOf(world, mold)) {
    const cells = start.cells.slice();
    for (const c of cells) {
      if (world.owner[c] !== mold.id) continue;
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const n = y * w + x;
          if (world.owner[n] !== mold.id || world.component[n] === world.component[c]) continue;
          if (ring === 1) {
            if (!contested(world, mold, cx, cy)) linkCells(world, c, n);
          } else bridge(world, mold, c, n);
        }
      }
    }
  }
}

const isOpen = (world: World, cell: CellIndex): boolean => world.terrain[cell] === Terrain.Open || world.terrain[cell] === Terrain.Rough;

/** build one cell between two pieces of the mold that are two cells apart, if it is allowed and affordable */
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
  if (payer.pool < cost) return;
  payer.pool -= cost;
  addCell(world, mold.id, best, a);
  engulfFood(world, mold.id, best);
  linkCells(world, best, b); // merges the two pieces
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
