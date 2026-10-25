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
