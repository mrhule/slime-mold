# Contract: Touch Controls

How touch input maps to the existing commands. Touch adds no commands; every sim-changing input is
the same `Command` the mouse or keyboard sends, stamped with the player's mold id.

| Touch | Condition | Result |
|-------|-----------|--------|
| Tap | map, not placing, not on own farm | `setTarget` at the cell |
| Tap | map, on own farm | select the farm (panel opens), no command |
| Tap | map, placing a building | set the pending placement, no command |
| Tap | map, selected farm, empty ground | deselect, then the normal tap action |
| One-finger drag | map | pan the camera by the finger's movement (local only) |
| Pinch | map | zoom about the midpoint, same limits as the wheel (local only) |
| Long press | within 28 px of a target marker | `cancelTarget` for it |
| Long press | elsewhere | nothing |
| Confirm button | pending placement | `placeBuilding`, then leave placement mode |
| Cancel button | pending placement or placing | clear it, no command |
| Clear all button | always | `clearTargets` |
| Home button | always | centre the camera on the core (local only) |
| Farm dial buttons | farm selected | `setFarmOutput` one level up or down |
| HUD pause and speed | always | same as Space and 1, 2, 3 |
| Growth / Fight slider | always | `setAllocation` |

Rules:
- A gesture that moved the map (pan or pinch) never ends as a tap.
- A tap or drag that starts on a control does not reach the map.
- Edge-of-screen panning is disabled in touch mode.
- Touch input uses the same fog and visibility rules as the mouse; the preview and hints read only what
  the player can already see.

## Page behaviour in touch mode

- No page zoom (pinch, double-tap), scroll, bounce, pull-to-refresh or text selection while playing.
- Menus and Settings keep vertical touch scrolling.
- Portrait shows a rotate overlay and pauses the clock; rotating back resumes only that pause.
