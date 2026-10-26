import type { FoodType } from '../sim/types';

export interface FoodTypeSpec {
  w: number;
  h: number;
  /** total nutrients in the food */
  nutrients: number;
  /** nutrients absorbed per owned cell per second */
  absorbRate: number;
  /** a goo pool: its cells never lose nutrients, it never depletes, and it pays only with a store house (008) */
  infinite?: boolean;
}

export interface PoolConfig {
  /** contested pools away from every start (plus one per two rivals) */
  contested: number;
  /** how far from a start, in cells, its own pool sits (a ring of this width) */
  nearMin: number;
  nearMax: number;
  /** fewest cells between two pools' footprints */
  spacing: number;
}

export interface BuildingSpec {
  /** nutrients, paid up front from the pool of the piece it is placed in */
  cost: number;
  /** nutrients per second, on top of per-cell upkeep */
  upkeep: number;
  /** most a single mold may have */
  limit: number;
  /** the tier a mold must have evolved to before it can build this (1 or missing: from the start) */
  minTier?: number;
}

export interface RelaySpec extends BuildingSpec {
  /** how far along the veins it carries supply, in cells (the same falloff as a factory's reach) */
  reach: number;
  /** most levels a relay can reach (it is placed at level 1) */
  maxLevel: number;
  /** extra reach, in cells, for each level above the first */
  reachPerLevel: number;
  /** nutrients to go from level n to n + 1, at index n - 1 */
  upgradeCost: number[];
}

export interface BoosterSpec extends BuildingSpec {
  /** how far along the veins the boost reaches, in cells; it tapers off linearly to nothing */
  reach: number;
  /** extra combat strength per factory right at the factory, as a fraction (0.5 = +50%) */
  bonus: number;
  /** most extra strength overlapping factories can add together */
  stackCap: number;
}

export interface HarvesterSpec extends BuildingSpec {
  /** smallest food item (in cells) a harvester can be placed on */
  minFoodCells: number;
  /** how much faster its owner absorbs that food */
  rateMult: number;
}

export interface StoreHouseSpec extends BuildingSpec {
  /** extra cap its piece gets from each working store house */
  capacity: number;
  /** how many working store houses in one piece add capacity */
  perPiece: number;
  /** how far along the veins the growth/harvest boost reaches, in cells (linear taper) */
  reach: number;
  /** extra speed right at the store house, as a fraction (0.5 = +50%) */
  bonus: number;
  /** most extra speed overlapping store houses can add together */
  stackCap: number;
  /** nutrients per second drained from its piece while something in it is boosted */
  drain: number;
  /** below this stock the boost stops; it resumes at 1.25x this */
  lowStock: number;
  /** most levels a factory can reach (it is placed at level 1) */
  maxLevel: number;
  /** extra reach, in cells, for each level above the first */
  reachPerLevel: number;
  /** nutrients to go from level n to n + 1, at index n - 1 */
  upgradeCost: number[];
}

/** Every tunable constant (Constitution IV). Sim code reads it through `world.balance`. */
export interface BalanceConfig {
  // economy
  coreIncome: number;
  upkeepPerCell: number;
  cellBuildCost: number;
  spendRateCap: number;
  /** extra spend rate per owned cell in a piece: bigger molds grow and fight faster */
  spendRatePerCell: number;
  playerStartNutrients: number;
  rivalStartNutrientsBase: number;

  // flow & veins (R2)
  flowEvery: number;
  conductivityDecay: number;
  capacityPerD: number;
  /** idle veins thin to this conductivity but are never removed */
  minConductivity: number;
  /** biomass per second lost by the leaf cell starving when upkeep cannot be paid */
  starveDecay: number;
  orphanDecay: number;
  initialConductivity: number;
  maxConductivity: number;
  /** pool is budgeted to drain over this many seconds */
  demandHorizon: number;

  // growth (R5)
  terrainCost: { open: number; rough: number; enemy: number; own: number };
  maxTargets: number;
  /** chance per built vein cell that a short side spur sprouts from it (a bit of spreading) */
  spurChance: number;
  /** longest side spur, in cells */
  spurMaxLen: number;
  targetSnapRadius: number;

  // combat (R6)
  attackEff: number;
  /** pressure every front cell exerts even with no nutrients delivered, so contact always grinds */
  basePressure: number;
  consumeRefund: number;
  biomassRegen: number;

  // vision (R7)
  visionRadius: number;
  fogEvery: number;
  fogFullEvery: number;

  // drops
  dropInterval: number;
  dropJitter: number;
  dropWarning: number;
  dropWeights: Partial<Record<FoodType, number>>;

  // mapgen (R12)
  startClearRadius: number;
  fairRadius: number;
  fairTolerance: number;
  minReachableArea: number;
  mapgenAttempts: number;
  obstacleThreshold: number;
  roughThreshold: number;
  foodSpacing: number;
  /** pieces of one mold within this many cells (2 = one free cell apart) join up on their own */
  connectGap: number;
  /** a loop closes between two cells of one piece only when the veins between them are at least this many steps long */
  loopMinSteps: number;
  /** ticks between those checks */
  connectEvery: number;
  /** one food item per this many cells at foodDensity 1 */
  foodAreaPerItem: number;
  starterFood: number;

  // rounds
  victoryControl: number;
  defaultAllocation: number;

  // AI (R8)
  aiCommandsPerThink: number;

  foodTypes: Record<FoodType, FoodTypeSpec>;

  /** one entry per building type (002) */
  buildings: { booster: BoosterSpec; harvester: HarvesterSpec; storehouse: StoreHouseSpec; relay: RelaySpec };

