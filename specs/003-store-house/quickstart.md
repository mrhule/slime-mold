# Quickstart: Store House, Fertile Ground, and Farm Output

How to run the feature and prove it works. Contracts: [commands](contracts/commands.md),
[sim API](contracts/sim-api.md), [controls](contracts/controls.md). Model:
[data-model.md](data-model.md).

## Prerequisites

```bash
npm install
npm run typecheck && npm test        # all existing tests pass before you start
npm run dev                          # http://localhost:5173
```

Dev-only URL parameters from 001 still apply: `?seed=7`, `?round=3`, `?debug`, `?nopause`.

## Automated checks (headless)

```bash
npx vitest run tests/unit/sim/store-house.test.ts
npx vitest run tests/unit/sim/fertile.test.ts
npx vitest run tests/unit/sim/farm-output.test.ts
npx vitest run tests/unit/sim/store-boost.test.ts
npx vitest run tests/integration/store-house-round.test.ts
npm test                                  # the whole suite, incl. determinism over 20 seeds
npx tsx tests/bench/tick.bench.ts         # tick cost with every building at its limit
npm run sim:batch -- --rounds 1-3 --games 20   # balance proxy with the new farm routine
```

## Validation scenarios

1. **Cap and store house (US1)**: start a round, let a piece fill to its base cap (use
   `__slime.world` in dev to set a pool), confirm the HUD shows `FULL` and extra income is lost;
   place a Store House and confirm the cap rises and stock can grow past the old limit.
2. **Fertile ground and linking (US2)**: on `?seed=7` find the fertile patches near the start (they
   are visible in the fog); place a farm on a patch with no Store House and confirm the unlinked
   warning and no income; place a Store House on the same vein and confirm the farm pays.
3. **Throttling (US2)**: fill the piece to its cap with a farm running; confirm net stock stays at
   the cap with no jitter and the farm status reads `Throttled`; spend nutrients and confirm it
   resumes.
4. **Output dial (US3)**: select a farm, press `]` and `[`, and confirm the income and upkeep numbers
   change together and the gain per upkeep falls at the top; park it at 0 and confirm no income or
   upkeep.
5. **Boost (US4)**: place a Store House mid-vein, order growth toward food, and compare the tip
   speed near the Store House with a run without it; place a Harvester on the vein and compare
   absorb time; confirm the stock drain stops when nothing is boosted or when stock is below the
   low level.
6. **Rivals (US5)**: run a round with two rivals via `npm run sim:batch` or `?debug`; confirm via
   the event log that rivals place Store Houses and farms only on fertile ground and with the same
   costs and limits.
7. **Determinism**: run the determinism test; confirm the replay of a round with Store Houses and
   dial changes matches the state hash.

## Manual playtest checklist (see `checklists/playtest.md` when implemented)

- Fertile ground is readable in fog and in grayscale; tufts differ from rough ground hatching.
- The unlinked warning is noticed within a few seconds of placing a farm without a store.
- The farm panel is usable with the keyboard alone.
- The early game before the first Store House is not a stall: a new player can afford the first
  linked farm within about two minutes on round 1.
- The boost glow reads as "this vein is boosted", not as a fog or selection effect.
