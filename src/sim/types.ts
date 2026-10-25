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

export type BuildingType = 'farm' | 'booster' | 'harvester' | 'storehouse';

/** what `Mold.memBuilding` stores for each building type (0 = none) */
export const BUILDING_CODE: Record<BuildingType, number> = { farm: 1, booster: 2, harvester: 3, storehouse: 4 };
export const BUILDING_OF_CODE: (BuildingType | null)[] = [null, 'farm', 'booster', 'harvester', 'storehouse'];

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
  /** short side branches still growing off this tip's path */
  spurs?: { head: CellIndex; dir: number; left: number }[];
}

export interface MoldStats {
  nutrientsGathered: number;
  cellsBuilt: number;
  cellsDestroyed: number;
  peakSize: number;
}

/** a rival's private scratch; the AI reads the world only through its MoldView */
export interface AiState {
  /** 0..1, from the difficulty profile */
  aggression: number;
  /** from the difficulty profile; defaults to 100 */
  buildReserve?: number;
  /** last few decisions, for the debug overlay */
  debug: string[];
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
  /** owned cells touching an enemy cell, rebuilt every tick */
  frontCells: CellIndex[];
  /** smoothed biomass per second lost on fronts, and the per-tick accumulator */
  frontLoss: number;
  lossTick: number;
  /** fog of war (R7): 0 never seen, 1 remembered, 2 visible now */
  vision: Uint8Array;
  memOwner: Uint8Array;
  memFood: Float32Array;
  /** last-seen building on each cell: 0 none, 1 farm, 2 booster, 3 harvester */
  memBuilding: Uint8Array;
  /** for the player: enemy cells currently in view (HUD rival list) */
  seenCells: Uint32Array;
  /** rivals only */
  ai: AiState | null;
  aiNext: number;
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
  /** true while the piece could not pay this tick's upkeep (booster factories stop working) */
  unpaid: boolean;
  /** the cap the pool was last clamped to (lets a falling cap be noticed) */
  cap: number;
  /** true while the pool sits at its cap (an edge for the storeFull event) */
  full: boolean;
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

export interface Building {
  /** index in World.buildings */
  id: number;
  type: BuildingType;
  moldId: MoldId;
  cell: CellIndex;
  placedTick: number;
  /** harvester only: the food source it speeds up, otherwise -1 */
  target: number;
  /** farm only: output level, an integer 0..farm.maxLevel (default farm.defaultLevel); others 0 */
  level: number;
  /** farm only: whether a working store house shared its piece at the last tick (for link events) */
  linked: boolean;
  /** true once its cell is gone; the entry stays so ids do not shift */
  destroyed: boolean;
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
  | { type: 'setAllocation'; mold: MoldId; value: number }
  | { type: 'placeBuilding'; mold: MoldId; building: BuildingType; cell: CellIndex }
  | { type: 'setFarmOutput'; mold: MoldId; building: number; level: number };

export type PlaceReason =
  | 'unknown-building'
  | 'mold-eliminated'
  | 'out-of-bounds'
  | 'not-your-cell'
  | 'occupied'
  | 'on-food'
  | 'limit-reached'
  | 'cant-afford'
  | 'no-food-nearby'
  | 'food-too-small'
  | 'already-harvested'
  | 'not-fertile';

export type PlaceResult = { ok: true } | { ok: false; reason: PlaceReason };

export type SimEvent =
  | { type: 'cellDied'; cell: CellIndex; mold: MoldId; by: MoldId | 0 }
  | { type: 'dropWarning'; dropId: number; cell: CellIndex; foodType: FoodType }
  | { type: 'dropLanded'; dropId: number; foodSourceId: number }
  | { type: 'foodDepleted'; foodSourceId: number }
  | { type: 'moldEliminated'; mold: MoldId }
  | { type: 'pieceOrphaned'; mold: MoldId; componentId: number }
  | { type: 'buildingPlaced'; id: number; building: BuildingType; mold: MoldId; cell: CellIndex }
  | { type: 'buildingDestroyed'; id: number; building: BuildingType; mold: MoldId; cell: CellIndex }
  | { type: 'farmLinkChanged'; building: number; linked: boolean }
  | { type: 'storeFull'; componentId: number }
  | { type: 'capLost'; componentId: number; amount: number }
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
  /** nutrients a rival keeps in hand beyond a building's cost before it builds: lower builds sooner */
  rivalBuildReserve: number;
}

export type RoundOutcome = 'playing' | 'victory' | 'defeat';
export type VictoryReason = 'eliminated-all' | 'map-control';

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

export interface BuildOption {
  type: BuildingType;
  cost: number;
  /** per second */
  upkeep: number;
  /** per second, farm only */
  income?: number;
  count: number;
  limit: number;
  /** some piece of the mold holds at least `cost` */
  affordable: boolean;
}

export interface HudModel {
  round: number;
  storedNutrients: number;
  netIncome: number;
  allocation: number;
  mapControl: number;
  growthStarved: boolean;
  targets: HudTarget[];
  build: BuildOption[];
  /** nutrients per second from working farms, before upkeep */
  buildingIncome: number;
  /** stored nutrients against the caps of the mold's pieces (003) */
  stock: { total: number; cap: number; full: boolean };
  /** how many of the mold's farms are linked to a store house, and how many are not */
  farms: { total: number; linked: number; unlinked: number };
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
    components: { id: number; pool: number; cap: number; storeHouses: number; cellCount: number; orphaned: boolean }[];
    targets: HudTarget[];
    frontCells: CellIndex[];
    frontLoss: number;
  };
  width: number;
  height: number;
  terrain: Readonly<Uint8Array>;
  visibility(cell: CellIndex): 0 | 1 | 2;
  /** fertile ground is terrain: known to every mold, like obstacles */
  fertileAt(cell: CellIndex): boolean;
  /** id of the mold's own piece holding this cell, or -1 */
  pieceOf(cell: CellIndex): number;
  ownerAt(cell: CellIndex): MoldId | 0;
  biomassAt(cell: CellIndex): number | null;
  foodAt(cell: CellIndex): number;
  visibleEnemyCells(): CellIndex[];
  knownFood(): { cell: CellIndex; amount: number; stale: boolean }[];
  dropWarnings(): { cell: CellIndex; type: FoodType; landsInTicks: number }[];
  /** the own cell nearest to `cell`, or -1 if the mold has none */
  nearestOwn(cell: CellIndex): CellIndex;
  /** every cell of the mold outside orphaned pieces */
  ownCells(): CellIndex[];
  /** would a building be allowed here right now? (same rules as the player, own cells only) */
  canBuild(type: BuildingType, cell: CellIndex): boolean;
  /** the most nutrients any one piece of the mold holds */
  richestPool(): number;
  /** what a building costs (public knowledge) */
  buildCost(type: BuildingType): number;
  /** approximate cost to grow from one cell to another (distance plus terrain along the line) */
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
  // combat
  damage: Float32Array;
  damageBest: Float32Array;
  damageFrom: Int32Array;
  damageStamp: Int32Array;
  damageStampN: number;
  eff: Float32Array;
  hit: number[];
  // fog
  fogTmp: Uint8Array;
  prefix: Int32Array;
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
  /** nutrients per second delivered to each front cell by the last flow solve */
  pressure: Float32Array;
  /** number of enemy cells next to each owned cell (valid for cells in a mold's frontCells) */
  enemyAdj: Uint8Array;

