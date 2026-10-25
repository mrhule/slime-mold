# Contract: Commands

The only way the player or a rival changes the simulation (FR-015, Constitution II).
Commands are plain serializable objects. They are queued, then applied in order at the start
of the next tick, including while paused (FR-025).

```ts
type MoldId = number;          // 1 = player, 2..6 = rivals
type CellIndex = number;       // y * width + x

type Command =
  | { type: 'setTarget';     mold: MoldId; cell: CellIndex }
  | { type: 'cancelTarget';  mold: MoldId; targetId: number }
  | { type: 'clearTargets';  mold: MoldId }
  | { type: 'setAllocation'; mold: MoldId; value: number };   // 0 = growth .. 1 = fight
```

## Semantics

| Command | Effect | Rejections (no state change; event `CommandRejected{reason}`) |
|---|---|---|
| `setTarget` | Snap to the nearest open cell within 6 cells, plan a path (R5), and add a target. If the mold already has 3, the oldest is replaced. | `out-of-bounds`, `no-open-cell-nearby`, `unreachable`, `mold-eliminated` |
| `cancelTarget` | Remove that target. Built veins remain. | `unknown-target`, `not-owner` |
| `clearTargets` | Remove all of the mold's targets. | `mold-eliminated` |
| `setAllocation` | `allocation = clamp(value, 0, 1)`, rounded to 0.05 steps. | `mold-eliminated` |

## Rules

- A command's `mold` must be the issuer's own mold. The input layer stamps the player's id, and
  the AI controller stamps its own id. `applyCommand` rejects mismatches when the issuer is
  known (debug assertion in tests).
- Commands are deterministic: identical queues at identical ticks give identical worlds.
- Every applied command is appended to the `ReplayLog` as `{ tick, cmd }`.
- Rivals are rate-limited to `aiCommandsPerThink` per think (R8). The player is not limited.
