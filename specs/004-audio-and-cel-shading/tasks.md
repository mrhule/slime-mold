---

description: "Task list for 004-audio-and-cel-shading"
---

# Tasks: Audio and Cel-Shaded Look

**Input**: Design documents from `/specs/004-audio-and-cel-shading/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included (Constitution IV) for all pure logic (cue mapping, limiter, bands, light side,
shake, quality, settings) and for determinism with audio attached. How it sounds and looks is covered
by a playtest checklist per story.

**Organization**: Grouped by user story. US1, US2 and US3 are P1 and make up the **MVP (Phases 1–5)**.
Nothing in `src/sim/` changes in this feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 Sound and music · US2 One light and shading · US3 Banded veins and pulses ·
  US4 Fight impact and shake · US5 Shadows and line weight · US6 Print texture
- References like (A5) point to [research.md](research.md); FR/SC IDs point to [spec.md](spec.md)

---

## Phase 1: Setup

**Purpose**: Confirm the starting point

- [X] T001 Confirm branch `004-audio-and-cel-shading`, `.specify/feature.json` pointing at `specs/004-audio-and-cel-shading`, and a green baseline (`npm run typecheck`, `npm test`); note the test count in `specs/004-audio-and-cel-shading/tasks.md` under Implementation notes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared style table, settings, fog-safe event filter, quality plumbing, and the boundary rules every story uses

**⚠️ CRITICAL**: No story work can begin until this phase is complete

- [X] T002 Create `src/render/style.ts` (FR-018, data-model.md "Style table"): `light` (unit vector toward the light, (-0.6, -0.8) normalized), `veinBands` (`halfWidth: [1.2, 2.2, 3.4]`, `up: [1.2, 3.0]`, `down: [0.9, 2.4]`), `outline` (`padLit: 1.0`, `padShade: 2.4`, `strokeShift: [1.0, 1.2]`), `shadow` (`veinOffset: [2.5, 3.5]`, `veinAlpha: 0.35`, `groundOffset: [3, 4]`, `groundAlpha: 0.3`), `pulse` (`minFlow: 0.05`, `lightFlow: 0.5`, `heavyFlow: 2.0`, `speed: 1.6`), `shake` (`max: 6`, `k: 1.2`, `decaySeconds: 0.25`), `splats` (`maxPerFrame: 12`, `lifeSeconds: 0.5`), and `quality: { high: {...}, low: {...} }` with `veinShadow`, `pulses`, `printFilter`, `splatScale` as in contracts/render-style.md
- [X] T003 [P] Add `litSide(nx, ny)` to `src/render/style.ts`: returns `1` when the edge normal `(nx, ny)` faces the light (`dot > 0`) and `-1` otherwise, and `jointU(dx, dy)` returning `-(dx*light.x + dy*light.y)` for round joints (A8)
- [X] T004 Refactor `src/game/storage.ts`: export a `safeLocalStorage()` helper and small `readJson(store, key)` / `writeJson(store, key, value)` wrappers (all in try/catch, as today); keep `createStorage` and the best-round key behaviour unchanged (A15)
- [X] T005 Create `src/audio/settings.ts`: `Settings` type `{ muted, sfxVolume, musicVolume, reduceMotion, quality: 'auto' | 'high' | 'low', printTexture }`, `defaultSettings()` (`muted` false, `sfxVolume` 0.8, `musicVolume` 0.5, `reduceMotion` from `matchMedia('(prefers-reduced-motion: reduce)')` guarded for missing `matchMedia`, `quality` `'auto'`, `printTexture` false), `loadSettings(store?)` validating each field against its type and range (volumes clamped to 0..1, unknown `quality` falls back to `'auto'`), `saveSettings(settings, store?)`; key `slime-mold:v1:settings` (contracts/settings.md)
- [X] T006 [P] Test settings in `tests/unit/audio/settings.test.ts`: defaults when storage is empty, null, throws on read, or holds invalid JSON; volumes clamp; unknown quality falls back; a saved value round-trips; saving to a throwing store does not throw
- [X] T007 Create `src/game/frame-events.ts`: `visibleDeaths(world, events, playerId)` returns `{ own: boolean; byEnemy: boolean; cell: number; mold: number }[]` for every `cellDied` event whose cell has the player's `vision[cell] === 2`; events in fog are dropped (A3, FR-005). It imports only sim types
- [X] T008 [P] Test `visibleDeaths` in `tests/unit/game/frame-events.test.ts`: a death in view is returned with `own` and `byEnemy` set correctly; a death in remembered or unseen fog is dropped; a death with `by === 0` (starvation) is `byEnemy: false`
- [X] T009 Create `src/render/quality.ts`: `QualityGovernor` with `update(dtSeconds, fps, setting)` and `level`; for `'auto'` it drops from `high` to `low` after fps stays under 45 for 3 s and returns to `high` after fps stays over 58 for 20 s; `'high'` and `'low'` pin the level; thresholds come from `style.ts` (A14)
- [X] T010 [P] Test the governor in `tests/unit/render/quality.test.ts`: drops after sustained low fps, not after a single slow frame; recovers only after sustained high fps; pinned settings ignore fps; a hovering fps near the threshold does not flip repeatedly
- [X] T011 Plumb quality into `src/render/renderer.ts`: `GameRenderer` gets `quality: 'high' | 'low'` and `setQuality(level)`; layers read `style.quality[level]` for which passes to draw; nothing draws differently yet
- [X] T012 Extend `tests/boundaries.test.ts`: `src/audio/**` may import only `../sim/types`, `../sim/index` (types only) and other `src/audio` files; no file under `src/sim/` may import `src/audio` or `src/render`; render may import `../sim/index` (as it already does for `boosterCover`)

**Checkpoint**: Style, settings, fog-safe death filter, quality governor, and boundary rules exist; no behaviour has changed yet

---

## Phase 3: User Story 1 - Sound Effects, Music, and Mute (Priority: P1) 🎯 MVP

**Goal**: The game makes the listed sounds, plays a looping music track, and can be muted and adjusted

**Independent Test**: Play a round and confirm every listed event makes its sound; mute silences everything and the setting survives a reload (quickstart scenarios 1–3)

### Tests for User Story 1 ⚠️

- [X] T013 [P] [US1] Test the limiter in `tests/unit/audio/limiter.test.ts`: a cue within its minimum interval is dropped; more than the per-second maximum is dropped; a bypass cue skips the interval; the global voice cap drops extra requests and recovers as voices end
- [X] T014 [P] [US1] Test the director in `tests/unit/audio/director.test.ts`: `grow` when `playerCells` rises, none when it falls; `squelch` when gathered rises; `warn` and `land` from drop events; `place` and `refuse` only for the player's mold; `frontWon` when visible enemy deaths dominate and `frontLost` when own deaths dominate; no front cue from an empty `visibleDeaths`; `roundStart`, `roundWin` and `roundLose` on run-state transitions only once each (contracts/audio-cues.md)
- [X] T015 [P] [US1] Test the music scheduler's pure part in `tests/unit/audio/music.test.ts`: the same seed gives the same note sequence; all notes belong to the scale; the loop length is 8 bars; scheduling never queues notes further than the lookahead
- [X] T016 [P] [US1] Test the engine with no audio in `tests/unit/audio/engine.test.ts`: with `AudioContext` undefined or throwing, `unlock`, `play`, `setRunning` and `startMusic` never throw; with a minimal fake context, `setRunning(false)` suspends and `setRunning(true)` resumes, and mute sets the master gain to zero
- [X] T017 [US1] Integration test in `tests/integration/audio-determinism.test.ts`: run 600 ticks of a fixed-seed round with a director fed each frame, and again without; `stateHash` is identical (SC-006); the director never mutates the world (compare a deep snapshot of cells and pools before and after)

### Implementation for User Story 1

- [X] T018 [P] [US1] Create `src/audio/limiter.ts`: `Limiter` with `admit(cue, nowMs, bypass)` using the per-cue minimum interval, maximum per second and a global voice cap from the cue table in data-model.md (A4)
- [X] T019 [US1] Create `src/audio/director.ts`: `Director.update(snapshot)` returning `CueRequest[]` per the mapping in contracts/audio-cues.md; it keeps the previous snapshot for deltas and a one-second window for front cues; `strength` is capped to 0..1 (FR-001, FR-004)
- [X] T020 [P] [US1] Create `src/audio/synth.ts`: a recipe per cue (`grow`, `squelch`, `warn`, `land`, `place`, `refuse`, `frontWon`, `frontLost`, `roundStart`, `roundWin`, `roundLose`) using oscillators, a shared one-second noise buffer, a biquad filter and gain envelopes; each recipe takes `(ctx, bus, strength, when)` and schedules its own cleanup (A1)
- [X] T021 [US1] Create `src/audio/music.ts`: a generative ambient loop on a lookahead scheduler (100 ms timer, 0.4 s ahead): a drone of two detuned oscillators through a low-pass, plus sparse plucks from a minor pentatonic scale, 8 bars at about 56 BPM, notes from a small local seeded generator, connected to the music bus; `start()` and `stop()` (A5)
- [X] T022 [US1] Create `src/audio/engine.ts`: lazy `AudioContext` created on `unlock()`; buses `master`, `sfx`, `music`; `play(request)` runs the limiter then the synth recipe; `setSettings` maps `muted` and volumes to gains; `setRunning` suspends or resumes the context; every method is a no-op when audio is unavailable (A6, A7, FR-002)
- [X] T023 [US1] Wire audio into `src/main.ts`: load settings once; build a `DirectorSnapshot` per rendered frame from the player's `cellCount`, `stats.nutrientsGathered`, `run.state`, `visibleDeaths(...)` and the frame's events; call `engine.play` for each cue; call `engine.unlock()` and `engine.startMusic()` from the first `pointerdown` or `keydown`; call `engine.setRunning(run.state === 'playing' && !document.hidden)`
- [X] T024 [US1] Add a mute button to `src/ui/hud.ts` (a speaker icon in the HUD corner, always visible, `aria-label` "Mute", toggles `muted`, saves) and styles in `src/ui/styles.css` in the comic style (contracts/settings.md)
- [X] T025 [US1] Add a Settings section to the pause menu in `src/ui/screens.ts` with a Sound volume slider, a Music volume slider, and the mute toggle, wired to `Settings`, applied immediately, saved with `saveSettings`; styles in `src/ui/styles.css`; the menu keeps working when storage is unavailable
- [X] T026 [US1] Playtest checklist `specs/004-audio-and-cel-shading/checklists/playtest.md` (US1 section): every listed event has a distinct cue; nothing becomes a wall of noise in a big fight at 3x; mute and sliders work and persist; Space and Esc stop and resume sound; music is pleasant on loop for ten minutes and not tiring; a tab switch and back resumes cleanly

**Checkpoint**: US1 is playable: sound, music, mute and volume work

---

## Phase 4: User Story 2 - One Light and Hard-Stepped Shading (Priority: P1)

**Goal**: Every object has a lit side facing the upper left and a shadow side facing away, in hard bands

**Independent Test**: View veins, buildings, food and obstacles together; each is lit on the same side (quickstart scenario 4)

### Tests for User Story 2 ⚠️

- [ ] T027 [P] [US2] Test the light helpers in `tests/unit/render/style.test.ts`: `litSide` is `1` for normals facing up-left and `-1` facing down-right; flipping an edge's direction keeps the lit side in the same world position; `jointU` is symmetric and zero perpendicular to the light; the `light` vector has length 1

### Implementation for User Story 2

- [ ] T028 [US2] Update `src/render/vein-layer.ts`: when building edge quads, compute the normal `(nx, ny)` and multiply the cross-axis coordinate `u` of all four vertices by `litSide(nx, ny)` so the lit side is always the `u < 0` side; for round joints set `u = jointU(ux, uy)` instead of `ux`; no shader change is needed (A8)
- [ ] T029 [P] [US2] Update `src/render/building-layer.ts`: give the farm, booster, harvester and store house a highlight on the upper-left and a darker lower-right band in flat steps, consistent with `style.light`; keep each shape recognizable by silhouette and keep stale (remembered) buildings in the muted grey with no new detail
- [ ] T030 [P] [US2] Update `src/render/food-layer.ts`: the same lit and shadow bands on each food type's cells, keeping the food-type shapes and the size cue
- [ ] T031 [US2] Check the glass obstacles in `src/render/terrain-layer.ts` already match the light (lit rim up-left, shadow down-right); adjust only if they disagree with `style.light`
- [ ] T032 [US2] Playtest checklist (US2 section): every object is lit from the upper left; mold ink patterns still read on lit and shadow sides; shading never hides a pattern in grayscale; zoomed all the way in and out the bands do not shimmer

**Checkpoint**: US1 and US2 work independently; the look has one light

---

## Phase 5: User Story 3 - Banded Veins and Flow Pulses (Priority: P1)

**Goal**: Vein widths snap to three bands that follow flow, and pulses travel along fed veins

**Independent Test**: Grow a trunk with branches and confirm three distinct widths with no flicker, and pulses moving toward the tip (quickstart scenarios 4–5)

### Tests for User Story 3 ⚠️

- [ ] T033 [P] [US3] Test banding in `tests/unit/render/bands.test.ts`: `bandOf(conductivity, previous)` returns thin, medium, thick at the thresholds in `style.ts`; a value hovering between `down` and `up` keeps the previous band (hysteresis); a value sweeping up then down changes bands at different thresholds
- [ ] T034 [P] [US3] Test pulses in `tests/unit/render/pulse.test.ts`: `pulseCount(|flow|)` is `0` below `minFlow`, `1` for light flow, `2` for heavy flow, monotonic, and `0` for `NaN` or negative zero

### Implementation for User Story 3

- [ ] T035 [US3] Add `bandOf(conductivity, previous)` and `pulseCount(flow)` to `src/render/style.ts` with the thresholds from the style table (A10, A11)
- [ ] T036 [US3] Update `src/render/vein-layer.ts`: replace the continuous `half` with `style.veinBands.halfWidth[band]`; keep a `Uint8Array(width * height * 4)` of previous bands allocated once per round in the constructor (no per-rebuild allocation); round joints use the widest incident band
- [ ] T037 [US3] Update `src/render/shaders/vein.frag` and the style attribute: replace the marching ink dashes with hard-edged cream pulses that move in the flow direction, count from `pulseCount` (passed per edge in the existing `flow` attribute as a band), phase offset hashed per edge, none where `|flow|` is under `minFlow`; honour `style.quality[level].pulses` by setting a `uPulses` uniform to `0` on Low
- [ ] T038 [US3] Playtest checklist (US3 section): the three widths read as thin line, tube and trunk; a busy trunk throbs and an idle branch is still; pulses shift toward fronts when the slider goes to Fight; rival veins in view pulse and ones in fog do not appear

**Checkpoint**: MVP complete (US1–US3): sound, one light, banded veins and pulses

---

## Phase 6: User Story 4 - Fight Impact and Screen Shake (Priority: P2)

**Goal**: Visible deaths burst in ink splats, and fights shake the map scaled by size; shake can be turned off

**Independent Test**: Stage a fight, confirm splats and a scaled shake, turn Reduce motion on and confirm they stop; hide a fight in fog and confirm nothing (quickstart scenario 6)

### Tests for User Story 4 ⚠️

- [ ] T039 [P] [US4] Test shake in `tests/unit/render/shake.test.ts`: `shakeImpulse(n)` is `0` for `0` deaths, grows with `sqrt(n)`, and caps at `style.shake.max`; the amplitude decays to under 5% within one second; with `reduceMotion` set, the offset is always `0`; the offset never changes the camera's real `x`, `y` or clamping

### Implementation for User Story 4

- [ ] T040 [US4] Add `shakeImpulse(n)` to `src/render/style.ts` and a decaying shake to `src/render/camera.ts`: `addShake(amount)`, `tickShake(dt)`, and an offset applied inside `apply()` to `world.position` only (never to `x`, `y`, `centerOn` or `clamp`); a small local seeded generator drives the direction; `reduceMotion` makes the offset `0` (A13, FR-014)
- [ ] T041 [US4] Add splats to `src/render/fx-layer.ts`: `addSplat(cell, width, color, pattern)` draws a short comic ink burst in the dying mold's colour with its ink pattern marks, fading over `style.splats.lifeSeconds`; at most `maxPerFrame` per frame, scaled by `style.quality[level].splatScale`
- [ ] T042 [US4] Wire fights in `src/main.ts`: for each entry of `visibleDeaths(...)`, call `renderer.fx.addSplat`; call `renderer.camera.addShake(shakeImpulse(count))` once per frame with the visible count; pass `reduceMotion` from settings to the camera
- [ ] T043 [US4] Add a Reduce motion toggle to the Settings section in `src/ui/screens.ts` (also turns off any flashing, such as repeated bright full-screen effects), applied immediately and saved
- [ ] T044 [US4] Playtest checklist (US4 section): splats read in the dying mold's colour and pattern; shake scales with fight size and never moves the HUD; Reduce motion stops it completely; a fight in fog gives no sound, splat or shake

**Checkpoint**: US4 works; fights feel heavier

---

## Phase 7: User Story 5 - Grounding Shadows and Variable Line Weight (Priority: P2)

**Goal**: Things cast short hard shadows toward the lower right, and outlines are heavier on the shadow side

**Independent Test**: Place veins, buildings and food together and confirm shadows and heavier lower-right outlines (quickstart scenario 7)

### Implementation for User Story 5

- [ ] T045 [US5] Update `src/render/vein-layer.ts`: add a first geometry pass (kind `2`, flat dark, `style.shadow.veinAlpha`) with the same edges and joints offset by `style.shadow.veinOffset`; make the outline pass pad `style.outline.padLit` on the lit side and `padShade` on the shadow side; skip the shadow pass when `style.quality[level].veinShadow` is false; update `vein.frag` to output the shadow colour and alpha for kind `2` (A12)
- [ ] T046 [P] [US5] Update `src/render/building-layer.ts`: draw a flat offset ground shadow under every building (`style.shadow.groundOffset`) before the shape, and stroke each outline twice, once normally and once shifted by `style.outline.strokeShift`; shadows follow the building's own visibility and stale style so nothing leaks through fog (FR-011)
- [ ] T047 [P] [US5] Update `src/render/food-layer.ts` the same way: a ground shadow and a shifted second outline stroke per food item
- [ ] T048 [US5] Update `src/render/terrain-layer.ts` `paintGround`: make the obstacle ink outline thicker where the field one step toward the lower right is outside and thinner where it is inside, within the limited range of `style.outline`; the existing hatched drop shadow stays
- [ ] T049 [US5] Playtest checklist (US5 section): shadows give depth without hiding veins, patterns or fronts in a dense network; outlines look hand-inked, not doubled; fog memory shows no live shadow detail; Low quality removes the vein shadow pass and nothing else breaks

**Checkpoint**: US5 works; the look has depth and hand-inked line weight

---

## Phase 8: User Story 6 - Print Texture and Halftone (Optional, Priority: P3)

**Goal**: An optional halftone, grain and colour-fringe pass, off by default and kept only if it looks good

**Independent Test**: Toggle it in a busy fight; molds, food and fronts stay readable, and off returns the exact previous look (quickstart scenario 9)

- [ ] T050 [US6] Spike: in a scratch file (not committed) confirm the PixiJS 8 filter API (`Filter.from` with a GLSL fragment, the default filter vertex, `uTexture` sampling, resolution handling) by applying a trivial tint filter to the world container; record the working shape in `specs/004-audio-and-cel-shading/research.md` under A9
- [ ] T051 [US6] Create `src/render/print-filter.ts`: a filter that samples the scene, darkens with a halftone dot pattern whose size is a fixed screen size divided by the camera zoom and whose coverage rises in darker areas, adds a subtle grain, and samples red and blue with a small opposite offset for the fringe; exposes `setZoom` and `setEnabled`
- [ ] T052 [US6] Apply it in `src/render/renderer.ts`: attach the filter to `world` only when `printTexture` is on and the quality level is High; detach it otherwise so off returns the previous look exactly (SC-007)
- [ ] T053 [US6] Add a Print texture toggle to the Settings section in `src/ui/screens.ts`, saved; hide it if the filter could not be created
- [ ] T054 [US6] Playtest checklist (US6 section) and decision: compare on and off in a busy late-round scene; every mold, food item and front stays readable at a glance; keep the filter only if it improves the look, and otherwise remove it (record the decision in Implementation notes)

**Checkpoint**: US6 is decided: kept behind its toggle, or removed

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality wiring, settings completeness, performance, docs, and a clean-checkout validation

- [ ] T055 Wire the quality governor in `src/main.ts`: feed the frame rate each frame, call `renderer.setQuality(governor.level)`, and add the Quality control (Auto / High / Low) to the Settings section in `src/ui/screens.ts`, saved (FR-016, A14)
- [ ] T056 [P] Performance check at the largest map and rival count with every effect on High: record the frame rate from `?debug` in `specs/004-audio-and-cel-shading/checklists/playtest.md`; confirm Auto drops to Low on a throttled tab and that Low restores the frame rate (SC-005)
- [ ] T057 [P] Update `README.md`: sound and music, the mute button and Settings menu, quality levels, and the new look in the feature list; mention that audio starts after the first click
- [ ] T058 Run every scenario in [quickstart.md](quickstart.md) and complete the playtest checklist; fix what is found (this is the manual half of Constitution IV)
- [ ] T059 Fresh-clone validation: clone the repo, `npm install`, `npm run typecheck`, `npm run build`, `npm test`, `npx tsx tests/bench/tick.bench.ts`; confirm the test count and that `src/sim/` has no diff in this feature (`git diff main -- src/sim` is empty apart from earlier features)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2** first. Phase 2 blocks everything.
- **US1** needs T005 (settings), T007 (visible deaths), T012 (boundaries). It touches `src/audio/`, `main.ts`, `hud.ts`, `screens.ts`.
- **US2** needs T002–T003 and touches `vein-layer.ts`, `building-layer.ts`, `food-layer.ts`.
- **US3** needs T002 and builds on US2's `vein-layer.ts` changes, so it follows US2.
- **US4** needs T007, T011 and the settings from US1 (Reduce motion lives in the same menu section).
- **US5** touches `vein-layer.ts`, `building-layer.ts`, `food-layer.ts`, `terrain-layer.ts`, so it follows US2 and US3.
- **US6** needs T011 and the settings menu; it is last and removable.
- **Polish** last.

**Same-file ordering**: `vein-layer.ts` is edited by T028 → T036 → T037 → T045 in that order;
`building-layer.ts` by T029 → T046; `food-layer.ts` by T030 → T047; `src/main.ts` by T023 → T042 → T055;
`src/ui/screens.ts` by T025 → T043 → T053 → T055.

## Parallel Opportunities

- Phase 2: T003, T006, T008, T010 alongside their implementations.
- US1 tests T013–T016 together; T018 and T020 in parallel; T021 after T018.
- US2: T029 and T030 together.
- US3: T033 and T034 together.
- US5: T046 and T047 together.
- Polish: T056 and T057 together.

## Implementation Strategy

1. **MVP**: Phases 1–5 (US1, US2, US3): sound and music, one light, banded veins with pulses. Playtest
   before adding more.
2. **Then** US4 (fight feel), US5 (depth), in that order, checking readability after each.
3. **Last** US6, with an explicit keep-or-drop decision, then Polish.

## Implementation notes

*(to be filled in as tasks are completed)*
