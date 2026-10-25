# Data Model: Buildings

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md) | **Date**: 2026-10-25

Extends the [001 data model](../001-core-game-loop/data-model.md). Only the farm exists in this
slice, so `BuildingType` is `'farm'`.

## Building

| Field | Type | Notes |
|---|---|---|
| `id` | int | index in `World.buildings`; stable for the round |
| `type` | `BuildingType` | `'farm'` now |
| `moldId` | int | owner |
| `cell` | cell index | the one cell it stands on |
| `placedTick` | int | |
| `destroyed` | bool | true once its cell is gone; the entry stays so ids do not shift |

**Validation** (`canPlace`, in this order)
- `unknown-building`: the type is not in the data table.
- `mold-eliminated`: the mold is not alive.
- `out-of-bounds`: the cell is off the grid.
- `not-your-cell`: "a building MUST sit only on a cell of its owner's mold" (`owner[cell] === mold`).
- `occupied`: "Each cell MUST hold at most one building" (`buildingAt[cell] === -1`).
- `on-food`: "A cell holding a building MUST NOT be a food cell, except for Harvesters"
  (`food[cell] === 0`; farms are never placed on food).
- `limit-reached`: live buildings of this type owned by the mold is below the type's `limit`.
- `cant-afford`: the pool of the piece holding the cell is at least `cost`.

**State transitions**
```
(canPlace ok) ──placeBuilding──▶ working ──(its cell is removed)──▶ destroyed   (no refund)
```
A farm is always `working` while it stands. The `idle` state in the spec is for harvesters.

## BuildingSpec (balance data)

| Field | Farm default | Notes |
|---|---|---|
| `cost` | 30 | nutrients, paid up front from the piece's pool |
| `upkeep` | 0.1 /s | paid from the piece's pool, on top of per-cell upkeep |
| `limit` | 6 | per mold |
| `income` | 0.5 /s | farm only: nutrients per second into its piece |

## World additions

| Field | Type | Notes |
|---|---|---|
| `buildings` | `Building[]` | append-only |
| `buildingAt` | `Int16Array[cells]` | building id or -1 |

`stateHash` covers both. `assertInvariants` adds: every live building's cell is owned by its owner
and points back at it through `buildingAt`; no two live buildings share a cell; destroyed
buildings have `buildingAt === -1` on their cell.

## Component and source rules

- `sources` includes every cell with a live farm (so such a piece is never `orphaned`).
- Due upkeep per piece = `upkeepPerCell * cells + Σ building upkeep` of live buildings in it.
- Starvation victim order: cells with no building first, then thinnest vein, then outermost, then
  lowest index. A building cell is chosen only when no building-free leaf remains.

## Events

| Event | Fields |
|---|---|
| `buildingPlaced` | `id`, `type`, `mold`, `cell` |
| `buildingDestroyed` | `id`, `type`, `mold`, `cell` |

## HudModel additions

| Field | Notes |
|---|---|
| `build` | one entry per building type: `type`, `cost`, `upkeep`, `income` (if any), `count`, `limit`, `affordable` (the mold's richest piece can pay) |
| `buildingIncome` | nutrients per second currently produced by the mold's working farms, before upkeep |

## Command

`placeBuilding { mold, building, cell }`; see [contracts/commands.md](contracts/commands.md).
