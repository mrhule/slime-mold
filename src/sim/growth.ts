import { DX, DY, SQRT2, dirBetween, isDiagonal, octile } from './grid';
import { heapPop, heapPush } from './heap';
import { addCell, linkCells } from './network';
import { engulfFood } from './food';
import { moldOf, moldsInOrder } from './world';
import { TICK_DT, Terrain } from './types';
import type { CellIndex, Component, GrowthTarget, Mold, MoldId, World } from './types';

export type PlanResult =
  | { ok: true; cell: CellIndex; path: CellIndex[] }
  | { ok: false; reason: string };

const isOpen = (world: World, cell: CellIndex): boolean => {
  const t = world.terrain[cell];
  return t === Terrain.Open || t === Terrain.Rough;
};

/** Nearest walkable cell to `cell` within the snap radius (ring search, ties by index). */
export function snapTarget(world: World, cell: CellIndex): CellIndex {
  if (isOpen(world, cell)) return cell;
  const { width: w, height: h } = world;
  const cx = cell % w;
  const cy = Math.floor(cell / w);
  const maxR = world.balance.targetSnapRadius;
  for (let r = 1; r <= maxR; r++) {
    let best = -1;
    let bestD = Infinity;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const c = y * w + x;
        if (!isOpen(world, c)) continue;
        const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

function terrainStep(world: World, moldId: MoldId, cell: CellIndex): number {
  const tc = world.balance.terrainCost;
  const o = world.owner[cell] as number;
  if (o === moldId) return tc.own;
  const base = world.terrain[cell] === Terrain.Rough ? tc.rough : tc.open;
  return o !== 0 ? Math.max(base, tc.enemy) : base;
}

/**
 * A* over the 8-connected grid from every cell the mold owns (outside orphaned pieces) to the
 * target. Returns the cells from the attach cell to the target, inclusive.
 */
export function findPath(world: World, moldId: MoldId, target: CellIndex): CellIndex[] | null {
  const { width: w, height: h } = world;
  const sc = world.scratch;
  const tick = ++sc.closedN;
  const g = sc.g;
  const from = sc.from;
  const closed = sc.closed;
  const stamp = sc.stamp;
  const stampId = ++sc.stampN; // marks cells whose g/from are valid this search
  const heapF = sc.heapF;
  const heapN = sc.heapN;
  heapF.length = 0;
  heapN.length = 0;

  for (const comp of world.components.values()) {
    if (comp.moldId !== moldId || comp.orphaned) continue;
    for (const c of comp.cells) {
      g[c] = 0;
      from[c] = -1;
      stamp[c] = stampId;
      heapPush(heapF, heapN, octile(w, c, target), c);
    }
  }
  if (heapF.length === 0) return null;

  while (heapF.length) {
    const u = heapPop(heapF, heapN);
    if (closed[u] === tick) continue;
    closed[u] = tick;
    if (u === target) {
      const path: CellIndex[] = [];
      for (let c = u; c !== -1; c = from[c] as number) path.push(c);
      return path.reverse();
    }
    const ux = u % w;
    const uy = Math.floor(u / w);
    const gu = g[u] as number;
    for (let k = 0; k < 8; k++) {
      const nx = ux + (DX[k] as number);
      const ny = uy + (DY[k] as number);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const v = ny * w + nx;
      if (closed[v] === tick || !isOpen(world, v)) continue;
      if (isDiagonal(k)) {
        // no cutting corners through obstacles
        if (!isOpen(world, uy * w + nx) || !isOpen(world, ny * w + ux)) continue;
      }
      const step = terrainStep(world, moldId, v) * (isDiagonal(k) ? SQRT2 : 1);
      const gv = gu + step;
      if (stamp[v] === stampId && gv >= (g[v] as number)) continue;
      stamp[v] = stampId;
      g[v] = gv;
      from[v] = u;
      heapPush(heapF, heapN, gv + octile(w, v, target), v);
    }
  }
  return null;
}

export function planTarget(world: World, moldId: MoldId, cell: CellIndex): PlanResult {
  if (!Number.isInteger(cell) || cell < 0 || cell >= world.width * world.height) {
    return { ok: false, reason: 'out-of-bounds' };
  }
  const snapped = snapTarget(world, cell);
  if (snapped < 0) return { ok: false, reason: 'no-open-cell-nearby' };
  if (world.owner[snapped] === moldId) return { ok: false, reason: 'already-owned' };
  const path = findPath(world, moldId, snapped);
  if (!path) return { ok: false, reason: 'unreachable' };
  return { ok: true, cell: snapped, path };
}

/** Add a growth target; the oldest is replaced when the mold already has the maximum. */
export function addTarget(world: World, moldId: MoldId, cell: CellIndex): PlanResult {
  const plan = planTarget(world, moldId, cell);
  if (!plan.ok) return plan;
  const mold = moldOf(world, moldId);
  if (mold.targets.length >= world.balance.maxTargets) {
    let oldest = 0;
    for (let i = 1; i < mold.targets.length; i++) {
      if ((mold.targets[i] as GrowthTarget).createdTick < (mold.targets[oldest] as GrowthTarget).createdTick) oldest = i;
    }
    mold.targets.splice(oldest, 1);
  }
  mold.targets.push({
    id: world.nextTargetId++,
    moldId,
    cell: plan.cell,
    path: plan.path,
    pos: 0,
    progress: 0,
    createdTick: world.tick,
    state: 'growing',
    starvedFor: 0,
    rate: 0,
  });
  return plan;
}

function repath(world: World, mold: Mold, tip: GrowthTarget): boolean {
  const path = findPath(world, mold.id, tip.cell);
  if (!path) {
    tip.state = 'blocked';
    tip.rate = 0;
    return false;
  }
  tip.path = path;
  tip.pos = 0;
  tip.state = 'growing';
  return true;
}

const stepCostOf = (world: World, cell: CellIndex): number =>
  world.balance.cellBuildCost * (world.terrain[cell] === Terrain.Rough ? world.balance.terrainCost.rough : world.balance.terrainCost.open);

/** Spend delivered nutrients on extending each mold's tips (called every tick). */
export function tickGrowth(world: World): void {
  const dt = TICK_DT;
  for (const mold of moldsInOrder(world)) {
    if (mold.status !== 'alive') continue;
    for (const tip of [...mold.targets]) advanceTip(world, mold, tip, dt);
  }
}

function advanceTip(world: World, mold: Mold, tip: GrowthTarget, dt: number): void {
  const last = tip.path.length - 1;
  let head = tip.path[tip.pos] as number;
  if (world.owner[head] !== mold.id) {
    // the cell under the head was lost; find a new way from what is left
    if (!repath(world, mold, tip)) return;
    head = tip.path[tip.pos] as number;
  }
  if (tip.state === 'blocked' && world.tick % 20 === 0) {
    // look for a way around; a new path starts from wherever is nearest now, so the head moves with it
    if (!repath(world, mold, tip)) return;
    head = tip.path[tip.pos] as number;
  }
  if (tip.state === 'blocked') tip.state = 'growing';

  let builtThisTick = 0;
  let delivered = false;
  for (;;) {
    // veins of our own are free to cross
    while (tip.pos < last && world.owner[tip.path[tip.pos + 1] as number] === mold.id) {
      linkCells(world, head, tip.path[tip.pos + 1] as number);
      tip.pos++;
      head = tip.path[tip.pos] as number;
    }
    if (tip.pos >= last) {
      tip.state = 'arrived';
      mold.targets.splice(mold.targets.indexOf(tip), 1);
      return;
    }
    const next = tip.path[tip.pos + 1] as number;
    if (world.owner[next] !== 0) {
      tip.state = 'blocked'; // an enemy holds it; combat decides
      return;
    }
    if (!isOpen(world, next)) {
      repath(world, mold, tip);
      return;
    }
    const cost = stepCostOf(world, next);
    if (!delivered) {
      delivered = true;
      const comp = world.components.get(world.component[head] as number) as Component;
      const grant = Math.min(tip.rate * dt, comp.pool);
      if (grant > 1e-9) {
        comp.pool -= grant;
        // a store house on this vein makes each delivered nutrient go further (S8)
        const boost = world.supply[head] as number;
        // and the farther the head is from supply along the veins, the less of it arrives (feed)
        tip.progress += grant * boost * (world.feed[head] as number);
        if (boost > 1) world.supplyUse.add(comp.id);
      }
      // starved = the stock is (nearly) empty, so growth is limited to whatever income arrives
      if (comp.pool + grant < world.balance.cellBuildCost * 0.25) tip.starvedFor += dt;
      else tip.starvedFor = 0;
    }
    if (tip.progress < cost || builtThisTick >= 4) break;
    tip.progress -= cost;
    builtThisTick++;
    addCell(world, mold.id, next, head);
    // a new cell is one step farther from supply than the one it grew from, until the next recompute
    const { coreReach, trickle } = world.balance.feed;
    world.feed[next] = Math.max(trickle, (world.feed[head] as number) - (1 - trickle) / coreReach);
    engulfFood(world, mold.id, next);
    growSpurs(world, mold, tip, head, next);
    tip.pos++;
    head = next;
  }
  tip.state = tip.starvedFor >= 1 ? 'starved' : 'growing';
}

/** a spur only sprouts while its piece holds this many cells' worth of nutrients */
const SPUR_CUSHION = 30;

function pay(world: World, from: CellIndex, cell: CellIndex): void {
  const comp = world.components.get(world.component[from] as number) as Component;
  comp.pool = Math.max(0, comp.pool - stepCostOf(world, cell));
}

/** can a spur cell go here: open, unowned, and no corner cutting through obstacles */
function spurOk(world: World, from: CellIndex, k: number): CellIndex {
  const { width: w, height: h } = world;
  const x = (from % w) + (DX[k] as number);
  const y = Math.floor(from / w) + (DY[k] as number);
  if (x < 0 || y < 0 || x >= w || y >= h) return -1;
  const c = y * w + x;
  if (!isOpen(world, c) || world.owner[c] !== 0) return -1;
  if (isDiagonal(k) && (!isOpen(world, Math.floor(from / w) * w + x) || !isOpen(world, y * w + (from % w)))) return -1;
  return c;
}

/**
 * Side spurs: as a tip lays down vein, short thin branches now and then sprout sideways so the
 * mold spreads a little instead of drawing single lines. They are paid from the piece's stock
 * (and only sprout while it holds a cushion), so they never slow the tip, and they use the
 * mold's own RNG stream, so rivals get the very same behavior.
 */
function growSpurs(world: World, mold: Mold, tip: GrowthTarget, from: CellIndex, to: CellIndex): void {
  const bal = world.balance;
  if (bal.spurChance <= 0) return;
  const comp = world.components.get(world.component[to] as number) as Component;
  if (comp.pool < stepCostOf(world, to) * SPUR_CUSHION) return;
  const rng = world.rng.get(`spur:${mold.id}`);
  const spurs = (tip.spurs ??= []);
  for (let i = spurs.length - 1; i >= 0; i--) {
    const s = spurs[i] as { head: CellIndex; dir: number; left: number };
    const head0 = s.head;
    if (world.owner[head0] !== mold.id) {
      spurs.splice(i, 1); // the spur's end was lost in a fight
      continue;
    }
    if (!rng.chance(0.6)) continue;
    const k = rng.chance(0.65) ? s.dir : (s.dir + (rng.chance(0.5) ? 1 : 7)) & 7;
    const c = spurOk(world, s.head, k);
    if (c < 0) {
      spurs.splice(i, 1);
      continue;
    }
    addCell(world, mold.id, c, s.head);
    engulfFood(world, mold.id, c);
    pay(world, head0, c);
    s.head = c;
    s.dir = k;
    if (--s.left <= 0) spurs.splice(i, 1);
  }
  if (spurs.length >= 3 || !rng.chance(bal.spurChance)) return;
  const heading = dirBetween(world.width, from, to);
  if (heading < 0) return;
  const k = (heading + (rng.chance(0.5) ? 1 : -1) * (rng.chance(0.7) ? 2 : 1) + 8) & 7;
  const c = spurOk(world, to, k);
  if (c < 0) return;
  addCell(world, mold.id, c, to);
  engulfFood(world, mold.id, c);
  pay(world, to, c);
  spurs.push({ head: c, dir: k, left: rng.int(bal.spurMaxLen) });
  if (spurs[spurs.length - 1]!.left <= 0) spurs.pop();
}
