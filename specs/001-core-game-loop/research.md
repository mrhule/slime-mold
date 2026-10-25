# Research: Core Game Loop — Slime Mold RTS

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-25

Each entry gives a Decision, Rationale, and Alternatives considered. All balance numbers
mentioned here are starting values; they live in `src/config/balance.ts` and are tuned in
playtesting (Constitution IV).

---

## R1. World representation

**Decision**: The world is a uniform square grid of cells (8 world units per cell) stored in
flat typed arrays (struct-of-arrays). Each cell holds terrain, owner mold id, biomass, and food
amount. Map sizes range from 160×120 cells (round 1) to 320×240 cells (cap). The vein network
is a graph whose nodes are owned cells and whose edges link 8-connected neighbor cells.

**Rationale**: A grid makes pathfinding, contact detection, fog, and map-control % cheap and
deterministic (index order). Typed arrays avoid per-tick allocation (Constitution V). The
"organic" look comes from rendering (R9), not from the sim's geometry. 320×240 = 76,800 cells,
which fits comfortably within an O(cells) pass per tick.

**Alternatives considered**:
- *Continuous-space graph (free-floating nodes)*: truest to Physarum, but needs spatial hashing
  for every contact/vision query and makes territory % ill-defined.
- *Agent-based Physarum (Jones model, particles + trail map)*: gorgeous, but hard to control
  precisely from a click, hard to balance, and expensive at 5 rivals.

## R2. Nutrient flow and vein thickness

**Decision**: A simplified, tree-routed version of the Tero Physarum model, recomputed every
flow tick (every 5 sim ticks, i.e. 4×/s):

