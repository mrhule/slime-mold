# Contract: Controls and Interface

Extends [002 controls](../../002-buildings/contracts/controls.md).

## Build bar

| Input | Action |
|---|---|
| Click the Store House button, or press `T` | enter placement mode for a Store House |
| Click Farm / press `F` | as before; the ghost now shows fertile ground only as valid |

Hotkeys in use: `F` farm, `B` booster, `M` harvester, `T` store house, `W/A/S/D` pan, `1/2/3`
speed, `Space` pause, `Q/E` as in 001, `Esc` cancel.

## Placement preview

| Building | What the ghost shows |
|---|---|
| Farm | valid only on fertile ground; reason text "Farms need fertile ground" otherwise; a warning badge "No store house on this vein" when the piece has none |
| Store House | the piece's cap as `300 → 600` text, and the boost glow along the vein it would cover |

## Farm selection and the output dial

| Input | Action |
|---|---|
| Click an own farm (not in placement mode) | select it; show the farm panel; it does not set a growth target |
| `[` / `]` or the panel's `−` / `+` | change the selected farm's level by one step (sends `setFarmOutput`) |
| `Esc`, or a click elsewhere on the map | deselect |

The panel shows: level as pips (0–6), income per second, upkeep per second, and a status line:
`Working`, `Unlinked: build a store house on this vein`, `Throttled: store is full`, or `Parked`.

## HUD

- Nutrients shows `stock / cap` for the mold, with a **FULL** tag when any piece is at its cap.
- An amber "N farms unlinked" line appears when `farms.unlinked > 0` and links to the build bar's
  Store House button (highlight).
- A toast "Stock lost" appears on `capLost`.

## Drawing (comic / cel-shaded)

- Fertile ground: flat green-brown wash, soft inked edge, short ink tufts (shape, not just color).
- Store House: a squat inked barn-like silhouette with a round tank, distinct from farm (mushroom
  pile), booster (tower), and harvester (tripod); readable in grayscale.
- Unlinked farm: a small hand-drawn break/"no link" mark above it. Parked farm: dimmed.
- Boost glow: soft glow along the covered vein in the owner's color, fading with the taper, only
  shown where the Store House is visible.
