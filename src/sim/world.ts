import type { BalanceConfig } from '../config/balance';
import { RngStreams } from './rng';
import { DX, DY, dirBetween, edgeSlot } from './grid';
import { Terrain } from './types';
import type { DifficultyProfile, Mold, Scratch, World } from './types';

function createScratch(cells: number): Scratch {
  return {
    stamp: new Int32Array(cells),
    stampN: 0,
    parent: new Int32Array(cells),
    order: new Int32Array(cells),
    subInc: new Float32Array(cells),
    subDem: new Float32Array(cells),
    scale: new Float32Array(cells),
    g: new Float32Array(cells),
    from: new Int32Array(cells),
    closed: new Int32Array(cells),
    closedN: 0,
    heapF: [],
    heapN: [],
  };
}

const EMPTY_DIFFICULTY: DifficultyProfile = {
  rivalCount: 0,
  mapWidth: 0,
  mapHeight: 0,
  foodDensity: 1,
  rivalAggression: 0,
  rivalStartNutrients: 1,
  aiThinkInterval: 1,
  dropInterval: 35,
};

export function createWorld(
  width: number,
  height: number,
  balance: BalanceConfig,
  seed: number,
  roundNumber = 1,
  difficulty: DifficultyProfile = { ...EMPTY_DIFFICULTY, mapWidth: width, mapHeight: height },
): World {
  const cells = width * height;
  const component = new Int32Array(cells);
  component.fill(-1);
  const foodSourceId = new Int16Array(cells);
  foodSourceId.fill(-1);
  return {
    width,
    height,
    seed,
    roundNumber,
    tick: 0,
    balance,
    difficulty,
    terrain: new Uint8Array(cells),
    owner: new Uint8Array(cells),
    biomass: new Float32Array(cells),
    edges: new Uint8Array(cells),
    conductivity: new Float32Array(cells * 4),
    edgeFlow: new Float32Array(cells * 4),
    component,
    food: new Float32Array(cells),
    foodSourceId,
    molds: [],
    components: new Map(),
    nextComponentId: 0,
    foodSources: [],
    drops: [],
    nextTargetId: 1,
    reachableCells: 0,
    rng: new RngStreams(seed),
    commandQueue: [],
    events: [],
    replay: { runSeed: seed, roundNumber, entries: [], finalHash: 0 },
    scratch: createScratch(cells),
  };
}

export function moldOf(world: World, id: number): Mold {
  const m = world.molds[id - 1];
  if (!m) throw new Error(`unknown mold ${id}`);
  return m;
}

/** Throws if any structural invariant from data-model.md is violated. */
export function assertInvariants(world: World): void {
  const { width: w, height: h } = world;
  const fail = (msg: string): never => {
    throw new Error(`invariant violated (tick ${world.tick}): ${msg}`);
  };
  const counts = new Map<number, number>();
  for (let i = 0; i < world.owner.length; i++) {
    const o = world.owner[i] as number;
    const bio = world.biomass[i] as number;
    if (o !== 0) {
      const t = world.terrain[i];
      if (t === Terrain.Obstacle || t === Terrain.Wall) fail(`cell ${i} owned on impassable terrain`);
      if (!(bio > 0)) fail(`cell ${i} owned with biomass ${bio}`);
      if ((world.component[i] as number) < 0) fail(`cell ${i} owned without a component`);
      counts.set(o, (counts.get(o) ?? 0) + 1);
    } else {
      if (bio > 0) fail(`cell ${i} unowned with biomass ${bio}`);
      if ((world.component[i] as number) !== -1) fail(`cell ${i} unowned with a component`);
      if ((world.edges[i] as number) !== 0) fail(`cell ${i} unowned with edges`);
    }
    const bits = world.edges[i] as number;
    for (let k = 0; k < 8; k++) {
      if (!(bits & (1 << k))) continue;
      const x = (i % w) + (DX[k] as number);
      const y = Math.floor(i / w) + (DY[k] as number);
      if (x < 0 || y < 0 || x >= w || y >= h) fail(`cell ${i} edge ${k} leaves the grid`);
      const n = y * w + x;
      if (!((world.edges[n] as number) & (1 << ((k + 4) & 7)))) fail(`edge ${i}-${n} not mirrored`);
      if (world.owner[n] !== o) fail(`edge ${i}-${n} crosses owners`);
      if (world.component[n] !== world.component[i]) fail(`edge ${i}-${n} crosses components`);
      if (dirBetween(w, i, n) !== k) fail('direction mismatch');
      if (!((world.conductivity[edgeSlot(w, i, k)] as number) > 0)) fail(`edge ${i}-${n} has no conductivity`);
    }
  }
  for (const m of world.molds) {
    if ((counts.get(m.id) ?? 0) !== m.cellCount) {
      fail(`mold ${m.id} cellCount ${m.cellCount} != ${counts.get(m.id) ?? 0}`);
    }
  }
  let inComponents = 0;
  for (const c of world.components.values()) {
    inComponents += c.cells.length;
    for (const cell of c.cells) {
      if (world.component[cell] !== c.id) fail(`component ${c.id} lists cell ${cell} of another component`);
      if (world.owner[cell] !== c.moldId) fail(`component ${c.id} lists cell ${cell} of another owner`);
    }
    if (c.pool < -1e-6 || !Number.isFinite(c.pool)) fail(`component ${c.id} pool ${c.pool}`);
  }
  let owned = 0;
  for (const n of counts.values()) owned += n;
  if (inComponents !== owned) fail(`components hold ${inComponents} cells but ${owned} are owned`);
}