1. For each connected component of a mold's network, run a multi-source BFS from its
   **sources** (cells absorbing food, plus the mold's start core) to build a shortest-path
   tree.
2. Each **sink** (growth tip, battle-front cell) has a demand set by the allocation (R4).
3. Push demands up the tree; an edge's flow is the summed demand of its subtree.
4. Each edge has a conductivity `D` that relaxes toward its flow:
   `D += (|Q| - decay·D)·dt`. Rendered vein thickness ∝ `D`.
5. A sink's delivered amount is capped by the bottleneck capacity `kCap·D` along its path,
   so thick established veins deliver more to the front than fresh thin ones.
6. Edges with no flow thin toward `minConductivity` but are never removed (FR-005). Expansion is
   limited by upkeep instead (FR-006): when a piece cannot pay `upkeepPerCell`, its thinnest,
   outermost leaf cell loses `starveDecay` biomass per second and dies at zero, one at a time,
   until income covers upkeep again. A half-starved cell heals once upkeep is paid. The core
   never starves, and removing a leaf never splits a piece.

**Rationale**: Gives the key Physarum behaviors (used routes thicken, unused ones thin,
reinforcing supply lines matters) in O(nodes) per component per flow tick, with no linear
solve. Only `+ − × ÷` and `sqrt` are used, which are exactly specified by IEEE-754, keeping
determinism (R11).

**Alternatives considered**:
- *Full Tero model (solve Kirchhoff pressure system each tick)*: physically faithful but needs a
  sparse linear solve over up to ~50k nodes; too costly and numerically fiddly.
- *Global nutrient pool, no flow*: simplest, but then "send nutrients to the front" has no
  spatial meaning and vein thickness is purely cosmetic.

## R3. Nutrient pools and network pieces

**Decision**: Stored nutrients belong to a **connected component**, not to the mold as a
whole. When a network splits, its stored nutrients are shared out by node count. When pieces
rejoin, their pools merge. A component with no source (no food under it and no start core)
is **orphaned**: it receives no income, and its cells lose biomass until they die
(`orphanDecay`, about 4 s to wither) (FR-013). The HUD shows the mold's total across pieces.

The start core supplies a small base income (`coreIncome`, 0.5/s) so the opening never soft-locks.
Upkeep is `upkeepPerCell` × cell count, charged to each component's pool (FR-006).

**Rationale**: Makes cutting a supply line a real, readable tactic, and follows the spec's edge
case of a split mold with food on both sides.

**Alternatives considered**: One pool per mold (cutting would then only cost territory, never
supply); losing all nutrients when split (too punishing and hard to read).

## R4. Allocation model (growth vs fight slider)

**Decision**: One slider `a ∈ [0,1]` per mold (0 = all growth, 1 = all fight). Each flow tick,
a component's spend budget is `min(pool, spendRateCap·dt)` after upkeep:

- Growth sinks (tips) share `(1−a)·budget`, weighted by distance to target (nearer tips first).
- Front sinks (contact cells) share `a·budget`, weighted toward cells under the most enemy
  pressure.
- If one category has no sinks, its share goes to the other, so nothing is wasted while
  idle. That means a mold with no fronts grows at full speed whatever the slider says.

Default slider for new molds is 0.3. The keyboard (Q/E) moves it in steps of 0.1. Rivals use
the same field (FR-015).

**Rationale**: One control matches the spec. Spillover keeps the slider from being a trap when
there is no fighting.

**Alternatives considered**: Three-way grow/fight/hoard split (more UI, unclear benefit for the
MVP); per-region painted priorities (deferred; the spec chose sliders).

## R5. Growth and pathfinding

**Decision**: A growth target creates a **tip**. The tip's path is computed with A* on the
8-connected grid from the nearest owned cell of the mold (nearest by octile distance, found
with a BFS ring search), with terrain costs: open 1.0, rough 2.5, obstacle impassable, and
enemy cells 1.5 (passable, but contact triggers combat). The path is string-pulled into
straight runs for nicer veins. The tip advances one cell each time its accumulated delivered
nutrients reach `cellBuildCost` × terrain cost. Each step creates the cell plus an edge to the
previous cell.

- Max 3 active targets per mold (FR-002). A 4th click replaces the oldest target.
- A target inside an obstacle snaps to the nearest open cell within 6 cells; otherwise it is
  rejected with a "can't grow there" ping (edge case).
- Tips re-path if their next cell becomes blocked by a friendly cell (merge, done) or after a
  cell is lost in combat.
- A tip that reaches its target is removed. The veins remain.

**Rationale**: A* on a grid of this size runs in well under 1 ms per path, and paths are
computed only when targets change. Treating enemy cells as passable-with-combat makes
"target the enemy" work without a separate attack command.

**Alternatives considered**: Flow-field per target (amortizes well with many units, but there
are ≤3 tips per mold, so A* is cheaper); diffusion growth toward chemoattractant (organic but
imprecise and hard to aim).

## R6. Combat resolution

**Decision**: A **battle front** is the set of owned cells that are 8-adjacent to an enemy's
cells. Fronts are grouped per mold pair, and the pairs are found in one O(cells) scan each sim
tick. Each front cell gets `pressure` from its share of front nutrients (R4). Every tick, for
each contact pair (cell A of mold X next to cell B of mold Y):

- `B.biomass -= pressureX(A) · attackEff · dt` and the reverse at the same time (simultaneous;
  both are computed from the state at the start of the tick for determinism).
- A cell at biomass ≤ 0 dies. Its edges are removed, and the attacker whose pressure on it was
  highest gains `consumeRefund` (40%) of its build cost as nutrients (FR-012).
- The winner does not occupy the dead cell automatically. Its tips, or an auto-advance rule
  (front cells with surplus pressure claim adjacent dead or empty cells at
  `cellBuildCost`), take it. This makes pushes visible as forward motion.
- After any cell death, affected components are re-labeled (union-find over the touched
  region, or BFS on the changed component) to detect splits (R3).

Biomass of a live cell regenerates toward 1.0 when it is supplied and not in contact.
A mold with zero cells is eliminated (FR-014).

**Rationale**: The outcome follows the nutrients actually delivered to the front (FR-011).
Simultaneous resolution keeps it deterministic and symmetric. Thick supply lines matter
because delivery is bottleneck-capped (R2).

**Alternatives considered**: Discrete "HP per mold region" battles (less granular, less
organic); Lanchester-style aggregate per front (simpler, but loses where along the front you
are winning).

## R7. Fog of war

**Decision**: Each mold has a vision grid (Uint8: 0 = never seen, 1 = remembered, 2 = visible).
It is updated every 5 ticks by a radius-limited multi-source BFS (Chebyshev radius
`visionRadius`, 10 cells) from the mold's cells. To keep it cheap, the update is incremental:
only cells whose ownership changed since the last update are re-stamped, with a full
recompute every 2 s to clear visibility that was lost. A per-mold **memory** stores the
last-seen owner and food amount for remembered cells (FR-028).

Terrain is globally visible. Drop warnings are globally visible (FR-031).

The **only** way the AI reads the world is a `MoldView` (contract: [sim-api.md](contracts/sim-api.md)),
built from the mold's vision and memory. The AI module cannot import `World` (enforced by an
import-boundary test) (FR-030, Constitution II).

