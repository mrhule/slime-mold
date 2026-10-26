# Slime Mold

A single-player, browser-based real-time strategy game. You are a slime mold. Grow a network of
veins across a generated map, eat the food you find, spend your nutrients on growing faster or
on fighting, and beat the rival molds. Each round is a new map and gets harder.

Drawn in a comic, cel-shaded style: heavy ink outlines, flat color bands, hatching and grit.

## On a phone

Open the game on a touch device held sideways (it asks you to rotate in portrait). It switches to a touch
layout by itself; **Settings → Touch mode** (Auto / On / Off) overrides that.

- **Tap** the map to grow there; **drag** to look around; **pinch** to zoom; **press and hold** a marker to
  cancel it. The round buttons at the top right open the menu, jump to your core and clear all targets.
- **Build:** pick a building, tap a spot to preview it, then press **Build** (or Cancel).
- Touch mode starts on Low quality to save battery; you can raise it in Settings.

## Sound, music and look

- Sound effects and generated music start after your first click or key press (browsers block audio
  until then). The speaker button in the corner mutes everything; the pause menu has Sound and Music
  sliders, **Reduce motion** (no screen shake or UI animation), **Quality** and **Print texture**.
  Settings are saved in your browser.
- Quality is **Auto** by default: it drops to **Low** (no flow pulses or vein shadows, fewer splats)
  when the frame rate stays low and returns when it recovers. You can pin High or Low.
- Veins are lit from the upper left and drawn in three width bands with a heavier line on the
  shadow side; flow pulses run along fed veins, fights throw ink splats and shake the screen
  (only fights you can see). **Print texture** (off by default, High quality only) adds a halftone
  dot screen, grain and a slight colour offset.

## How to play

- **Grow.** Click the map to set a growth target (up to 3 at once). Your veins extend toward it
  and route around obstacles. Right-click a marker to cancel it, or Shift + right-click to
  clear them all.
- **Eat.** Touch food and your mold spreads over it and absorbs its nutrients. Bigger food holds
  more. Every so often food drops from above: a warning burst with a countdown shows where, for
  everyone, so it becomes a race.
- **Spend.** Growing costs nutrients and every cell costs upkeep. If you grow past what your
  income can pay for, your outermost cells starve. Each connected piece of vein holds only so many
  nutrients, so build **Factories** (`F`) to raise that cap. Income comes from **pools of
  primordial goo** (glowing green wells, visible even in the fog): grow a vein to one and the mold
  spreads over it and harvests it. A pool never runs dry, pays for each of its cells you hold, and
  only pays while a factory is on the same vein; where two molds reach one pool, the cells each
  holds decide the split. A store
  house also speeds up tips and **Harvesters** (`M`, beside big food) along its vein, fading with
  distance, at a small drain on the stock. **Booster Factories** (`B`) make the whole vein they sit
  on stronger in fights.
- **Join up.** Pieces of your mold that grow within a cell of touching link up on their own (with a
  one-cell bridge if needed), so a mold spreading in several directions stays one network and shares
  its nutrients. Near an enemy this never happens, so cutting a rival's vein still works.
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
| Right-click a vein | Cut it (a cut-off piece with no core or food starves); right-click the snip to rejoin |
| `F` / `B` / `M` | Place a Factory / Booster / Harvester (click a cell of yours; `Esc` or right-click cancels) |
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
