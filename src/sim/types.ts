import type { BalanceConfig } from '../config/balance';
import type { Rng, RngStreams } from './rng';

/** 0 = none, 1 = the player, 2..6 = rivals */
export type MoldId = number;
/** y * width + x */
export type CellIndex = number;

/** Fixed simulation step in seconds (20 Hz). */
export const TICK_DT = 0.05;

export const Terrain = { Open: 0, Rough: 1, Obstacle: 2, Wall: 3 } as const;

export type FoodType = 'oatFlake' | 'breadCrumb' | 'sugarCube' | 'fruitSlice';

export type TipState = 'growing' | 'starved' | 'blocked' | 'arrived';

export interface GrowthTarget {
  id: number;
  moldId: MoldId;
  /** target cell after snapping */
  cell: CellIndex;
  /** attach cell ... target, inclusive */
  path: CellIndex[];
  /** index in `path` of the head (last connected cell) */
  pos: number;
  /** nutrients accumulated toward the next cell */
  progress: number;
  createdTick: number;
  state: TipState;
  /** seconds the stock has been (nearly) empty, so growth runs on income alone */
  starvedFor: number;
  /** nutrients/s the flow solve currently routes to this tip */
  rate: number;
}

export interface MoldStats {
  nutrientsGathered: number;
  cellsBuilt: number;
  cellsDestroyed: number;
  peakSize: number;
}

export interface Mold {
  id: MoldId;
  kind: 'player' | 'rival';
  color: number;
  pattern: number;
  core: CellIndex;
  /** 0 = all growth, 1 = all fight */
  allocation: number;
  targets: GrowthTarget[];
  status: 'alive' | 'eliminated';
  cellCount: number;
  stats: MoldStats;
  /** smoothed (income - upkeep) in nutrients/s, for the HUD */
  netIncome: number;
  /** per-tick accumulators feeding netIncome */
  incomeTick: number;
  upkeepTick: number;
}

export interface Component {
  id: number;
  moldId: MoldId;
  pool: number;
  cells: CellIndex[];
  sources: CellIndex[];
  orphaned: boolean;
  /** leaf cell currently starving because upkeep cannot be paid, or -1 */
  starveCell: CellIndex;
}

export interface FoodSource {
  id: number;
  type: FoodType;
  /** top-left cell of the footprint */
  x: number;
  y: number;
  w: number;
  h: number;
  total: number;
  remaining: number;
  origin: 'initial' | 'drop';
  depleted: boolean;
}

export interface DropEvent {
  id: number;
  type: FoodType;
  cell: CellIndex;
  warnTick: number;
  landTick: number;
  state: 'scheduled' | 'warning' | 'landed';
}

export type Command =
  | { type: 'setTarget'; mold: MoldId; cell: CellIndex }
  | { type: 'cancelTarget'; mold: MoldId; targetId: number }
  | { type: 'clearTargets'; mold: MoldId }
  | { type: 'setAllocation'; mold: MoldId; value: number };

export type SimEvent =
  | { type: 'cellDied'; cell: CellIndex; mold: MoldId; by: MoldId | 0 }
  | { type: 'dropWarning'; dropId: number; cell: CellIndex; foodType: FoodType }
  | { type: 'dropLanded'; dropId: number; foodSourceId: number }
  | { type: 'foodDepleted'; foodSourceId: number }
  | { type: 'moldEliminated'; mold: MoldId }
  | { type: 'pieceOrphaned'; mold: MoldId; componentId: number }
  | { type: 'commandRejected'; mold: MoldId; reason: string; cell?: CellIndex };

export interface DifficultyProfile {
  rivalCount: number;
  mapWidth: number;
  mapHeight: number;
  foodDensity: number;
  rivalAggression: number;
  rivalStartNutrients: number;
  aiThinkInterval: number;
  dropInterval: number;
}

export type RoundOutcome = 'playing' | 'victory' | 'defeat';

export interface ReplayLog {
  runSeed: number;
  roundNumber: number;
  entries: { tick: number; cmd: Command }[];
  finalHash: number;
}

export interface HudTarget {
  id: number;
  cell: CellIndex;
  state: TipState;
}

export interface HudModel {
  round: number;
  storedNutrients: number;
  netIncome: number;
  allocation: number;
  mapControl: number;
  growthStarved: boolean;
  targets: HudTarget[];
  rivals: {
    id: MoldId;
    color: number;
    pattern: number;
    status: 'alive' | 'eliminated';
    visibleCells: number | null;
  }[];
  elapsedSeconds: number;
}

/** The AI's only view of the world (filled in by the rivals story). */
export interface MoldView {
  self: {
    id: MoldId;
    allocation: number;
    cellCount: number;
    components: { id: number; pool: number; cellCount: number; orphaned: boolean }[];
    targets: HudTarget[];
    frontCells: CellIndex[];
    frontLoss: number;
  };
  width: number;
  height: number;
  terrain: Readonly<Uint8Array>;
  visibility(cell: CellIndex): 0 | 1 | 2;
  ownerAt(cell: CellIndex): MoldId | 0;
  biomassAt(cell: CellIndex): number | null;
  foodAt(cell: CellIndex): number;
  visibleEnemyCells(): CellIndex[];
  knownFood(): { cell: CellIndex; amount: number; stale: boolean }[];
  dropWarnings(): { cell: CellIndex; type: FoodType; landsInTicks: number }[];
  pathCost(from: CellIndex, to: CellIndex): number;
  tick: number;
}

/** Reusable buffers for the per-tick algorithms (avoid per-tick allocation). */
export interface Scratch {
  stamp: Int32Array;
  stampN: number;
  parent: Int32Array;
  order: Int32Array;
  subInc: Float32Array;
  subDem: Float32Array;
  scale: Float32Array;
  // A*
  g: Float32Array;
  from: Int32Array;
  closed: Int32Array;
  closedN: number;
  heapF: number[];
  heapN: number[];
}

export interface World {
  width: number;
  height: number;
  seed: number;
  roundNumber: number;
  tick: number;
  balance: BalanceConfig;
  difficulty: DifficultyProfile;

  terrain: Uint8Array;
  owner: Uint8Array;
  biomass: Float32Array;
  /** bit k set = vein link to neighbor in direction k (see grid.ts) */
  edges: Uint8Array;
  /** conductivity D for the 4 forward directions (E, SE, S, SW) of each cell */
  conductivity: Float32Array;
  /** signed flow per edge slot (+ = along the forward direction); render-only pulse info */
  edgeFlow: Float32Array;
  component: Int32Array;
  food: Float32Array;
  foodSourceId: Int16Array;

  molds: Mold[];
  components: Map<number, Component>;
  nextComponentId: number;
  foodSources: FoodSource[];
  drops: DropEvent[];
  nextTargetId: number;
  reachableCells: number;

  rng: RngStreams;
  commandQueue: Command[];
  events: SimEvent[];
  replay: ReplayLog;
  scratch: Scratch;
}

export type { Rng };