  /** evolving: the highest tier, and what it costs in nutrients to go up from tier n (at index n - 1). The cost is fixed: it does not grow with the factories you have built. */
  tiers: { max: number; costs: number[] };

  /**
   * how far supply carries along the veins: from the core and from each working factory, in cells (a
   * factory has its own reach). Growth speed falls from 1 at supply to `trickle` at the end of the reach,
   * then to `floor` (almost nothing) half a reach further out. A vein out of every reach for `graceSeconds`
   * (time to build a factory) starts to die back, taking `fadeSeconds` to go.
   */
  feed: { coreReach: number; trickle: number; floor: number; graceSeconds: number; fadeSeconds: number };

  /** the share of a building's cost paid back into its piece when the player demolishes it */
  demolishRefund: number;

  /** nutrient storage per connected piece of vein (003) */
  pool: { baseCap: number };
  /** goo pool placement (008) */
  pools: PoolConfig;

  /** coefficients for difficultyFor(round), R14 */
  difficulty: {
    baseW: number;
    baseH: number;
    capW: number;
    capH: number;
    rivalsMax: number;
    mapGrowth: number;
    mapScaleMax: number;
    foodDecay: number;
    foodMin: number;
    aggressionBase: number;
    aggressionStep: number;
    aggressionMax: number;
    startNutrientsStep: number;
    thinkBase: number;
    thinkStep: number;
    thinkMin: number;
    buildReserveBase: number;
    buildReserveStep: number;
    buildReserveMin: number;
  };
}

export const defaultBalance: BalanceConfig = Object.freeze({
  coreIncome: 0.5,
  upkeepPerCell: 0.004,
  cellBuildCost: 1.0,
  spendRateCap: 6,
  spendRatePerCell: 0.01,
  playerStartNutrients: 50,
  rivalStartNutrientsBase: 30,

  flowEvery: 5,
  conductivityDecay: 0.8,
  capacityPerD: 6.0,
  minConductivity: 0.15,
  starveDecay: 0.1,
  orphanDecay: 0.25,
  initialConductivity: 0.5,
  maxConductivity: 20,
  demandHorizon: 2,

  terrainCost: { open: 1, rough: 2.5, enemy: 1.5, own: 0.2 },
  maxTargets: 3,
  spurChance: 0.3,
  spurMaxLen: 7,
  targetSnapRadius: 6,

  attackEff: 0.12,
  basePressure: 0.4,
  consumeRefund: 0.4,
  biomassRegen: 0.2,

  visionRadius: 10,
  fogEvery: 5,
  fogFullEvery: 40,

  dropInterval: 35,
  dropJitter: 10,
  dropWarning: 5,
  dropWeights: { breadCrumb: 5, sugarCube: 3, fruitSlice: 2 },

  startClearRadius: 6,
  fairRadius: 25,
  fairTolerance: 0.1,
  minReachableArea: 0.55,
  mapgenAttempts: 10,
  obstacleThreshold: 0.7,
  roughThreshold: 0.6,
  foodSpacing: 12,
  connectGap: 2,
  loopMinSteps: 20,
  connectEvery: 10,
  foodAreaPerItem: 900,
  starterFood: 3,

  victoryControl: 0.75,
  defaultAllocation: 0.3,

  aiCommandsPerThink: 3,

  foodTypes: {
    oatFlake: { w: 2, h: 2, nutrients: 40, absorbRate: 2.0 },
    breadCrumb: { w: 3, h: 3, nutrients: 120, absorbRate: 1.5 },
    sugarCube: { w: 4, h: 4, nutrients: 300, absorbRate: 3.0 },
    fruitSlice: { w: 6, h: 4, nutrients: 500, absorbRate: 1.0 },
    // a pool of primordial goo: 12 cells holding 1 nutrient each that are never used up; each cell a mold
    // holds pays 0.2/s while a store house is on its piece, so a fully held pool pays 2.4/s (008, S12 balance)
    goo: { w: 4, h: 3, nutrients: 12, absorbRate: 0.2, infinite: true },
  },

  buildings: {
    storehouse: { cost: 25, upkeep: 0.2, limit: 6, capacity: 300, perPiece: 3, reach: 20, bonus: 0.5, stackCap: 1.0, drain: 0.5, lowStock: 15, maxLevel: 3, reachPerLevel: 12, upgradeCost: [35, 55] },
    relay: { cost: 15, upkeep: 0.1, limit: 6, minTier: 2, reach: 16, maxLevel: 3, reachPerLevel: 8, upgradeCost: [20, 35] },
    booster: { cost: 40, upkeep: 0.15, limit: 4, reach: 24, bonus: 0.75, stackCap: 1.0 },
    harvester: { cost: 25, upkeep: 0.1, limit: 4, minFoodCells: 9, rateMult: 2 },
  },

  feed: { coreReach: 40, trickle: 0.5, floor: 0.04, graceSeconds: 30, fadeSeconds: 60 },

  demolishRefund: 0.5,

  tiers: { max: 2, costs: [250] },

  pool: { baseCap: 300 },
  pools: { contested: 3, nearMin: 11, nearMax: 19, spacing: 8 },

  difficulty: {
    baseW: 160,
    baseH: 120,
    capW: 320,
    capH: 240,
    rivalsMax: 5,
    mapGrowth: 0.08,
    mapScaleMax: 2.0,
    foodDecay: 0.07,
    foodMin: 0.35,
    aggressionBase: 0.2,
    aggressionStep: 0.08,
    aggressionMax: 0.9,
    startNutrientsStep: 0.5,
    thinkBase: 3.0,
    thinkStep: 0.25,
    thinkMin: 0.8,
    buildReserveBase: 700,
    buildReserveStep: 70,
    buildReserveMin: 60,
  },
});
