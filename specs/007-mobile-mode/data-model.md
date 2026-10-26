# Data Model: Mobile Mode

No simulation state changes. These are UI-only values.

## Settings (extended)

| Field | Values | Default | Notes |
|-------|--------|---------|-------|
| `touchMode` | `'auto' \| 'on' \| 'off'` | `'auto'` | invalid saved values fall back to `auto` |
| `quality` | `'auto' \| 'high' \| 'low'` | `auto`, or `low` when touch mode is active and nothing is saved | a saved value always wins |

Stored in the existing settings record (`slime-mold:v1:settings`); older records load fine.

## TouchMode (runtime)

`detected: boolean` (coarse pointer and no hover), `setting: auto|on|off`, `active = setting === 'on' ||
(setting === 'auto' && detected)`. Changes at runtime (the Settings switch) toggle the root class and tell
the input controller.

## Gesture (output of the recognizer)

`{ kind: 'tap', x, y } | { kind: 'longpress', x, y } | { kind: 'pan', dx, dy } | { kind: 'pinch', x, y,
factor }`, in screen pixels. Pan and pinch are continuous (one per move); tap and long press fire once.

## PendingPlacement (input controller)

`{ type: BuildingType, cell: number } | null`. Set by a tap in placement mode on a cell; cleared by
Confirm, Cancel, choosing another building, or leaving placement mode. Read by main to draw the ghost and
fill the touch bar from `placePreview`.
