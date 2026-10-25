# Implementation Plan: Audio and Cel-Shaded Look

**Branch**: `004-audio-and-cel-shading` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-audio-and-cel-shading/spec.md`

## Summary

Adds sound and a stronger comic look without touching the simulation. Technically it is two new
read-only consumers of `Readonly<World>`: an **audio module** (`src/audio/`) that turns per-frame
world snapshots and sim events into procedurally generated Web Audio cues plus a looping generative
music track, and a set of **render changes** (a shared light, banded vein widths, flow pulses,
ground shadows, side-weighted outlines, splats, camera shake, and an optional print-texture
filter). Everything tunable lives in one style/settings file; player choices (mute, volumes, motion,
quality, print texture) persist in a second, separate storage key. Nothing here writes sim state,
adds sim events, or changes `stateHash`. See [research.md](research.md) for each decision.

**Scope of this plan**: the full feature is designed. Implementation order follows the stories:
audio first (cheapest, biggest gain), then light and banded veins with pulses, then fight feedback,
then shadows and line weight, then the optional print texture last, behind its toggle.

## Technical Context

**Language/Version**: TypeScript 7.0 (strict), as in 001

**Primary Dependencies**: PixiJS 8.22, Vite 8.3, Vitest 5.0. **No new dependencies**: audio uses the
browser's Web Audio API directly.

**Storage**: browser `localStorage` under a new key `slime-mold:v1:settings`, wrapped in try/catch
like the best-round key; the game works with it unavailable.

**Testing**: Vitest headless for the pure logic: cue mapping from events and state deltas, the cue
rate limiter, vein width banding with hysteresis, the light-side function, shake scaling, the quality
governor, and settings load/save and defaults; a determinism test that runs a round with the audio
director attached and compares `stateHash`; the import-boundary test extended to cover `src/audio`.
Manual playtest checklist for how it sounds and looks (Constitution IV).

**Target Platform**: current Chrome, Firefox, Edge, Safari on desktop; audio starts after the first
user gesture (autoplay policies).

**Project Type**: single-page browser game (extends the 001 project)

**Performance Goals**: hold 60 fps at the largest map and rival count (001 SC-003). Vein geometry is
already rebuilt only at the flow cadence; pulses are a shader effect (no extra geometry); shadows add
one more pass in the same mesh; audio work is O(events) per frame; the print filter is the only
whole-screen pass and is off on Low quality.

**Constraints**: the simulation stays free of audio, DOM and Pixi imports and is unchanged; the
audio module reads the world and never writes it; nothing about fogged events may be played or drawn;
all numbers (widths, thresholds, light, volumes, limits) live in `src/render/style.ts` and
`src/audio/settings.ts`; no `Math.random` is needed for gameplay, and cosmetic randomness uses a
small local seeded generator so tests are stable.

**Scale/Scope**: about 10 sound cues, one music loop, 6 visual changes, 1 optional filter, 5
settings.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
|---|---|---|
| I. Simulation is the source of truth | Audio and render only read `Readonly<World>` and sim events; no sim change, no new events, no new state; light, shake and sound never feed back | ✅ |
| II. Same rules for every mold | Nothing changes rules; rivals' veins and buildings are shaded by the same code; cues are only for the player's own and visible events | ✅ |
| III. Seeded & reproducible | The sim is untouched and `stateHash` identical with audio on or off (tested); cosmetic variation uses a local seeded generator | ✅ |
| IV. Test the rules, playtest the fun | Pure logic is unit tested; how it sounds and looks is a manual checklist ([quickstart.md](quickstart.md)); all numbers in one style/settings file | ✅ |
| V. Smooth at scale | Pulses in the shader, shadows in the existing mesh, cue limiter, automatic quality governor that drops effects, print filter optional and off on Low | ✅ |
| VI. Playable increments, simplest thing first | Each story is playable alone; generated sound instead of an asset pipeline; print texture last and removable | ✅ |
| Technical constraints, art direction | No new runtime dependency; storage degrades gracefully; effects follow the comic style; mold identity still by pattern and shape, never colour alone | ✅ |

**Post-design re-check (after Phase 1)**: ✅ Still passing. The only items worth noting are the
generative music loop (justified in research A5: no assets, no licensing) and the whole-screen print
filter (research A9: optional, toggled, off on Low, droppable if it does not earn its place).

## Project Structure

### Documentation (this feature)

```text
specs/004-audio-and-cel-shading/
├── spec.md
├── plan.md              # This file
├── research.md          # Decisions A1-A11
├── data-model.md        # Settings, style table, cue table, vein bands, shake and quality state
├── quickstart.md        # Run and validation guide
├── contracts/
│   ├── audio-cues.md    # event/state -> cue mapping, limits, fog rule
│   ├── settings.md      # persisted settings and the menu controls
│   └── render-style.md  # light, bands, shadows, line weights, quality levels
├── checklists/
│   └── requirements.md
└── tasks.md             # Generated by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── audio/                       # NEW (reads the world; no sim, Pixi or DOM-layout imports)
│   ├── settings.ts              # AudioSettings load/save/defaults, volumes
│   ├── limiter.ts               # per-cue rate limiter
│   ├── director.ts              # pure: (snapshot, events) -> cue requests
│   ├── synth.ts                 # cue recipes (Web Audio nodes: noise, oscillators, envelopes)
│   ├── music.ts                 # generative ambient loop with a lookahead scheduler
│   └── engine.ts                # AudioContext lifecycle, gain buses, suspend/resume, unlock
├── render/
│   ├── style.ts                 # NEW: light direction, width bands, line weights, shadow offsets,
│   │                            #      quality levels and what each disables
│   ├── quality.ts               # NEW: QualityGovernor (fps -> level with hysteresis)
│   ├── print-filter.ts          # NEW (last): optional halftone/grain/fringe filter
│   ├── vein-layer.ts            # CHANGED: lit side by light, banded widths, shadow pass, asymmetric pad
│   ├── shaders/vein.frag        # CHANGED: pulses (replaces ink dashes), uses lit side
│   ├── building-layer.ts        # CHANGED: ground shadow, side-weighted outline
│   ├── food-layer.ts            # CHANGED: ground shadow, side-weighted outline
│   ├── terrain-layer.ts         # CHANGED: side-weighted obstacle outline
│   ├── fx-layer.ts              # CHANGED: splat bursts for visible deaths
│   ├── camera.ts                # CHANGED: shake offset (decaying), applied in apply()
│   └── renderer.ts              # CHANGED: owns quality level, forwards shake, adds print filter
├── game/
│   └── storage.ts               # CHANGED: generic safe store helper shared with settings
├── ui/
│   ├── screens.ts               # CHANGED: Settings section in the pause menu
│   ├── hud.ts                   # CHANGED: corner mute button
│   └── styles.css               # CHANGED: settings and mute button styles
└── main.ts                      # CHANGED: wires director, engine, quality, shake, settings

tests/
├── unit/audio/                  # limiter, director, settings, music scheduler (pure parts)
├── unit/render/                 # bands (hysteresis), light side, shake, quality governor, style table
├── integration/audio-determinism.test.ts   # stateHash identical with the director attached
└── boundaries.test.ts           # CHANGED: src/audio may import only sim types; sim never imports audio
```

**Structure Decision**: Single project, extending 001/002/003. Audio is its own folder because it is
a separate consumer of the world with its own tests; render changes stay inside `src/render/`. No
file in `src/sim/` changes.

## Complexity Tracking

> No constitution violations. Two additions worth a line of justification (Principle VI):

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Generative music loop (research A5) | The player asked for background music; generating it needs no assets and no licensing | Bundled audio files add download size, licensing work, and an asset pipeline for a single track |
| Whole-screen print filter (research A9) | The player wanted the halftone/paper look evaluated | A baked texture cannot shade by what is on screen; it is optional, last, and removable if it does not look good |
