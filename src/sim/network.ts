import { clampPools, recomputeBoost, recomputeSupply } from './buildings';
import { DX, DY, dirBetween, edgeSlot, neighbor, popcount8 } from './grid';
import { moldOf } from './world';
import type { Building, CellIndex, Component, MoldId, World } from './types';
import { TICK_DT } from './types';

export function newComponent(world: World, moldId: MoldId): Component {
  const c: Component = {
    id: world.nextComponentId++,
    moldId,
    pool: 0,
    cells: [],
    sources: [],
    orphaned: false,
    starveCell: -1,
    unpaid: false,
    cap: world.balance.pool.baseCap,
    full: false,
  };
  world.components.set(c.id, c);
  return c;
}

/** Claim `cell` for a mold, optionally joined by a vein to the owned cell `linkTo`. */
export function addCell(world: World, moldId: MoldId, cell: CellIndex, linkTo: CellIndex): void {
  const mold = moldOf(world, moldId);
  world.owner[cell] = moldId;
  world.biomass[cell] = 1;
  world.strayFor[cell] = 0;
  mold.cellCount++;
  mold.stats.cellsBuilt++;
  if (mold.cellCount > mold.stats.peakSize) mold.stats.peakSize = mold.cellCount;
  const comp = linkTo >= 0 ? (world.components.get(world.component[linkTo] as number) as Component) : newComponent(world, moldId);
  world.component[cell] = comp.id;
  comp.cells.push(cell);
  if (linkTo >= 0) linkCells(world, cell, linkTo);
}

/** Add a vein between two adjacent owned cells of one mold, merging their pieces if needed. */
export function linkCells(world: World, a: CellIndex, b: CellIndex): void {
  const w = world.width;
  const k = dirBetween(w, a, b);
  if (k < 0) throw new Error(`cells ${a} and ${b} are not adjacent`);
  world.edges[a] = (world.edges[a] as number) | (1 << k);
  world.edges[b] = (world.edges[b] as number) | (1 << ((k + 4) & 7));
  const slot = edgeSlot(w, a, k);
  if ((world.conductivity[slot] as number) === 0) {
    world.conductivity[slot] = world.balance.initialConductivity;
  }
  const ca = world.component[a] as number;
  const cb = world.component[b] as number;
  if (ca !== cb) mergeComponents(world, ca, cb);
}

export function unlinkCells(world: World, a: CellIndex, b: CellIndex): void {
  const w = world.width;
  const k = dirBetween(w, a, b);
  if (k < 0) return;
  world.edges[a] = (world.edges[a] as number) & ~(1 << k);
  world.edges[b] = (world.edges[b] as number) & ~(1 << ((k + 4) & 7));
  const slot = edgeSlot(w, a, k);
  world.conductivity[slot] = 0;
  world.edgeFlow[slot] = 0;
}

/** Merge two pieces; the lower id survives and the pools are added together. */
export function mergeComponents(world: World, idA: number, idB: number): void {
  if (idA === idB) return;
  const keepId = Math.min(idA, idB);
  const dropId = Math.max(idA, idB);
  const keep = world.components.get(keepId) as Component;
  const drop = world.components.get(dropId) as Component;
  for (const cell of drop.cells) {
    world.component[cell] = keepId;
    keep.cells.push(cell);
  }
  keep.pool += drop.pool;
  keep.orphaned = keep.orphaned && drop.orphaned;
  world.components.delete(dropId);
}

/** Remove a cell and its veins. Does not detect splits; use removeCellAndSplit for that. */
export function removeCell(world: World, cell: CellIndex): void {
  const w = world.width;
  const h = world.height;
  const moldId = world.owner[cell] as number;
  if (moldId === 0) return;
  const bits = world.edges[cell] as number;
  for (let k = 0; k < 8; k++) {
    if (bits & (1 << k)) unlinkCells(world, cell, neighbor(w, h, cell, k));
  }
  const compId = world.component[cell] as number;
  const comp = world.components.get(compId);
  if (comp) {
    const i = comp.cells.indexOf(cell);
    if (i >= 0) {
      comp.cells[i] = comp.cells[comp.cells.length - 1] as number;
      comp.cells.pop();
    }
    if (comp.cells.length === 0) world.components.delete(compId);
  }
  const buildingId = world.buildingAt[cell] as number;
  if (buildingId >= 0) {
    const building = world.buildings[buildingId] as Building;
    building.destroyed = true;
    world.buildingAt[cell] = -1;
    world.events.push({ type: 'buildingDestroyed', id: building.id, building: building.type, mold: moldId, cell });
    if (building.type === 'booster') recomputeBoost(world); // its bonus ends at once
    if (building.type === 'storehouse') {
      clampPools(world); // its cap ends at once
      recomputeSupply(world); // and so does its boost
    }
  }
  world.owner[cell] = 0;
  world.biomass[cell] = 0;
  world.component[cell] = -1;
  const mold = moldOf(world, moldId);
  mold.cellCount--;
}

