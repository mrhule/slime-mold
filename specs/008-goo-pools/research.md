# Research: Pools of Primordial Goo

## P1. A pool is infinite food, not a new system

**Decision**: add a food type `goo` with a rectangle footprint (4 x 3 cells) and an `infinite` flag. A mold
that touches one cell engulfs the rest of the footprint (existing `engulfFood`), which is the "spans around
it" behaviour. `tickFood` pays each owned cell a fixed rate and never reduces the cell's nutrients, the
source's `remaining` or its `depleted` flag.

**Rationale**: touching, engulfing, per-cell ownership, fronts and combat, fog and rendering already work
for food. Per-cell payout gives the "cells decide the split" rule for free, and the store house check is one
extra condition on the piece.

**Alternatives**: a ring of cells around a blocked pool (new growth rules, new ownership logic); a pool as
terrain with a new income pass (a second system doing what food does).

## P2. Payout and the store house

**Decision**: payout per owned goo cell per second is `balance.pools.cellRate` (0.125, so a full 12-cell pool
pays 1.5/s, the old farm's default income). It is paid into the cell's piece only if
`workingStoreHouses(world, piece) > 0`; otherwise nothing is paid and the pool counts as "waiting".

**Rationale**: matches the user's choice (needs a store house) and the old farm economy, so balance moves
little. `workingStoreHouses` already exists from 003.

## P3. Never depletes, never harvested by a harvester, never dropped

**Decision**: goo cells keep their nutrients, so the existing "used up" paths never fire. The harvester
building ignores goo (its rate and boost are for finite food), and the food budget and drop code skip goo.

## P4. Map generation

**Decision**: `placeGooPools` replaces `placeFertile`: for each start, one pool at a reachable open spot at
distance `balance.pools.nearDistance` (same for every start, then validated), then `balance.pools.contested`
extra pools at the best candidates between starts (reachable by two or more starts within fair distance).
`validateMap` requires every start to have a pool within `fairRadius` and the nearest-pool distances to be
within `fairTolerance`. The `fertile` overlay stays in the world arrays as zeros for now (state shape and
hash stay compatible) and is removed in the cleanup task.

## P5. Visibility

**Decision**: goo pools are terrain-like: they are listed in `MoldView` and drawn regardless of fog. A rival's
ring ownership and payout are already fogged by the existing cell visibility.

## P6. Removing the farm

**Decision**: remove the farm building from `BuildingType`, balance, commands (`setFarmOutput`), view, HUD,
AI, world validation, UI and tests in one cleanup task, after pools work. Farm tests are deleted with the
farm; behaviour they protected (cap, store house, boost) keeps its own tests.

## P7. Rival AI

**Decision**: the AI scores goo cells like food (a fixed value larger than an oat flake) so it grows toward
pools, and builds a store house first as it does now; farm placement and farm output logic are removed.
