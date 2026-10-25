# Research: Audio and Cel-Shaded Look

Decisions that shape the plan. Numbers here are first guesses; the final values live in
`src/render/style.ts` and `src/audio/settings.ts` and get tuned by eye and ear.

## A1. Web Audio directly, no library

**Decision**: Use the browser's Web Audio API (`AudioContext`, oscillators, a shared noise buffer,
gain envelopes, a biquad filter) with no audio library.

**Rationale**: The clarification chose generated sound, and the cues are short percussive blips and
squelches that a handful of nodes can make. It keeps the "no runtime dependency beyond PixiJS" rule
(Constitution technical constraints) and the static-files deploy.

**Alternatives considered**: Howler or Tone.js (a dependency for a feature that does not need it);
bundled audio files (rejected in clarification).

## A2. Audio is driven by what the sim already exposes: no new events

**Decision**: A pure `director` takes a small per-frame **snapshot** (player cell count, player
nutrients gathered, run state, visible-death counts) plus the frame's `SimEvent`s, and returns cue
requests. The sim gains nothing.

| Cue | Source |
|---|---|
| grow | player `cellCount` rose since the last frame |
| squelch (absorb) | player `stats.nutrientsGathered` rose since the last frame |
| drop warning / land | `dropWarning`, `dropLanded` events |
| place / refuse | `buildingPlaced` and `commandRejected` events of the player's mold |
| front won / lost | `cellDied` events aggregated per window (see A3) |
| round start / end | `Run` state changes |

**Rationale**: Adding sim events would change nothing for replays but would still touch the sim and
its hash tests; deriving from state deltas keeps the feature purely a consumer (Principle I) and
lets the director be unit-tested with plain objects.

**Alternatives considered**: New `cellBuilt`/`absorbed` sim events (more precise, but couples the
sim to presentation and adds per-cell events at scale).

## A3. The fog rule is enforced in the director's inputs

**Decision**: A `cellDied` event only reaches the director, the splat effects, and the shake when the
player's vision of that cell is "visible now" (`vision[cell] === 2`). Growth and absorption cues are
only for the player's own mold. Drop warnings and landings are global because the core game already
announces them to everyone (001 drops).

**Rationale**: FR-005 and 001 FR-028: a sound is information. Filtering at the input keeps the rule
in one place and testable (a death in fog makes no cue, no splat, no shake).

**Alternatives considered**: Filtering inside each cue (easy to forget one).

## A4. A rate limiter per cue

**Decision**: Each cue has a minimum interval and a maximum events per second; a global cap on
simultaneous voices (about 12). Over-limit requests are dropped, except high-importance cues (drop
warning, round end), which bypass the interval.

**Rationale**: Hundreds of cells growing or dying in one frame must not become a wall of noise
(FR-003). Dropping is cheaper than mixing.

**Alternatives considered**: Merging many requests into one louder cue (more code, less predictable).

## A5. Generative music loop

**Decision**: One ambient loop built from a held drone (two detuned oscillators through a low-pass
filter) and sparse plucked notes from a minor pentatonic scale, on a lookahead scheduler (a 100 ms
timer scheduling about 0.4 s ahead). Eight bars at about 56 BPM, notes chosen with a small local
seeded generator so the loop is stable. Its own gain bus and volume.

**Rationale**: The clarification asked for a looping track with no assets. A pentatonic scale cannot
sound wrong, and the lookahead scheduler is the standard way to keep Web Audio timing steady while
the main thread is busy.

**Alternatives considered**: A recorded loop (assets and licensing); a tracker-style sequence of
fixed notes (sounds the same every time and gets old quickly).

## A6. Start audio on the first gesture

**Decision**: Create the `AudioContext` lazily on the first `pointerdown` or `keydown` and resume it
then. Until then the engine accepts cue requests and silently drops them.

**Rationale**: Browser autoplay policy. The title screen's Start button is the natural first gesture,
so music starts when the round does. If audio is unavailable, the engine is a no-op (edge case:
blocked or missing audio).

## A7. Pause, focus and speed

**Decision**: The engine suspends the context when the run is not `playing` (paused, menu, title,
tab hidden) and resumes on `playing`, so music and cues stop with the game. At 2x/3x nothing changes:
cues are produced per frame from deltas, not per tick, so fast-forward cannot multiply them; the
limiter handles the rest.

**Rationale**: FR "gameplay sounds stop until play resumes" and no pitch or volume surprises at speed.

## A8. One light, applied by flipping the vein's lit side

**Decision**: A fixed light direction `L` (toward the light, from the upper left, about (-0.6, -0.8)).
Each vein edge is a quad whose cross-axis coordinate `u` runs -1 to 1; the shader already draws a
highlight stripe near `u = -1` and a shadow band near `u = +1`. At geometry time the layer takes
`dot(normal, L)` and, when negative, flips the sign of `u` for that edge, so the lit side always faces
the light with **no shader change**. Round joints use `u = -dot(direction, L)`.

