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

## US2 Booster Factory, US3 Harvester, US4 Rivals Build (2026-10-25)

Build: all three added. Seed 777; buildings placed through the dev console in a visible Browser pane, plus headless tests.

| # | What | Result |
|---|---|---|
| US2 | Booster factory | **Pass in the browser and headless.** It draws as a squat inked machine with a chimney and a lightning bolt, with a hand-inked dashed square showing the area it strengthens. Tests: only its owner's cells inside the radius are boosted, overlapping factories stack up to the cap (+100%), the bonus stops while its piece cannot pay upkeep, ends the moment its cell dies, and a covered front deals 1.5x and takes 1/1.5x damage while an uncovered front is unchanged. It does not change growth speed. |
| US3 | Harvester | **Pass in the browser and headless.** Draws as an inked tripod rig with a bucket, with a dotted line to its food; crossed out and dimmed once the food is gone. Placement is refused with a plain reason (needs food touching the cell, at least 9 cells, one per food per mold). Tests: absorbing is exactly 2x for the owner only, the total nutrients are unchanged, and the item runs out sooner. A mold still has to grow onto the food for any absorbing to happen. |
| US4 | Rivals build | **Pass headless; seen in simulated rounds.** Over 6 game minutes rivals placed farms and harvesters in round 1, and farms, harvesters and boosters in round 6. They use the same command, costs and limits, ask only about their own cells through their view, never react to food they have not seen, and build once they hold cost plus a difficulty-set reserve. A rival's building seen once is remembered, dimmed, until the player looks again (test in `fog.test.ts`). |

### Findings

- With the farm's raised income (1.5/s, from earlier playtest feedback) rivals that build farms quickly beat the player model badly (round 1 fell to 60%, round 3 to 20% with many stalemates). The build reserve is now 700 nutrients in round 1 down to 70 by round 10, which puts the AI-played win rates back at about 90%, 90%, 60% for rounds 1 to 3.
- The farm balance (cost 30, income 1.5/s, upkeep 0.15/s) was changed by hand before this work and is kept; the research notes document it.
- Booster and harvester numbers (cost 40 and 25, radius 6, +50% each up to +100%, harvest x2, minimum food 9 cells) are first guesses and have not been tuned by hand playtesting.
- Not checked by hand: the placement ghost and tooltip for boosters and harvesters, and a real fight with boosters on both sides.
