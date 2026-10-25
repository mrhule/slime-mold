# Research: Buildings

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-25

Builds on [001 research](../001-core-game-loop/research.md) (R1–R19). Numbers here are starting
values in `src/config/balance.ts` and are tuned in playtesting (Constitution IV).

---

## B1. Where buildings live in the sim

**Decision**: `World.buildings: Building[]` (append-only, ids are array indexes, destroyed ones
are flagged and kept so ids stay stable) plus `World.buildingAt: Int16Array[cells]` holding the
building id on a cell or -1. The building types are a data table in `BalanceConfig.buildings`
(`cost`, `upkeep`, `limit`, and per-type settings).

**Rationale**: Same pattern as `foodSources` and `foodSourceId` in 001: O(1) lookup per cell, easy
hashing, no per-tick allocation. A destroyed flag instead of splicing keeps replay and ids simple.

**Alternatives considered**: a `Map<cell, Building>` (order-sensitive for hashing, slower in hot
loops); storing the building as a cell flag only (no room for per-building state).

## B2. Only the farm is built now, so the type union is just `'farm'`

**Decision**: `BuildingType = 'farm'` for this slice. The booster factory and harvester widen the
union and add their settings when their stories are implemented.

**Rationale**: Constitution VI (simplest thing first). Unused types would be dead code and
untested config. The data table and command shape are already generic, so widening is a small
change.

## B3. The farm is a source of supply

**Decision**: A working farm cell counts as a source for its piece, like a food cell or the core:
- `refreshSources` lists farm cells in `comp.sources`, so a piece with a working farm is not
  orphaned (spec FR-009, US1-5).
- `tickIncome` adds `farm.income * dt` to the farm's piece pool for each working farm.
- The flow solve's `sourceRate` returns the farm income for a farm cell, so veins that carry
  farm income thicken, as they do for food.

**Rationale**: It reuses the existing source mechanism end to end; no special cases in flow or
orphan logic beyond one extra condition.

**Alternatives considered**: a global per-mold income bonus (simpler, but cutting the supply line
would have no effect and a cut-off island could not live on its own farm).

## B4. Cost, upkeep, and limits

**Decision**:
- **Cost** is paid up front from the pool of the piece the building is placed in (FR-003).
  Affordability is checked against that pool, not the mold's total.
- **Upkeep** is a per-building amount, added to the piece's due upkeep in `tickUpkeep`, in
  addition to the per-cell upkeep (FR-006).
- **Limit** is a fixed per-mold count per type (FR-007), not an escalating cost.
- When upkeep cannot be paid, the existing starvation rule (001 FR-006) applies. Starvation
  victims prefer cells without a building; a building cell is chosen only when no other leaf is
  left.
- A building is destroyed with its cell and nothing is refunded (FR-005).

**Starting values** (farm): cost 30, upkeep 0.15/s, income 1.5/s, limit 6. Net +1.35/s, so a farm
pays back in about 22 s. Six farms add up to +8.1/s net, on top of the core's 0.5/s. The
core-only break-even is about 125 cells; each farm lifts that by about 340 cells. (Raised from 0.5/s income after playtest feedback that the first value gave no real return.)

**Rationale**: A fixed limit is easier to read and to balance than a rising cost, and it keeps
farms from snowballing. Paying from the local pool makes where you build matter.

**Alternatives considered**: escalating cost per farm (harder to explain in the UI); paying from
the mold-wide total (would need a transfer rule between pieces).

## B5. One validation function for UI preview and command

**Decision**: `canPlace(world, moldId, type, cell)` in `src/sim/buildings.ts` returns
`{ ok: true }` or `{ ok: false, reason }`. `applyCommand` calls it, and the UI preview calls the
same function through the sim API (it only reads state).

**Reasons**, in check order: `unknown-building`, `mold-eliminated`, `out-of-bounds`,
`not-your-cell`, `occupied`, `on-food`, `limit-reached`, `cant-afford`.

**Rationale**: The preview can never disagree with what the command will do (SC-005), and rivals
get the same checks for free (FR-002, FR-019).

## B6. Placement command and replay

**Decision**: One new command, `placeBuilding { mold, building, cell }`, handled like any other
command: queued, applied at the start of the next tick (also while paused), and recorded in the
replay log. Removal is out of scope (spec has no sell or demolish).

**Rationale**: Constitution II and III: the same interface for every mold and fully replayable.

## B7. Placement interaction (UI)

**Decision**: A DOM build bar at the bottom of the screen, styled as comic buttons (R19). Each
button shows the building's shape icon, name, cost, `count/limit`, and goes gray when it cannot
be afforded. Clicking a button or pressing its hotkey (`F` for the farm) enters **placement
mode**:
- A ghost of the building follows the cursor, snapped to a cell. It is drawn with a green ink
  outline when valid and a red one when not, with the reason in a small tooltip at the cursor.
- Left-click places (a refused click shows a toast with the reason). The mode ends after one
  placement unless Shift is held.
- `Esc` or right-click cancels with no cost. While in placement mode, left-click does not set
  growth targets.

**Rationale**: Matches the spec (FR-001, FR-017) and keeps the existing click-to-grow controls
unchanged outside placement mode.

## B8. Rendering

**Decision**: A new `BuildingLayer` draws buildings with `Graphics`, redrawn only when the set of
buildings changes. The farm is an outlined round planter with three sprouting mushroom caps (flat
two-band shading, ink outline, hard shadow), recognizable by shape (FR-018). The layer sits
above veins and below fx. The placement ghost is drawn by the FX layer.

**Rationale**: Few buildings (at most 6 per type per mold), so `Graphics` is cheap; no atlas
needed. Follows the art direction (FR-032).

## B9. Future buildings plug into the same seams

Noted so the farm design does not box them in (not built now):
- **Booster factory**: an area scan around the factory cell, applied where combat pressure and
  cell damage are computed (001 US2). The area is a set of cells within radius R, cached per
  tick.
- **Harvester**: a per-food-item rate multiplier applied in `tickFood`, only for the owner's
  cells touching the item.
- Both reuse `placeBuilding`, `canPlace`, the data table, upkeep, and destruction with the cell.

## B10. Rivals

**Decision**: Out of this slice (spec US4). Rivals will build through `placeBuilding` with the
same `canPlace` rules and a `MoldView` that exposes only what they can see.
