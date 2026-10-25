# Data Model: Store House, Fertile Ground, and Farm Output

Changes on top of [002's data model](../002-buildings/data-model.md). Names match the planned
code in `src/sim`.

## World additions

| Field | Type | Meaning |
|---|---|---|
| `fertile` | `Uint8Array(cells)` | 1 where the ground is fertile; set by map generation, never changes in a round; only on `Open`/`Rough` cells |
| `supply` | `Float32Array(cells)` | growth and harvest multiplier from working Store Houses (1 = none), capped at `1 + storeHouse.stackCap` |
| `supplyActive` | `boolean` | any working Store House is boosting some cell (lets rebuilding be skipped) |

`stateHash` covers `fertile`, each building's `level`, and `supply`. `assertInvariants` checks:
fertile cells are never `Obstacle`/`Wall`; no pool exceeds its cap by more than a rounding error
after `clampPools`; farm levels are integers in 0–6; no farm stands on a non-fertile cell.

## Building changes

| Field | Change |
|---|---|
| `type` | adds `'storehouse'`; `BUILDING_CODE.storehouse = 4`, `BUILDING_OF_CODE[4] = 'storehouse'` |
| `level` | new, integer 0–6, farms only (other types keep 0); default `farm.defaultLevel` (4) |

A Store House has no per-building state beyond `Building` itself; "working" is derived (it stands
and its piece is not `unpaid`).

## Derived quantities

| Name | Definition |
|---|---|
| `workingStoreHouses(comp)` | live Store Houses whose piece is `comp` and which are not `unpaid` |
| `capOf(comp)` | `pool.baseCap + storeHouse.capacity × min(workingStoreHouses(comp), storeHouse.perPiece)` |
| `farmLinked(farm)` | `workingStoreHouses(piece of farm) ≥ 1` |
| `farmOutput(farm)` | `level = 0` or not linked → 0; else `farm.income × o × (1.5 − 0.5·o)` with `o = level × 0.25` |
| `farmUpkeep(farm)` | `farm.upkeep × o` (also paid by an unlinked farm; 0 at level 0) |
| `headroom(comp)` | `max(0, capOf(comp) − comp.pool)` |
| `storeCover(storehouse)` | `veinCover(cell, storeHouse.reach, storeHouse.bonus)`: each connected cell gets `bonus × (1 − d/reach)`, `d` = steps along veins |

## Balance additions (`src/config/balance.ts`)

```ts
pool: { baseCap: 300 }
buildings.farm: { …existing, defaultLevel: 4, levelStep: 0.25, maxLevel: 6 }
buildings.storehouse: {
  cost: 25, upkeep: 0.2, limit: 4,
  capacity: 300, perPiece: 3,
  reach: 20, bonus: 0.5, stackCap: 1.0,
  drain: 0.5,        // nutrients per second per working Store House while something is boosted
  lowStock: 15,      // boost stops below this pool level, resumes at lowStock × 1.25
}
fertile: {
  nearPatches: 2, nearRadius: 18, patchMin: 2, patchMax: 4,
  contested: 1, minNear: 24,
}
```

The farm's cost is now 25 and `playerStartNutrients` is 50 (research S12, balance pass).

## Command (see [contracts/commands.md](contracts/commands.md))

`{ type: 'setFarmOutput'; mold; building: number; level: number }`, plus new `PlaceReason`s
`'not-fertile'` for farms off fertile ground. A rejected command emits `commandRejected`.

## Events

| Event | When |
|---|---|
| `buildingPlaced` / `buildingDestroyed` | unchanged; now also for `'storehouse'` |
| `farmLinkChanged { building, linked }` | a farm's linked state flips (UI warning, sound hooks later) |
| `storeFull { componentId }` | a piece first reaches its cap after being below it (HUD flag) |
| `capLost { componentId, amount }` | a falling cap cut the stock (a toast: "Stock lost") |

## HUD additions

| Field | Meaning |
|---|---|
| `build[].type = 'storehouse'` | a normal build option with cost, upkeep, count and limit |
| `stock.total`, `stock.cap` | sum of piece stocks and sum of piece caps for the mold |
| `stock.full` | at least one piece is at its cap |
| `farms: { total, linked, unlinked }` | counts for the "unlinked" warning |
| `buildingIncome` | now the sum of current farm outputs (linked, at their levels) |

## State transitions

- **Farm**: *placed (fertile cell)* → *linked* (a working Store House in the piece) ↔ *unlinked*;
  *level* changes by command at any time; destroyed with its cell.
- **Store House**: *placed* → *working* ↔ *not working* (unpaid piece); destroyed with its cell
  (cap and boost end at once, stock above the new cap is lost).
- **Pool**: grows from gains, is clamped to `capOf` at the end of each tick.
