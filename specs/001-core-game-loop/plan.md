# Implementation Plan: Core Game Loop — Slime Mold RTS

**Branch**: `001-core-game-loop` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-core-game-loop/spec.md`

## Summary

A single-player browser RTS in which the player is a slime mold, racing and fighting rival
molds over procedurally generated maps across rounds that get harder. Technically, it's a
pure, deterministic, fixed-tick (20 Hz) simulation over a cell grid in typed arrays. On top of
the grid sits a vein graph whose nutrient flow and thickness follow a simplified Physarum
model (tree-routed demand, conductivity reinforcement, retraction). Combat is resolved by
nutrients delivered to contact cells. Rivals are utility AIs that see the world only through
a fog-filtered `MoldView` and act only through the player's `Command` set. PixiJS renders
the grid as a shader-smoothed "goo" film with mesh veins and a fog overlay. A DOM HUD and the
fixed-timestep loop provide pause and 1x/2x/3x speed. See [research.md](research.md) for every
decision and its rationale.

## Technical Context

**Language/Version**: TypeScript 7.0 (strict), ES2022 target

**Primary Dependencies**: PixiJS 8.22 (runtime). Vite 8.3 (build/dev). Vitest 5.0 (tests,
bench). tsx (dev-only, batch sim tool)

**Storage**: `localStorage` for best round only (R17); degrades gracefully

**Testing**: Vitest headless for all sim rules, determinism, and import boundaries. `vitest
bench` for the tick budget. Batch AI-vs-AI tool for balance. Manual playtest checklists per story

**Target Platform**: Modern desktop browsers (Chrome, Firefox, Edge, Safari). Static hosting

**Project Type**: Single-page browser game (single project, no backend)

**Performance Goals**: 60 fps render. Sim tick ≤ 6 ms mean at round-10 scale (≈275×206 cells,
6 molds). Flow solve ≤ 3 ms per flow tick

**Constraints**: Deterministic sim (seeded PRNG streams; no `Math.random`/`pow`/`exp`/trig in
sim). No per-tick allocation of large structures. PixiJS is the only runtime dependency

**Scale/Scope**: Maps from 160×120 to 320×240 cells. 2–6 molds. Rounds of 5–15 min. 4 food
types. About 5 screens (title, HUD, pause, round end, debug overlay)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
|---|---|---|
| I. Simulation is the source of truth | `src/sim` is pure TS with no Pixi or DOM imports. Fixed 20 Hz tick. Render reads `Readonly<World>`. Input becomes `Command`s. An import-boundary test enforces it ([sim-api.md](contracts/sim-api.md)) | ✅ |
| II. Same rules for every mold | One `Command` set for all molds ([commands.md](contracts/commands.md)). AI reads only `MoldView` under the same fog (R7, R8). Difficulty is parameters only (R14). Boundary test on `src/sim/ai` | ✅ |
| III. Seeded & reproducible | sfc32 named streams. No `Math.random` in sim. Index-order iteration. `stateHash` + `ReplayLog` tests (R11) | ✅ |
| IV. Test the rules, playtest the fun | Vitest suites for every rule area. Playtest scenarios in [quickstart.md](quickstart.md). All constants in `balance.ts` ([balance-config.md](contracts/balance-config.md)) | ✅ |
| V. Smooth at scale | Typed-array SoA. O(cells) passes. Flow at 4 Hz. Texture-based film. Mesh veins rebuilt at 4 Hz. Bench gate at round-10 scale. Worker fallback planned (R13) | ✅ |
| VI. Playable increments | Stories are delivered in order US1 → US5 → US2 → US3 → US4. Each ends playable. No upgrades, persistence beyond best round, or extra resources | ✅ |
| Technical constraints | TS strict, PixiJS, Vite, Vitest. Static build. `localStorage` with try/catch. Only runtime dep is PixiJS (`tsx` is dev-only) | ✅ |

**Post-design re-check (after Phase 1)**: ✅ Still passing. The design artifacts added no new
dependencies, no rule exceptions for AI, and no non-deterministic sources. The one risk to
watch is Principle V (sim tick budget at 6 molds), which has a named fallback (R13).

## Project Structure

### Documentation (this feature)

```text
specs/001-core-game-loop/
├── spec.md              # Feature spec (with clarifications)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R18
├── data-model.md        # Phase 1: entities, fields, state transitions
├── quickstart.md        # Phase 1: run + validation guide
├── contracts/
│   ├── commands.md      # Command schema (player & AI)
│   ├── sim-api.md       # Sim ⇄ render/UI/AI boundary, HudModel, MoldView, SimEvent
│   ├── balance-config.md# Tunable constants
│   └── controls.md      # Input bindings and feedback
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
index.html
package.json
tsconfig.json
vite.config.ts

