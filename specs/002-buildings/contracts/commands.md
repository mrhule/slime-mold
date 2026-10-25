# Contract: Building Commands

Extends [001 commands](../../001-core-game-loop/contracts/commands.md). Same rules: queued,
applied at the start of the next tick (also while paused), recorded in the replay log, available
to every mold.

```ts
type BuildingType = 'farm';

type Command =
  | /* ...001 commands... */
  | { type: 'placeBuilding'; mold: MoldId; building: BuildingType; cell: CellIndex };
```

## Semantics

`placeBuilding` runs `canPlace(world, mold, building, cell)`. On success it deducts the cost from
the pool of the piece holding the cell, creates the building, and emits `buildingPlaced`. On
failure nothing changes and `commandRejected { mold, reason, cell }` is emitted.

| Reason | When |
|---|---|
| `unknown-building` | the type is not in the building table |
| `mold-eliminated` | the mold is not alive |
| `out-of-bounds` | the cell is off the grid |
| `not-your-cell` | the cell is not owned by the mold |
| `occupied` | the cell already holds a building |
| `on-food` | the cell holds food (farms) |
| `limit-reached` | the mold already has the maximum of this type |
| `cant-afford` | the piece holding the cell has less than the cost |

Checks run in the order shown, so the first failing reason is the one reported (for example, a
click far from the mold is `not-your-cell`, not `cant-afford`).

## Rules

- No refund when a building is destroyed (with its cell).
- No removal command in this feature.
- Two orders for the same cell in one tick: the earlier one in the queue wins, the later one gets
  `occupied`.
