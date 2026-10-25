# Playtest Log: Buildings

Manual scenarios from [quickstart.md](../quickstart.md). Results are from the real game running in
the dev server (`npm run dev`), seed 777, round 1, no rivals.

## US1 — Nutrient Farm (2026-10-25)

Build: Phases 1–2 and US1 (T001–T020).

| # | Scenario | Result |
|---|---|---|
| 1 | Place a farm (US1-1, SC-001) | **Pass.** Pressing `F` (or clicking the build bar) enters placement mode. Hovering the mold's own cell shows a green ghost and "Click to build"; clicking places the farm. Stock went 35.1 to 5.5 (cost 30), and the income readout rose (about +0.9/s with the core's 0.5/s, the farm's 0.5/s, and 0.1/s upkeep). |
| 2 | Invalid spots (US1-2) | **Pass for open ground.** Hovering bare map shows a red ghost and "Build on your own mold!". Obstacle, food, and occupied-cell reasons are covered by the headless tests (`buildings.test.ts`), not re-checked by hand. |
| 3 | Cannot afford (US1-3) | **Pass.** With 5 nutrients the ghost is red with "Not enough nutrients!". Clicking shows the same toast, places nothing, and the stock is unchanged. The build button is grayed when the mold cannot pay. |
| 4 | Income and upkeep (US1-4) | **Pass by readout and tests.** Net income matched the numbers above. Payback (about 75 s) is checked by `farm-economy.test.ts`, not timed by hand. |
| 5 | Cut-off farm (US1-5) | **Headless only.** `farm.test.ts` shows a split-off piece with a farm is not orphaned and keeps being paid. Not exercised in the browser. |
| 6 | Destroyed with its cell (US1-6) | **Headless only.** `farm.test.ts` covers destruction with the cell, the event, and no refund. Not exercised in the browser. |
| 7 | Cancel (edge case) | **Pass.** `Esc` and right-click both leave placement mode with no cost and no building. |
| 8 | Limit | **Headless only.** The 7th farm is refused with `limit-reached` in `buildings.test.ts`; the build button shows `count/limit` (seen as 1/6). |

### Observations

- Placement mode used to end even after a refused click; it now stays on after a refusal so the
  spot can be fixed (input checks `canPlace` first). Recorded in contracts/controls.md.
- The farm was first drawn at one cell wide and was hard to spot; it is now 35% larger and reads
  as a planter with mushroom caps. The caps use the owner's color, which for the yellow player
  blends with the mold, so shape is what makes it recognizable (FR-018). Worth a look in the
  accessibility pass.
- Balance: with the starting 30 nutrients a player can afford exactly one farm right away, which
  uses the whole opening stock. Whether that is a good first move is a balance question for T034.
- Frame rate was not measured (pane hidden at times); no change to the sim tick cost is expected.