  molds: Mold[];
  components: Map<number, Component>;
  nextComponentId: number;
  foodSources: FoodSource[];
  buildings: Building[];
  /** building id on each cell, or -1 */
  buildingAt: Int16Array;
  /** combat strength multiplier from booster factories (1 = none) */
  boost: Float32Array;
  /** true while any working booster factory is boosting some cells (lets recomputing be skipped) */
  boostActive: boolean;
  /** 1 where ground is fertile (farms only), else 0; set by map generation */
  fertile: Uint8Array;
  /** growth and harvest speed multiplier from working store houses (1 = none) */
  supply: Float32Array;
  /** true while any working store house boosts some cell (lets rebuilding be skipped) */
  supplyActive: boolean;
  drops: DropEvent[];
  /** walkable cells reachable from the starts; drops only fall where molds can get to them */
  reachable: Uint8Array;
  /** tick at which the next drop will be announced */
  nextDropTick: number;
  nextTargetId: number;
  reachableCells: number;
  /** how many generation attempts the map needed, and whether the open-map fallback was used */
  mapAttempts: number;
  mapFallback: boolean;
  outcome: RoundOutcome;
  victoryReason: VictoryReason | null;

  rng: RngStreams;
  commandQueue: Command[];
  /** commands issued by rival AIs: applied like any other, but not logged, because replaying regenerates them */
  internalCommands: WeakSet<Command>;
  events: SimEvent[];
  replay: ReplayLog;
  scratch: Scratch;
}

export type { Rng };
