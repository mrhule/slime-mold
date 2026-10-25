---

description: "Task list for 001-core-game-loop (Slime Mold RTS)"
---

# Tasks: Core Game Loop — Slime Mold RTS

**Input**: Design documents from `/specs/001-core-game-loop/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution IV requires automated headless tests for every simulation
rule, plus a manual playtest checklist per story. Write each story's sim tests first and
confirm they fail before implementing.

**Organization**: Tasks are grouped by user story. Phases follow the plan's delivery order:
US1 → US5 → US2 (all P1), then US3 → US4 (P2). US5 comes before US2 so pause and the HUD exist
for combat playtesting.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 Grow & Forage · US2 Rivals & Battle Fronts · US3 Food Drops ·
  US4 Generated Maps & Escalation · US5 Time Control & HUD
- References like (R5) point to [research.md](research.md); FR/SC IDs point to [spec.md](spec.md)

## Path Conventions

Single project at the repository root: `src/`, `tests/`, `tools/` (see plan.md Project Structure).
Sim code in `src/sim/**` MUST NOT import `pixi.js`, `src/render`, `src/ui`, or DOM globals.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [X] T001 Create `package.json` with `"type": "module"`, runtime dep `pixi.js@8.22.0`, dev deps `typescript@7.0.2`, `vite@8.3.5`, `vitest@5.0.5`, `tsx`, and scripts `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `bench` (`vitest bench --run`), `sim:batch` (`tsx tools/batch-sim.ts`), then run `npm install`
- [X] T002 Create `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `target`/`lib` ES2022 + DOM, `moduleResolution: "bundler"`, includes `src`, `tests`, `tools`
- [X] T003 [P] Create `vite.config.ts` with the Vitest config: `test.include: ["tests/**/*.test.ts"]`, `benchmark.include: ["tests/bench/**/*.bench.ts"]`, environment `node`
- [X] T004 [P] Create `index.html` with a `#game` canvas host and an `#ui` overlay root, and `src/ui/styles.css` with base layout (full-viewport canvas, absolutely positioned overlay, CSS variables for the palette)
- [X] T005 [P] Create the empty directory skeleton from plan.md (`src/config`, `src/sim/ai`, `src/game`, `src/render/shaders`, `src/ui`, `tests/unit/sim`, `tests/unit/game`, `tests/integration`, `tests/bench`, `tools`), and update `README.md` with the run commands from quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sim core types, determinism primitives, the loop, and the empty render shell that every story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Define all sim types in `src/sim/types.ts` per data-model.md and contracts/sim-api.md: `World`, `Mold`, `Component`, `GrowthTarget` (`state: 'growing' | 'starved' | 'blocked' | 'arrived'`), `FoodSource`, `FoodType` (`'oatFlake' | 'breadCrumb' | 'sugarCube' | 'fruitSlice'`), `DropEvent`, `Command`, `SimEvent`, `HudModel`, `MoldView`, `DifficultyProfile`, `RoundOutcome`, `ReplayLog`; mold ids "`0` = none, `1` = the player, `2..6` = rivals"; terrain "`0` open, `1` rough, `2` obstacle, `3` wall"
- [X] T007 [P] Implement `src/config/balance.ts` exporting a frozen `defaultBalance: BalanceConfig` with every field and default value in contracts/balance-config.md, plus a `balance.difficulty` coefficients group for R14
- [X] T008 [P] Implement splitmix32 + sfc32 and named streams (`mapgen`, `drops`, `ai:<moldId>`, `jitter`) in `src/sim/rng.ts`, with tests in `tests/unit/sim/rng.test.ts` (same seed → same sequence; drawing from one stream doesn't change another; `int(n)`, `float()`, `pick()`, `jitter()` helpers)
- [X] T009 [P] Implement grid helpers in `src/sim/grid.ts` (index ↔ x,y; 8-neighbor offsets; direction bits 0–7; forward-direction mapping E, SE, S, SW → `conductivity[i*4 + k]` so each edge is stored once; octile distance), with tests in `tests/unit/sim/grid.test.ts`
- [X] T010 [P] Implement integer-hash value noise (2 octaves; only `+ − × ÷`, `floor`, no `Math.sin`/`pow`/`exp`) in `src/sim/noise.ts`, with a determinism test in `tests/unit/sim/noise.test.ts`
- [X] T011 Implement `createWorld(width, height, balance)` allocating every typed array from data-model.md World, plus `assertInvariants(world)` checking: "`owner[i] ≠ 0` ⇒ `terrain[i] ∉ {2, 3}`", "An edge bit is set on both endpoints, and both endpoints have the same owner", "`biomass[i] > 0` ⇔ `owner[i] ≠ 0`", in `src/sim/world.ts`
- [X] T012 Implement `stateHash` (FNV-1a over all typed arrays, component pools, mold fields, targets, food, drops, rng state; excludes `events`) and `ReplayLog` recording in `src/sim/hash.ts`, with tests in `tests/unit/sim/hash.test.ts`
- [X] T013 Implement the command queue and `applyCommand` in `src/sim/commands.ts` per contracts/commands.md. For now only `setAllocation` does real work ("`allocation = clamp(value, 0, 1)`, rounded to 0.05 steps"); the other commands validate and emit `commandRejected{reason}`. Every applied command goes to the ReplayLog. Tests go in `tests/unit/sim/commands.test.ts`
- [X] T014 Implement tick orchestration in `src/sim/step.ts` with the cadence table from R10 (every tick / every 5 / every 10 / every 40 ticks) as stubbed system calls, and the public API in `src/sim/index.ts` (`createRound`, `enqueue`, `step`, `stateHash`, `readHud`, `viewFor`, `roundOutcome`, `difficultyFor` stubs) per contracts/sim-api.md
- [X] T015 [P] Write the import-boundary test in `tests/boundaries.test.ts`: fail if any `src/sim/**` file imports `pixi.js`, `src/render`, `src/ui`, `src/game`, or references `window`/`document`/`Math.random`; fail if `src/sim/ai/**` imports anything other than `../types`, `../rng`, and `../view` types
- [X] T016 Implement the fixed-timestep loop in `src/game/loop.ts` (dt 0.05 s, speed 0/1/2/3, at most 8 ticks per frame with excess dropped, a per-frame `SimEvent` buffer that drains every tick's events), with fake-clock tests in `tests/unit/game/loop.test.ts`
- [X] T017 [P] Implement the palette (player warm yellow; rivals Okabe–Ito–derived orange, sky blue, bluish green, vermillion, reddish purple; patterns stripes, dots, rings, cross-hatch, plain) in `src/render/palette.ts` (R18)
- [X] T018 Create the PixiJS v8 app and ordered layer containers (terrain, film, veins, food, fog, fx) in `src/render/renderer.ts`. The renderer takes `Readonly<World>` only
- [X] T019 Implement the camera (pan with WASD, arrows, screen-edge, and middle-drag; wheel zoom 0.5x–3x around the cursor; clamp to map bounds; `H` centers on the core; screen↔cell conversion) in `src/render/camera.ts`
- [X] T020 Bootstrap in `src/main.ts`: create an empty 160×120 world, start the loop, and render the empty layers (verifies the toolchain end to end)
- [X] T021 [P] Scaffold the tick benchmark in `tests/bench/tick.bench.ts` (builds a world at a given size and mold count, times `step()`; real systems are filled in as stories land)

**Checkpoint**: `npm test`, `npm run typecheck`, `npm run dev` all work. An empty map renders and the camera moves

---

## Phase 3: User Story 1 - Grow and Forage (Priority: P1) 🎯 MVP

**Goal**: A single mold on a generated map grows toward clicked targets, absorbs food, thickens used veins, and thins idle ones (never removing them)

**Independent Test**: A round with no rivals. Set targets toward food and confirm the mold reaches it, absorbs it, and nutrients rise enough to fund more growth (quickstart scenarios 1–4)

### Tests for User Story 1 ⚠️

> Write these first and confirm they fail before implementing

- [X] T022 [P] [US1] Network tests in `tests/unit/sim/network.test.ts`: adding an edge sets bits on both endpoints; component labeling; merge "the pools are added together, and the merged piece keeps the lower id"; split pool "shared out by cell count (rounded down; the remainder goes to the piece with the lowest id)"; an orphaned piece loses `orphanDecay·dt` biomass per tick
- [X] T023 [P] [US1] Growth tests in `tests/unit/sim/growth.test.ts`: a target inside an obstacle snaps to the nearest open cell within 6 cells, otherwise it is rejected `no-open-cell-nearby`; A* never enters terrain 2 or 3 and routes around obstacles; terrain costs open 1.0 / rough 2.5; the 4th target replaces the oldest (`createdTick`); the tip advances one cell per `cellBuildCost × terrainCost` delivered; the state becomes `starved` after 1 s without delivery and `arrived` removes the target; `cancelTarget`/`clearTargets` keep built veins
- [X] T024 [P] [US1] Flow tests in `tests/unit/sim/flow.test.ts`: an edge's flow equals the summed subtree demand; `D += (|Q| − decay·D)·dt`; delivery is capped by the bottleneck `capacityPerD·D` along the path; idle edges thin to `minConductivity` and are never removed; with no front sinks the full budget goes to growth (spillover, R4); spend ≤ `min(pool, spendRateCap·dt)` after upkeep
- [X] T025 [P] [US1] Food tests in `tests/unit/sim/food.test.ts`: per tick, each owned food cell transfers `min(food[i], absorbRate·dt)` to its component pool; `remaining = Σ food[cells]`; at 0 the source is removed and `foodDepleted` is emitted; the oatFlake footprint is 2×2 with 40 nutrients at 2.0/cell/s
- [X] T026 [US1] Forage integration test in `tests/integration/forage.test.ts`: fixed seed, no rivals, scripted `setTarget` at the nearest food. The mold reaches it within 60 s of game time (1200 ticks), stored nutrients end higher than they started, and `assertInvariants` holds every tick

### Implementation for User Story 1

- [X] T027 [US1] Basic map generation in `src/sim/mapgen.ts`: dish-wall border (terrain 3), noise-threshold obstacles and a rough band (R12 step 2), a single start with radius 6 cleared to open, oatFlake food scattered by Poisson-disk sampling scaled by `foodDensity` (connectivity, fairness, and multi-start come in US2 and US4)
- [X] T028 [US1] Implement the network in `src/sim/network.ts`: add/remove cell and edge, BFS component relabel on change, merge and split with pool rules (T022), orphan detection (`sources.length === 0`) with `pieceOrphaned` events, and orphan biomass decay
- [X] T029 [US1] Implement food absorption and `FoodSource` lifecycle in `src/sim/food.ts` (drops come in US3)
- [X] T030 [US1] Implement growth in `src/sim/growth.ts`: `setTarget` snapping and validation, nearest owned attach cell by BFS ring search, A* over the 8-connected grid with the terrain costs from `balance.terrainCost`, string-pulling, tip advance, re-path on invalidation, and tip state transitions per data-model.md
- [X] T031 [US1] Implement the flow solve in `src/sim/flow.ts`: per component, a multi-source BFS tree from sources (food cells with `food > 0` and the owned `core`); growth-sink demand split by distance to target; subtree accumulation; bottleneck-capped delivery; conductivity update with a floor (R2, R4); unpaid upkeep starves leaf cells in `src/sim/upkeep.ts`
- [X] T032 [US1] Wire the economy into `src/sim/step.ts`: `coreIncome` (0.5/s), upkeep `upkeepPerCell × cellCount` per component, growth delivery each tick, flow every `flowEvery` ticks; set up `createRound` for single-mold rounds with `playerStartNutrients` (30) and `defaultAllocation` (0.3); make `setTarget`, `cancelTarget`, and `clearTargets` real in `src/sim/commands.ts`
- [X] T033 [US1] Implement `readHud` (stored nutrients, 2 s smoothed net income, allocation, `growthStarved`, targets) in `src/sim/hud.ts`, exported from `src/sim/index.ts`
- [X] T034 [P] [US1] Terrain layer: bake terrain (grimy scratched surface with grunge overlay, inked rough patches, outlined cel-shaded obstacle shards and pebbles with hatched shadows, dish wall) once per map into a 2× cell-resolution texture in `src/render/terrain-layer.ts`
- [X] T035 [P] [US1] Film layer: an RGBA grid texture (RGB = owner color × biomass, A = occupancy) uploaded only when dirty, drawn upscaled through the ink-film filter (3 flat cel bands, heavy wobbly outline from occupancy edge detection, hatching in the shadow band, no glow; see R9 and FR-032) in `src/render/film-layer.ts` and `src/render/shaders/toon.frag`
- [X] T036 [P] [US1] Vein layer: a per-mold dynamic `Mesh` (quad strip per edge, width ∝ √D, seeded per-cell node jitter, reused buffers) rebuilt only on flow ticks or topology change, drawn as a near-black outline pass plus a flat colored core with an offset highlight stripe, with chunky marching dashes showing flow direction, in `src/render/vein-layer.ts` and `src/render/shaders/vein.vert`/`vein.frag`. Ease width between flow ticks
- [X] T037 [P] [US1] Food layer: procedurally drawn outlined, cel-shaded runtime atlas for the 4 food types, with sprites scaled by remaining amount, in `src/render/food-layer.ts`
- [X] T038 [P] [US1] FX layer: inked target markers with the tip state shown (growing, starved, blocked) and a rough red "X" rejection ping in `src/render/fx-layer.ts`
- [X] T039 [US1] Input in `src/ui/input.ts` per contracts/controls.md: left-click → `setTarget`, right-click on a marker → `cancelTarget`, Shift + right-click → `clearTargets`, camera bindings; stamp the player mold id
- [X] T040 [US1] Minimal HUD (stored nutrients, net income, "growth starved" indicator) bound to `HudModel` in `src/ui/hud.ts`, plus rejection toasts, styled as comic panels per R19 (thick black border, hard offset shadow, halftone overlay, bold hand-lettered display font with a readable fallback) in `src/ui/styles.css`
- [X] T041 [US1] Wire everything in `src/main.ts`: create a single-mold round, connect loop → sim → renderer → HUD, route input commands into `enqueue`
- [X] T042 [US1] Playtest quickstart scenarios 1–4 and record the results in `specs/001-core-game-loop/checklists/playtest.md` (US1 section). Profile vein mesh rebuild cost in the Chrome Performance panel and note it there

**Checkpoint**: The foraging sandbox is playable and every US1 test passes

> **Implementation notes (T001–T042, 2026-10-25)** — where the build differs from the task text:
> - T021: the benchmark is a plain `tsx` script (`npm run bench`), not `vitest bench`; Vitest 5 no
>   longer exports a `bench` helper.
> - T022–T026: the sim systems were written before their tests rather than strictly test-first.
> - T030: no string-pulling; a growing vein has to occupy every cell on its path.
> - T033: also needed `difficultyFor` (R14) for map size, so `src/sim/difficulty.ts` already exists;
>   T085 stays open until its tests (T082) are written.
> - T036: vein width is not eased between flow ticks yet (it steps at 4 Hz). Geometry is rebuilt
>   as a fresh mesh each time (8–12 ms at 4000 cells); buffer reuse is deferred to T096.
> - T037: food is drawn with a redrawn `Graphics`, not a pre-baked atlas.
> - T042: vein rebuild cost was profiled, but frame rate was not (browser pane hidden); see
>   `checklists/playtest.md`.
> - Added during the build: a lower `spendRateCap` (40 to 6); "starved" now means an empty stock
>   with growth running on income.
> - Phase 4 (US5, 2026-10-25): the farm hotkey moved from `1` to `F` because `1 2 3` are the speed keys. Manual pause shows a non-blocking banner (orders still work); focus loss shows a blocking "click to resume" overlay, and Space also resumes it. `T047`: `mapControl` is computed on read (it is a cheap division), not on a 10-tick cadence. `T083/T084/T089/T090/T091` were pulled forward because the run, storage and URL parameters belong to the same screens; the defeat path is unit-tested through `Run` and gets exercised in the game once rivals exist. URL parameters (`?seed`, `?round`, `?debug`) work in dev builds only.
> - Phase 5 (US2, 2026-10-25): `T059` is only half done: the 20-seed determinism and replay test is in (`determinism.test.ts`), but the "a round is decided within 20 game minutes" test waits for the balance pass, because both molds currently stall at the upkeep ceiling (see the playtest log). `T054` front tests live in `fronts-flow.test.ts`. `T064`: vision is recomputed from scratch at the fog cadence with a separable dilation (O(cells) per mold) instead of incremental stamping plus a periodic full pass, so there is nothing to compare an incremental update against. The AI may also import `../grid` (pure helpers), and the AI's `MoldView` gained `nearestOwn`. Rival commands are applied like any other but are not written to the replay log (replaying regenerates them). `T085–T088` (difficulty formulas, corridor repair, food fairness, validated generation with fallback) were built together with multi-start generation; their tests (`T081`, `T082`) are still to do.
> - Fixed along the way: a blocked tip that found a new path kept using its old head cell; two cells that killed each other in the same tick could each be revived by the side processed first (now both die); mold processing order rotates every tick.
> - Changed after review (2026-10-25): veins no longer retract (FR-005 amended). Idle veins thin to
>   `minConductivity`; unpaid upkeep starves the thinnest, outermost leaf cell one at a time
>   (`src/sim/upkeep.ts`, FR-006). `retract*` and `coreSafeRadius` settings and `lowFlowTime` removed.

---

## Phase 4: User Story 5 - Time Control and HUD (Priority: P1)

**Goal**: Pause, 1x/2x/3x speed, orders while paused, auto-pause, a full HUD, and the run screens

**Independent Test**: Pause mid-round, set targets and move the slider, resume, and confirm the orders apply. Every HUD value matches sim state (quickstart scenario 11)

### Tests for User Story 5 ⚠️

- [ ] T043 [P] [US5] Pause integration test in `tests/integration/pause.test.ts`: at speed 0 no tick advances (`stateHash` unchanged); commands enqueued while paused are all applied on the first tick after resume, in order (SC-007)
- [ ] T044 [P] [US5] Speed-equivalence test in `tests/integration/speed.test.ts`: the same seed and commands at the same ticks give the same `stateHash` after N game seconds when driven through the loop at 1x and at 3x
- [ ] T045 [P] [US5] Map-control test in `tests/unit/sim/round.test.ts` (map-control part): `mapControl = cellCount / reachableCells`, where reachable excludes terrain 2 and 3

### Implementation for User Story 5

- [ ] T046 [US5] Pause and speed controls plus auto-pause on `visibilitychange` (hidden) and window `blur` in `src/game/loop.ts` and `src/main.ts` (FR-025, FR-027), with a "Paused — click to resume" overlay
- [ ] T047 [US5] Compute `reachableCells` at round creation and `mapControl` every 10 ticks in `src/sim/round.ts`, exposed via `readHud`
- [ ] T048 [US5] Full HUD in `src/ui/hud.ts` per FR-026: allocation slider (`<input type=range>` 0..1 step 0.05 → `setAllocation`, `Q`/`E` ±0.1), map control % with "win at 75%", round number, speed indicator, elapsed time, rival list placeholder, tooltips per contracts/controls.md; the slider is a chunky inked bar with a thick handle (R19)
- [ ] T049 [US5] Run state machine (`title → playing ⇄ paused → roundEnd → …`, per data-model.md Run) in `src/game/run.ts`
- [ ] T050 [US5] Screens in `src/ui/screens.ts`: title (Start), pause menu on `Esc` (resume, restart run, quit to title), round-end with elapsed time, peak size, nutrients gathered, rivals eliminated, and seed (FR-029)
- [ ] T051 [P] [US5] Debug overlay (FPS, mean tick ms, ticks per frame, seed) toggled by backtick or `?debug`, dev builds only, in `src/ui/debug.ts`
- [ ] T052 [US5] Playtest quickstart scenario 11 and record the results in `specs/001-core-game-loop/checklists/playtest.md` (US5 section)

**Checkpoint**: The foraging sandbox has full time control, HUD, and screens

---

## Phase 5: User Story 2 - Rival Molds and Battle Fronts (Priority: P1)

**Goal**: Rivals that follow the same rules, contact combat driven by delivered nutrients, supply-line cutting, fog of war, and win/loss

**Independent Test**: A round with one rival. Moving the slider toward Fight wins a front the player was losing, and eliminating the rival ends the round in victory (quickstart scenarios 5–7)

### Tests for User Story 2 ⚠️

- [ ] T053 [P] [US2] Combat tests in `tests/unit/sim/combat.test.ts`: contact is 8-adjacency between different owners; damage `pressure · attackEff · dt` is applied simultaneously from start-of-tick state (swapping mold ids gives a mirrored result); a cell at biomass ≤ 0 dies, its edges are removed, and the highest-pressure attacker gets `consumeRefund` (40%) of build cost; regen `biomassRegen` only applies when supplied and not in contact; auto-advance claims adjacent dead or empty cells; a mold with 0 cells emits `moldEliminated`
- [ ] T054 [P] [US2] Front-allocation tests in `tests/unit/sim/flow.test.ts` (front part): with allocation `a`, front sinks share `a·budget` weighted toward the most enemy pressure and tips share `(1−a)·budget`; with no tips, the front gets the full budget
- [ ] T055 [P] [US2] Fog tests in `tests/unit/sim/fog.test.ts`: Chebyshev `visionRadius` 10 from own cells; states 0 unseen / 1 remembered / 2 visible; memory keeps last-seen owner and food; incremental update followed by a full recompute matches a from-scratch recompute
- [ ] T056 [P] [US2] View tests in `tests/unit/sim/view.test.ts`: `MoldView` returns nothing about cells with visibility 0; `biomassAt` is `null` unless the cell is visible; `ownerAt` and `foodAt` return last-known values when remembered; `dropWarnings()` is global; terrain is global
- [ ] T057 [P] [US2] Round-outcome tests in `tests/unit/sim/round.test.ts`: victory when every rival is eliminated (`eliminated-all`) or `mapControl ≥ 0.75` (`map-control`); defeat when the player is eliminated; "When both happen in the same tick, defeat wins"
- [ ] T058 [P] [US2] AI tests in `tests/unit/sim/ai.test.ts`: `think()` returns at most `aiCommandsPerThink` (3) commands, all stamped with its own mold id; the same view, state, and rng give the same commands; it targets visible food when uncontested; it explores when it knows no food; it raises allocation when `frontLoss` is high
- [ ] T059 [US2] Integration and determinism tests: `tests/integration/rival-round.test.ts` (an AI-driven "player" vs 1 rival reaches a decided outcome within 20 game minutes; invariants hold) and `tests/integration/determinism.test.ts` (record a ReplayLog, replay it from the seed, final `stateHash` equal across 20 seeds — SC-006)

### Implementation for User Story 2

- [ ] T060 [US2] Multi-start map generation in `src/sim/mapgen.ts`: N+1 starts by best-candidate sampling (maximize minimum distance, minimum distance from the wall), each start area of radius 6 cleared, the player assigned to a random start, cores placed; `createRound` takes the rival count
- [ ] T061 [US2] Implement the contact scan, front grouping per mold pair, simultaneous damage, cell death with refund and events, regen, and auto-advance in `src/sim/combat.ts`, wired into `src/sim/step.ts` every tick
- [ ] T062 [US2] Add front sinks and the pressure array to the flow solve in `src/sim/flow.ts` (allocation split, front weighting, spillover both ways)
- [ ] T063 [US2] After cell deaths, run the split, re-label, and orphan pass for affected components only in `src/sim/network.ts`; eliminate molds at 0 cells and clear their targets
- [ ] T064 [US2] Implement the vision grid, memory arrays, incremental stamping every `fogEvery` ticks, and full recompute every `fogFullEvery` ticks in `src/sim/fog.ts`
- [ ] T065 [US2] Implement the `MoldView` builder (the only AI input; exposes only the fields in contracts/sim-api.md, with fog-limited `pathCost`) in `src/sim/view.ts`
- [ ] T066 [US2] Implement the utility AI `think(view, state, rng)` in `src/sim/ai/rival-ai.ts`: scores for forage, attack weak visible enemy cells × aggression, defend/reinforce, and explore; picks up to 3 targets with a diversity penalty; sets allocation from the front pressure ratio and aggression (R8)
- [ ] T067 [US2] Call the AI in `src/sim/step.ts`: think cadence `aiThinkInterval` ± seeded jitter per rival from stream `ai:<id>`, commands go through the same `enqueue`, at most `aiCommandsPerThink` per think, and rival start nutrients come from difficulty
- [ ] T068 [US2] Implement `roundOutcome` (checked every 10 ticks, defeat-first tie rule) in `src/sim/round.ts`, and route victory and defeat to roundEnd in `src/game/run.ts`
- [ ] T069 [P] [US2] Fog layer: vision → R8 texture → fog filter (dense ink scribble/cross-hatching for unseen, halftone dots with flat gray tones for remembered, clear for visible, hand-drawn wavy boundary line), with remembered rival cells drawn from memory marked as stale, in `src/render/fog-layer.ts` and `src/render/shaders/fog.frag`
- [ ] T070 [P] [US2] Angular comic starburst FX scaled by pressure in `src/render/fx-layer.ts`, and per-rival ink patterns (plain, hatching, halftone dots, rings, cross-hatch) in `src/render/shaders/toon.frag`
- [ ] T071 [US2] HUD rival list (color and pattern swatch, alive/eliminated, `visibleCells` or "?") and elimination toasts in `src/ui/hud.ts`
- [ ] T072 [US2] Add AI target scores and front pressures to the debug overlay in `src/ui/debug.ts`
- [ ] T073 [US2] Fill in `tests/bench/tick.bench.ts` with combat, fog, and AI at 160×120 with 2 molds and at 275×206 with 6 molds; record the mean tick ms in `specs/001-core-game-loop/checklists/playtest.md`
- [ ] T074 [US2] Playtest quickstart scenarios 5–7 and record the results in `specs/001-core-game-loop/checklists/playtest.md` (US2 section)

**Checkpoint**: A full 1-rival round is winnable and losable. All P1 stories work

---

## Phase 6: User Story 3 - Food Drops (Priority: P2)

**Goal**: Food drops with a warning visible to everyone, which create races and contested food

**Independent Test**: Drops appear on schedule with a warning, the first mold there absorbs, and contested drops produce fronts (quickstart scenario 8)

### Tests for User Story 3 ⚠️

- [ ] T075 [P] [US3] Drop tests in `tests/unit/sim/drops.test.ts`: the next drop is scheduled when the previous one enters `warning`, at `dropInterval ± dropJitter` (35 ± 10 s); "`landTick − warnTick` = `dropWarning` (5 s)"; the footprint fits on non-obstacle terrain; type is a weighted pick by `dropWeights` (breadCrumb 5, sugarCube 3, fruitSlice 2); landing on owned cells absorbs on the next tick; contested food is split by coverage; values per data-model.md FoodType (breadCrumb 3×3/120/1.5, sugarCube 4×4/300/3.0, fruitSlice 6×4/500/1.0)

### Implementation for User Story 3

- [ ] T076 [US3] Add drop food types to the FoodType table in `src/sim/food.ts` (values from data-model.md) and `dropWeights` in `src/config/balance.ts`
- [ ] T077 [US3] Implement drop scheduling and state transitions (`scheduled → warning → landed`) from the `drops` stream, with `dropWarning` and `dropLanded` events, in `src/sim/food.ts`, wired into `src/sim/step.ts`
- [ ] T078 [US3] Add the race-drop score (own ETA vs estimated rival ETA from visible info) to `src/sim/ai/rival-ai.ts` using `view.dropWarnings()`
- [ ] T079 [P] [US3] Drop warning ring with countdown and landing animation in `src/render/food-layer.ts`, and a HUD toast "Sugar cube incoming!" in `src/ui/hud.ts`
- [ ] T080 [US3] Playtest quickstart scenario 8 and record the results in `specs/001-core-game-loop/checklists/playtest.md` (US3 section)

**Checkpoint**: Rounds have drop-driven races

---

## Phase 7: User Story 4 - Generated Maps and Escalating Rounds (Priority: P2)

**Goal**: Fair, connected, seeded maps; a monotonic difficulty curve; roguelike runs; a persisted best round

**Independent Test**: Win round 1; round 2 has a new, harder map; the same seed and round generate the identical map (quickstart scenarios 9–10)

### Tests for User Story 4 ⚠️

- [ ] T081 [P] [US4] Mapgen tests in `tests/unit/sim/mapgen.test.ts` over 500 seeds: every start reachable from every other start; food value within `fairRadius` (25 cells by path distance) of every start within ±10% of the richest; reachable open area ≥ 55%; the same seed and round give a byte-identical map; the no-obstacle fallback is used in < 1% of seeds
- [ ] T082 [P] [US4] Difficulty tests in `tests/unit/sim/difficulty.test.ts`: values match the R14 table at rounds 1, 5, and 10; "For all n in 1..50, `profile(n+1)` is at least as hard as `profile(n)` in every field, and strictly harder in at least one"
- [ ] T083 [P] [US4] Storage tests in `tests/unit/game/storage.test.ts`: reads and writes `slime-mold:v1:best` as `{ bestRound }`; returns defaults and does not throw when `localStorage` is missing or throws
- [ ] T084 [P] [US4] Run-flow tests in `tests/unit/game/run.test.ts`: round seed = `hash(runSeed, number)`; victory → round n+1 and `bestRound = max(bestRound, number)`; defeat → new run at round 1 with a new runSeed (FR-023); nothing carries over between rounds (FR-024)

### Implementation for User Story 4

- [ ] T085 [US4] Implement `difficultyFor(round)` with the R14 formulas (rival count, map size scale, food density, aggression, uncapped rival start nutrients, AI think interval, drop interval) in `src/sim/difficulty.ts`
- [ ] T086 [US4] Connectivity in `src/sim/mapgen.ts`: flood fill from the player start, carve an A* corridor that ignores obstacles to any unreached start, re-check (R12 step 4)
- [ ] T087 [US4] Food fairness pass in `src/sim/mapgen.ts`: sum food value by path distance within `fairRadius` per start, top up the poorest starts to within ±10% (R12 step 5)
- [ ] T088 [US4] Map validation with retry on a derived seed (up to 10 attempts) and a logged no-obstacle fallback in `src/sim/mapgen.ts` (R12 step 6); `createRound` uses the difficulty profile for size, rivals, and food density
- [ ] T089 [US4] Best-round persistence with try/catch in `src/game/storage.ts` (R17)
- [ ] T090 [US4] Round progression, defeat → new run, best-round update, and round-end "Next round" / "New run" buttons in `src/game/run.ts` and `src/ui/screens.ts`; title screen shows the best round
- [ ] T091 [US4] URL parameters `?seed=`, `?round=`, `?debug` (dev builds) in `src/main.ts` (R11)
- [ ] T092 [US4] Batch sim tool in `tools/batch-sim.ts`: `--rounds a-b --games n`; plays medium-AI "player" vs rivals headless; reports median and p10/p90 round length, win rate per round, share of runs reaching round 10, and mean tick ms per scale
- [ ] T093 [US4] Balance pass: tune `src/config/balance.ts` and the difficulty coefficients until the batch tool shows median round length 5–15 min for rounds 1–10 (SC-002), round-1 win rate > 80%, and < 20% of runs reaching round 10 (SC-005). Record the results in `specs/001-core-game-loop/checklists/playtest.md`
- [ ] T094 [US4] Playtest quickstart scenarios 9–10 and record the results in `specs/001-core-game-loop/checklists/playtest.md` (US4 section)

**Checkpoint**: The full game loop works — runs, escalating rounds, and the best round kept

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Performance gates, accessibility, and final validation

- [ ] T095 Perf gate (Constitution V): `npm run bench` mean tick ≤ 6 ms at 275×206 with 6 molds. If it misses, move the sim into a Web Worker per R13 (`src/game/sim-worker.ts`, snapshot transfer) and record the decision in plan.md Complexity Tracking
- [ ] T096 Render perf: with `?round=10&debug`, hold about 60 fps during a 5-rival battle (quickstart scenario 12, SC-003); fix hotspots in `src/render/vein-layer.ts` and `src/render/film-layer.ts`
- [ ] T097 [P] Accessibility check: rivals can be told apart by pattern alone (grayscale screenshot), HUD contrast, slider keyboard operable; also check outline readability at 0.5x and 3x zoom (FR-033); fix in `src/render/palette.ts`, `src/render/shaders/toon.frag`, `src/ui/styles.css`
- [ ] T098 [P] Make sure the debug overlay and URL parameters are stripped from production builds (`import.meta.env.DEV` guards) in `src/ui/debug.ts` and `src/main.ts`
- [ ] T099 [P] Update `README.md` with gameplay overview, controls (from contracts/controls.md), and dev commands
- [ ] T100 Run the full quickstart.md validation (all automated checks and all 12 playtest scenarios) from a fresh clone, and record the results in `specs/001-core-game-loop/checklists/playtest.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup and blocks every story
- **US1 (Phase 3)**: depends on Foundational. It's the MVP
- **US5 (Phase 4)**: depends on US1 (it needs a playable round to pause and a HUD to extend)
- **US2 (Phase 5)**: depends on US1 (network, flow, growth) and US5 (run state machine, screens)
- **US3 (Phase 6)**: depends on US1 (food). The AI drop scoring (T078) depends on US2
- **US4 (Phase 7)**: depends on US2 (multi-start maps, outcomes). The batch balance tool (T092–T093) works best after US3
- **Polish (Phase 8)**: after all stories

### Story Completion Order

```text
Setup → Foundational → US1 (MVP) → US5 → US2 → US3 → US4 → Polish
                                           └──── US3 sim/render (T075–T077, T079) can start right after US1
```

### Within Each Story

- Tests first, and confirm they fail
- Sim (types → systems → step wiring) before render and UI
- Render layer tasks marked [P] are separate files and can be done side by side
- The playtest task closes the story

### Parallel Opportunities

- Setup: T003, T004, T005
- Foundational: T006–T010, T015, T017, T021 (separate files); T011–T014 in order after T006
- US1: tests T022–T025 together; render layers T034–T038 together once T032 lands
- US5: tests T043–T045 together; T051 alongside T048–T050
- US2: tests T053–T058 together; T069 and T070 alongside sim work after T064
- US3: T075 together with the US2 tail; T079 alongside T077
- US4: tests T081–T084 together

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "Network tests in tests/unit/sim/network.test.ts"
Task: "Growth tests in tests/unit/sim/growth.test.ts"
Task: "Flow tests in tests/unit/sim/flow.test.ts"
Task: "Food tests in tests/unit/sim/food.test.ts"

# Render layers together (after T032):
Task: "Terrain layer in src/render/terrain-layer.ts"
Task: "Film layer in src/render/film-layer.ts + shaders/toon.frag"
Task: "Vein layer in src/render/vein-layer.ts + shaders/vein.*"
Task: "Food layer in src/render/food-layer.ts"
Task: "FX layer in src/render/fx-layer.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Combat tests in tests/unit/sim/combat.test.ts"
Task: "Fog tests in tests/unit/sim/fog.test.ts"
Task: "View tests in tests/unit/sim/view.test.ts"
Task: "Round-outcome tests in tests/unit/sim/round.test.ts"
Task: "AI tests in tests/unit/sim/ai.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1: the foraging sandbox
3. **Stop and validate**: run quickstart scenarios 1–4 and judge whether the comic ink look and growth feel are good. Settle that before building combat on top

### Incremental Delivery

1. US1 → a foraging sandbox (MVP)
2. US5 → time control, HUD, screens
3. US2 → rivals, combat, fog: the first real "game"
4. US3 → drop races
5. US4 → generated escalation and runs: the full loop
6. Polish → perf, accessibility, final validation

Each step ends in a playable build (Constitution VI). Commit after each task or logical group.

---

## Notes

- [P] = different files, no dependencies on incomplete tasks
- Every sim task must keep `tests/boundaries.test.ts` and `assertInvariants` green
- Never use `Math.random`, `Math.pow`, `Math.exp`, or trig in `src/sim/**` (R11)
- Balance numbers go in `src/config/balance.ts` only, never inline literals (Constitution IV)
