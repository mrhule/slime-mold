---

description: "Task list for 002-buildings"
---

# Tasks: Buildings — Nutrient Farms, Booster Factories, Harvesters

**Input**: Design documents from `/specs/002-buildings/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included (Constitution IV): headless tests for every rule, plus a playtest checklist.

**Organization**: Grouped by user story. **This round implements Phases 1–2 and User Story 1 (the
nutrient farm).** US2–US4 are listed in order so the shape of the feature is clear; they are
detailed further when started, and US2 and US4 wait for the combat and rival stories of 001.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 Nutrient Farm · US2 Booster Factory · US3 Harvester · US4 Rivals Build
- References like (B3) point to [research.md](research.md); FR/SC IDs point to [spec.md](spec.md)

---

## Phase 1: Setup

**Purpose**: Point the tooling at this feature

- [X] T001 Create branch `002-buildings` from `001-core-game-loop` and set `.specify/feature.json` to `specs/002-buildings`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The building system every building type uses

**⚠️ CRITICAL**: No story work can begin until this phase is complete

- [ ] T002 Add the buildings table to `src/config/balance.ts` (`BalanceConfig.buildings` with `farm: { cost: 30, upkeep: 0.1, limit: 6, income: 0.5 }`) and the same fields to `specs/002-buildings/` data model notes if values change
- [ ] T003 Extend `src/sim/types.ts`: `BuildingType = 'farm'`, `Building` (`id`, `type`, `moldId`, `cell`, `placedTick`, `destroyed`), `World.buildings` and `World.buildingAt`, the `placeBuilding` command, the `buildingPlaced` and `buildingDestroyed` events, and the `BuildOption` and HUD fields from contracts/sim-api.md
- [ ] T004 Add `buildings: []` and `buildingAt` (`Int16Array`, filled with -1) to `createWorld` in `src/sim/world.ts`, and extend `assertInvariants`: "every live building's cell is owned by its owner and points back at it through `buildingAt`; no two live buildings share a cell; destroyed buildings have `buildingAt === -1` on their cell"
- [ ] T005 Hash `buildings` and `buildingAt` in `src/sim/hash.ts`
- [ ] T006 Destroy a cell's building when the cell is removed in `src/sim/network.ts` (`removeCell`): set `destroyed`, clear `buildingAt`, emit `buildingDestroyed`, no refund (FR-005)

**Checkpoint**: The world can hold buildings, hash them, and lose them with their cell

---

## Phase 3: User Story 1 - Place a Nutrient Farm (Priority: P1) 🎯 MVP

**Goal**: A player can place a farm on their mold; it costs nutrients, pays steady income, costs upkeep, keeps a cut-off piece alive, and is lost with its cell

**Independent Test**: In a round with no rivals and no food nearby, place a farm, confirm income rises and the farm pays back its cost, and that the mold can keep growing on that income (quickstart scenarios 1–8)

### Tests for User Story 1 ⚠️

> Write these first and confirm they fail before implementing

- [ ] T007 [P] [US1] Placement tests in `tests/unit/sim/buildings.test.ts`: every reason from data-model.md in order (`unknown-building`, `mold-eliminated`, `out-of-bounds`, `not-your-cell`, `occupied`, `on-food`, `limit-reached`, `cant-afford`); cost deducted from the pool of the piece holding the cell, not another piece; a refused placement changes nothing; the 7th farm is refused with `limit-reached`; two orders for one cell in a tick: first wins, second `occupied`; `placeBuilding` is recorded in the replay log
- [ ] T008 [P] [US1] Farm economy tests in `tests/unit/sim/farm.test.ts`: income per tick equals `income * dt`; upkeep is charged on top of per-cell upkeep; a piece holding a working farm is not `orphaned` when cut off; the farm is destroyed with its cell with no refund; starvation spares building cells while another leaf exists; the net income readout includes farm income and upkeep
- [ ] T009 [P] [US1] Integration test in `tests/integration/farm-economy.test.ts`: with no food in reach, a mold with a farm keeps growing where one without cannot; two runs with the same seed and commands (including `placeBuilding`) end with equal `stateHash`; replaying the log reproduces the hash

### Implementation for User Story 1

- [ ] T010 [US1] Implement `canPlace` and `placeBuilding` in `src/sim/buildings.ts` per data-model.md and contracts/commands.md (B4, B5, B6); export `canPlace` from `src/sim/index.ts`
- [ ] T011 [US1] Handle `placeBuilding` in `src/sim/commands.ts`: call `placeBuilding`, emit `commandRejected { reason, cell }` on failure
- [ ] T012 [US1] Make working farms sources in `src/sim/network.ts` (`refreshSources`), add their income each tick in `src/sim/step.ts` (`tickIncome`, counted into the mold's income), and return the farm income from `sourceRate` in `src/sim/flow.ts` (B3)
- [ ] T013 [US1] Charge building upkeep in `src/sim/upkeep.ts` (added to the piece's due upkeep and into `upkeepTick`) and make starvation prefer building-free leaves (data-model.md, Component and source rules)
- [ ] T014 [US1] Fill `build` and `buildingIncome` in `readHud` in `src/sim/hud.ts`
- [ ] T015 [P] [US1] Building layer: inked farm (outlined round planter with three sprouting mushroom caps, flat two-band shading, hard shadow), redrawn only when the set of buildings changes, in `src/render/building-layer.ts`; add it to `src/render/renderer.ts` between veins and fx
- [ ] T016 [P] [US1] Placement ghost in `src/render/fx-layer.ts`: follows the hovered cell, green ink outline when valid, red when not
- [ ] T017 [P] [US1] Build bar in `src/ui/buildbar.ts` and `src/ui/styles.css`: comic buttons with a farm shape icon, name, cost, `count/limit`, grayed when unaffordable with a tooltip, hotkey hint; plus a small cursor tooltip showing the invalid reason in plain words
- [ ] T018 [US1] Placement mode in `src/ui/input.ts` per contracts/controls.md: hotkey `1` or a button click enters it, left-click sends `placeBuilding` (Shift keeps the mode), `Esc` or right-click cancels, and left-click does not set growth targets while in the mode
- [ ] T019 [US1] Wire the build bar, ghost, hovered-cell preview (via `canPlace`), building layer, and toasts for refused placements in `src/main.ts`
- [ ] T020 [US1] Playtest quickstart scenarios 1–8 and record the results in `specs/002-buildings/checklists/playtest.md` (US1 section)

**Checkpoint**: A farm can be placed, pays out, and behaves per the spec; all US1 tests pass

---

## Phase 4: User Story 2 - Booster Factory (Priority: P2)

*Waits for 001's combat story (fronts and pressure). Detail when started.*

- [ ] T021 [US2] Widen `BuildingType` and the balance table with the booster (cost, upkeep, limit, radius, pressure and toughness multipliers, stack cap), per FR-010 (combat only) and FR-012
- [ ] T022 [P] [US2] Tests: area membership, combat bonus at covered fronts only, bonus stops when upkeep is unpaid, capped stacking, bonus ends when the factory cell is destroyed
- [ ] T023 [US2] Apply the bonus where front pressure and cell damage are computed in `src/sim/combat.ts`, with the area from `src/sim/buildings.ts`
- [ ] T024 [P] [US2] Booster drawing, area ring (hand-inked) and build bar entry
- [ ] T025 [US2] Playtest and record results in `specs/002-buildings/checklists/playtest.md` (US2 section)

---

## Phase 5: User Story 3 - Harvester (Priority: P2)

*Needs food sizes from 001. Detail when started.*

- [ ] T026 [US3] Widen the building type and balance table with the harvester (cost, upkeep, limit, minimum food size, rate multiplier), per FR-014 to FR-016
- [ ] T027 [P] [US3] Tests: placement only on a cell touching large enough food, rate multiplier applies to the owner's cells only, totals unchanged, idle once the food is used up
- [ ] T028 [US3] Apply the multiplier in `src/sim/food.ts` (`tickFood`) and allow harvesters on food-adjacent cells in `canPlace`
- [ ] T029 [P] [US3] Harvester drawing, idle look, and build bar entry
- [ ] T030 [US3] Playtest and record results in `specs/002-buildings/checklists/playtest.md` (US3 section)

---

## Phase 6: User Story 4 - Rivals Build Too (Priority: P3)

*Waits for 001's rival AI. Detail when started.*

- [ ] T031 [US4] Let the rival AI choose and place buildings through `placeBuilding` using its `MoldView` only, with difficulty changing only how early and how often (FR-019)
- [ ] T032 [P] [US4] Tests: same costs and limits, no hidden information, enemy buildings shown as last-known when out of vision
- [ ] T033 [US4] Playtest and record results in `specs/002-buildings/checklists/playtest.md` (US4 section)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T034 Balance pass for farm numbers with the batch sim from 001 (payback time, SC-002; limit and upkeep so farms do not dominate)
- [ ] T035 [P] Check the build bar and buildings for readability and keyboard use (shape recognition without color, outline at 0.5x and 3x zoom)
- [ ] T036 Run the full quickstart validation from a fresh clone

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 (US1)**. Nothing in US1 can start before the foundation is done.
- **US2** needs 001's combat (fronts, pressure). **US3** needs 001's food sizes and can follow the
  farm directly. **US4** needs 001's rival AI.
- Within US1: tests T007–T009 first (fail), then sim T010–T014 in order, then render and UI
  T015–T017 in parallel, then T018 and T019, then the playtest T020.

### Parallel Opportunities

- Tests T007, T008, T009 together.
- Render and UI tasks T015, T016, T017 together once T014 is done.

---

## Implementation Strategy

1. Phases 1–2: the building system, with nothing visible yet.
2. Phase 3 US1: the farm, end to end. **Stop and playtest**: does it make growth without food feel
   possible without making farms the obvious best move?
3. Then continue 001 (pause, HUD, rivals and combat), and return for US2–US4 as their
   prerequisites land.

## Notes

- Never use `Math.random`, `Math.pow`, `Math.exp`, or trig in `src/sim/**`.
- Balance numbers live in `src/config/balance.ts` only.
- Commit after each task or logical group.
