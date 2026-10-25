# Contract: Building Controls

Extends [001 controls](../../001-core-game-loop/contracts/controls.md). Outside placement mode,
every 001 control is unchanged.

| Input | Action |
|---|---|
| Click a build bar button, or press its hotkey (`1` = Nutrient Farm) | Enter placement mode for that building |
| Move the mouse (placement mode) | The ghost follows the cursor, snapped to a cell; green outline = valid, red = invalid, with the reason in a tooltip |
| Left-click (placement mode) | Place the building (`placeBuilding`). The mode ends afterwards, unless Shift is held |
| `Esc` or right-click (placement mode) | Cancel placement, no cost |
| Left-click (outside placement mode) | Set a growth target, as before |

Feedback rules:
- A refused placement shows a toast with the reason in plain words and a rough red "X" ping at
  the cell, as for rejected growth targets.
- The build bar shows cost, `count/limit` for each building, and grays out a button the mold
  cannot afford (the tooltip says why).
- Placing a building plays a short ink "thud" effect on the cell (visual only).
