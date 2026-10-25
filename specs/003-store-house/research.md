# Research: Store House, Fertile Ground, and Farm Output

Decisions for [plan.md](plan.md). Numbers here are first guesses for `balance.ts`, to be tuned by
the batch simulator and playtests (see S12). Earlier decisions: [001](../001-core-game-loop/research.md)
(R1–R14) and [002](../002-buildings/research.md) (B1–B10).

## S1. Fertile ground is a per-cell overlay, not a `Terrain` value

- **Decision**: add `World.fertile: Uint8Array` (1 = fertile). Fertile cells are always `Open` or
  `Rough` ground; every existing terrain check (movement, combat, growth cost, obstacles) is
  unchanged. Only `canPlace('farm', …)` reads it.
- **Rationale**: fertile ground restricts one building, not movement. A new `Terrain` value would
  touch every `isOpen`, A* and terrain-cost site (growth, mapgen, world invariants, combat).
- **Alternatives**: a fourth/fifth `Terrain` value (rejected above); per-food-style "sites" with
  ids (more state, no gameplay gain).

## S2. Cap = base + store houses, enforced once per tick after all gains

- **Decision**: `capOf(world, comp) = pool.baseCap + storeHouse.capacity × min(n, perPiece)`,
  where `n` counts the working Store Houses in the piece. A single `clampPools(world)` runs at the
  end of `step` (after combat refunds and orphan handling) and also right after a Store House is
  destroyed. Everything that adds to a pool (core income, food absorption, farms, refunds, merges)
  is left alone; the clamp discards the excess, so no gain path can forget the cap.
- **Rationale**: pool gains happen in six places today (`step.ts`, `food.ts`, `buildings.ts`,
  `combat.ts`, `network.ts` merge and split). One clamp point is smaller and safer than six
  guards. Farms are the only gain path that throttles first (S5) because spec FR-012 says their
  output must not be wasted; food and core income may be lost at the cap, which is the intended
  pressure to spend.
- **Alternatives**: guard each gain site (six places, easy to miss one); a hard "no gain" at the
  cap for food too (would stall absorption and make food items outlast their usefulness).

## S3. A Store House counts only while it works

- **Decision**: a Store House is "working" when it stands, and its piece is not `unpaid`. A
  non-working Store House adds no capacity and no boost, exactly like the Booster (002 FR-011).
  The per-piece counting limit is `storeHouse.perPiece` (3).
- **Rationale**: reuses the existing `unpaid` flag; one rule for all upkeep-gated buildings.
- **Alternatives**: capacity always counts (a starving piece would still bank, which is odd).

## S4. A farm is linked when its piece has a working Store House

- **Decision**: `farmLinked(world, farm)` is true when `world.component[farm.cell]` has at least
  one working Store House. The set of linked piece ids is built once per tick (and once per flow
  solve) from the building list. The flow's `sourceRate` for a farm cell becomes the farm's
  current output rate (0 when unlinked or at level 0), but the cell stays in `comp.sources`, so a
  piece with only an unlinked farm is still "supplied" and not orphaned (spec FR-014).
- **Rationale**: matches the answer "same connected piece, any distance"; cheap (buildings are few);
  keeps the 002 source-of-supply behavior for orphan logic.
- **Alternatives**: link by vein distance (rejected by the player); store links on the farm (needs
  updating on every split and merge).

## S5. Farms throttle to the headroom of their piece

- **Decision**: in `tickBuildings`, per piece: `desired = Σ output × dt` over its linked farms,
  `headroom = max(0, cap − pool)`, `scale = desired > headroom ? headroom / desired : 1`; each
  farm pays `output × dt × scale`. Upkeep is not reduced by throttling.
