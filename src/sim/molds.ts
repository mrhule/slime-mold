import { DX, DY, cellAt, cellX, cellY } from './grid';
import { addCell } from './network';
import { Terrain, emptyFlow } from './types';
import type { CellIndex, Mold, World } from './types';

/**
 * Create a mold with its core and four orthogonal neighbors, and give its piece the
 * starting nutrients.
 */
export function addMold(
  world: World,
  kind: Mold['kind'],
  core: CellIndex,
  startNutrients: number,
  aggression = 0,
  buildReserve = 100,
): Mold {
  const cells = world.width * world.height;
  const id = world.molds.length + 1;
  const mold: Mold = {
    id,
    kind,
    color: id - 1,
    pattern: id - 1,
    core,
    allocation: world.balance.defaultAllocation,
    tier: kind === 'rival' ? world.balance.tiers.max : 1, // rivals never evolve, so they start with every building open
    targets: [],
    status: 'alive',
    cellCount: 0,
    stats: { nutrientsGathered: 0, cellsBuilt: 0, cellsDestroyed: 0, peakSize: 0 },
    netIncome: 0,
    incomeTick: 0,
    upkeepTick: 0,
    flowTick: emptyFlow(),
    flow: emptyFlow(),
    bloomUntil: 0,
    burstUsed: false,
    frontCells: [],
    frontLoss: 0,
    lossTick: 0,
    vision: new Uint8Array(cells),
    memOwner: new Uint8Array(cells),
    memFood: new Float32Array(cells),
    memBuilding: new Uint8Array(cells),
    seenCells: new Uint32Array(8),
    ai: kind === 'rival' ? { aggression, buildReserve, debug: [] } : null,
    aiNext: 0,
  };
  world.molds.push(mold);
  addCell(world, id, core, -1);
  const w = world.width;
  const h = world.height;
  const cx = cellX(w, core);
  const cy = cellY(w, core);
  for (const k of [0, 2, 4, 6]) {
    const x = cx + (DX[k] as number);
    const y = cy + (DY[k] as number);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const c = cellAt(w, x, y);
    const t = world.terrain[c];
    if (t === Terrain.Obstacle || t === Terrain.Wall || world.owner[c] !== 0) continue;
    addCell(world, id, c, core);
  }
  const comp = world.components.get(world.component[core] as number);
  if (comp) comp.pool = startNutrients;
  return mold;
}
