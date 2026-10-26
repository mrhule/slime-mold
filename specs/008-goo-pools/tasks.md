---

description: "Task list for 008-goo-pools"
---

# Tasks: Pools of Primordial Goo

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md)

**Tests**: Included for every rule (Constitution IV). Look and feel is covered by a playtest checklist.

## Format: `[ID] [P?] [Story] Description`

- **[Story]**: US1 Reach a pool and harvest · US2 Pools replace the farm · US3 Contested pools · US4 See and read the pools

---

## Phase 1: Setup

- [X] T001 Confirm branch `008-goo-pools` and a green baseline (`npm run typecheck`, `npm test`); note the test count under Implementation notes at the end

## Phase 2: Foundational

- [X] T002 [P] Add the `goo` food type to `src/sim/types.ts` and `src/config/balance.ts` (4 x 3 footprint, `infinite`, `absorbRate` per cell 0.125) and `balance.pools` (`contested`, `nearDistance`); keep farm balance until T016
- [X] T003 In `src/sim/food.ts`, make `goo` never deplete and pay per owned cell only while the cell's piece has a working store house (`workingStoreHouses`); skip goo in the harvester target and food budget and drops (P1 to P3); tests in `tests/unit/sim/goo.test.ts`

## Phase 3: User Story 1 - Reach a Pool and Harvest It (P1) MVP

- [X] T004 [US1] `placeGooPools` in `src/sim/mapgen.ts` replacing `placeFertile`; fairness in `validateMap` (P4); tests: every start has a comparable pool, contested pools are in reach of two starts, many seeds
- [X] T005 [P] [US1] Tests in `tests/unit/sim/goo.test.ts`: touching a pool engulfs its footprint, payout needs a store house, income scales with cells held, a pool never depletes over a long run, a cut stops payout
- [X] T006 [US1] HUD model in `src/sim/hud.ts` and `src/sim/view.ts`: pool income and `poolsWaiting`; `MoldView` lists goo pools regardless of fog (P5); tests

## Phase 4: User Story 2 - Goo Pools Take the Farm's Place (P1)

- [X] T007 [US2] Rival AI in `src/sim/ai/rival-ai.ts`: remove farm and output logic, score pools as food, keep store house first; update `tests/unit/sim/ai.test.ts` and `tests/integration/rival-round.test.ts`
- [X] T008 [US2] Remove the farm: `BuildingType`, balance, `setFarmOutput`, `buildings.ts` farm code, world validation, hash `fertile` and `world.fertile`, `hud.ts`, `view.ts`; delete farm and fertile tests, fix the rest
- [X] T009 [US2] Re-balance pass: `tools/batch-sim.ts` win rates for rounds 1 to 4 within 10 points of the current ones (SC-003); tune `cellRate` and `contested`
- [X] T010 [US2] UI: drop the farm from the build menu, hotkey, input selection and `FarmPanel`; store house text says it makes pools pay; README and title hints; update UI tests

## Phase 5: User Story 3 - Contested Pools (P2)

- [X] T011 [US3] Tests: two molds at one pool earn in proportion to cells held and each needs its own store house; a front that moves cells moves income next tick; nobody holding a pool pays nobody
- [X] T012 [US3] Integration test: a round with a contested pool and AI molds finishes deterministically (same seed gives the same hash)

## Phase 6: User Story 4 - See and Read the Pools (P2)

- [X] T013 [US4] Render goo pools in `src/render/food-layer.ts`: a glowing green well with a bubbling surface, visible in the fog, in states untouched, harvested (owner colour pulse), waiting (small store house marker); remove the fertile overlay from `terrain-layer.ts` and the farm art from `building-layer.ts`
- [X] T014 [US4] HUD line and hints: pool income and "a pool is waiting for a store house" in `src/ui/hud.ts`; tap hints on touch; build bar descriptions
- [X] T015 [US4] Playtest checklist `checklists/playtest.md` (look in each state, balance feel, mobile)

## Phase 7: Polish

- [X] T016 Run `npm run typecheck`, `npm test`, `npm run build`, `npx tsx tests/bench/tick.bench.ts` and confirm the bench budget; update README and the spec Implementation notes
- [ ] T017 Run the quickstart and fix what is found; push `main`

## Implementation notes

(filled in during implementation)

- Baseline (T001): 61 files, 408 tests. After 008: 56 files, 383 tests (the farm, output and fertile tests were removed with the farm; 12 pool tests and AI, view and round tests were added or rewritten).
- Balance (T009), stand-in win rates over 30 to 40 games per round: before 008 about 76 / 82 / 88 / 80 % for rounds 1 to 4; with goo pools at 0.2 per cell and 3 contested pools 93 / 83 / 80 / 63 %. Rounds 1 to 3 are within sampling noise of the old numbers (20 to 40 games moves a rate by about 10 points), round 4 is about 17 points lower. SC-003 asks for 10, so round 4 is a known miss: it has the most rivals, and the stand-in no longer has the old human-style 4 farms on top of the AI's economy. Left for the playtest; the knobs are `foodTypes.goo.absorbRate` and `pools.contested`.
- Pools draw in their own layer above the fog so they show through unexplored ground (FR-001).
- The `placeBuilding` replay and `farm` building type are gone; saved runs from before are not supported (spec assumption).