- **Rationale**: spec FR-012; stays O(#farms); keeps total ≤ cap without discarding farm output.
  Upkeep stays full so a player who parks farms at a full store still has a reason to turn the
  dial down (spec User Story 3).
- **Alternatives**: scale upkeep with throttling (removes the reason to use the dial).

## S6. Output level and curve

- **Decision**: each farm has `level` ∈ {0,…,6}, default 4; `o = level × 0.25`. Income is
  `income × o × (1.5 − 0.5 × o)` and upkeep is `upkeep × o`. At `o = 1` both equal the 002 values;
  at `o = 1.5` the income slope is zero, so income per upkeep always falls as the dial rises.
  Level 0 pays nothing and costs no upkeep (the farm still counts as a source of supply).
- **Rationale**: a polynomial, so no banned math in the sim; integer levels keep the command, the
  hash and the UI simple (VI). A concave income against linear upkeep gives the "diminishing
  returns" the spec asks for (FR-017).
- **Alternatives**: float level (rounding noise in replays, no benefit); `pow` curve (banned in the
  sim by the determinism boundary test).

## S7. The Store House boost reuses the vein cover routine

- **Decision**: generalize `boosterCover(world, start)` to `veinCover(world, start, reach, bonus)`
  (a BFS over `world.edges` with a linear taper); the Booster calls it with its numbers and the
  Store House with its own. Store House covers are summed into a new `World.supply` array
  (`Float32Array`, 1 = none, capped at `storeHouse.stackCap`), rebuilt at flow cadence and on
  place/destroy/pay-state change, like the booster array.
- **Rationale**: spec FR-020/FR-024; the taper along the vein is the same geometry as the booster's.
- **Alternatives**: a second BFS implementation (duplication); rebuild every tick (the vein graph
  changes slowly, and 20 Hz is wasted work for cover that fades over 20 cells).

## S8. What the boost multiplies, and what it costs

- **Decision**:
  - **Tips**: in `advanceTip`, the progress gained from a grant is multiplied by `supply[head]`
    (a tip at `supply = 1.5` builds a cell for two-thirds of the nutrients). The stock still pays
    the grant first.
  - **Harvesters**: in `tickFood`, a harvester-boosted item absorbs `base × rateMult ×
    supply[cell]`; the item's total is unchanged.
  - **Cost**: while any tip head or harvester-owned food cell in a piece has `supply > 1`, each
    working Store House in that piece drains `storeHouse.drain` per second from the piece's pool
    (never below 0). The drain itself is the price of the speed-up; boosted growth is therefore
    not free, but cheaper per cell than unboosted growth only while the drain is lower than the
    savings (a tuning question, S12).
  - **Low stock**: when `pool < storeHouse.lowStock`, the Store House stops boosting (and stops
    draining) until the pool recovers; a hysteresis of 25% avoids flicker.
- **Rationale**: matches the spec (FR-021, FR-022, FR-023: no combat, no farm, no food-total
  change) with the fewest touch points: two multiplications and one drain.
- **Alternatives**: boost raises `tip.rate` in the flow solve (changes flow routing and
  thickness, harder to reason about); drain per boosted cell (couples cost to vein size, harder to
  explain than one number).

## S9. Map generation: fertile patches near starts plus contested ones

- **Decision**: after terrain, starts, and food: for each start, place `fertile.nearPatches` (2)
  blobs of radius 2–4 cells on `Open`/`Rough` cells whose path distance from the start is within
  `fertile.nearRadius`; then `fertile.contested` patches (1 + one per two rivals) at the cells
  farthest from every start. Blobs are a disk with a noise-warped edge. `validateMap` gains a
  check that every start has at least `fertile.minNear` fertile cells within `fairRadius` of it
  and the richest start has no more than the existing `fairTolerance` over the poorest; failures
  retry like food fairness does (the retry loop and open-map fallback in `createRound` already
  exist).
- **Rationale**: spec FR-015; reuses the retry and fallback machinery; fairness measured with the
  same `foodNear`-style flood fill.
- **Alternatives**: scatter randomly and hope (needs more retries and gives lopsided starts).

## S10. Drawing fertile ground

- **Decision**: in `terrain-layer.ts`, generalize `occupancy` to take a predicate and add a
  fertile pass: a flat green-brown wash with a soft inked edge and short ink tufts, drawn from the
  same blurred field as rough ground so edges are smooth. It is part of the terrain bake, so the
  fog does not hide it (spec FR-008). It is distinguished from rough ground by shape (tufts, not
  diagonal hatching) as well as tone.
- **Rationale**: one bake, no new layer; reuses the smooth-blob machinery from the cel-shading
  pass.
- **Alternatives**: a separate sprite layer (extra draw call and ordering with fog).

## S11. Selecting a farm and the dial

- **Decision**: a click on an own farm (outside placement mode) selects it instead of setting a
  growth target (a target on an owned cell is rejected as `already-owned` today, so no behavior is
  lost). A small comic panel shows its level, income, and upkeep with `−` / `+` buttons; `[` and
  `]` change the level; Esc or a click elsewhere deselects. The panel issues `setFarmOutput`.
  The Store House gets hotkey `T`; `F`, `B`, `M` stay, and `W/A/S/D` stay pan keys.
- **Rationale**: no new modes beyond selection; consistent with the build bar's keys.
- **Alternatives**: a right-click menu (right-click already cancels targets); a slider per farm in
  the HUD (clutters it).

## S12. Rival AI and balance

- **Decision (AI)**: `planBuild` gains: with at least one fertile site in reach and no working
  Store House in the piece, build a Store House first (own cell of that piece); then farms on
  fertile cells in a piece that has one; Store House for capacity when the pool exceeds 80% of the
  cap and a spend is not planned. The AI sets a farm's level only to turn farms down while its net
  income is negative. All through `MoldView` (`fertileAt`, `capOf`, `farmsLinked` are public
  information).
- **Decision (balance, first guess, superseded by the Balance pass below)**: first numbers: `pool.baseCap 120`; Store House cost 40, upkeep 0.2,
  limit 4, capacity 180, `perPiece` 3, reach 20, bonus 0.5, stack cap 1.0, drain 0.5/s, low stock
  15; farm unchanged otherwise (income 1.5, upkeep 0.15, default level 4). The early game is the
  risk: a player starts with 30 nutrients, a Store House costs 40, and a farm 30, so the first
  linked farm needs about 70 nutrients from food first. The balance pass tunes cost,
  `playerStartNutrients`, and `baseCap` with `tools/batch-sim.ts`, whose farm-building proxy is
  updated to place a Store House and farms on fertile ground.
- **Rationale**: the AI follows the same rules (Constitution II); numbers stay in one config (IV).
- **Alternatives**: start every mold with a free Store House (would contradict the spec's
  "a mold begins a round with none"; kept as the fallback if the early game proves too slow).

## S12b. Balance pass (T055)

Measured with `tools/batch-sim.ts` (the AI stand-in plays the player: store house first, then farms
on fertile ground; 40–60 games per cell, rounds 1–4). Before 003 the stand-in won about 83% / 78% /
88% of rounds 1–3. After the first 003 numbers (store house 40, farm 30, start 30, cap 120 then 300)
it won only about 57% / 45% / 63%.

What the runs showed:

- **Not the cap.** A huge base cap changed nothing; neither did cheaper store houses alone, a higher
  farm income, closer fertile patches (`fertile.nearRadius` 11 or 14), or switching rival building off.
- **The affordable pair.** Games were bimodal: either a store house and farms went down in the first
  minute (win) or never (loss, "farms 0, stores 0"), because growth spends the stock as fast as it
  arrives, so it never reached store house + farm. With a start of 30 and a 40-nutrient store house
  the pair was out of reach at the start. Raising only the start (50) made it worse (18%): the store
  house was bought and the farm never was. What fixed it was making **store house + farm affordable
  from the starting stock**.
- **Chosen numbers**: `playerStartNutrients` 50, store house cost 25, farm cost 25 (upkeep, capacity
  300, base cap 300, `perPiece` 3, boost and drain unchanged). Store house + farm pay back in about
  43 s (50 nutrients at +1.15/s net). Stand-in result: **76% / 82% / 88% / 80%** for rounds 1–4
  (50 games each), against 83% / 78% / 88% before 003.
- **AI change kept**: rivals and the stand-in grow toward fertile ground (value 18, nearest two
  cells) until they have three farms. Its measured effect is within noise at this sample size; it is
  kept because a mold with no farm site cannot use the new economy at all.
- **Not tuned**: the boost strength (+50% at the store house, 20-cell reach), the drain (0.5/s) and the
  dial curve. The stand-in does not use them in a way a person would; they need playtesting.
- **Rival starts** (`rivalStartNutrientsBase` 30) are unchanged; rivals rarely build early because
  the build reserve gates them.

## S13. Risks to watch

- **Early-game stall**: see S12; mitigated by the batch simulator and a playtest scenario.
- **Cap waste hidden from the player**: the HUD must show stock against cap and a "full" flag
  (spec FR-004), or the clamp feels like a bug.
- **Selection vs targets**: clicking a farm no longer tries to set a target; the placement preview
  and cursor must make the difference clear.
- **Existing tests** that place farms anywhere (`farm.test.ts`, `farm-economy.test.ts`,
  `buildings.test.ts`, the harness in `tests/helpers.ts`) need a fertile cell and a Store House;
  the helper gains `fertile: true` and a `withStore` option.
