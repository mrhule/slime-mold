---

description: "Task list for 007-mobile-mode"
---

# Tasks: Mobile Mode

**Input**: Design documents from `/specs/007-mobile-mode/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included (Constitution IV) for all pure logic (detection, gestures, input mapping, settings,
determinism). Feel and layout on a phone are covered by a playtest checklist per story.

**Organization**: Grouped by user story. US1 and US2 are P1 and make up the **MVP (Phases 1-4)**.
Nothing in `src/sim/` changes in this feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 Play by touch · US2 Build without stray taps · US3 Layout for thumbs ·
  US4 Lighter graphics and a steady page
- References like (M5) point to [research.md](research.md); FR/SC IDs point to [spec.md](spec.md)

---

## Phase 1: Setup

- [ ] T001 Confirm branch `007-mobile-mode` and a green baseline (`npm run typecheck`, `npm test`); note the test count under Implementation notes at the end of this file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Mode detection, the setting, and the gesture recognizer every story uses

- [ ] T002 [P] Add `touchMode: 'auto' | 'on' | 'off'` (default `auto`, invalid values fall back) to `src/audio/settings.ts`, and let `loadSettings(store, defaults?)` take default overrides that a saved value still beats (M9); extend `tests/unit/audio/settings.test.ts`
- [ ] T003 [P] Create `src/ui/touch-mode.ts`: `detectTouch(matchMedia)` (coarse pointer and no hover), `resolveTouch(setting, detected)`, and `applyTouchClass(on)` toggling `touch` on `<html>` (M1); tests in `tests/unit/ui/touch-mode.test.ts`
- [ ] T004 [P] Create `src/ui/gestures.ts`: the pure recognizer with injected time (tap, pan, pinch, long press; thresholds in M2; a pan or pinch never ends as a tap; extra fingers cancel cleanly); tests in `tests/unit/ui/gestures.test.ts` covering every edge case in the spec
- [ ] T005 Add the Touch mode row (Auto / On / Off) to the Settings section in `src/ui/screens.ts` and wire it in `src/main.ts` so changing it toggles the root class and tells the input controller at once (FR-002)
- [ ] T006 [P] Add boundary checks in `tests/boundaries.test.ts` that `src/ui/gestures.ts` and `src/ui/touch-mode.ts` import nothing from `src/sim` internals or render

**Checkpoint**: touch mode can be switched on a desktop; the recognizer is tested.

---

## Phase 3: User Story 1 - Play a Whole Round by Touch (Priority: P1) MVP

**Goal**: map and clock fully usable by finger.

**Independent Test**: with Touch mode On in a touch emulator, play a round by finger only (quickstart 2 and 3).

- [ ] T007 [US1] Add a touch path to `src/ui/input.ts`: when touch mode is on, pointer events with `pointerType` touch or pen go through the recognizer; tap sets a target or selects an own farm exactly as a click does; pan calls `camera.pan`; pinch calls `camera.zoomAt`; long press near a marker (28 px) sends `cancelTarget`; no edge panning in touch mode; mouse behavior untouched when off (FR-003 to FR-005, FR-017)
- [ ] T008 [US1] Create `src/ui/touch-bar.ts` with Clear all (`clearTargets`) and Home (centre on the core) round buttons shown only in touch mode, and mount it from `src/main.ts` (FR-005, FR-006)
- [ ] T009 [P] [US1] Tests in `tests/unit/ui/input-touch.test.ts` with a fake canvas, renderer and world: tap sets a target, a pan then release sets none, a pinch zooms within limits, a long press cancels the nearest target and does nothing elsewhere, tap on own farm selects it, desktop mouse mapping unchanged
- [ ] T010 [US1] Make the HUD pause and speed buttons, the Growth / Fight slider and the farm dial work reliably with `pointerdown` from touch (no 300 ms delay, `touch-action: manipulation` on controls) in `src/ui/hud.ts`, `src/ui/farm-panel.ts` and `src/ui/styles.css`
- [ ] T011 [US1] Playtest checklist `specs/007-mobile-mode/checklists/playtest.md` (US1 section): finish a round by finger only; no accidental target after a pan or pinch

**Checkpoint**: US1 works on its own.

---

## Phase 4: User Story 2 - Build Without Stray Taps (Priority: P1) MVP

**Goal**: preview, then Confirm or Cancel; farm dial by touch.

**Independent Test**: place each building type, cancel one, try an invalid spot, change a farm output by finger (quickstart 4 and 5).

- [ ] T012 [US2] Add `pendingPlacement` to `src/ui/input.ts` with `confirmPlacement()` and `cancelPlacement()`: in touch mode a tap while placing sets the pending cell instead of sending a command; Confirm sends the same `placeBuilding` the click sends; choosing another building, Cancel or Esc clears it; panning keeps it (M4, FR-007)
- [ ] T013 [US2] Show the pending placement in `src/main.ts`: the ghost is drawn at the pending cell and `placePreview` text (allowed, reason, cap hint) goes to the touch bar; extend `src/ui/touch-bar.ts` with Confirm and Cancel (Confirm disabled when not allowed) placed at the bottom centre (FR-008)
- [ ] T014 [P] [US2] Tests in `tests/unit/ui/input-touch.test.ts`: no command before Confirm, Confirm sends exactly one `placeBuilding`, Cancel and another building send none, an invalid spot disables Confirm, pan keeps the pending cell
- [ ] T015 [P] [US2] `tests/integration/touch-determinism.test.ts`: drive one scripted game through mouse-style input and through touch-style input (taps, pending placement, confirm) and assert identical commands and the same `stateHash` (FR-018, SC-006)
- [ ] T016 [US2] Make farm selection and the dial usable by touch: tapping elsewhere deselects, panel docks where the thumb reaches (`src/ui/farm-panel.ts`, `src/ui/styles.css`) (FR-009)
- [ ] T017 [US2] Playtest checklist (US2 section): ten placements with no accidental builds; invalid spot reasons readable without hover

**Checkpoint**: MVP (US1 + US2) is playable on a phone.

---

## Phase 5: User Story 3 - A Layout Made for Thumbs (Priority: P2)

**Goal**: touch layout, tap hints, rotate overlay, scrollable menus.

**Independent Test**: quickstart 6, 7 and 8 on a short landscape phone.

- [ ] T018 [US3] Add the `.touch` layout to `src/ui/styles.css`: compact HUD strip on the left, build bar as a right-edge column of 56 px buttons, farm panel and touch bar at the bottom, toasts at the top centre, every control at least 44 by 44 px, safe-area insets, nothing covering the middle of the map (FR-010, SC-003)
- [ ] T019 [P] [US3] Create `src/ui/tap-hints.ts`: in touch mode a tap on an element with a `title` inside the HUD and build bar shows the text as a toast for 3 s without blocking the action (M7); tests in `tests/unit/ui/tap-hints.test.ts`
- [ ] T020 [US3] Rotate overlay: add the portrait message markup and CSS (`.touch` plus `@media (orientation: portrait)`), and in `src/main.ts` pause through the existing auto-pause on portrait and resume only that pause on landscape (M8, FR-012)
- [ ] T021 [US3] Make the title, pause, round-end and Settings screens fit and scroll with a finger on a short screen (`src/ui/screens.ts`, `src/ui/styles.css`), hiding the keyboard-only hints in touch mode (FR-016)
- [ ] T022 [US3] Playtest checklist (US3 section): controls hit accurately, map mostly visible, hints on tap, rotate and resume, every menu button reachable

**Checkpoint**: layout is comfortable on a phone.

---

## Phase 6: User Story 4 - Lighter Graphics and a Steady Page (Priority: P2)

**Goal**: Low by default on touch, no page gestures, audio on first tap.

**Independent Test**: quickstart 9 and 10.

- [ ] T023 [US4] `index.html` and `src/ui/styles.css`: viewport meta without user scaling and with `viewport-fit=cover`; in touch mode `touch-action: none` on the canvas, `overscroll-behavior: none`, `user-select: none`, `-webkit-touch-callout: none`, menus keep `touch-action: pan-y` (M5, FR-013)
- [ ] T024 [US4] In `src/main.ts` load settings with a `low` quality default when touch mode is active, and pass an explicit resolution of 1 to `app.init` in touch mode (M9, FR-015); desktop options unchanged
- [ ] T025 [P] [US4] Make the audio unlock listener `passive` and confirm the first tap both unlocks sound and acts normally (M10, FR-014)
- [ ] T026 [P] [US4] Tests: settings default quality is low under touch with nothing saved and the saved value wins; touch-mode Auto/On/Off resolution including a laptop (fine pointer, hover) staying off (extend T002 and T003 tests)
- [ ] T027 [US4] Playtest checklist (US4 section): fresh settings start Low; five minutes with no zoom, scroll or refresh; sound after the first tap; Settings switch both ways

**Checkpoint**: all four stories work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Performance check on a real phone in a late round: record the frame rate with `?debug` in the playtest checklist (SC-004); if under 30 fps tune the Low level or the resolution cap
- [ ] T029 [P] Update `README.md`: Mobile section (landscape, gestures, Touch mode setting, Low by default) and the live link
- [ ] T030 Run every scenario in [quickstart.md](quickstart.md) and complete the playtest checklist; fix what is found (the manual half of Constitution IV)
- [ ] T031 Final validation: `npm run typecheck`, `npm run build`, `npm test`, and `git diff <branch point> -- src/sim` is empty; confirm the desktop screenshot is unchanged with touch mode off (SC-007)

---

## Dependencies & Execution Order

- **Phase 2** blocks everything (T002, T003, T004 are parallel; T005 needs T002 and T003).
- **US1** needs T004 and T005. **US2** builds on US1's input changes (same file) and follows it.
- **US3** needs US1 and US2 (it lays out their controls). **US4** needs T002, T003 and can run beside US3 except for shared `styles.css` and `main.ts` edits, so sequence them.
- **Same-file ordering**: `src/ui/input.ts` T007 → T012; `src/main.ts` T005 → T008 → T013 → T020 → T024; `src/ui/styles.css` T010 → T016 → T018 → T021 → T023.

## Parallel Opportunities

- Phase 2: T002, T003, T004, T006 together.
- US1: T009 beside T008. US2: T014 and T015 together. US3: T019 beside T018. US4: T025 and T026 together.

## Implementation Strategy

1. Phases 1 and 2, then US1 and US2 (the MVP), then check on a touch emulator.
2. US3 and US4, then Polish and a real-phone playtest.
3. Nothing in `src/sim/` changes; the determinism test (T015) proves it.

## Implementation notes

(filled in during implementation)