**Rationale**: Today the highlight sits on an arbitrary side of each edge, which looks inconsistent
(it follows the edge's drawing direction, not a light). The flip makes a shared light cost nothing at
run time.

**Alternatives considered**: Computing the lit side in the fragment shader (needs the world normal
passed through; more shader work for the same result).

## A9. Print texture as an optional Pixi filter, built last

**Decision**: A filter on the world container that samples the rendered scene, adds a halftone dot
mask that grows in dark areas, a subtle grain, and a small red/blue sample offset (the off-register
fringe). Dot size is in screen pixels divided by zoom so dots scale with the view. It is applied only
when the print setting is on and the quality is High.

**Rationale**: Shading by what is on screen needs the scene as input, which a filter gets for free.
The clarification says to keep it only if it looks good, so it lands behind a toggle at the end and
can be deleted without touching anything else.

**Open item**: confirm the PixiJS 8 filter API (`Filter.from` with a GLSL fragment, default filter
vertex, resolution handling) in a short spike task before building the effect.

**Alternatives considered**: A baked overlay texture (cannot follow the scene's shadows); drawing
halftone into each layer (more code, more places to keep consistent).

## A10. Banded vein widths with hysteresis

**Decision**: Vein half-width snaps to three bands (thin, medium, thick) from the edge's
conductivity, with separate up and down thresholds (for example up at 1.2 and 3.0, down at 0.9 and
2.4) so a value hovering at a threshold does not flicker. The previous band per edge is kept in a
`Uint8Array` the layer owns; geometry is rebuilt at the flow cadence as today.

**Rationale**: Hard bands are the cel-shaded look, and they make the flow information easier to read.
The `Uint8Array` is allocated once per round (no per-rebuild allocation, Principle V).

**Alternatives considered**: Quantizing without hysteresis (visibly flickers when flow drifts).

## A11. Pulses replace the ink dashes

**Decision**: The vein shader's marching ink dashes become bright, hard-edged pulses: cream blobs that
travel in the flow direction, with the number per cell set by the flow band (none below a minimum,
one for light flow, two for heavy) and a phase offset hashed from the edge so pulses do not move in
lockstep. Visible rivals pulse by the same shader; veins in fog are not drawn at all, so none show.

**Rationale**: The shader already marches dashes by signed flow; this keeps the plumbing and changes
only how it looks, so the cost is nil.

## A12. Shadows and side-weighted outlines

**Decision**:
- **Veins**: a third geometry pass first (kind 2): the same edges and joints offset by about (+2.5,
  +3.5) world units, flat dark, about 35% opacity. The outline pass pads **less** on the lit side
  (about 1.0) and **more** on the shadow side (about 2.4), instead of a constant 1.7.
- **Buildings and food**: drawn into `Graphics`; each draws a flat offset ground shadow first, and
  its outline is stroked twice, once normally and once shifted toward the lower right, which reads as
  a heavier line on the shadow side.
- **Obstacles**: the terrain bake already knows the shadow side; the ink outline is made thicker where
  the up-left neighbour is open and thinner elsewhere.

**Rationale**: All are small additions to code that already draws these shapes, using the same
visibility rules, so nothing leaks through fog (FR-011).

## A13. Splats and camera shake

**Decision**: For each visible `cellDied` (A3), the fx layer spawns a short ink splat in the dying
mold's colour (capped per frame; fewer on Low). Shake adds an impulse
`min(max, k * sqrt(n))` per frame with `n` visible deaths, decays exponentially (about 0.25 s), and is
applied as a small random-looking offset to the world container only (never to the DOM HUD). The
offset uses a local seeded generator. "Reduced motion" (a setting, defaulting from
`prefers-reduced-motion`) turns shake and flashing off.

**Rationale**: Combat deaths are the biggest moment (Principle V's "late-round battle"). Applying
shake in `Camera.apply` keeps it out of `centerOn`/clamping so it never moves the real view.

## A14. A quality governor with a menu override

**Decision**: `QualityGovernor` tracks an EMA of frame time. If frame rate stays under about 45 fps
for 3 seconds it drops one level (High to Low); it raises one level only after about 20 seconds above
58 fps. The setting is `Auto` (default), `High` or `Low`; the menu shows it. Low turns off: the vein
shadow pass, pulses, print filter, halftone, and halves splats.

**Rationale**: FR-016 and Principle V. Hysteresis stops it flipping back and forth, and a manual
override lets the player decide.

## A15. Settings stored separately and defensively

**Decision**: A new key `slime-mold:v1:settings` holds `{ muted, sfxVolume, musicVolume,
reduceMotion, quality, printTexture }`. Load validates each field and falls back to defaults;
every access is in try/catch like the best-round key. A shared safe-store helper in `storage.ts`
avoids duplicating the try/catch.

**Rationale**: FR-002 and the Constitution's graceful-degradation rule for storage.
