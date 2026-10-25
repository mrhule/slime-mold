import type { FoodType } from '../sim/types';

export interface FoodTypeSpec {
  w: number;
  h: number;
  /** total nutrients in the food */
  nutrients: number;
  /** nutrients absorbed per owned cell per second */
  absorbRate: number;
}

export interface BuildingSpec {
  /** nutrients, paid up front from the pool of the piece it is placed in */
  cost: number;
  /** nutrients per second, on top of per-cell upkeep */
  upkeep: number;
  /** most a single mold may have */
  limit: number;
}

export interface BoosterSpec extends BuildingSpec {
  /** cells (Chebyshev) around the factory that it strengthens */
  radius: number;
  /** extra combat strength per factory, as a fraction (0.5 = +50%) */
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

export interface FarmSpec extends BuildingSpec {
  /** nutrients per second into its piece */
  income: number;
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
  buildings: { farm: FarmSpec; booster: BoosterSpec; harvester: HarvesterSpec };

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
  playerStartNutrients: 30,
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
  },

  buildings: {
    farm: { cost: 30, upkeep: 0.15, limit: 6, income: 1.5 },
    booster: { cost: 40, upkeep: 0.15, limit: 4, radius: 6, bonus: 0.5, stackCap: 1.0 },
    harvester: { cost: 25, upkeep: 0.1, limit: 4, minFoodCells: 9, rateMult: 2 },
  },

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
