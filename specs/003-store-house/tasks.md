---

description: "Task list for 003-store-house"
---

# Tasks: Store House, Fertile Ground, and Farm Output

**Input**: Design documents from `/specs/003-store-house/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included (Constitution IV): headless tests for every rule, plus a playtest checklist.

**Organization**: Grouped by user story. US1 and US2 are both P1 and ship together in practice
(farms stop paying without a Store House as soon as US2 lands), so the **MVP is Phases 1–4**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 Store House and caps · US2 Fertile ground and linked farms · US3 Output dial ·
  US4 Boost · US5 Rivals
- References like (S5) point to [research.md](research.md); FR/SC IDs point to [spec.md](spec.md)

---

## Phase 1: Setup

**Purpose**: Confirm the starting point

- [X] T001 Confirm branch `003-store-house`, `.specify/feature.json` pointing at `specs/003-store-house`, and a green baseline (`npm run typecheck`, `npm test`); note the test count in `specs/003-store-house/tasks.md` under Implementation notes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, config, world storage, and the shared vein cover every story uses

**⚠️ CRITICAL**: No story work can begin until this phase is complete

- [X] T002 Add to `src/config/balance.ts`: `pool: { baseCap: 120 }`; `buildings.storehouse: { cost: 40, upkeep: 0.2, limit: 4, capacity: 180, perPiece: 3, reach: 20, bonus: 0.5, stackCap: 1.0, drain: 0.5, lowStock: 15 }`; `buildings.farm` gains `defaultLevel: 4, levelStep: 0.25, maxLevel: 6`; `fertile: { nearPatches: 2, nearRadius: 18, patchMin: 2, patchMax: 4, contested: 1, minNear: 24 }`; extend `BalanceConfig`, `StoreHouseSpec`, and `FarmSpec` types accordingly
- [X] T003 Extend `src/sim/types.ts`: `BuildingType` adds `'storehouse'` with `BUILDING_CODE.storehouse = 4` and `BUILDING_OF_CODE[4]`; `Building.level` (integer 0–6, farms only, default `farm.defaultLevel`); `World.fertile: Uint8Array`, `World.supply: Float32Array`, `World.supplyActive: boolean`; `Command` adds `{ type: 'setFarmOutput'; mold; building; level }`; `PlaceReason` adds `'not-fertile'`; `SimEvent` adds `farmLinkChanged`, `storeFull`, `capLost` (data-model.md)
- [X] T004 Add `fertile` (`Uint8Array`, zeros), `supply` (`Float32Array`, filled with 1) and `supplyActive: false` to `createWorld` in `src/sim/world.ts`; extend `assertInvariants`: "fertile cells are never Obstacle or Wall; every farm's level is an integer 0–6; every farm stands on a fertile cell; after `clampPools` no pool exceeds its cap by more than 1e-6"
- [X] T005 [P] Hash `fertile`, each building's `level`, and `supply` in `src/sim/hash.ts`
- [X] T006 Generalize `boosterCover` in `src/sim/buildings.ts` into `veinCover(world, start, reach, bonus)` (BFS over `world.edges`, linear taper `bonus × (1 − d/reach)`); keep `boosterCover` as a thin wrapper and export both from `src/sim/index.ts`; the existing `tests/unit/sim/booster.test.ts` must still pass unchanged
- [X] T007 [P] Extend `tests/helpers.ts`: `createOpenWorld(..., { fertile })` option that marks every open cell fertile, and a `withStoreHouse(world, moldId, cell)` helper that places a Store House bypassing cost, so later tests stay short
- [X] T008 [P] Export `capOf`, `farmLinked`, `farmOutput`, `storeCover`, `placePreview` stubs from `src/sim/index.ts` (filled in by their stories) so render and UI code can be written against the contract in contracts/sim-api.md

**Checkpoint**: The world can hold fertile ground, levels and a supply layer, and `veinCover` is shared

---

## Phase 3: User Story 1 - Store House and Caps (Priority: P1) 🎯 MVP

**Goal**: Pools have a cap; a Store House raises it; the player can place one and sees stock against cap

**Independent Test**: Fill a piece to its base cap and confirm extra income is lost; place a Store House and confirm the cap and stock can rise past the old limit (quickstart scenario 1)

### Tests for User Story 1 ⚠️

> Write these first and confirm they fail before implementing

- [X] T009 [P] [US1] `tests/unit/sim/store-house.test.ts`: cap is `pool.baseCap + capacity × min(workingStoreHouses, perPiece)` (S2/S3); placing one raises the cap and costs `storehouse.cost`; a third and fourth in one piece stop adding capacity past `perPiece`; a Store House in an `unpaid` piece adds nothing; destroying it drops the cap and cuts stock above the new cap, emitting `capLost`; a cut-off piece keeps its own stock and cap; income that would push a pool above its cap is discarded; merging two pieces clamps the sum to the merged cap
- [X] T010 [P] [US1] Extend `tests/unit/sim/commands.test.ts`: `placeBuilding` with `storehouse` follows the 002 rules (not-your-cell, occupied, on-food, limit-reached, cant-afford) and is refused with no cost on failure
- [X] T011 [P] [US1] Extend `tests/unit/sim/hash.test.ts`: two worlds differing only in a Store House differ in hash; the same commands replay to the same hash

### Implementation for User Story 1

- [X] T012 [US1] In `src/sim/buildings.ts`: add `workingStoreHouses(world, comp)`, `capOf(world, comp)` (formula in data-model.md), `canPlace`/`placeBuilding` support for `storehouse` (no extra rule), and `clampPools(world)` that cuts every pool to its cap, emitting `storeFull` once on reaching it and `capLost` when a cap fall removes stock
- [X] T013 [US1] Call `clampPools` at the end of `step` in `src/sim/step.ts` (after `decayOrphans`, before `settleNetIncome`) and right after a building is destroyed in `src/sim/network.ts` (S2)
- [X] T014 [US1] Extend `src/sim/hud.ts` with `stock { total, cap, full }` and the `storehouse` build option; extend `HudModel` in `src/sim/types.ts`
- [X] T015 [P] [US1] Draw the Store House in `src/render/building-layer.ts` (`drawStoreHouse`: squat inked barn with a round tank, readable in grayscale, distinct from farm, booster and harvester) and add it to `drawBuilding`
- [X] T016 [US1] Add the Store House button (icon, name "Store House", tooltip, hotkey `T`) to `src/ui/buildbar.ts` and handle `t` in `src/ui/input.ts`
- [X] T017 [US1] Show `stock / cap` with a **FULL** tag in `src/ui/hud.ts`; add a "Stock lost" toast on `capLost` in `src/ui/messages.ts`; show the piece's cap before and after in the placement ghost via `placePreview` (`src/sim/buildings.ts`, `src/render/fx-layer.ts`)
- [X] T018 [US1] Playtest checklist `specs/003-store-house/checklists/playtest.md` (US1 section): the cap text is understood without explanation, FULL is noticed, `T` places a Store House, losing one costs stock visibly

**Checkpoint**: Stock has a cap and a Store House raises it. Farms still pay without one until US2.

---

## Phase 4: User Story 2 - Fertile Ground and Linked Farms (Priority: P1)

**Goal**: Fertile terrain on generated maps; farms only on it; farms pay only with a Store House in their piece; farms throttle at the cap

**Independent Test**: A farm with no Store House pays nothing and shows as unlinked; adding a Store House makes it pay; at the cap it slows and resumes (quickstart scenarios 2–3)

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] `tests/unit/sim/fertile.test.ts`: over 500 seeds and rival counts 1–5, every start has at least `fertile.minNear` fertile cells within `fairRadius`, richest-to-poorest within `fairTolerance`; fertile cells are only Open or Rough; the contested patches sit away from every start; same seed gives the same layer
- [X] T020 [P] [US2] `tests/unit/sim/farm.test.ts` (update) and `tests/unit/sim/farm-link.test.ts` (new): `canPlace('farm', …)` returns `not-fertile` off fertile ground; an unlinked farm pays 0 and emits no income; a linked farm pays `farm.income` at any vein distance in the same piece; cutting the vein between them unlinks it and emits `farmLinkChanged`; destroying the Store House unlinks all its farms at once; a piece whose only source is an unlinked farm is not orphaned (FR-014)
- [X] T021 [P] [US2] `tests/unit/sim/farm-throttle.test.ts`: with the pool at the cap a linked farm pays 0; with headroom smaller than one tick's output it pays exactly the headroom; the pool never exceeds the cap; upkeep is unchanged while throttled (S5)
- [X] T022 [US2] Update `tests/integration/farm-economy.test.ts`, `tests/unit/sim/buildings.test.ts` and any other test that places a farm: use fertile ground and a Store House; confirm they pass

### Implementation for User Story 2

- [X] T023 [US2] In `src/sim/mapgen.ts`: after terrain, starts and food, place `fertile.nearPatches` blobs per start (radius `patchMin`–`patchMax`, noise-warped edge, Open/Rough cells within `fertile.nearRadius` path distance) and `fertile.contested` patches (+1 per two rivals) at cells farthest from every start, drawing only from the map-generation stream; extend `validateMap` with the `minNear` and fairness checks (S9)
- [X] T024 [US2] In `src/sim/buildings.ts`: `canPlace('farm', …)` returns `not-fertile` when `world.fertile[cell] === 0` (placed in PlaceReason order after `on-food`); add `farmLinked(world, building)` and `farmOutput(world, building)` (0 when unlinked; level handling arrives in US3, use the default level until then); emit `farmLinkChanged` when a farm's state flips
- [X] T025 [US2] Rewrite `tickBuildings` in `src/sim/buildings.ts`: per piece, `desired = Σ output × dt`, `scale = min(1, headroom / desired)`, each farm pays `output × dt × scale` (S5); update `buildingIncome` to the sum of current outputs
- [X] T026 [US2] Make `sourceRate` in `src/sim/flow.ts` use `farmOutput`; keep farm cells in `comp.sources` regardless of link (S4)
- [X] T027 [P] [US2] Bake fertile ground in `src/render/terrain-layer.ts`: generalize `occupancy` to take a predicate, add a flat green-brown wash with a soft inked edge and short ink tufts over fertile cells (S10); verify it reads in grayscale and differs from rough ground by shape
- [X] T028 [P] [US2] Draw an unlinked marker above unlinked farms and dim parked ones in `src/render/building-layer.ts`; farm ghost shows valid only on fertile ground and a "No store house on this vein" badge in `src/render/fx-layer.ts`
- [X] T029 [US2] HUD and messages: `farms { total, linked, unlinked }` in `src/sim/hud.ts`; amber "N farms unlinked" line in `src/ui/hud.ts` that highlights the Store House button; reason texts `not-fertile` ("Farms need fertile ground") in `src/ui/messages.ts`
- [X] T030 [US2] Update the farm proxy in `tools/batch-sim.ts` to place a Store House first and then farms on fertile cells in the same piece; run `npm run sim:batch -- --rounds 1-3 --games 20` and record the result in Implementation notes
- [X] T031 [US2] Playtest checklist (US2 section): fertile ground readable in fog and grayscale; the unlinked warning is noticed within a few seconds; the first linked farm is affordable within about two minutes on round 1

**Checkpoint**: MVP. A mold needs storage and fertile ground to farm; the economy works end to end.

---

## Phase 5: User Story 3 - Dial a Farm's Output (Priority: P2)

**Goal**: Each farm has a level 0–6 that scales income and upkeep with diminishing returns, set by command and by a small panel

**Independent Test**: Change a farm's level and see income and upkeep change together; at level 0 it pays and costs nothing (quickstart scenario 4)

### Tests for User Story 3 ⚠️

- [X] T032 [P] [US3] `tests/unit/sim/farm-output.test.ts`: with `o = level × 0.25`, income is `farm.income × o × (1.5 − 0.5 × o)` and upkeep is `farm.upkeep × o`; level 4 equals the 002 values; income per upkeep falls as the level rises; level 0 pays nothing, costs no upkeep, and the farm still counts as a source of supply; levels are integers 0–6
- [X] T033 [P] [US3] Extend `tests/unit/sim/commands.test.ts`: `setFarmOutput` is accepted for an own farm (also while paused) and rejected with `unknown-building`, `not-your-building`, `not-a-farm`, `bad-level` (non-integer, below 0, above 6) or `mold-eliminated`; a rejected command changes nothing and emits `commandRejected`
- [X] T034 [P] [US3] Extend `tests/unit/sim/hash.test.ts` (or `determinism.test.ts`): a round with `setFarmOutput` commands replays to the same hash

### Implementation for User Story 3

- [X] T035 [US3] Handle `setFarmOutput` in `src/sim/commands.ts` and validate per contracts/commands.md; set `Building.level` and default it in `placeBuilding`
- [X] T036 [US3] Make `farmOutput` use the curve and make `buildingUpkeep` in `src/sim/buildings.ts` use `farm.upkeep × o`; `src/sim/upkeep.ts` already reads `buildingUpkeep`
- [X] T037 [US3] Selection and panel: in `src/ui/input.ts` a click on an own farm (outside placement mode) selects it instead of setting a target; `[` / `]` change the level; `Esc` or a click elsewhere deselects; in `src/ui/hud.ts` (or a new `src/ui/farm-panel.ts`) draw the comic panel with level pips, `−` / `+`, income, upkeep, and status text (`Working`, `Unlinked`, `Throttled`, `Parked`) (contracts/controls.md)
- [X] T038 [P] [US3] Add reason texts for the new rejections to `src/ui/messages.ts`
- [X] T039 [US3] Playtest checklist (US3 section): the panel is usable with the keyboard alone; clicking a farm never sets a stray target; the status line matches what the farm does

---

## Phase 6: User Story 4 - Store House Boosts Growth and Harvest (Priority: P2)

**Goal**: A working Store House speeds up tips and harvesters on its vein, tapering with vein distance, at a stock drain, never touching combat

**Independent Test**: A tip near a Store House grows faster than without one, less so further along the vein; a harvester absorbs faster; the drain stops when idle or low (quickstart scenario 5)

### Tests for User Story 4 ⚠️

- [X] T040 [P] [US4] `tests/unit/sim/store-boost.test.ts`: `world.supply` is `1 + bonus × (1 − d/reach)` along the vein and 1 elsewhere (other pieces, other molds, off-vein); overlapping Store Houses stack and `supply` never exceeds `1 + stackCap`; a non-working Store House (unpaid piece or `pool < lowStock`) adds nothing; resumes at `lowStock × 1.25` (no flicker)
- [X] T041 [P] [US4] Extend `tests/unit/sim/growth.test.ts`: a tip with `supply[head] = 1.5` converts a grant into 1.5× the progress; the grant is still paid from the pool; combat strength and farm output are unaffected by the boost
- [X] T042 [P] [US4] Extend `tests/unit/sim/harvester.test.ts`: a boosted harvester absorbs `base × rateMult × supply[cell]` per tick and the item's total nutrients are unchanged; an unboosted item is unaffected
- [X] T043 [P] [US4] `tests/unit/sim/store-boost.test.ts` (drain section): each working Store House drains `storehouse.drain` per second from its piece only while some tip head or harvester-owned food cell in that piece has `supply > 1`; no drain when nothing is boosted; the pool never goes below 0

### Implementation for User Story 4

- [X] T044 [US4] In `src/sim/buildings.ts`: `storeCover(world, startCell)` via `veinCover`, `recomputeSupply(world)` (working Store Houses summed into `world.supply`, capped at `1 + stackCap`, `supplyActive`), called at flow cadence, on place, on destroy, and on pay-state change; the `lowStock` hysteresis (S3, S8)
- [X] T045 [US4] Multiply tip progress by `world.supply[head]` in `advanceTip` in `src/sim/growth.ts`; multiply harvester absorption by `world.supply[cell]` in `src/sim/food.ts` (S8)
- [X] T046 [US4] Add the drain to `tickBuildings`: per piece, `drain × (working Store Houses)` per second while a boosted consumer exists in it (S8)
- [X] T047 [P] [US4] Draw the boost glow along the covered vein in `src/render/building-layer.ts` (reuse `drawBoosterCover`, owner's color, only where the Store House is visible) and in the Store House placement ghost in `src/render/fx-layer.ts`
- [X] T048 [US4] Playtest checklist (US4 section): the glow reads as "boosted vein", tips visibly speed up near the Store House, the stock drain is understood from the HUD

---

## Phase 7: User Story 5 - Rivals Use Storage, Fertile Ground and Dials (Priority: P3)

**Goal**: Rivals place Store Houses and farms on fertile ground and manage output, through the same commands and `MoldView`

**Independent Test**: A rival round with the event log shows only legal placements; the player sees rival buildings only when in view (quickstart scenario 6)

### Tests for User Story 5 ⚠️

- [X] T049 [P] [US5] Extend `tests/unit/sim/view.test.ts`: `fertileAt` is global terrain; `capOf` and `farmLevel` work for own pieces and farms only; nothing about an opponent's caps or levels is exposed; `canBuild('farm', cell)` reflects fertile and cost
- [X] T050 [P] [US5] Extend `tests/unit/sim/ai.test.ts`: with fertile ground in reach and no Store House, the AI builds a Store House first, then farms on fertile cells in a piece that has one; it never issues a placement `canPlace` would refuse; it turns farms down only while net income is negative
- [X] T051 [US5] Extend `tests/integration/rival-round.test.ts`: over several seeds, rivals build Store Houses and linked farms; the round still ends within the time limit and invariants hold

### Implementation for User Story 5

- [X] T052 [US5] Add `fertileAt`, `capOf`, `pieces().cap/linkedFarms`, and `farmLevel` to `MoldView` in `src/sim/view.ts` and `src/sim/types.ts` (contracts/sim-api.md)
- [X] T053 [US5] Extend `planBuild` in `src/sim/ai/rival-ai.ts`: Store House first when fertile sites are in reach and the piece has none; farms on fertile cells of a piece with a Store House; a Store House for capacity when the pool exceeds 80% of the cap; a `setFarmOutput` to level 2 while net income is negative, back to the default when it recovers; `buildReserve` gating unchanged (S12)
- [X] T054 [US5] Extend the difficulty table if needed so harder rounds build the new buildings earlier (`src/sim/difficulty.ts`, `src/config/balance.ts`); no change to costs or limits (spec User Story 5)

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Balance, performance, docs, and a clean-clone check

- [ ] T055 Balance pass with `tools/batch-sim.ts`: tune `storehouse.cost`, `playerStartNutrients`, `pool.baseCap`, `storehouse.drain` and the boost so round 1 is playable before the first Store House, a Store House plus a farm pays back in a sensible time, and the AI stand-in keeps roughly its earlier win rates; record the numbers and the decision in `specs/003-store-house/research.md` (S12)
- [ ] T056 [P] Performance: extend `tests/bench/tick.bench.ts` to place every building at its limit and run the boost; confirm the tick stays inside the 6 ms budget and the terrain bake with the fertile overlay stays under about 1 s on the largest map; record results in Implementation notes
- [ ] T057 [P] Update `README.md` (Store House, fertile ground, farm dial, new keys `T`, `[`, `]`) and the 002 docs where they describe the farm (`specs/002-buildings/spec.md` note that 003 changes farm placement and income)
- [ ] T058 Run every scenario in [quickstart.md](quickstart.md) and complete the playtest checklist; fix what they show
- [ ] T059 Fresh-clone validation: clone, `npm install`, `npm run typecheck`, `npm run build`, `npm test`, `npx tsx tests/bench/tick.bench.ts` all pass

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (blocking) → **US1** → **US2** → **US3**, **US4** (independent of each other after US2) → **US5** → **Polish**.
- US2 depends on US1 (links need Store Houses and caps). US3 and US4 both depend on US2 for linked
  farms and the cover routine from T006; US4 also needs the pool and cap logic of US1. US5 needs
  all of them, because the AI plans with all the rules.
- Within a story, tests come first and must fail before implementation.
- Tasks touching the same file run in order; `[P]` tasks are in different files.

## Parallel opportunities

- Phase 2: T005, T007 and T008 can run together after T003.
- US1: T009, T010 and T011 in parallel; T015 (art) alongside T012–T014.
- US2: T019, T020 and T021 in parallel; T027 and T028 (render) alongside the sim work.
- US3 and US4 can be built in parallel by different sessions once US2 is done (they touch
  different sim files except `buildings.ts`; coordinate there).

## Implementation Strategy

1. **MVP**: Phases 1–4 (setup, foundations, US1, US2). The economy changes in one go: farms need
   fertile ground and a Store House, stock has a cap. Stop and play it; tune the early game.
2. **Increment 2**: US3 (dial), then US4 (boost). Each is playable on its own.
3. **Increment 3**: US5 (rivals), then Phase 8 (balance, performance, docs, fresh clone).

## Implementation notes

- T001 baseline: 221 tests passing before this feature.
- T002/T012 balance: a base cap of 120 stalled the combat and rival-round tests (the spend budget uses the pool), so the first numbers are `pool.baseCap 300` and store house `capacity 300` (perPiece 3). The balance pass (T055) retunes them; research S12 still lists the earlier 120/180.
- T004: the "no pool above its cap" invariant is checked in tests, not in `assertInvariants` (many existing tests set pools by hand); the "farm stands on fertile ground" invariant arrives with T024.
- Build bar order is farm, store house, booster, harvester.

- T008: `farmLinked`, `farmOutput`, `capOf`, `placePreview`, `storeCover`, `veinCover` are exported from `src/sim/index.ts` (`storeCover` is used by US4).
- T024/T036: the output-level curve and level-scaled upkeep were implemented together with the link rule (they share `farmOutput`); US3 still owes the `setFarmOutput` command, the panel, and its tests.
- T023: fertile fairness uses `(1 - 2 x fairTolerance)` of the richest start (a blob is lumpier than food), checked over 300 seeds in `tests/unit/sim/fertile.test.ts`.
- T022: test worlds are fertile by default (`createOpenWorld` option `fertile`, default true); tests that need a farm to pay place a store house with `withStoreHouse`.
- T030 batch-sim, rounds 1-3, 20 games each, AI stand-in (store house first, then farms on fertile ground): win 55% / 75% / 55% (it was 90% / 80% / 80% before this feature). The early game is slower because a store house (40) comes before the first paying farm; the balance pass (T055) retunes cost, start nutrients and cap.
- US2 also pulled forward a minimal rival AI (store house first, then farms on fertile ground) so rival rounds still decide; US5 refines it.

- US3: `setFarmOutput`, `farmIncomeAt`/`farmUpkeepAt`/`pendingFarmLevel` and the farm panel (`src/ui/farm-panel.ts`) are in. Clicking elsewhere on the map deselects the farm and also sets a growth target, as an ordinary click does. Verified in headless Chrome: select, `]` to level 6, `[` down to 0 (parked).

- US4: `recomputeSupply` runs at flow cadence (and on place/destroy) before food and growth; a store house boosts while its piece is paid and stock >= lowStock (back on at 1.25x). Tips multiply the progress of each granted nutrient by `supply[head]`; harvester-owned food absorbs `base x rateMult x supply[cell]`. A per-tick `supplyUse` set (not hashed) records pieces where a boosted tip or harvester did work, and `drainStoreHouses` (after growth) drains `drain`/s per boosting store house there. Rings (not the booster glow) mark the covered vein; a `boosting` flag per building is hashed.

- US5: `MoldView` gained `fertileAt`, `pieceOf`, `farms()`, `farmLevel`, `rules`, and per-piece `cap`/`storeHouses`/`linkedFarms`; nothing about other molds' farms. The AI builds a store house first, then farms on fertile cells of a stocked piece, and a capacity store house when a piece passes 80% of its cap (up to `perPiece`).
- T053 deviation: the plan said turn farms down while net income is negative, but a lower level always earns less than it saves, so the AI turns a linked farm down to level 2 while its piece is full (it pays nothing then but still costs upkeep) and back to the default once the stock is under half the cap.
- T054: no change needed. `rivalBuildReserve` already shrinks each round (`buildReserveBase` minus `buildReserveStep` per round, floored at `buildReserveMin`), so harder rounds build the new buildings earlier through the same gate, with no change to costs or limits.

(more notes as tasks complete)