/** Remove a cell, then relabel its piece so a split is noticed and the pool is shared out. */
export function removeCellAndSplit(world: World, cell: CellIndex): void {
  const compId = world.component[cell] as number;
  removeCell(world, cell);
  if (world.components.has(compId)) relabelComponent(world, compId);
}

/** Recompute the connected pieces of a component; extra pieces become new components. */
export function relabelComponent(world: World, compId: number): void {
  const comp = world.components.get(compId);
  if (!comp) return;
  const sc = world.scratch;
  const w = world.width;
  const h = world.height;
  const stamp = ++sc.stampN;
  const cells = comp.cells;
  const inComp = new Set<number>(cells);
  const pieces: number[][] = [];
  const seen = new Set<number>();
  for (const start of cells) {
    if (seen.has(start)) continue;
    const piece: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const u = stack.pop() as number;
      piece.push(u);
      const bits = world.edges[u] as number;
      for (let k = 0; k < 8; k++) {
        if (!(bits & (1 << k))) continue;
        const v = neighbor(w, h, u, k);
        if (v >= 0 && inComp.has(v) && !seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    pieces.push(piece);
  }
  void stamp;
  if (pieces.length <= 1) return;
  const total = cells.length;
  const first = pieces[0] as number[];
  let handedOut = 0;
  for (let p = 1; p < pieces.length; p++) {
    const piece = pieces[p] as number[];
    const nc = newComponent(world, comp.moldId);
    nc.cells = piece;
    nc.pool = (comp.pool * piece.length) / total;
    handedOut += nc.pool;
    for (const c of piece) world.component[c] = nc.id;
    refreshSources(world, nc);
  }
  comp.cells = first;
  comp.pool -= handedOut;
  refreshSources(world, comp);
}

/** Find the cells that supply a piece (the core, and cells over food) and flag orphans. */
export function refreshSources(world: World, comp: Component): void {
  const mold = moldOf(world, comp.moldId);
  const was = comp.orphaned;
  comp.sources.length = 0;
  for (const cell of comp.cells) {
    if (cell === mold.core || (world.food[cell] as number) > 0) comp.sources.push(cell);
  }
  comp.orphaned = comp.sources.length === 0 && comp.cells.length > 0;
  if (comp.orphaned && !was) {
    world.events.push({ type: 'pieceOrphaned', mold: comp.moldId, componentId: comp.id });
  }
}

/** Pieces with no supply lose biomass until they die (FR-013). */
export function decayOrphans(world: World): void {
  const loss = world.balance.orphanDecay * TICK_DT;
  const dead: CellIndex[] = [];
  for (const comp of world.components.values()) {
    // a spore burst's pieces stay alive while it blooms
    if (!comp.orphaned || (world.molds[comp.moldId - 1]?.bloomUntil ?? 0) > world.tick) continue;
    for (const cell of comp.cells) {
      const b = (world.biomass[cell] as number) - loss;
      if (b <= 0) dead.push(cell);
      else world.biomass[cell] = b;
    }
  }
  for (const cell of dead) {
    const moldId = world.owner[cell] as number;
    if (moldId === 0) continue;
    world.events.push({ type: 'cellDied', cell, mold: moldId, by: 0 });
    moldOf(world, moldId).stats.cellsDestroyed++;
    removeCellAndSplit(world, cell);
  }
}

export function degree(world: World, cell: CellIndex): number {
  return popcount8(world.edges[cell] as number);
}

export { DX, DY };

/** the key a deliberately cut vein is stored under: the same for either order of its two cells */
export function cutKey(world: Readonly<World>, a: CellIndex, b: CellIndex): number {
  const n = world.width * world.height;
  return a < b ? a * n + b : b * n + a;
}

/** both cells of a stored cut key */
export function cutCells(world: Readonly<World>, key: number): [CellIndex, CellIndex] {
  const n = world.width * world.height;
  return [Math.floor(key / n), key % n];
}
