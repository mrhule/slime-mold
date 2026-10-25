# Playtest Log: Core Game Loop

Manual scenarios from [quickstart.md](../quickstart.md), recorded per story. Results are from
the real game running in the dev server (`npm run dev`) unless noted.

## US1 — Grow and Forage (2026-10-25)

Build: Phases 1–2 and US1 (T001–T041). Seeds 12345 and 777, map 160×120 (round 1), no rivals.

| # | Scenario | Result |
|---|---|---|
| 1 | First food (US1-1, US1-2, SC-001) | **Pass.** Clicking the nearest food (13 cells away) set a target marker and the mold grew to it. All 40 nutrients were absorbed (food retired) and the stock rose from 30.0 to 56.4. Reached well inside 60 s. |
| 2 | Obstacle routing (US1-4) | **Pass.** A click on a glass obstacle snapped to its nearest open edge and the vein routed around the obstacle, never through it. |
| 3 | Starved growth (US1-3) | **Pass, after a fix.** First run showed 0.0 nutrients but no warning, because a trickle of core income kept resetting the starvation timer. "Starved" now means the stock is nearly empty so growth runs on income alone; the red "GROWTH STARVED!" burst appeared about 12 s after two far targets were set. Regression tests added. |
| 4 | Idle veins (US1-5/6) | **Superseded.** The first build retracted idle veins (45 cells to 14 in about 18 s). That was removed on 2026-10-25: idle veins now thin to a floor and stay, and unpaid upkeep starves one outermost leaf cell at a time. Covered by tests (`flow.test.ts`, `upkeep.test.ts`); re-run in the browser at the next playtest. |

### Observations

- Idle networks used to retract back to the core within about 20 s. Decision (2026-10-25): veins
  never retract; upkeep starvation is the brake on expansion instead (FR-005, FR-006). The core's
  0.5/s income pays upkeep for about 125 cells with no other income, so food and (later) farms
  are what let a mold grow bigger.
- Growth speed: `spendRateCap` was 40 and let a funded tip build about 40 cells/s. Lowered to 6
  (about 6 cells/s). Final value is for the balance pass.
- Opening budget is tight: 30 starting nutrients is about 25 cells, and the nearest food is
  10–20 cells away, so a first click at the nearest food works but a far click starves quickly.
- Visuals (comic ink style, FR-032): terrain, ink-outlined film with flat bands, flat-banded veins
  with marching flow dashes, outlined food, inked target markers, comic HUD panel and burst all
  render. Obstacle glass shows chunky 2×2-cell bands; terrain grunge is visibly pixel-stepped at
  3x zoom. Acceptable for the MVP, worth polishing.
- Not yet verified: frame rate. The browser pane was hidden during the later checks, so no
  trustworthy fps number exists; to be measured in a visible window (T096).

### Vein mesh rebuild cost (T042)

Measured in the browser with a 4000-cell network: **8–12 ms per rebuild**, run at the flow
cadence (4 times a second). That is most of a 16.6 ms frame on the frame that rebuilds, so
expect a visible hitch at large sizes. Planned fixes if it shows in T096: reuse buffers instead of
allocating a new geometry each rebuild, and skip molds whose topology and flow did not change.

Sim tick benchmark (`npm run bench`, 4000-cell network): mean 0.13 ms, p99 2.0 ms, far inside
the 6 ms budget.

## US5 — Time Control and HUD (2026-10-25)

Build: Phase 4 (T043–T052), seed 777. Window was small (about 700×440), which also exercised the compact layout.

