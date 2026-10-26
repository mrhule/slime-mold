# Feature Specification: Pools of Primordial Goo

**Feature Branch**: `008-goo-pools`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Instead of a farm or pool there are pools of primordial goo. If a vein goes to
it, it just spans around it and harvests. The pool does not run out of nutrients." Decisions made with the
player: the buildable farm (the slime pool building) and its output dial are removed; a goo pool pays only
while a store house stands on the same connected piece of vein; goo pools replace the fertile patches that
map generation places today (a fair one near each start and a few contested ones); when two molds reach the
same pool, the ring cells each mold holds decide the split.

This builds on [003-store-house](../003-store-house/spec.md), [002-buildings](../002-buildings/spec.md) and
[001-core-game-loop](../001-core-game-loop/spec.md): the same simulation, commands, fog of war and comic art
direction apply. It changes where income comes from: income stops being something you build and becomes
something you reach.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reach a Pool and Harvest It (Priority: P1)

The map has pools of primordial goo: glowing green wells set into the ground, visible from the start even in
the fog, like terrain. When the player's vein grows to a pool, the mold spreads a ring of cells around it and
starts harvesting it. The pool never runs dry. While the ring is held and a store house stands on the same
connected piece of vein, nutrients flow into that piece's stock; the more of the ring the mold holds, the
more it earns. The player grows toward pools on purpose, and the income shows in the HUD.

**Why this priority**: This is the whole feature: a new, permanent source of income that rewards reaching a
place instead of building a thing.

**Independent Test**: Start a round, grow a vein to the nearest pool with a store house on the same vein, and
confirm that a ring forms around the pool, income rises, and the pool still pays after a long time.

**Acceptance Scenarios**:

1. **Given** a pool on the map, **When** a vein of the player's mold reaches a cell next to it, **Then** the
   mold's growth spreads around the pool to form a ring of cells, with no extra command from the player.
2. **Given** a mold holding some of a pool's ring and a store house on the same connected piece, **When** time
   passes, **Then** that piece's stock grows at a rate that rises with the share of the ring held.
3. **Given** a pool being harvested, **When** any amount of time passes, **Then** the pool is never depleted
   and its rate does not drop.
4. **Given** a pool whose ring is held but no store house stands on that piece, **Then** no income flows and
   the player is shown that the pool is waiting for a store house.
5. **Given** a cut that separates the ring from the store house, **Then** the pool stops paying that piece
   until a store house is on the same piece again.

---

### User Story 2 - Goo Pools Take the Farm's Place (Priority: P1)

The farm (the slime pool building) is gone: there is no farm in the build menu, no output dial, and no warning
about unlinked farms. The build menu offers the store house, booster factory and harvester. Store houses now
exist to make pools pay (as well as raising the stock cap and boosting growth and harvest), and the HUD and
build hints explain that. Map generation places goo pools where fertile patches used to go: one near each
start, fair for every mold, and a few contested ones toward the middle.

**Why this priority**: Without removing the farm and placing pools fairly, the new income would be on top of
the old and the balance would be off.

**Independent Test**: Start rounds on several seeds and confirm there is no farm anywhere in the game, that
every mold has a comparable pool near its start, and that the contested pools are in reach of more than one
mold.

**Acceptance Scenarios**:

1. **Given** the build menu, **Then** it has no farm, and the keyboard or touch way to build one is gone.
2. **Given** a new round on any seed, **Then** each mold has a goo pool at a similar distance from its start,
   and one or more contested pools lie between molds.
3. **Given** the fog of war, **Then** pools are always visible, but a rival's ring and income are shown only
   where the player can see them.
4. **Given** the rival molds, **Then** they grow toward pools and build store houses under the same rules and
   costs as the player.

---

### User Story 3 - Contested Pools (Priority: P2)

Two molds can reach the same pool. Each earns from the ring cells it holds, so the share of income follows
who holds more of the ring. Where their rings meet, normal fronts and combat decide who keeps each cell, so a
pool becomes a place worth fighting over, and cutting a rival's vein to a pool cuts their income from it.

**Why this priority**: It turns the pools into objectives and gives fights a purpose, but the game is
playable with US1 and US2 alone.

**Independent Test**: Put two molds at one pool and confirm each earns in proportion to the ring cells it
holds, and that losing ring cells in a fight lowers the loser's income and raises the winner's.

**Acceptance Scenarios**:

1. **Given** two molds with ring cells at the same pool, **Then** each earns in proportion to the cells it
   holds, and only while it has a store house on that piece.
2. **Given** a front at a pool, **When** one mold takes ring cells from the other, **Then** their incomes
   change on the next tick.
3. **Given** a pool with no ring cells held by anyone, **Then** nobody earns from it.

---

### User Story 4 - See and Read the Pools (Priority: P2)

Pools look like pools of primordial goo: a deep green, glowing well with a bubbling surface, drawn in the
comic style and visible in the fog. A pool you are harvesting shows that (a pulse or glow in your colour), a
pool waiting for a store house shows a small marker, and the HUD shows income from pools. On touch the same
information is available without hover.

