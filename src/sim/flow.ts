import { dirBetween, edgeSlot, neighbor, octile } from './grid';
import { refreshSources } from './network';
import { moldOf } from './world';
import { TICK_DT } from './types';
import type { CellIndex, Component, GrowthTarget, World } from './types';

/**
 * Tree-routed Physarum flow (R2). Every `flowEvery` ticks, for each connected piece:
 * route income (toward the root) and tip demand (away from it) through a BFS tree, cap what
 * reaches each tip by the thinnest vein on its path, let each vein's conductivity relax toward
 * the flow it carries (thinning to a floor when idle, never retracting).
 */
export function solveFlow(world: World): void {
  const dtF = world.balance.flowEvery * TICK_DT;
  for (const comp of world.components.values()) {
    refreshSources(world, comp);
    if (comp.cells.length > 0) solveComponent(world, comp, dtF);
  }
}

function sourceRate(world: World, cell: CellIndex, core: CellIndex): number {
  if (cell === core) return world.balance.coreIncome;
  const sid = world.foodSourceId[cell] as number;
  const src = world.foodSources[sid];
  if (!src || src.depleted || (world.food[cell] as number) <= 0) return 0;
  return world.balance.foodTypes[src.type].absorbRate;
}

function solveComponent(world: World, comp: Component, dtF: number): void {
  const b = world.balance;
  const { width: w, height: h } = world;
  const sc = world.scratch;
  const mold = moldOf(world, comp.moldId);
  const root = comp.sources.includes(mold.core) ? mold.core : (comp.sources[0] ?? (comp.cells[0] as number));

  // BFS tree from the root
  const stamp = ++sc.stampN;
  const order = sc.order;
  const parent = sc.parent;
  let head = 0;
  let tail = 0;
  order[tail++] = root;
  sc.stamp[root] = stamp;
  parent[root] = -1;
  while (head < tail) {
    const u = order[head++] as number;
    const bits = world.edges[u] as number;
    for (let k = 0; k < 8; k++) {
      if (!(bits & (1 << k))) continue;
      const v = neighbor(w, h, u, k);
      if (v < 0 || sc.stamp[v] === stamp) continue;
      sc.stamp[v] = stamp;
      parent[v] = u;
      order[tail++] = v;
    }
  }
  const visited = tail;

  // income per source cell
  const subInc = sc.subInc;
  const subDem = sc.subDem;
  let income = 0;
  for (let i = 0; i < visited; i++) {
    const u = order[i] as number;
    subDem[u] = 0;
    subInc[u] = 0;
  }
  for (const s of comp.sources) {
    if (sc.stamp[s] !== stamp) continue;
    const r = sourceRate(world, s, mold.core);
    subInc[s] = r;
    income += r;
  }

  // tip demand
  const tips: GrowthTarget[] = [];
  for (const tip of mold.targets) {
    const hd = tip.path[tip.pos] as number;
    if (world.component[hd] === comp.id && sc.stamp[hd] === stamp) tips.push(tip);
  }
  if (tips.length > 0) {
    const budget = Math.min(b.spendRateCap, income + comp.pool / b.demandHorizon);
    // front sinks arrive with the rivals story: until then growth gets the whole budget
    const growthShare = 1;
    let wsum = 0;
    for (const t of tips) wsum += 1 / (1 + octile(w, t.path[t.pos] as number, t.cell));
    for (const t of tips) {
      const wt = 1 / (1 + octile(w, t.path[t.pos] as number, t.cell));
      const d = (budget * growthShare * wt) / wsum;
      subDem[t.path[t.pos] as number] = (subDem[t.path[t.pos] as number] as number) + d;
    }
  }
  const demandAt = new Map<number, number>();
  for (const t of tips) {
    const hd = t.path[t.pos] as number;
    demandAt.set(hd, subDem[hd] as number);
  }

  // accumulate subtree sums toward the root
  for (let i = visited - 1; i > 0; i--) {
    const u = order[i] as number;
    const p = parent[u] as number;
    subInc[p] = (subInc[p] as number) + (subInc[u] as number);
    subDem[p] = (subDem[p] as number) + (subDem[u] as number);
  }

  // capacity-limited delivery, top down
  const scale = sc.scale;
  scale[root] = 1;
  for (let i = 1; i < visited; i++) {
    const u = order[i] as number;
    const p = parent[u] as number;
    const slot = edgeSlot(w, u, dirBetween(w, u, p));
    const cap = b.capacityPerD * (world.conductivity[slot] as number);
    const dem = subDem[u] as number;
    const s = dem > 1e-9 ? Math.min(1, cap / dem) : 1;
    scale[u] = Math.min(scale[p] as number, s);
  }
  for (const t of tips) {
    const hd = t.path[t.pos] as number;
    // tips sharing a head cell split that cell's demand evenly
    t.rate = (demandAt.get(hd) as number) * (scale[hd] as number) / tips.filter((o) => o.path[o.pos] === hd).length;
  }
  for (const t of mold.targets) {
    if (!tips.includes(t)) t.rate = 0;
  }

  // conductivity relaxes toward the flow each edge carries
  for (const cell of comp.cells) {
    const bits = world.edges[cell] as number;
    for (let k = 0; k < 4; k++) {
      if (!(bits & (1 << k))) continue;
      const v = neighbor(w, h, cell, k);
      const slot = cell * 4 + k;
      let q = 0;
      let sign = 0;
      if (sc.stamp[v] === stamp && parent[v] === cell) {
        q = (subInc[v] as number) + (subDem[v] as number);
        sign = 1; // outward (root to leaf) is along the stored direction
      } else if (sc.stamp[cell] === stamp && parent[cell] === v) {
        q = (subInc[cell] as number) + (subDem[cell] as number);
        sign = -1;
      }
      let d = world.conductivity[slot] as number;
      d += (q - b.conductivityDecay * d) * dtF;
      // unused veins thin to a floor but are never removed (FR-005)
      world.conductivity[slot] = Math.min(b.maxConductivity, Math.max(b.minConductivity, d));
      world.edgeFlow[slot] = sign * q;
    }
  }
}
