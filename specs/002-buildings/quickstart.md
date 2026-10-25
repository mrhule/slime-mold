# Quickstart & Validation: Buildings

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Same setup as [001 quickstart](../001-core-game-loop/quickstart.md): `npm install`, `npm run dev`,
`npm test`, `npm run typecheck`, `npm run build`. Use `?seed=777` for the same map every time.

## Automated validation

| Check | Command | Expected |
|---|---|---|
| Placement rules, cost, limit, destruction | `npm test -- buildings` | all reasons from data-model.md covered, in order |
| Farm income, upkeep, source, starvation order | `npm test -- farm` | income and upkeep match balance values; a cut-off piece with a farm is not orphaned |
| Growth on farm income alone, determinism, replay | `npm test -- farm-economy` | same seed and commands give the same `stateHash` (SC-006) |
| Import boundaries | `npm test -- boundaries` | no new DOM or Pixi imports in `src/sim` |

## Manual playtest scenarios (US1 farm)

1. **Place a farm (US1-1, SC-001)**: With enough nutrients, press `F` (or click the build bar),
   hover over your veins, and click. The farm appears, the cost drops from your stock, and the
   HUD income goes up.
2. **Invalid spots (US1-2)**: In placement mode, hover empty ground, an obstacle, food, and an
   existing farm. The ghost turns red each time and the tooltip names the reason.
3. **Cannot afford (US1-3)**: Spend your stock on growth, then try to place. The button is gray,
   a click is refused with a toast, and no nutrients are lost.
4. **Income and upkeep (US1-4)**: Watch the income readout. A working farm adds about 1.35/s net
   (1.5 income, 0.15 upkeep) and pays back its 30 nutrients in about 22 s.
5. **Cut-off farm (US1-5)**: Place a farm on a branch, then starve or cut the branch so the farm's
   piece is separate. The piece keeps living on its own farm.
6. **Destroyed with its cell (US1-6)**: Let the farm's cell starve (or cut it off with no
   source). The farm disappears with it and nothing is refunded.
7. **Cancel (edge case)**: Enter placement mode, press `Esc`, then right-click. No cost either time.
8. **Limit**: Place six farms. The button shows `6/6` and further placements are refused.

## Done when

All automated checks pass and scenarios 1–8 behave as described, and the build runs from a fresh
clone (`npm install && npm run build`).
