# Contract: Simulation API

The boundary between `src/sim` (pure, headless) and everything else (Constitution I).
Render, UI, game loop, tests, and the batch tool all use only these exports.

```ts
// src/sim/index.ts
export function createRound(opts: {
  runSeed: number;
  roundNumber: number;
  balance?: BalanceConfig;            // defaults to src/config/balance.ts
  difficulty?: DifficultyProfile;     // defaults to difficultyFor(roundNumber)
}): World;

export function enqueue(world: World, cmd: Command): void;
export function step(world: World): void;            // advance exactly one tick (dt = 0.05 s)
export function stateHash(world: World): number;     // FNV-1a, uint32

export function readHud(world: World, mold: MoldId): HudModel;
export function viewFor(world: World, mold: MoldId): MoldView;   // fog-filtered (R7)
export function roundOutcome(world: World): RoundOutcome;

export function difficultyFor(round: number): DifficultyProfile;
```

`World` is exported as an opaque-ish type: render may **read** its typed arrays for drawing
but MUST NOT write them. A test makes sure render is rejected at compile time (a
`Readonly<World>` alias is used in render signatures).

## HudModel (FR-026)

```ts
interface HudModel {
  round: number;
  storedNutrients: number;
  netIncome: number;                 // per second, smoothed over 2 s
  allocation: number;                // 0..1
  mapControl: number;                // 0..1 of reachable cells
  growthStarved: boolean;            // any target in 'starved'
  targets: { id: number; cell: CellIndex; state: TipState }[];
  rivals: { id: MoldId; color: number; pattern: number;
            status: 'alive' | 'eliminated';
            visibleCells: number | null }[];   // null if none in vision
  elapsedSeconds: number;
}
```

## MoldView (FR-030) — the AI's only input

Built from the mold's own vision and memory plus globally visible data. It is the fairness
surface: anything not here, the AI cannot know.

```ts
interface MoldView {
  self: { id: MoldId; allocation: number; cellCount: number;
          components: { id: number; pool: number; cellCount: number; orphaned: boolean }[];
          targets: HudModel['targets'];
          frontCells: CellIndex[]; frontLoss: number /* biomass lost on fronts, last 2 s */ };
  width: number; height: number;
  terrain: Readonly<Uint8Array>;                 // globally visible
  visibility(cell: CellIndex): 0 | 1 | 2;
  ownerAt(cell: CellIndex): MoldId | 0;          // last-known if remembered, live if visible
  biomassAt(cell: CellIndex): number | null;     // null unless currently visible
  foodAt(cell: CellIndex): number;               // last-known if remembered
  visibleEnemyCells(): CellIndex[];
  knownFood(): { cell: CellIndex; amount: number; stale: boolean }[];
  dropWarnings(): { cell: CellIndex; type: FoodType; landsInTicks: number }[];  // global
  pathCost(from: CellIndex, to: CellIndex): number;   // uses terrain + known owners only
  tick: number;
}
```

The AI controller signature:

```ts
// src/sim/ai/rival-ai.ts
export function think(view: MoldView, state: AiState, rng: Rng): Command[];
```

The import-boundary test fails if `src/sim/ai/**` imports anything from `src/sim/world*`,
`src/sim/network*`, or other internals besides the view and command types.

## SimEvent (read-only feed for render, UI, and audio)

```ts
type SimEvent =
  | { type: 'cellDied'; cell: CellIndex; mold: MoldId; by: MoldId | 0 }
  | { type: 'dropWarning'; dropId: number; cell: CellIndex; foodType: FoodType }
  | { type: 'dropLanded'; dropId: number; foodSourceId: number }
  | { type: 'foodDepleted'; foodSourceId: number }
  | { type: 'moldEliminated'; mold: MoldId }
  | { type: 'pieceOrphaned'; mold: MoldId; componentId: number }
  | { type: 'commandRejected'; mold: MoldId; reason: string };
```

`world.events` is replaced each tick. Consumers that run once per frame must drain every
tick's events, which the game loop collects into a per-frame buffer.
