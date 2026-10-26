import { canPlace, capOf, workingStoreHouses } from './buildings';
import { SQRT2, octile } from './grid';
import { moldOf } from './world';
import { TICK_DT } from './types';
import type { CellIndex, MoldId, MoldView, World } from './types';

/**
 * The only way the rival AI sees the world (Constitution II, R7): everything here is limited to
 * what the mold's own veins can see, plus what is visible to every mold (terrain, drop
 * warnings). If a fact is not exposed here, the AI cannot know it.
 */
export function viewFor(world: World, moldId: MoldId): MoldView {
  const mold = moldOf(world, moldId);
  const { width: w, height: h } = world;
  const vision = mold.vision;

  const visibility = (cell: CellIndex): 0 | 1 | 2 => (vision[cell] as 0 | 1 | 2);
  const foodAt = (cell: CellIndex): number => {
    const v = vision[cell];
    return v === 2 ? (world.food[cell] as number) : v === 1 ? (mold.memFood[cell] as number) : 0;
  };

  const ownCells: CellIndex[] = [];
  for (const comp of world.components.values()) {
    if (comp.moldId === moldId && !comp.orphaned) for (const c of comp.cells) ownCells.push(c);
  }

  const components = [...world.components.values()]
    .filter((c) => c.moldId === moldId)
    .map((c) => ({
      id: c.id,
      pool: c.pool,
      cap: capOf(world, c),
      storeHouses: workingStoreHouses(world, c),
      cellCount: c.cells.length,
      orphaned: c.orphaned,
    }));

  return {
    self: {
      id: moldId,
      allocation: mold.allocation,
      cellCount: mold.cellCount,
      components,
      targets: mold.targets.map((t) => ({ id: t.id, cell: t.cell, state: t.state })),
      frontCells: mold.frontCells.slice(),
      frontLoss: mold.frontLoss,
    },
    width: w,
    height: h,
    terrain: world.terrain,
    visibility,
    knownPools() {
      // goo pools are terrain: every mold knows where they are, in the fog or not
      const out: { cell: CellIndex; w: number; h: number; cells: number; owned: number }[] = [];
      for (const src of world.foodSources) {
        if (!world.balance.foodTypes[src.type].infinite) continue;
        let owned = 0;
        for (let y = src.y; y < src.y + src.h; y++) {
          for (let x = src.x; x < src.x + src.w; x++) if (world.owner[y * w + x] === moldId) owned++;
        }
        out.push({ cell: src.y * w + src.x, w: src.w, h: src.h, cells: src.w * src.h, owned });
      }
      return out;
    },
    rules: { storeHousesPerPiece: world.balance.buildings.storehouse.perPiece },
    pieceOf: (cell) => (world.owner[cell] === moldId ? (world.component[cell] as number) : -1),
    ownerAt(cell) {
      const v = vision[cell];
      return v === 2 ? (world.owner[cell] as number) : v === 1 ? (mold.memOwner[cell] as number) : 0;
    },
    biomassAt: (cell) => (vision[cell] === 2 ? (world.biomass[cell] as number) : null),
    foodAt,
    visibleEnemyCells() {
      const out: CellIndex[] = [];
      for (let i = 0; i < vision.length; i++) {
        if (vision[i] !== 2) continue;
        const o = world.owner[i] as number;
        if (o !== 0 && o !== moldId) out.push(i);
      }
      return out;
    },
    knownFood() {
      const out: { cell: CellIndex; amount: number; stale: boolean }[] = [];
      for (const src of world.foodSources) {
        if (src.depleted || world.balance.foodTypes[src.type].infinite) continue;
        let amount = 0;
        let seenNow = false;
        let seenEver = false;
        for (let y = src.y; y < src.y + src.h; y++) {
          for (let x = src.x; x < src.x + src.w; x++) {
            const c = y * w + x;
            const v = vision[c] as number;
            if (v > 0) seenEver = true;
            if (v === 2) seenNow = true;
            amount += foodAt(c);
          }
        }
        if (seenEver && amount > 0) out.push({ cell: src.y * w + src.x, amount, stale: !seenNow });
      }
      return out;
    },
    dropWarnings() {
      return world.drops
        .filter((d) => d.state === 'warning')
        .map((d) => ({ cell: d.cell, type: d.type, landsInTicks: Math.max(0, d.landTick - world.tick) }));
    },
    ownCells: () => ownCells.slice(),
    canBuild: (type, cell) => ownCells.length > 0 && world.owner[cell] === moldId && canPlace(world, moldId, type, cell).ok,
    buildCost: (type) => world.balance.buildings[type].cost,
    richestPool: () => components.reduce((best, c) => (c.pool > best ? c.pool : best), 0),
    nearestOwn(cell) {
      let best = -1;
      let bestD = Infinity;
      for (const c of ownCells) {
        const d = octile(w, c, cell);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    },
    pathCost(from, to) {
      // distance plus the extra cost of rough ground and obstacles along the straight line
      const fx = from % w;
      const fy = Math.floor(from / w);
      const tx = to % w;
      const ty = Math.floor(to / w);
      const steps = Math.max(Math.abs(tx - fx), Math.abs(ty - fy));
      let extra = 0;
      for (let s = 1; s <= steps; s++) {
        const x = fx + Math.round(((tx - fx) * s) / steps);
        const y = fy + Math.round(((ty - fy) * s) / steps);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const t = world.terrain[y * w + x];
        if (t === 1) extra += 1.5;
        else if (t === 2 || t === 3) extra += 3;
      }
      return octile(w, from, to) * 1.1 + extra * (SQRT2 - 1);
    },
    tick: world.tick,
  };
}

export const THINK_TICKS = (seconds: number): number => Math.max(1, Math.round(seconds / TICK_DT));