**Why this priority**: The mechanic needs to be readable at a glance, but the rules work without the art.

**Independent Test**: Look at pools in each state (untouched, ringed with a store house, ringed without one,
contested) and confirm each is told apart at a glance, on desktop and on a phone.

**Acceptance Scenarios**:

1. **Given** a pool nobody holds, **Then** it looks like an untouched goo well.
2. **Given** a pool the player is harvesting, **Then** it looks active in the player's colour.
3. **Given** a ringed pool with no store house on that piece, **Then** it shows a small "needs a store house"
   marker and the HUD hint says so.

---

### Edge Cases

- A pool far from every start: it is reached later, but fairness is checked for the near and contested ones.
- A ring that is partly blocked by terrain or another mold: only the cells that can be held count.
- A mold eliminated while holding a ring: the cells go with it and the pool is free again.
- A pool reached by a piece with no store house, then a store house built: income starts at once.
- Two pools on one piece: each pays on its own, with the same store house.
- Saved runs and replays from before this change are not expected to load.
- Fog: income from a rival's pool is never shown unless that ring is in view.
- A pool at the edge of the map has a smaller ring and so a lower top rate, which map generation avoids.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The map MUST contain goo pools as terrain, replacing fertile patches: one near each start, equally
  fair for every mold, plus a few contested pools between molds, all visible in the fog.
- **FR-002**: A goo pool MUST never run out: its rate does not fall however long it is harvested.
- **FR-003**: When a mold's vein reaches a cell beside a pool, the mold's growth MUST spread around the pool to
  form a ring of cells without further commands, within the usual growth rules and costs.
- **FR-004**: A mold MUST earn from a pool at a rate that rises with the share of the pool's ring cells it
  holds, and only while a store house stands on the same connected piece as those cells.
- **FR-005**: Income MUST flow into the stock of the piece holding the ring, and be limited by that piece's
  cap like all other income.
- **FR-006**: Where more than one mold holds ring cells of a pool, each MUST earn according to the cells it
  holds; nobody earns from cells they do not hold.
- **FR-007**: The buildable farm (slime pool), its output dial, its build command and its unlinked-farm
  warning MUST be removed from the game for the player and for rivals.
- **FR-008**: The store house MUST keep its other effects (cap, growth and harvest boost) and gain the job of
  making pools pay; its description and hints MUST say so.
- **FR-009**: Rival molds MUST grow toward pools, build store houses and harvest under the same rules and
  costs, with no information the player lacks.
- **FR-010**: Map generation MUST keep every round winnable and fair: near pools equally reachable for every
  mold, and contested pools within reach of at least two molds.
- **FR-011**: Pools MUST be shown as goo wells in every state (untouched, harvested, waiting for a store
  house, contested), readable without hover, and a rival's activity MUST show only where visible.
- **FR-012**: The HUD MUST show income from pools and tell the player when a held pool is waiting for a
  store house.
- **FR-013**: The simulation MUST stay deterministic: the same seed, round and commands MUST give the same
  state, and pools MUST use the seeded generator and the existing fixed timestep.
- **FR-014**: The balance values (pool rate, ring size, store house requirement) MUST live in the one
  balance configuration.
- **FR-015**: Mobile mode and the replay and state hash MUST keep working with the new pools.

### Key Entities

- **Goo pool**: A permanent terrain feature at a fixed place, with a ring of cells around it. It has a rate
  that never changes and no stock that can run out.
- **Pool ring**: The cells around a pool that molds can hold; the share a mold holds decides its income.
- **Pool income**: The nutrients per second a mold earns from a pool, available only to a piece with a store
  house, added to that piece's stock.
- **Store house**: As before, now also the thing that makes a pool pay on its piece.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a round, a player who reaches a pool with a store house on the vein sees their income rise
  within 5 seconds, and the pool still pays after 30 minutes of game time.
- **SC-002**: On at least 50 different seeds, every mold's nearest pool is within 25% of the same travel
  distance as every other mold's, and every contested pool is reachable by two or more molds.
- **SC-003**: The AI-played stand-in win rate stays within 10 percentage points of today's for rounds 1 to 4.
- **SC-004**: With the same seed and commands, two runs end in an identical state hash, and every existing
  automated test that is not about farms still passes.
- **SC-005**: A first-time player can tell untouched, harvested and waiting pools apart at a glance in a
  playtest.
- **SC-006**: There is no farm left in the build menu, the controls, the hints or the rules text.

## Assumptions

- A pool's ring is a fixed set of cells around it (about eight to twelve); the exact size and rate are
  tuned in the balance pass.
- Income from a pool is the pool's rate times the share of the ring a mold holds, and the pool's rate is set
  so a fully held pool pays about what one farm at full output did.
- Pools pay only while a store house is on the same connected piece, as the player chose; the first store
  house therefore matters more than before.
- Goo pools reuse the positions and fairness checks of today's fertile patches.
- Growing around a pool uses the normal growth rules (costs, upkeep, fronts); no new command is added.
- No new building or command is added, and one is removed (the farm and its output dial).
- Replays and saves from before this change are not supported.
- Mobile mode shows pools the same way and needs no new controls.