src/
├── main.ts                    # bootstrap: Pixi app, run controller, UI
├── config/
│   └── balance.ts             # BalanceConfig defaults (frozen)
├── sim/                       # PURE — no pixi.js, no DOM (boundary-tested)
│   ├── index.ts               # public API (createRound, enqueue, step, readHud, viewFor, …)
│   ├── types.ts               # World, Mold, Component, Command, SimEvent, …
│   ├── rng.ts                 # splitmix32 + sfc32, named streams
│   ├── noise.ts               # integer-hash value noise
│   ├── grid.ts                # index math, neighbor tables, direction bits
│   ├── mapgen.ts              # terrain, starts, connectivity, food fairness (R12)
│   ├── difficulty.ts          # difficultyFor(round) (R14)
│   ├── commands.ts            # apply/validate commands
│   ├── network.ts             # edges, components (split/merge), orphaning (R3)
│   ├── flow.ts                # demand routing, conductivity, retraction (R2, R4)
│   ├── growth.ts              # targets, A*, tips (R5)
│   ├── combat.ts              # contact scan, pressure, cell death (R6)
│   ├── food.ts                # absorption, drop scheduling (FR-007, FR-017)
│   ├── fog.ts                 # vision + memory (R7)
│   ├── view.ts                # MoldView builder (fairness surface)
│   ├── round.ts               # win/loss, map control (FR-022)
│   ├── hud.ts                 # readHud → HudModel (FR-026)
│   ├── hash.ts                # stateHash, ReplayLog
│   ├── step.ts                # tick orchestration and cadences (R10)
│   └── ai/
│       └── rival-ai.ts        # utility AI: think(view, state, rng) → Command[]
├── game/
│   ├── loop.ts                # rAF fixed-timestep accumulator, speed, pause, event buffer
│   ├── run.ts                 # Run state machine (title/playing/paused/roundEnd)
│   └── storage.ts             # best round (try/catch localStorage)
├── render/                    # PixiJS only; reads Readonly<World>
│   ├── renderer.ts            # layer setup, per-frame update
│   ├── camera.ts              # pan/zoom/clamp
│   ├── terrain-layer.ts       # baked terrain texture
│   ├── film-layer.ts          # owner/biomass texture + goo filter
│   ├── vein-layer.ts          # per-mold dynamic mesh + pulse shader
│   ├── food-layer.ts          # food sprites, drop warnings
│   ├── fog-layer.ts           # vision texture + fog filter
│   ├── fx-layer.ts            # target markers, front sparks, pings
│   ├── palette.ts             # colors + patterns (R18)
│   └── shaders/               # goo.frag, vein.vert/frag, fog.frag
└── ui/
    ├── hud.ts                 # DOM HUD bound to HudModel
    ├── screens.ts             # title, pause, round-end
    ├── input.ts               # mouse/keyboard → Commands + camera (controls.md)
    ├── debug.ts               # debug overlay
    └── styles.css

tests/
├── unit/sim/                  # rng, mapgen, difficulty, commands, network, flow,
│                              # growth, combat, food, fog, view, round
├── integration/               # full scripted rounds, determinism, pause queue
├── boundaries.test.ts         # import-boundary rules
└── bench/tick.bench.ts        # sim tick at round-10 scale

tools/
└── batch-sim.ts               # AI-vs-AI balance and perf report
```

**Structure Decision**: Single project. The hard boundary is between `src/sim` (pure,
deterministic, headless-testable) and the rest (`render`, `ui`, `game`), and it is enforced by
`tests/boundaries.test.ts`. Inside `src/sim`, the AI is further fenced off to `view.ts` and the
command types.

## Delivery Order (input to `/speckit-tasks`)

Each step ends in a playable build (Constitution VI):

1. **Foundation**: Vite + TS + Vitest scaffold, rng, grid, balance, sim API skeleton, game loop,
   Pixi app with camera, boundary test.
2. **US1 Grow and forage (P1)**: simple mapgen (no rivals), growth, flow, food absorption,
   retraction, film and vein rendering, basic HUD.
3. **US5 Time control and HUD (P1)**: pause, speed, command queue while paused, auto-pause,
   full HUD, title and round-end screens.
4. **US2 Rivals and battle fronts (P1)**: multi-mold starts, combat, splitting and orphaning, fog
   and memory, `MoldView`, rival AI, win/loss.
5. **US3 Food drops (P2)**: drop scheduling, warnings, drop food types.
6. **US4 Generated maps and escalation (P2)**: full mapgen (connectivity, fairness), difficulty
   curve, run state and best round, batch-sim balancing pass.

US5 comes before US2 because pause and the HUD make the more complex combat story easier to
playtest and debug.

## Risks

| Risk | Mitigation |
|---|---|
| Sim tick too slow at 6 molds, 275×206 cells | Bench gate from Foundation onward. Incremental fog. Flow at 4 Hz. Worker fallback (R13) |
| Vein mesh rebuilds cause frame spikes | Rebuild only on flow ticks and topology changes. Reuse buffers. Profile in US1 |
| Grid look feels blocky | Goo filter + jittered vein nodes + string-pulled paths. Judged in the US1 playtest |
| Combat feels opaque | Front sparks scaled by pressure. Slider tooltip. Debug overlay shows pressures |
| Balance off (rounds too long/short) | All constants in `balance.ts`. Batch sim gives round-length and win-rate data |

## Complexity Tracking

No constitution violations to justify. `tsx` is a dev-only dependency, which the technical
constraints don't restrict.
