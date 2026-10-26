# Research: Mobile Mode

## M1. Detecting a touch-first device

**Decision**: touch mode is on when `matchMedia('(pointer: coarse)')` matches and `(hover: none)` matches
(the primary pointer is a finger). Settings has Touch mode: Auto (use detection), On, Off.

**Rationale**: the primary-pointer media features separate phones and tablets from laptops with a
touchscreen and a mouse, which report a fine pointer and hover. User-agent sniffing is brittle.

**Alternatives**: window width (a narrow desktop window would get the phone layout); `maxTouchPoints`
alone (true on touch laptops).

## M2. Gesture recognition

**Decision**: a pure state machine fed `down(id, x, y, t)`, `move`, `up`, `cancel` and a `tick(t)` for the
long press. Thresholds: tap if moved under 10 px and released within 350 ms; pan starts after 8 px of
movement; long press after 500 ms still and under 10 px; a second finger starts a pinch (zoom around the
midpoint by the ratio of finger distances) and cancels any tap or long press; a gesture that became a pan
or pinch never ends as a tap, and a lifted finger after a pinch does not start a new tap until all fingers
are up.

**Rationale**: pure code with injected time tests deterministically and keeps `input.ts` small.

**Alternatives**: browser gesture events (iOS only); a library (new dependency, overkill).

## M3. Long press cancels a target

**Decision**: a long press within the existing 16 px marker hit radius (grown to 28 px on touch) of a target
sends `cancelTarget`; elsewhere it does nothing. A "Clear all" button sends `clearTargets`.

## M4. Placement on touch

**Decision**: with a building chosen, a tap sets `pendingCell` (not a command). `placePreview` already
returns the allowed flag, the reason and cap hints, so the touch bar shows that text and Confirm sends the
same `placeBuilding` command the mouse click sends. Cancel, choosing another building, or Esc clears it.
The ghost is drawn at `pendingCell`. Panning does not clear it. The bar sits at the bottom centre, away
from the finger.

**Rationale**: no sim change; "nothing built before Confirm" is enforced by sending no command until then.

## M5. Page gestures and sizing

**Decision**: viewport meta `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no,
viewport-fit=cover`; in touch mode the root gets `touch-action: none` on the canvas and
`overscroll-behavior: none`, `user-select: none`, `-webkit-touch-callout: none` on the document; scrollable
menus keep `touch-action: pan-y` so Settings can be scrolled. The system back gesture is untouched.

## M6. Touch layout

**Decision**: a `touch` class on `<html>` swaps CSS: HUD becomes a compact left strip (time, nutrients,
income, map control, clock buttons and slider with 44 px targets), the build bar moves to the right edge
as a column of 56 px buttons, the farm panel docks bottom-right with 56 px dial buttons, toasts move to
the top centre. Home and Clear-all are small round buttons under the build bar. All `title` hints are
shown by tapping (M7).

## M7. Hover hints become tap hints

**Decision**: in touch mode a delegated click listener finds the nearest ancestor with a `title` inside the
HUD and build bar and shows that text as a toast for 3 s, without blocking the control's own action (for
the build bar the action is "choose this building", which also shows its blurb).

## M8. Portrait and rotation

**Decision**: in touch mode a full-screen overlay (CSS, shown by `@media (orientation: portrait)`) asks for
landscape; a `matchMedia` listener calls the same auto-pause the tab-hidden path uses and resumes only if
the pause was that one, so a player pause stays.

## M9. Lighter graphics

**Decision**: `loadSettings` takes defaults; in touch mode the default Quality is `low` (a saved choice
still wins). The renderer already draws at resolution 1 with no auto density, so on touch the canvas draws
one pixel per CSS pixel; this is made explicit in `app.init` for touch so a later change to the default
cannot raise it. The governor can still raise Low to High under Auto.

## M10. Audio unlock

**Decision**: the existing `pointerdown` unlock already covers touch (`pointerdown` fires for fingers). The
unlocking tap is also a normal tap on the title Start button, which is intended; on the map it would set a
target, which is the same as desktop, so no change beyond making sure the listener is `passive`.
