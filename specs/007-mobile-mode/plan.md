# Implementation Plan: Mobile Mode

**Branch**: `007-mobile-mode` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-mobile-mode/spec.md`

## Summary

Make the game playable on a phone held in landscape without touching the simulation. A touch-mode flag
(auto-detected from a coarse, hover-less pointer, overridable in Settings) switches the UI layer: a pure
gesture recognizer turns pointer events into tap, pan, pinch and long-press; the input controller maps
those to the same commands the mouse and keyboard send; building placement becomes preview, then
Confirm or Cancel; the HUD, build bar and farm panel get a touch layout through one root CSS class;
hover hints become tap hints; portrait shows a rotate overlay and pauses; page gestures are disabled;
and touch mode starts on Low quality. Everything lives in `src/ui`, `src/game`, `src/main.ts` and CSS.

## Technical Context

**Language/Version**: TypeScript 5 on Node 24 (browser target: current iOS Safari and Android Chrome)

**Primary Dependencies**: PixiJS 8 (unchanged), Vite, Vitest. No new dependencies.

**Storage**: Settings in `localStorage` (`slime-mold:v1:settings`), one new field `touchMode`.

**Testing**: Vitest headless for the pure parts (detection, gesture recognizer, input mapping, settings
defaults, boundaries); manual playtest checklist on a phone for feel and layout (Constitution IV).

**Target Platform**: Phone and tablet browsers, landscape, GitHub Pages at `/slime-mold/`.

**Project Type**: Single-page browser game (single project).

**Performance Goals**: at least 30 fps on a typical recent phone on default settings (SC-004); desktop
unchanged.

**Constraints**: no `src/sim` changes (state hash identical); touch input reaches the sim only as the
existing `Command`s; fog fairness preserved; desktop behavior unchanged when touch mode is off.

**Scale/Scope**: about 6 new small files, edits to `input.ts`, `main.ts`, `hud.ts`, `screens.ts`,
`farm-panel.ts`, `settings.ts`, `styles.css`, `index.html`.

## Constitution Check

- **I. Simulation is the source of truth**: PASS. Touch maps to the same `Command`s; nothing in `src/sim`
  changes; the gesture recognizer is UI code with no sim access.
- **II. Same rules for every mold**: PASS. No rules change.
- **III. Seeded & reproducible**: PASS. No randomness added; a test replays one command stream through
  mouse-style and touch-style input and compares the state hash.
- **IV. Test the rules, playtest the fun**: PASS. Pure logic gets unit tests; each story gets a phone
  playtest checklist.
- **V. Smooth at scale**: PASS. Touch starts on Low and draws at 1 pixel per CSS pixel; the existing
  governor can still raise quality.

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-mobile-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── touch-controls.md
├── checklists/
│   ├── requirements.md
│   └── playtest.md          # added with the tasks
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── ui/
│   ├── touch-mode.ts        # NEW: detect + resolve Auto/On/Off, apply root class, portrait watcher
│   ├── gestures.ts          # NEW: pure recognizer (tap, pan, pinch, long-press)
│   ├── touch-bar.ts         # NEW: Confirm/Cancel bar with the placement reason, Home, Clear all
│   ├── tap-hints.ts         # NEW: tap an element with a title to show it as a toast (touch only)
│   ├── input.ts             # EDIT: touch path using gestures; pending placement; no edge pan on touch
│   ├── hud.ts, farm-panel.ts, buildbar.ts, screens.ts   # EDIT: touch hooks and Settings row
│   └── styles.css           # EDIT: `.touch` layout, 44 px targets, rotate overlay, page-gesture lock
├── audio/settings.ts        # EDIT: touchMode field, defaults override (quality low on touch)
├── main.ts                  # EDIT: wire mode, resolution, portrait pause, pending placement ghost
└── sim/                     # UNTOUCHED
index.html                   # EDIT: viewport meta (no user scaling, viewport-fit=cover), touch-action
tests/unit/ui/               # NEW: touch-mode, gestures, input-touch, tap-hints
tests/unit/audio/settings.test.ts   # EDIT
tests/integration/touch-determinism.test.ts   # NEW
```

**Structure Decision**: single project; all work in the UI layer. The recognizer is its own pure module
so thresholds and edge cases test without a DOM.

## Complexity Tracking

None.
