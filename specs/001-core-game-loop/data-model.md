# Data Model: Core Game Loop — Slime Mold RTS

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md) | **Date**: 2026-10-25

All simulation state lives in `World` (Constitution I). Per-cell data is struct-of-arrays in
typed arrays indexed by `i = y * width + x`. Mold ids are small integers: `0` = none, `1` = the
player, `2..6` = rivals. Balance constants referenced below (`cellBuildCost` and so on) are
defined in [contracts/balance-config.md](contracts/balance-config.md).

---

## World

The whole simulation state for one round.

| Field | Type | Notes |
|---|---|---|
| `width`, `height` | int | 160–320 × 120–240 (R14) |
| `tick` | int | sim ticks since round start; `dt` = 0.05 s |
| `terrain` | `Uint8Array[cells]` | `0` open, `1` rough, `2` obstacle, `3` wall |
| `owner` | `Uint8Array[cells]` | mold id or 0 |
| `biomass` | `Float32Array[cells]` | 0..1; cell health and visual density |
| `edges` | `Uint8Array[cells]` | 8-bit mask of vein links to neighbors (bit k = direction k) |
| `conductivity` | `Float32Array[cells × 4]` | `D` for the 4 "forward" directions (E, SE, S, SW), so each edge is stored once |
| `lowFlowTime` | `Float32Array[cells × 4]` | seconds the edge has spent below `retractThreshold` |
| `component` | `Int32Array[cells]` | network-piece id for owned cells, -1 otherwise |
| `food` | `Float32Array[cells]` | nutrients remaining on that cell (0 = none) |
| `foodSourceId` | `Int16Array[cells]` | which `FoodSource` the cell belongs to, -1 otherwise |
| `molds` | `Mold[]` | indexed by mold id |
| `components` | `Component[]` | live network pieces (compacted when components change) |
| `foodSources` | `FoodSource[]` | |
| `drops` | `DropEvent[]` | scheduled, warning, or landed |
| `rng` | `RngStreams` | named seeded streams (R11) |
| `commandQueue` | `Command[]` | applied at the start of the next tick |
| `events` | `SimEvent[]` | cleared each tick; used by render/UI/audio (cell died, drop landed, mold eliminated…) |

**Validation**
- `owner[i] ≠ 0` ⇒ `terrain[i] ∉ {2, 3}`.
- An edge bit is set on both endpoints, and both endpoints have the same owner.
- `biomass[i] > 0` ⇔ `owner[i] ≠ 0`.
- `stateHash(world)` covers every field above except `events`.

## Mold

One competitor.

| Field | Type | Notes |
|---|---|---|
| `id` | int | 1 = player |
| `kind` | `'player' \| 'rival'` | |
| `color`, `pattern` | palette index | R18; visual only, never read by sim logic |
| `core` | cell index | start point; a nutrient source while owned |
| `allocation` | float 0..1 | 0 = all growth, 1 = all fight (R4); default 0.3 |
| `targets` | `GrowthTarget[]` (≤ 3) | FR-002 |
| `status` | `'alive' \| 'eliminated'` | |
| `cellCount` | int | maintained incrementally |
| `vision` | `Uint8Array[cells]` | 0 unseen, 1 remembered, 2 visible (R7) |
| `memOwner` | `Uint8Array[cells]` | last-seen owner for remembered cells |
| `memFood` | `Float32Array[cells]` | last-seen food |
| `stats` | `MoldStats` | nutrients gathered, cells built, cells destroyed, peak size |
| `ai` | `AiState?` | rivals only; personality + scratch (not part of the fairness surface) |

Derived for the HUD: `storedNutrients` = Σ component pools; `netIncome` = smoothed
(income − upkeep − spend) over the last 2 s; `mapControl` = `cellCount / reachableCells`.

**State transitions**
```
alive ──(cellCount reaches 0)──▶ eliminated   (event: MoldEliminated)
```
Eliminated is terminal for the round. All of the mold's targets are cleared, and it issues no
further commands.

## Component (network piece)

A connected set of cells owned by one mold.

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `moldId` | int | |
| `pool` | float ≥ 0 | stored nutrients (R3) |
| `cellCount` | int | |
| `sources` | cell index[] | cells over food with `food > 0`, plus `core` if owned |
| `orphaned` | bool | `sources.length === 0` ⇒ no income; cells decay by `orphanDecay` |

**Lifecycle**
- **Split** (after a cell dies or an edge retracts): BFS relabels the affected component. The
  pool is shared out by cell count (rounded down; the remainder goes to the piece with the
  lowest id, for determinism).
- **Merge** (when growth links two pieces of the same mold): the pools are added together, and
  the merged piece keeps the lower id.
- **Orphan**: no sources ⇒ every cell loses `orphanDecay · dt` biomass per tick, and the piece
  dies off cell by cell (FR-013).

## GrowthTarget / Tip

| Field | Type | Notes |
|---|---|---|
| `id` | int | unique per round |
| `moldId` | int | |
| `cell` | cell index | after snapping (R5) |
| `path` | cell index[] | A* result from the attach cell; recomputed on invalidation |
| `progress` | float | nutrients accumulated toward the next cell |
| `createdTick` | int | the oldest target is replaced when a 4th is added |
| `state` | `'growing' \| 'starved' \| 'blocked' \| 'arrived'` | |

