import type { BalanceConfig } from '../config/balance';
import type { Rng, RngStreams } from './rng';

/** 0 = none, 1 = the player, 2..6 = rivals */
export type MoldId = number;
/** y * width + x */
export type CellIndex = number;

/** Fixed simulation step in seconds (20 Hz). */
export const TICK_DT = 0.05;

export const Terrain = { Open: 0, Rough: 1, Obstacle: 2, Wall: 3 } as const;

export type FoodType = 'oatFlake' | 'breadCrumb' | 'sugarCube' | 'fruitSlice' | 'goo';

export type BuildingType = 'booster' | 'harvester' | 'storehouse' | 'relay';

/** what `Mold.memBuilding` stores for each building type (0 = none) */
export const BUILDING_CODE: Record<BuildingType, number> = { booster: 1, harvester: 2, storehouse: 3, relay: 4 };
export const BUILDING_OF_CODE: (BuildingType | null)[] = [null, 'booster', 'harvester', 'storehouse', 'relay'];

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
  /** 1 at the start; evolving raises it and unlocks buildings with a higher minTier */
  tier: number;
  targets: GrowthTarget[];
  status: 'alive' | 'eliminated';
  cellCount: number;
  stats: MoldStats;
  /** smoothed (income - upkeep) in nutrients/s, for the HUD */
  netIncome: number;
  /** per-tick accumulators feeding netIncome */
  incomeTick: number;
  upkeepTick: number;
  /** where nutrients came from and went, per tick and smoothed per second, for the HUD */
  flowTick: NutrientFlow;
  flow: NutrientFlow;
  /** the tick the spore burst's bloom ends, 0 before it and -1 once it is over */
  bloomUntil: number;
  burstUsed: boolean;
  /** owned cells touching an enemy cell, rebuilt every tick */
  frontCells: CellIndex[];
  /** smoothed biomass per second lost on fronts, and the per-tick accumulator */
  frontLoss: number;
  lossTick: number;
  /** fog of war (R7): 0 never seen, 1 remembered, 2 visible now */
  vision: Uint8Array;
  memOwner: Uint8Array;
  memFood: Float32Array;
  /** last-seen building on each cell: 0 none, 1 booster, 2 harvester, 3 store house */
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
  /** factory only: 1 when placed, up to maxLevel; each level adds reach */
  level: number;
  /** factory only: its growth/harvest boost is on (stock above lowStock, with hysteresis) */
  boosting: boolean;
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
  /** cut the vein between two adjacent cells of the mold, or rejoin one it cut earlier */
  | { type: 'toggleLink'; mold: MoldId; a: CellIndex; b: CellIndex }
  /** raise the factory on a cell one level: more reach, paid from its piece */
  | { type: 'upgradeBuilding'; mold: MoldId; cell: CellIndex }
  /** tear down the mold's building on a cell, getting part of its cost back */
  | { type: 'demolishBuilding'; mold: MoldId; cell: CellIndex }
  /** spend most of a full stock to move up a tier */
  | { type: 'evolve'; mold: MoldId }
  /** go all in: scatter spores over the map and bloom, then reach the burst's control target or lose */
  | { type: 'sporeBurst'; mold: MoldId };

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
  | 'no-building'
  | 'not-upgradable'
  | 'max-level'
  | 'locked';

export type PlaceResult = { ok: true } | { ok: false; reason: PlaceReason };

export type SimEvent =
  | { type: 'cellDied'; cell: CellIndex; mold: MoldId; by: MoldId | 0 }
  | { type: 'dropWarning'; dropId: number; cell: CellIndex; foodType: FoodType }
  | { type: 'dropLanded'; dropId: number; foodSourceId: number }
  | { type: 'foodDepleted'; foodSourceId: number }
  | { type: 'sporeBurst'; mold: MoldId; seeds: number }
  | { type: 'moldEliminated'; mold: MoldId }
  | { type: 'pieceOrphaned'; mold: MoldId; componentId: number }
  | { type: 'buildingPlaced'; id: number; building: BuildingType; mold: MoldId; cell: CellIndex }
  | { type: 'moldEvolved'; mold: MoldId; tier: number }
  | { type: 'buildingUpgraded'; id: number; building: BuildingType; mold: MoldId; cell: CellIndex; level: number }
  | { type: 'buildingDestroyed'; id: number; building: BuildingType; mold: MoldId; cell: CellIndex }
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
export type VictoryReason = 'eliminated-all' | 'map-control' | 'spore-burst';
export type DefeatReason = 'eliminated' | 'burst-failed';

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
  count: number;
  limit: number;
  /** some piece of the mold holds at least `cost` */
  affordable: boolean;
  /** the mold has not evolved far enough to build this yet */
  locked: boolean;
  /** the tier that unlocks it */
  minTier: number;
}

