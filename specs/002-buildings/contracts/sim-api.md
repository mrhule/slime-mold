# Contract: Simulation API additions

Extends [001 sim-api](../../001-core-game-loop/contracts/sim-api.md).

```ts
// src/sim/index.ts
export type PlaceResult = { ok: true } | { ok: false; reason: PlaceReason };

/** Read-only. Same check `placeBuilding` runs, for the UI preview and for rival AIs. */
export function canPlace(world: Readonly<World>, mold: MoldId, building: BuildingType, cell: CellIndex): PlaceResult;
```

`PlaceReason` is the union of the reasons in [commands.md](commands.md).

## HudModel additions

```ts
interface BuildOption {
  type: BuildingType;
  cost: number;
  upkeep: number;          // per second
  income?: number;         // per second, farm only
  count: number;           // live buildings of this type owned by the mold
  limit: number;
  affordable: boolean;     // some piece of the mold holds at least `cost`
}

interface HudModel {
  /* ...001 fields... */
  build: BuildOption[];
  buildingIncome: number;  // nutrients/s from working farms, before upkeep
}
```

## SimEvent additions

```ts
| { type: 'buildingPlaced'; id: number; building: BuildingType; mold: MoldId; cell: CellIndex }
| { type: 'buildingDestroyed'; id: number; building: BuildingType; mold: MoldId; cell: CellIndex }
```

## World (read by render only)

`world.buildings` and `world.buildingAt` are readable for drawing. They are never written outside
`src/sim`.
