# Implementation Plan: Pools of Primordial Goo

**Branch**: `008-goo-pools` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

## Summary

Goo pools reuse the food machinery. A pool is a new food type, `goo`: a fixed rectangle of cells that a
mold engulfs for free when it touches one cell (the existing "spans around it" behaviour), whose cells
never lose nutrients and which never depletes. Each cell a mold holds pays a fixed rate per second into
its piece, but only while a store house stands on that piece, so the income follows the cells each mold
holds (contested pools split by cells, with no extra rule). Map generation places goo pools where fertile
patches were (one near each start, a few contested) and the fairness check moves with them. The farm
building, its output dial and the fertile overlay are removed. Pools are public terrain, so they are
visible in the fog, and the rival AI targets them like food and builds a store house under the same rules.

## Technical Context

**Language/Version**: TypeScript 5, Node 24; PixiJS 8 renderer; Vitest.

**Storage**: none new (pool cells live in the existing food arrays).

**Testing**: Vitest headless for the rules (pool payout, store house requirement, never depletes,
contested split, map-gen fairness, AI), plus the existing determinism, boundary and bench tests;
playtest checklist for the look and feel.

**Constraints**: Constitution I to V. Everything stays in the sim's fixed step and seeded generators; the
sim imports no render, UI or DOM; the AI sees only `MoldView`; all numbers live in `src/config/balance.ts`.

## Constitution Check

- **I. Simulation is the source of truth**: PASS. Pools, payout and removal of farms are all sim rules; the
  renderer only draws what the world says.
- **II. Same rules for every mold**: PASS. Rivals harvest pools and build store houses by the same commands.
- **III. Seeded & reproducible**: PASS. Pool placement uses the map-gen generator; payout has no randomness.
- **IV. Test the rules, playtest the fun**: PASS. New unit and integration tests, and a playtest checklist.
- **V. Smooth at scale**: PASS. Pool cells are a handful per map and use the existing per-cell food loop.

## Project Structure

```text
specs/008-goo-pools/  spec.md plan.md research.md data-model.md quickstart.md tasks.md checklists/
src/config/balance.ts        # goo food type, pool counts, store house requirement; farm removed
src/sim/types.ts, food.ts    # `goo` type, infinite food, payout rule
src/sim/mapgen.ts            # place goo pools (replaces placeFertile), fairness
src/sim/buildings.ts, commands.ts, hud.ts, view.ts, world.ts, hash.ts   # farm removed, pool status
src/sim/ai/rival-ai.ts       # drop farm logic, target pools, store house first
src/render/food-layer.ts, terrain-layer.ts, building-layer.ts   # goo wells; fertile overlay and farm art removed
src/ui/*                     # build menu without farm, farm panel removed, pool hints and HUD line
tests/                       # new pool tests; farm and fertile tests removed or rewritten
```

## Complexity Tracking

None.
