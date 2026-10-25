# Contract: Player Controls

Mouse and keyboard on desktop (spec Assumptions). Every action that changes the sim becomes a
[Command](commands.md). Camera and UI actions are local.

| Input | Action | Command |
|---|---|---|
| Left-click on map | Set growth target | `setTarget` |
| Right-click on a target marker | Cancel that target | `cancelTarget` |
| Shift + right-click anywhere | Clear all targets | `clearTargets` |
| HUD slider drag / `Q` / `E` | Allocation −0.1 / +0.1 (toward growth / fight) | `setAllocation` |
| `Space` | Pause / resume | — |
| `1` / `2` / `3` | Speed 1x / 2x / 3x (also unpauses) | — |
| `W A S D` / arrows / screen-edge / middle-drag | Pan camera | — |
| Mouse wheel | Zoom 0.5x–3x around cursor | — |
| `H` | Center camera on own core | — |
| `Esc` | Pause menu (resume, restart run, quit to title) | — |
| `` ` `` (backtick) | Debug overlay (FPS, tick ms, AI scores, seed) — dev builds only | — |

Feedback rules:
- A rejected `setTarget` shows a short red ping at the click spot with the reason in a toast.
- Tooltips on HUD items explain "Growth ← → Fight" and "Map control (win at 75%)".
- The game auto-pauses on tab hide or window blur, with a "Paused — click to resume" overlay
  (FR-027).