**Rationale**: Square/Chebyshev vision is cheap and reads fine under a soft-edged fog shader.
Routing the AI through a view type makes fairness enforced by structure, not by discipline.

**Alternatives considered**: Raycast line-of-sight (obstacles blocking vision; nice later, not
needed now); no memory (the fog would forget food the player just saw, which is frustrating).

## R8. Rival AI

**Decision**: A utility AI, re-evaluated every `aiThinkInterval` (set by difficulty, R14, plus or minus a
seeded jitter so rivals don't act in lockstep). Using its `MoldView` only, it scores candidate targets:

- **Forage**: visible or remembered food: `value / (pathCost + k)`.
- **Race drop**: active drop warnings, weighted by ETA versus estimated rival ETA.
- **Attack**: visible enemy cells near weak (thin-vein, low-biomass) parts of an enemy, ×
  `aggression`.
- **Defend/reinforce**: own fronts losing biomass → raise the slider.
- **Explore**: unexplored frontier cells, when nothing else scores above threshold.

It picks up to 3 targets (diversity penalty for clustered picks). The slider is set from the
front pressure ratio and `aggression`. It issues only `Command`s (contract:
[commands.md](contracts/commands.md)), at most `aiCommandsPerThink` (3) per think, to mimic
human APM.

Difficulty sets `aggression`, think interval, and starting nutrients. There are no rule
exceptions.

**Rationale**: Utility scoring is easy to tune and to debug (scores can be shown in a debug
overlay). Rate-limiting commands keeps rivals beatable and human-like.

**Alternatives considered**: Behavior trees (more structure than needed); MCTS (far too
expensive in real time); scripted waypoints (spec rejected "simple scripted").

## R9. Rendering approach (PixiJS v8)

**Art direction** (FR-032): "Borderlands-inspired" comic / cel-shaded, heavily outlined,
hand-drawn, gritty. Concretely:

- Thick dark ink outlines (about 3 px at 1x zoom, easing with zoom so they stay readable from
  0.5x to 3x) on every mold, vein, food item, obstacle, and HUD panel.
- Flat 2–3 band cel shading (base, shadow, highlight) with hard edges, never smooth gradients.
- Hand-drawn feel: seeded line wobble, uneven outline weight, and a "boiling line" effect that
  re-seeds the wobble at about 8 fps (visual only).
- Grit: hatching and halftone dots in shadow bands, a paper/grunge overlay, ink splatters,
  scratches, and stains on the surface. A desaturated, dirty base palette, with the molds
  as the saturated accents.
- No glow, bloom, or blur. Highlights are flat white or pale shapes.
- Comic FX: angular starburst "POW" shapes for combat, and a jagged burst plus "!" for drop
  warnings. HUD panels look like chunky comic panels with a bold hand-lettered font.

**Decision**: Layers, bottom to top. All stylization lives in render code and shaders; the sim
is unaffected (Constitution I).

1. **Terrain**: baked once per map into a texture at 2× cell resolution. A grimy, scratched
   dish or counter surface with a grunge overlay, hatched shadows, and inked rough patches.
   Obstacles (glass shards, pebbles) are drawn as outlined cel-shaded shapes with a
   hatched drop shadow.
2. **Slime film**: one RGBA texture at grid resolution. RGB is the owner color, A is occupancy,
   and biomass is stored in a second channel. It is re-uploaded only when cells change
   (dirty flag, at most once per frame). It is drawn upscaled through a custom **ink-film**
   fragment filter (`toon.frag`):
   - posterizes biomass into 3 flat color bands (thin edge = shadow band, thick middle =
     highlight band);
   - draws a heavy outline wherever occupancy changes between neighboring samples (edge
     detection on the occupancy texture), with a seeded wobble and varied thickness;
   - adds hatching or halftone in the shadow band, using the owner's pattern (R18);
   - uses nearest-then-smoothed thresholding so edges read as hand-inked blobs, not squares.
3. **Veins**: one `Mesh` per mold with dynamic geometry (a quad strip per edge, width ∝ √D,
   jittered node positions from a seeded per-cell offset). Each vein draws as two passes in
   the same mesh draw: a wider near-black ink outline, then the flat colored core, with a
   thin offset highlight stripe. Geometry is rebuilt only on flow ticks (4×/s) and topology
   changes. Flow direction is shown by chunky dashes or arrows that march along the vein
   (a per-vertex flow attribute), instead of a soft glow.
4. **Food and drops**: outlined, cel-shaded sprites drawn procedurally into a small runtime
   atlas (no art pipeline yet). Drop warnings use a jagged comic burst with a "!" and a
   hand-lettered countdown.
5. **Fog**: vision grid → R8 texture → filter. Unseen areas are filled with dense ink
   scribble/cross-hatching (not blurred black). Remembered areas are covered in halftone
   dots with the content dimmed to flat gray tones. Visible areas are clear. The boundary is
   a hand-drawn wavy ink line.
6. **Targets/FX**: inked target markers, angular starburst "POW" shapes for front contact
   (scaled by pressure), comic dust and speed lines, and a rough red "X" ping for rejected
   commands.

The camera supports pan (WASD, arrow keys, middle-drag, screen-edge) and wheel zoom
(0.5×–3×), clamped to map bounds.

Rendering interpolates nothing positional (cells are discrete). Vein width and film biomass
are eased between flow ticks for smooth thickening.

**Rationale**: Few draw calls (one per layer per mold). The texture-based film scales with
cell count, not with on-screen object count. The whole comic look (outline, cel bands,
hatching, grunge) sits in shaders and baked textures, so it costs a few texture samples per
pixel rather than extra geometry, and the sim stays a simple grid (Constitution I).

**Alternatives considered**: `Graphics` redrawn per frame (simple, but rebuilding thousands of
stroked segments costs too much CPU — kept as a fallback for debugging); a sprite per cell
(76k sprites; wasteful); a full-screen post-process outline (Sobel on the rendered scene).
It outlines everything uniformly, but also outlines pattern and grunge noise, and it cannot
give each element its own outline weight. A per-layer outline was chosen instead.

**Performance note**: the outline pass samples the occupancy texture 4–8 times per pixel. If
that misses the frame budget at the largest map, bake the outline into a half-resolution
texture that is rebuilt only when the film is dirty.

## R10. Simulation loop and time control

**Decision**: Fixed sim tick of 20 Hz (`dt = 0.05` s). The game loop (`requestAnimationFrame`)
accumulates real time × speed (0, 1, 2, 3) and runs whole ticks, at most 8 per frame (spiral-
of-death guard; excess time is dropped and logged in debug). Commands issued while paused are
queued and applied at the start of the next tick (FR-025, SC-007). The game auto-pauses on
`visibilitychange` (hidden) and `blur` (FR-027).

Sub-systems run at their own cadence, derived from the tick counter (deterministic):

| System | Cadence |
|---|---|
| Combat, growth, absorption, upkeep and starvation | every tick |
| Flow solve, vein D update | every 5 ticks |
| Fog incremental / full | every 5 ticks / every 40 ticks |
| AI think | every 16–28 ticks (difficulty R14 plus seeded jitter per rival) |
| Win/loss check, map-control % | every 10 ticks |

**Rationale**: Speed changes only how many ticks run, so 3x gives the same results as 1x
(spec US5 scenario 3). 20 Hz is plenty for slime-paced action and leaves frame budget.

**Alternatives considered**: Variable dt (breaks determinism); running the sim in a Web Worker
(see R13).

## R11. Determinism and seeding

**Decision**:
- PRNG: **sfc32** seeded via splitmix32 from a 32-bit seed. Independent named **streams** are
  derived per subsystem (`mapgen`, `drops`, `ai:<moldId>`, `jitter`), so adding a random call
  in one system does not shift another's sequence.
- Sim code uses only `+ − × ÷`, `Math.sqrt`, `Math.floor`/`min`/`max`/`abs` and integer ops.
  No `Math.sin`/`exp`/`pow`/`random` (`pow`, `exp` and the trig functions are not guaranteed
  bit-identical across engines). Visual-only noise (render) may use anything.
- Iteration order is always by mold id, then cell index. No iteration over object keys of
  data whose insertion order depends on timing.
- A `stateHash()` (FNV-1a over the typed arrays plus pools) supports replay tests
  (SC-006). A `ReplayLog` = seed + round + `[tick, command]` stream.
- The run's seed comes from `Date.now()` at run start, shown on the round-end screen, and can
  be overridden via the URL `?seed=` for debugging and sharing.

**Rationale**: Meets Constitution III and SC-006 within a browser engine. Cross-engine bit-
exactness is helped by avoiding transcendental functions, but it is not a stated requirement.

**Alternatives considered**: Fixed-point integer math everywhere (strongest guarantee, but much
harder to write and tune; can be adopted later if replays must be shareable across engines).

## R12. Procedural map generation

**Decision** (per round, from the `mapgen` stream):

1. Size from the difficulty profile (R14).
2. Terrain: two octaves of value noise (custom implementation, integer-hash based) give a
   field. Obstacles where noise > `obstacleThreshold`; rough terrain in a band below that.
   The map border is a dish wall (obstacle ring).
3. Starts: N+1 start points by best-candidate sampling (maximize minimum distance, with a
   minimum distance from the walls). The player's start is chosen at random among them.
   Each start area (radius 6) is cleared to open terrain.
4. Connectivity: a flood fill from the player's start. Any start not reached gets a corridor
   carved along an A* path that ignores obstacles, then the fill is re-checked (FR-020).
5. Starting food: scatter food clusters by Poisson-disk sampling at a density set by
   `foodScarcity`. Then **fairness pass**: for each start, sum the food value within
   `fairRadius` (25 cells) by path distance, and top up the poorest starts with food until
   all are within ±10% of the richest (FR-020).
6. Validation: reject and regenerate (next derived seed, up to 10 attempts) if the reachable
   open area is < 55% of the map or any check fails. After 10 attempts, fall back to a
   no-obstacle map. That fallback is logged, and a test asserts it is rare.

**Rationale**: Cheap, fully seeded, and the fairness and connectivity checks are directly
testable (Story 4 scenarios 1 and 3).

**Alternatives considered**: Cellular-automata caves (interesting shapes, but needs
connectivity repair anyway); hand-authored templates (no variety).

## R13. Main thread vs Web Worker

**Decision**: Run the sim on the **main thread** for this feature. Because the sim is pure
and data-only (Constitution I), it can later move to a Worker without design changes. The
plan's perf gate (Constitution V) decides: if the sim tick exceeds 6 ms at the round-10 scale,
move it to a Worker and post snapshots of the typed arrays (transfer or SharedArrayBuffer).

**Rationale**: Simpler debugging and no cross-thread snapshot plumbing until it is shown to be
needed (Constitution VI).

**Alternatives considered**: Worker from day one (extra complexity before there is a
measured need).

## R14. Difficulty curve

**Decision**: `difficultyFor(round)` returns a profile. With `n` = round number (1-based):

| Parameter | Formula | Round 1 | Round 5 | Round 10 | Cap |
|---|---|---|---|---|---|
| Rival count | `min(1 + floor((n−1)/2), 5)` | 1 | 3 | 5 | 5 (round 9) |
| Map size scale | `min(1 + 0.08(n−1), 2.0)` | 160×120 | ≈211×158 | ≈275×206 | 320×240 (round 14) |
| Food density | `max(1 − 0.05(n−1), 0.5)` | 1.0 | 0.8 | 0.55 | 0.5 (round 11) |
| Rival aggression | `min(0.2 + 0.08(n−1), 0.9)` | 0.2 | 0.52 | 0.9 | 0.9 (round 10) |
| Rival start nutrients ×| `1 + 0.1(n−1)` (uncapped) | 1.0 | 1.4 | 1.9 | — |
| AI think interval | `max(1.4 − 0.05(n−1), 0.8)` s | 1.4 | 1.2 | 0.95 | 0.8 |
| Drop interval | 35 s ± 10 s (constant) | | | | |

Every parameter is monotonic toward harder. Rival start nutrients is uncapped, so every round
is strictly harder than the last in at least one dimension (Story 4 scenario 2). A unit test
asserts this for rounds 1–50.

**Rationale**: Stepwise rival count gives felt jumps. The other settings ramp smoothly in
between. Targets SC-005 (win round 1 more than 80% of the time, reach round 10 under 20% of the
time); validated with the headless batch tool (R15).

## R15. Testing and balance tooling

**Decision**:
- **Vitest** for headless sim tests (unit: rng, mapgen validity, flow, growth, combat,
  fog/view, difficulty monotonicity; integration: full scripted rounds, determinism via
  `stateHash`, pause/queue).
- **Import-boundary test**: scan `src/sim/**` and fail on any import of `pixi.js`, `src/render`,
  `src/ui`, or DOM globals. Scan `src/sim/ai/**` and fail on any import of the world internals
  (Constitution I, II).
- **Batch sim tool** (`npm run sim:batch -- --rounds 1..10 --games 200`): plays AI-vs-AI
  rounds, with a "player" driven by the same AI at medium aggression, and reports round-length
  distribution and win rates. Used for SC-002 and SC-005, and as a perf benchmark (ticks/s at
  each round's scale). Runs with `tsx` (dev-only dependency).
- **Perf**: `vitest bench` on the sim tick at round-10 scale. Budget: tick ≤ 6 ms average on
  the reference laptop. Render is profiled in the browser (Chrome Performance panel); budget
  16.6 ms frame.
- **Playtest checklists** per story in tasks.md (Constitution IV).

## R16. UI technology for HUD and screens

**Decision**: HUD, slider, and screens (start, round end, pause) are plain DOM and CSS
overlaid on the Pixi canvas, with no UI framework. The slider is a native `<input type=range>`
(accessible, keyboard friendly). The UI reads a small per-frame `HudModel` derived from sim
state and issues commands through the same queue as map clicks.

**Rationale**: Few screens, so a framework isn't needed. Native controls give accessibility
for free. Keeps runtime dependencies to PixiJS only (Technical Constraints).

**Alternatives considered**: Pixi-drawn UI (more work for text and inputs); React or Preact
(not needed at this size).

## R17. Persistence

**Decision**: `localStorage` key `slime-mold:v1:best` stores `{ bestRound: number }`. All
access is wrapped in try/catch, and the game works without it (spec edge case). There is no
mid-run save (out of scope; a run is one sitting).

## R18. Color and accessibility

**Decision**: Player is always a warm yellow (classic Physarum). Rivals come from a
color-blind-safe palette (Okabe–Ito–derived: orange, sky blue, bluish green, vermillion,
reddish purple), pushed toward punchy comic saturation against a muted, dirty map palette.
Each mold also gets a distinct **ink pattern** in the shadow band of the ink-film filter
(`toon.frag`): plain, diagonal hatching, halftone dots, concentric rings, cross-hatch. This
suits the comic style and lets molds be told apart without color (FR-033). All molds use the
same near-black outline, so outline color never carries mold identity. The HUD rival list
shows the same color and pattern swatch.

## R19. UI and HUD styling

**Decision**: The DOM HUD (R16) is styled as comic panels: thick black borders, a hard offset
drop shadow, slight rotation (±1°) on panels, flat fills with a halftone overlay (CSS
gradients), and a bold hand-lettered display font with a plain readable fallback. The font is
loaded from Google Fonts at runtime (Bangers or Permanent Marker for titles, a plain
sans-serif for numbers) or bundled as a static file, and the HUD stays legible if it fails to
load. The allocation slider is drawn as a chunky inked bar with a thick handle. Toasts and
the round-end screen use speech-bubble and burst shapes.

**Rationale**: One consistent look across canvas and UI at no cost to accessibility, as long
as contrast and text size are kept (checked in T097).

**Alternatives considered**: Pixi-drawn UI for a perfect style match (more work for text and
inputs, see R16).
