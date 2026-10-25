# Slime Mold

A single-player, browser-based real-time strategy game. You are a slime mold. Grow a network of
veins across a generated map, eat the food you find, spend your nutrients on growing faster or
on fighting, and beat the rival molds. Each round is a new map and gets harder.

Drawn in a comic, cel-shaded style: heavy ink outlines, flat color bands, hatching and grit.

## How to play

- **Grow.** Click the map to set a growth target (up to 3 at once). Your veins extend toward it
  and route around obstacles. Right-click a marker to cancel it, or Shift + right-click to
  clear them all.
- **Eat.** Touch food and your mold spreads over it and absorbs its nutrients. Bigger food holds
  more. Every so often food drops from above: a warning burst with a countdown shows where, for
  everyone, so it becomes a race.
- **Spend.** Growing costs nutrients and every cell costs upkeep. If you grow past what your
  income can pay for, your outermost cells starve. Build **Nutrient Farms** (`F`, then click one
  of your cells) for steady extra income, **Harvesters** (`M`) beside big food to eat it faster, and
  **Booster Factories** (`B`) to make your cells nearby stronger in fights.
- **Fight.** Where two molds touch, a battle front forms. The **Growth / Fight** slider (or
  `Q` / `E`) decides how much of your nutrients go to growing and how much to the fronts. Cut a
  rival's vein and everything beyond the cut withers.
- **See.** You only see food and rivals near your own veins (fog of war). Rivals have the same
  limits. Terrain is always visible.
- **Win.** Eliminate every rival, or hold 75% of the map. Winning starts a bigger, harder round;
  losing ends the run and the next one starts again at round 1. Your best round is saved.

### Controls

| Input | Action |
|---|---|
| Left-click | Set a growth target (or place a building in placement mode) |
| Right-click a marker | Cancel that target. Shift + right-click clears all |
| `F` / `B` / `M` | Place a Nutrient Farm / Booster Factory / Harvester (click a cell of yours; `Esc` or right-click cancels) |
| `Q` / `E`, or the slider | Send more nutrients to growth / to the fight |
| `Space` | Pause and resume (you can still give orders while paused) |
| `1` `2` `3` | Speed 1x, 2x, 3x |
| `W` `A` `S` `D`, arrows, screen edge, middle-drag | Pan the camera |
| Mouse wheel | Zoom (0.5x to 3x) |
| `H` | Center on your core |
| `Esc` | Pause menu (or cancel placement) |

## Run it

Requires Node.js 24 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # headless simulation tests (no browser needed)
npm run typecheck
npm run build      # static files in dist/
npm run preview    # serve the production build
npm run bench      # simulation tick benchmark (fails over the 6 ms budget)
npm run sim:batch -- --rounds 1-5 --games 20   # AI-played rounds: win rates, round length
```

Developer URL parameters (dev builds only): `?seed=123` fixes the run seed, `?round=5` starts at
round 5, `?debug` opens the debug overlay (also toggled with the backtick key), and `?nopause`
turns off auto-pause when the window loses focus.

## How it is built

TypeScript, PixiJS (WebGL) and Vite, with Vitest for tests. The game is organized as a
**simulation** and a **view**:

- `src/sim` is a pure, deterministic, fixed-tick (20 Hz) simulation with no DOM or PixiJS. All
  randomness is seeded, so the same seed and orders always replay the same round. Rival AIs see
  the world only through a fog-filtered view and act only through the same commands you do.
- `src/render`, `src/ui` and `src/game` draw the world, run the loop, and handle input and
  screens. They read the simulation and send it commands; they never change it directly.

The project is organized with [Spec Kit](https://github.com/github/spec-kit): see
`.specify/memory/constitution.md` for the project principles and `specs/` for each feature's
spec, plan, tasks and playtest log:

- `specs/001-core-game-loop`: the game itself
- `specs/002-buildings`: farms, booster factories, harvesters, and rivals that build them
