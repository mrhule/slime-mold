# Contract: Commands

Extends [002 commands](../../002-buildings/contracts/commands.md). Commands are queued, applied
at the start of a tick in order, and logged for replay. The rival AI uses the same ones.

## `placeBuilding` (additions)

`{ type: 'placeBuilding', mold, building: 'storehouse' | …, cell }`

Rules added on top of 002 (checked in the PlaceReason order, first failure is reported):

| Building | Extra rule | Reason when it fails |
|---|---|---|
| `farm` | the cell must be fertile ground | `not-fertile` |
| `storehouse` | none beyond the common rules (own cell, not occupied, not food, limit, cost) | the common reasons |

`canPlace(world, mold, type, cell)` stays the single check used by the command, the UI preview, and
the AI's `view.canBuild`. The preview also reports (not as a failure) whether a farm would be
**unlinked** and the piece's cap before and after a Store House (see sim-api).

## `setFarmOutput`

`{ type: 'setFarmOutput', mold, building: BuildingId, level: 0..6 }`

| Rejection reason | When |
|---|---|
| `unknown-building` | no live building with that id |
| `not-your-building` | the building belongs to another mold |
| `not-a-farm` | the building is not a farm |
| `bad-level` | `level` is not an integer from 0 to 6 |
| `mold-eliminated` | the mold is out of the round |

Accepted while paused, takes effect on the next tick. No cost. Rejection emits
`commandRejected { mold, reason }`; nothing changes.
