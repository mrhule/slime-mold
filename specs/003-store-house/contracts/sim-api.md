# Contract: Sim API

Read-only helpers and view additions. Render and UI read these through `src/sim/index`; the AI
reads only `MoldView`.

## Exports (`src/sim/index`)

| Function | Returns |
|---|---|
| `capOf(world, comp)` | the piece's current cap (base plus working Store Houses, up to `perPiece`) |
| `farmLinked(world, building)` | `true` if the farm's piece has a working Store House |
| `farmOutput(world, building)` | current nutrients per second the farm pays (0 when unlinked or level 0) |
| `storeCover(world, startCell)` | `{ cell, bonus }[]`: cells a Store House at `startCell` boosts (for the glow and the placement preview) |
| `canPlace(world, mold, type, cell)` | as in 002, plus `not-fertile` |
| `placePreview(world, mold, type, cell)` | `{ result: PlaceResult, unlinked?: boolean, capBefore?: number, capAfter?: number }` for the ghost |

`veinCover(world, start, reach, bonus)` is shared with the Booster (`boosterCover` becomes a thin
wrapper).

## `MoldView` additions (fair: all public or own information)

| Member | Meaning |
|---|---|
| `fertileAt(cell)` | whether the cell is fertile ground (terrain, global like obstacles) |
| `capOf(componentId)` | the cap of one of the mold's own pieces |
| `pieces()` | now also `cap` and `linkedFarms` per own piece |
| `farmLevel(buildingId)` | an own farm's level |
| `canBuild(type, cell)` | as before; covers fertile and cost |
| `buildCost(type)` | as before, now also for `storehouse` |

Opponents' buildings still appear only as last-known `memBuilding` entries; nothing about their
caps or levels is exposed.

## `HudModel` additions

See [data-model.md](../data-model.md#hud-additions): `stock { total, cap, full }`, `farms { total,
linked, unlinked }`, the `storehouse` build option, and `buildingIncome` as the sum of current
farm outputs.

## Determinism

No new random draws in the sim except fertile patch placement, which uses the map-generation
stream. The output curve is a polynomial; no banned math. `stateHash` covers `fertile`, farm
levels, and `supply`.
