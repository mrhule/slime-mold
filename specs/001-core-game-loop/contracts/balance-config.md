# Contract: Balance Configuration

Every tunable constant lives in `src/config/balance.ts` as one frozen object
(Constitution IV). Sim code receives it through `World` and never imports it directly, so
tests and the batch tool can inject variants.

```ts
export interface BalanceConfig {
  // economy
  coreIncome: number;          // 0.5 /s, start core base income (R3)
  upkeepPerCell: number;       // 0.004 /s per owned cell
  cellBuildCost: number;       // 1.0 nutrient per cell × terrain cost
  spendRateCap: number;        // 6 /s max spend per component (about 6 cells/s)
  playerStartNutrients: number;// 30
  rivalStartNutrientsBase: number; // 30 (× difficulty multiplier)

  // flow & veins (R2)
  flowEvery: number;           // 5 ticks
  conductivityDecay: number;   // 0.8
  capacityPerD: number;        // 6.0 nutrients/s per unit D
  minConductivity: number;     // 0.15, idle veins thin to this but are never removed
  starveDecay: number;         // 0.1 biomass/s lost by the leaf starving when upkeep is unpaid
  orphanDecay: number;         // 0.25 biomass/s

  // growth (R5)
  terrainCost: { open: 1; rough: 2.5; enemy: 1.5 };
  maxTargets: number;          // 3
  targetSnapRadius: number;    // 6 cells

  // combat (R6)
  attackEff: number;           // 0.12 biomass per nutrient
  consumeRefund: number;       // 0.4
  biomassRegen: number;        // 0.2 /s when supplied and not in contact

  // vision (R7)
  visionRadius: number;        // 10 cells
  fogEvery: number;            // 5 ticks
  fogFullEvery: number;        // 40 ticks

  // drops (R12, data-model)
  dropInterval: number;        // 35 s
  dropJitter: number;          // 10 s
  dropWarning: number;         // 5 s
  dropWeights: Record<FoodType, number>; // breadCrumb 5, sugarCube 3, fruitSlice 2

  // mapgen (R12)
  startClearRadius: number;    // 6 cells
  fairRadius: number;          // 25 cells (path distance)
  fairTolerance: number;       // 0.10
  minReachableArea: number;    // 0.55
  mapgenAttempts: number;      // 10

  // rounds
  victoryControl: number;      // 0.75 (FR-022)
  defaultAllocation: number;   // 0.3

  // AI (R8)
  aiCommandsPerThink: number;  // 3
}
```

The difficulty curve's formulas (R14) live in `src/sim/difficulty.ts`. Its coefficients are
grouped under `balance.difficulty` so they can be tuned the same way.