/** nutrients per second (or per tick while accumulating) by where they came from or went */
export interface NutrientFlow {
  income: number;
  /** upkeep owed for veins, whether or not the stock could pay it */
  veins: number;
  /** upkeep owed for buildings */
  buildings: number;
  /** spent pushing veins outward */
  growth: number;
  /** spent on the fight at the fronts */
  fight: number;
}

export const emptyFlow = (): NutrientFlow => ({ income: 0, veins: 0, buildings: 0, growth: 0, fight: 0 });

export interface HudModel {
  round: number;
  storedNutrients: number;
  netIncome: number;
  /** smoothed income and each kind of spending, per second */
  flow: NutrientFlow;
  /** some piece cannot pay its upkeep, so its veins are dying back */
  starving: boolean;
  allocation: number;
  mapControl: number;
  /** the control that wins right now: it eases down in a long round */
  winControl: number;
  /** the spore burst: whether it can be used, and the bloom's clock once it has been */
  burst: { state: 'locked' | 'poor' | 'ready' | 'blooming' | 'used'; cost: number; target: number; unlockIn: number; secondsLeft: number };
  growthStarved: boolean;
  targets: HudTarget[];
  build: BuildOption[];
  /** nutrients per second from goo pools the mold holds with a store house on their piece (008) */
  poolIncome: number;
  /** stored nutrients against the caps of the mold's pieces (003) */
  stock: { total: number; cap: number; full: boolean };
  /** evolving: the mold's tier, the top tier, whether the stock is full enough now, and what the next step costs */
  tier: { current: number; max: number; ready: boolean; needed: number; cost: number };
  /** goo pools the mold holds a ring cell of, and how many of those wait for a store house on their piece (008) */
  pools: { held: number; waiting: number };
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
  /** goo pools are terrain, known to every mold in the fog like obstacles: the top-left cell and the cells the mold holds of each */
  knownPools(): { cell: CellIndex; w: number; h: number; cells: number; owned: number }[];
  /** public rules the AI plans with */
  rules: { storeHousesPerPiece: number; /** feed at the end of a supply's reach: cells at or below it are out of reach */ feedTrickle: number; factoryMaxLevel: number; factoryUpgradeCost: number[] };
  /** id of the mold's own piece holding this cell, or -1 */
  pieceOf(cell: CellIndex): number;
  ownerAt(cell: CellIndex): MoldId | 0;
  biomassAt(cell: CellIndex): number | null;
  /** how well fed one of the mold's own cells is, from 1 at supply down to the floor far from it (see balance.feed) */
  feedAt(cell: CellIndex): number;
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
  /** the mold's own factories: where, how upgraded, and the piece they stand in */
  ownFactories(): { cell: CellIndex; level: number; piece: number }[];
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
  /** growth and harvest speed multiplier from working store houses (1 = none) */
  supply: Float32Array;
  /** true while any working store house boosts some cell (lets rebuilding be skipped) */
  supplyActive: boolean;
  /** growth speed (trickle..1) from how far each cell is along the veins from the core or a working store house; 1 = right at supply */
  feed: Float32Array;
  /** seconds each cell has been out of every supply's reach (it starts dying back after the grace period) */
  strayFor: Float32Array;
  /** ids of pieces where a boosted tip or harvester did work this tick (store houses drain only then); not hashed, rebuilt every tick */
  supplyUse: Set<number>;
  /** veins the player cut on purpose, as cutKey(a, b); they are not healed or bridged around until rejoined */
  cuts: Set<number>;
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
  defeatReason: DefeatReason | null;

  rng: RngStreams;
  commandQueue: Command[];
  /** commands issued by rival AIs: applied like any other, but not logged, because replaying regenerates them */
  internalCommands: WeakSet<Command>;
  events: SimEvent[];
  replay: ReplayLog;
  scratch: Scratch;
}

export type { Rng };