| # | Scenario | Result |
|---|---|---|
| 11 | Time control (US5-1/2/3) | **Pass.** Space pauses: the tick count stayed at 0 for 1.5 s and a "Paused — Space to resume. You can still give orders." banner shows. Orders given while paused (slider nudges) queue and apply after resume. Speed buttons (and keys 1–3) work: 121 ticks in 2 s at 3x, 40 ticks at 1x, i.e. exactly 60 and 20 ticks per second. |
| — | Slider nudges while paused | **Fixed.** Three presses of `E` first only moved the slider 0.1, because each press started from the applied value. They now build on the pending value (0.3 to 0.6) and the slider shows it. Unit test added. |
| — | Auto-pause (FR-027) | **Pass.** Losing window focus paused the game with a "Paused — click to resume" overlay; a click resumed it. |
| — | Pause menu and screens (FR-029) | **Pass.** Esc opens the pause menu (Resume, Restart run, Quit to title) and closes it again. A forced victory showed the round-end screen with time, biggest size, nutrients gathered, rivals eliminated, seed, and best round. "Next round" loaded round 2 on a larger map (173×130 vs 160×120) and the best round was saved to browser storage. |

### Observations

- The HUD is tall (round, time, nutrients, income, map control, speed, slider, rivals). On a small window it covers a lot of the map, so a compact layout drops the hint text under 640 px of height and moves the build bar right under 900 px of width. Worth a pass in the accessibility step.
- A mis-click on the HUD panel does not set a growth target (the panel sits above the map), which is correct but easy to do when the panel is large.
- Not yet checked by eye: the `?debug` overlay (dev only).
- The defeat screen cannot be reached yet; rivals arrive in the next phase.

## US2 — Rival Molds and Battle Fronts (2026-10-25)

Build: Phase 5 (T053–T074; T059 half done). Seed 777, round 1 (one rival), small window. The pane was often throttled to a few frames per second, so timing was checked in the simulation rather than by the clock.

| # | Scenario | Result |
|---|---|---|
| 5 | Front and slider (US2-1/2) | **Pass, mostly headless.** In the browser a second rival placed 16 cells from the player formed a front: angular comic starbursts appeared where the yellow and blue veins touched. The slider's effect is tested headless in `front-allocation.test.ts`: the side sending more nutrients to the front wins it from either side of the map; flipping a losing mold to full Fight (with nutrients to send) swings the front back. |
| 6 | Cut a supply line (US2-3) | **Headless only.** A piece with no core and no food withers (biomass `orphanDecay`/s, about 4 s) and a kill that cuts a mold in two splits the piece and its pool (`network.test.ts`, `combat.test.ts`). Not exercised by hand. |
| 7 | Fog (US2-6) | **Pass.** Everything outside the player's 10-cell vision is covered in ink scribble with the terrain still readable through it, with a hand-inked boundary; the rival list shows "Rival 1 ?" until some of its cells are in view, then "13 seen". Remembered-versus-live behavior is covered by `fog.test.ts` and `view.test.ts`; the stale halftone look was not captured by hand. |

### Findings and fixes

- **Real bug:** a growth tip that was blocked and then found a new path kept its old head cell and tried to link to a non-adjacent cell (a crash). It only shows once fronts block tips. Fixed.
- **Fairness bug:** when two front cells killed each other in the same tick, whichever mold was processed first could claim its own dead cell and "win" every mutual kill. Deaths are now resolved in two phases (remove all dead cells, then only surviving attackers refund and advance), and the processing order of molds rotates each tick.
- Mirrored duels are not exactly equal (path tie-breaking favors lower cell indices), so the test checks that the slider decides the front in both orientations rather than exact symmetry. Starts are random on real maps, so no mold gets a systematic edge.
- **Balance: rounds do not get decided yet.** In AI-versus-AI games (both sides run by the same AI) both molds grow to about 500 and 230 cells in the first minutes and then sit at the upkeep ceiling with an empty pool, so fights are only base pressure and nothing is won. All 3 sample rounds timed out at 10 game minutes. This is the economy (income versus upkeep versus food) and will be tuned together with food drops in the balance pass (T093). Until then `T059`'s "decided within 20 minutes" test is not written.
- The AI does not build farms (buildings are feature 002), so its only income is food and the core.

### Performance (T073)

Sim tick, mean over 600 ticks: round 1 AI-vs-AI (2 molds) 0.10 ms; round 10 AI-vs-AI (6 molds, 1372 cells) 0.66 ms (p99 3.4 ms); growth-only with a 4000-cell network 0.7 to 1.2 ms. All far inside the 6 ms budget. Frame rate was not trustworthy in this pane.
