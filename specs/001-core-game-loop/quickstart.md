# Quickstart & Validation: Core Game Loop

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Prerequisites

- Node.js 24+ and npm
- A desktop browser: current Chrome, Firefox, Edge, or Safari

## Run

```bash
npm install
npm run dev          # Vite dev server → http://localhost:5173
npm test             # Vitest, headless sim tests
npm run bench        # sim tick benchmark at round-10 scale
npm run sim:batch -- --rounds 1-10 --games 200   # AI-vs-AI balance report
npm run build && npm run preview                 # production static build
```

Debug URL parameters (dev builds): `?seed=12345` fixes the run seed. `?round=5` starts at
round 5. `?debug` opens the debug overlay.

## Automated validation

| Check | Command | Expected |
|---|---|---|
| Sim rules, mapgen, fog/view, difficulty monotonicity | `npm test` | all pass |
| Determinism (SC-006) | `npm test -- determinism` | same seed + replay log → same `stateHash` in 100% of runs, including after running at 3x speed |
| Pause queue (SC-007) | `npm test -- pause` | commands enqueued while paused are all applied on the next tick |
| Import boundaries (Constitution I, II) | `npm test -- boundaries` | no `pixi.js`/DOM imports in `src/sim`; no world internals in `src/sim/ai` |
| Perf budget (Constitution V, SC-003) | `npm run bench` | mean tick ≤ 6 ms at 275×206 with 5 rivals |
| Round length (SC-002) | `npm run sim:batch` | median round length 5–15 min game time for rounds 1–10 |
| Difficulty curve (SC-005 proxy) | `npm run sim:batch` | medium-AI "player" wins round 1 more than 80%; reaches round 10 in under 20% of runs |

## Manual playtest scenarios

Run `npm run dev` and open the game.

1. **First food (US1, SC-001)**: Start a run. Without reading anything, click toward the nearest
   food. A vein should reach it within 60 s, nutrients should rise, and the vein should thicken.
2. **Obstacle routing (US1-4)**: Click a spot behind an obstacle. The vein routes around it.
3. **Starved growth (US1-3)**: Set 3 far targets right away. The HUD shows "growth starved"
   until income catches up.
4. **Idle veins persist (US1-5/6)**: Build a branch to food, let the food run out, and leave it.
   The branch thins but stays. Then grow far past the core's means (about 125 cells with no food
   income) and watch the outermost leaf cells starve one at a time.
5. **Front and slider (US2-1/2)**: Grow into the rival. A front forms (sparks). Drag the slider
   toward Fight. Your side of the front should start winning, and growth elsewhere slows.
6. **Cut a supply line (US2-3)**: Target a thin rival vein between its core and its food. The
   piece beyond the cut withers within about 4 s.
7. **Fog (US2-6)**: Retreat from an area. Rival veins there show as stale until you return.
8. **Food drop race (US3)**: Wait for a warning ring. Race the rival to it. Contested food is
   split by coverage.
9. **Victory and next round (US4)**: Win round 1 (eliminate the rival or reach 75%). Round 2 has
   a new map. Reload the page: the best round is kept.
10. **Defeat (FR-023)**: Lose a round. The run ends, and "New run" starts at round 1.
11. **Time control (US5)**: Pause, set targets and move the slider, then resume. Orders apply.
    Try 2x and 3x. Switch tabs and confirm the game auto-paused.
12. **Smoothness (SC-003)**: `?round=10&debug`. FPS stays at about 60 during a 5-rival battle.

## Done when

All automated checks pass, all 12 playtest scenarios behave as described, and the build runs
from a fresh clone (`npm install && npm run build`).