**State transitions**
```
growing ──(no delivery for 1 s)──▶ starved ──(delivery resumes)──▶ growing
growing ──(path invalid, re-path fails)──▶ blocked ──(re-path on next flow tick succeeds)──▶ growing
growing ──(tip reaches target cell)──▶ arrived ──▶ (removed)
any ──(CancelTarget command / mold eliminated)──▶ (removed)
```
`starved` drives the HUD "growth is starved" indicator (US1 scenario 3).

## FoodSource

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `type` | `FoodType` | see below |
| `cells` | cell index[] | footprint; each cell holds part of the food |
| `total`, `remaining` | float | `remaining = Σ food[cells]` |
| `origin` | `'initial' \| 'drop'` | |

**FoodType** (FR-018; values tunable):

| Type | Footprint (cells) | Nutrients | Absorb rate / cell / s | Notes |
|---|---|---|---|---|
| `oatFlake` | 2×2 | 40 | 2.0 | the common starting food |
| `breadCrumb` | 3×3 | 120 | 1.5 | drop |
| `sugarCube` | 4×4 | 300 | 3.0 | drop; fast and rich |
| `fruitSlice` | 6×4 | 500 | 1.0 | drop; large and slow |

**Absorption** (FR-007): each tick, for each food cell owned by mold *m*, transfer
`min(food[i], absorbRate·dt)` from `food[i]` into that cell's component pool. A food cell's
owner is whoever holds the cell, so contested food is split by coverage (US3 scenario 2).
When `remaining = 0`, the source is removed (event: `FoodDepleted`).

## DropEvent

| Field | Type | Notes |
|---|---|---|
| `id` | int | |
| `type` | `FoodType` | weighted pick from the `drops` stream |
| `cell` | cell index | top-left of the footprint; it must fit on non-obstacle terrain |
| `warnTick`, `landTick` | int | `landTick − warnTick` = `dropWarning` (5 s) |
| `state` | `'scheduled' \| 'warning' \| 'landed'` | |

**State transitions**
```
scheduled ──(tick ≥ warnTick)──▶ warning (globally visible, FR-031)
warning ──(tick ≥ landTick)──▶ landed ──▶ spawns FoodSource(origin='drop')
```
The next drop is scheduled when the previous one enters `warning`, at an interval of
`dropInterval ± dropJitter`. If a drop lands on owned cells, those cells begin absorbing at once
(edge case).

## BattleFront (derived, not stored)

Recomputed each tick from contact pairs: for each pair of molds (X, Y), the list of X's cells
that are 8-adjacent to a Y cell, and the reverse. Exposed to render (sparks), the HUD (number
of active fronts), and the AI view (only the visible part). The `pressure` per front cell is a
transient `Float32Array[cells]` that the flow solve writes (R4, R6).

## Round

| Field | Type | Notes |
|---|---|---|
| `number` | int ≥ 1 | |
| `seed` | uint32 | derived: `hash(runSeed, number)` |
| `difficulty` | `DifficultyProfile` | from `difficultyFor(number)` |
| `world` | `World` | |
| `elapsedTicks` | int | |
| `outcome` | `'playing' \| 'victory' \| 'defeat'` | |
| `victoryReason` | `'eliminated-all' \| 'map-control'?` | FR-022 |

**Checks** (every 10 ticks): victory if every rival is eliminated, or if the player's
`mapControl ≥ victoryControl` (0.75). Defeat if the player is eliminated. When both happen in
the same tick, defeat wins (it's checked first; decided here for determinism).

## Run

| Field | Type | Notes |
|---|---|---|
| `runSeed` | uint32 | `Date.now()` or `?seed=` (R11) |
| `round` | `Round` | current |
| `state` | see below | |
| `bestRound` | int | loaded from and saved to storage (R17) |

**State transitions** (FR-023, FR-029)
```
title ──start──▶ playing(round 1)
playing ⇄ paused            (Space / auto-pause on blur, FR-025/027)
playing ──victory──▶ roundEnd(victory) ──next──▶ playing(round n+1)
playing ──defeat──▶  roundEnd(defeat)  ──new run──▶ playing(round 1, new runSeed)
roundEnd(*) ──quit──▶ title
```
`bestRound` is updated when a round is won: `bestRound = max(bestRound, number)`.
The round-end screen shows elapsed time, peak size, nutrients gathered, rivals eliminated,
and the seed.

## DifficultyProfile

| Field | Type | Round 1 → cap (R14) |
|---|---|---|
| `rivalCount` | int | 1 → 5 |
| `mapWidth`, `mapHeight` | int | 160×120 → 320×240 |
| `foodDensity` | float | 1.0 → 0.5 |
| `rivalAggression` | float | 0.2 → 0.9 |
| `rivalStartNutrients` | float | base × (1 + 0.1(n−1)) |
| `aiThinkInterval` | seconds | 1.4 → 0.8 |
| `dropInterval` | seconds | 35 (constant) |

**Validation**: For all n in 1..50, `profile(n+1)` is at least as hard as `profile(n)` in every
field, and strictly harder in at least one (unit test).

## Command

The only way to change a mold's intent, for the player and AI alike. Schema in
[contracts/commands.md](contracts/commands.md).

## ReplayLog

| Field | Type |
|---|---|
| `runSeed` | uint32 |
| `roundNumber` | int |
| `entries` | `{ tick: int, cmd: Command }[]` |
| `finalHash` | uint32 |

Used by the determinism tests (SC-006) and for bug reports (debug menu "copy replay").
