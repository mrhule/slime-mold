# Feature Specification: Store House, Fertile Ground, and Farm Output

**Feature Branch**: `003-store-house`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Add a new building, a store house. It stores farm production, and it
can boost a vein to grow faster, harvest faster, and so on." Decisions made with the player while
shaping it: the store house raises the nutrient cap of its piece of the mold; farms only pay once
linked to a store house; farms can only be placed on fertile tiles; each farm has an output dial
that trades income against upkeep; the store house's boost spends stored nutrients and tapers
along the vein.

This builds on [002-buildings](../002-buildings/spec.md) and
[001-core-game-loop](../001-core-game-loop/spec.md): the same sim, commands, fog of war, build
bar, and comic art direction apply. It changes how the farm works and adds one building and one
kind of terrain.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stored Nutrients and the Store House (Priority: P1)

Each connected piece of the mold keeps its own stock of nutrients, as before, but a stock now
has a **cap**: a base amount for every piece, plus more for each Store House standing in it. When
a piece is full, anything that would push it higher is not gained. The player places a Store House
from the build bar on one of their own cells, sees a preview of the piece's cap before and after,
and pays for it up front. Building storage lets a piece bank nutrients for big purchases and long
trips, and a cut-off piece keeps what its own stock holds.

**Why this priority**: The cap is what makes storage meaningful and what the rest of the feature
hangs on. With only this story, the player already has a new decision: how much to bank and where.

**Independent Test**: In a round with no rivals, fill a piece's stock to its base cap, confirm
that extra income is not gained, place a Store House, and confirm the cap rises and the stock can
grow past the old limit.

**Acceptance Scenarios**:

1. **Given** the player has enough nutrients, **When** they choose Store House and click one of
   their own vein cells, **Then** it appears, its cost is deducted from that piece, and the
   piece's cap rises by the Store House's capacity.
2. **Given** a piece whose stock is at its cap, **When** it would gain nutrients, **Then** it
   gains nothing and the HUD shows that the stock is full.
3. **Given** a piece with two Store Houses, **When** the cap is shown, **Then** it is the base
   cap plus both capacities, up to a per-piece limit on how many Store Houses count.
4. **Given** a Store House whose cell is destroyed, **When** that happens, **Then** the piece's
   cap drops at once, and any stock above the new cap is lost.
5. **Given** a piece that is cut off from the rest of the mold, **When** it still has a Store
   House, **Then** it keeps its own stock and cap and can spend it on growth and buildings.
6. **Given** the HUD, **When** the player looks at it, **Then** it shows each piece's stock
   against its cap, or the piece under the cursor, so the player knows how full it is.

---

### User Story 2 - Fertile Ground and Linked Farms (Priority: P1)

A new kind of ground, **fertile ground**, appears on generated maps as patches the player can see
in the terrain, even in the fog. Farms can be placed only on fertile ground. A farm pays
nutrients only while a Store House stands in the same connected piece as the farm; otherwise it
idles and the interface marks it as unlinked. When the piece's stock is full, working farms slow
themselves down so nothing is wasted. The build bar warns before the player places a farm that
would be unlinked.

**Why this priority**: It changes the economy at its root: income now depends on where fertile
ground is, and on having storage wired to it. It must ship with the Store House because farms
need it to pay at all.

**Independent Test**: Place a farm on fertile ground in a piece with no Store House and confirm
it pays nothing and shows as unlinked. Then place a Store House in the same piece and confirm the
farm starts paying. Fill the stock and confirm the farm slows down and then resumes after
spending.

**Acceptance Scenarios**:

1. **Given** a map, **When** the player looks at it, **Then** fertile ground is visible as
   terrain, and each mold has fertile ground within reach of its start.
2. **Given** a cell that is not fertile ground, **When** the player tries to place a farm there,
   **Then** the preview shows it as invalid with the reason and nothing is placed.
3. **Given** a farm with no Store House in its piece, **When** time passes, **Then** it
   produces nothing and is shown as unlinked, and the build bar and HUD warn about it.
4. **Given** a farm and a Store House in the same piece, **When** time passes, **Then** the farm
   pays its piece at its rate, at any distance along the veins.
5. **Given** a piece whose stock is at its cap, **When** farms in it are working, **Then** they
   slow down automatically so that no output is wasted, and speed up again as the stock drops.
6. **Given** a link broken because the veins between a farm and its Store House are cut, **When**
   they end up in different pieces, **Then** the farm stops paying unless its own piece has a
   Store House.
7. **Given** a Store House, **When** it is the only link for several farms, **Then** all of them
   pay while it stands, and all stop if it is destroyed.

---

### User Story 3 - Dial a Farm's Output (Priority: P2)

Each farm has an output dial. Turning it up makes the farm produce more nutrients and cost more
upkeep, with diminishing returns, so running every farm flat out is wasteful. Turning it down
saves upkeep when the player has plenty of nutrients, and turning it to zero parks the farm
without losing it. The player sets the dial from a small control shown for the selected farm.

**Why this priority**: It gives the economy a knob, but it is only worth having once linked farms
exist, so it follows User Story 2.

**Independent Test**: Place a linked farm and set the dial to several values. Confirm that income
and upkeep both change with the dial, that net gain per nutrient of upkeep drops at high settings,
and that a dial at zero produces nothing and costs no upkeep.

**Acceptance Scenarios**:

1. **Given** a farm, **When** the player selects it, **Then** an output dial shows its current
   setting, the income it produces, and the upkeep it costs.
2. **Given** a farm, **When** the player changes the dial, **Then** its income and upkeep change
   together, and the HUD updates.
3. **Given** a dial turned high, **When** the numbers are compared with a lower setting,
   **Then** the extra income per extra upkeep is smaller (diminishing returns).
4. **Given** a dial at zero, **When** time passes, **Then** the farm produces nothing, costs no
   upkeep, and stays in place.
5. **Given** a rival's farm, **When** it sets its dial, **Then** it uses the same control the
   player uses.

---

### User Story 4 - Store House Boosts Growth and Harvest (Priority: P2)

A Store House can spend the nutrients it holds to speed up work on its vein. While it is
boosting, tips growing on the vein grow faster, and Harvesters on the vein absorb food faster,
with the effect strongest at the Store House and fading along the vein until it vanishes at a
set distance, like the Booster Factory's reach but for growth and harvesting instead of combat.
The boost costs stored nutrients at a steady rate and only runs while something on the vein is
actually being boosted, and it stops when the stock is low. The Store House's reach is shown as
a glow along the vein.

**Why this priority**: It gives stored nutrients a use beyond a rainy day and rewards building
storage near the growth front. It depends on stored nutrients and Store Houses existing, so it
follows the first two stories.

**Independent Test**: Grow a tip on a vein with and without a Store House nearby and confirm the
tip grows faster with it, fading with distance. Place a Harvester on the vein and confirm the
same. Drain the stock and confirm the boost stops.

**Acceptance Scenarios**:

1. **Given** a tip growing on a vein with a working Store House, **When** it grows near the
   Store House, **Then** it grows faster than the same tip without one, and the bonus is smaller
   the further along the vein the tip is.
2. **Given** a Harvester on a vein with a working Store House, **When** it absorbs food,
   **Then** it absorbs faster than without the boost, with the same total nutrients.
3. **Given** a Store House with nothing on its vein to boost, **When** time passes, **Then** it
   spends no stored nutrients on boosting.
4. **Given** a Store House whose piece's stock is too low, **When** the boost would be active,
   **Then** it stops until the stock recovers.
5. **Given** two Store Houses covering the same cell, **When** the bonus is computed, **Then** it
   is larger than from one but capped, so stacking does not grow without limit.
6. **Given** the Store House's boost, **When** a front is fought, **Then** it has no effect on
   combat; the Booster Factory still covers that.

---

### User Story 5 - Rivals Use Storage, Fertile Ground and Dials (Priority: P3)

Rival molds place farms only on fertile ground, link them to Store Houses, set their dials, and
build Store Houses under the same rules, costs, and fog of war as the player. Harder rounds make
them build sooner and more, but never give them cheaper buildings or hidden information.

**Why this priority**: It keeps the fairness rule of the core game. The feature is playable and
testable without it.

**Independent Test**: Run a round with one rival and confirm it builds Store Houses and linked
farms with the same commands and limits as the player, and that a rival's Store House shows for
the player only when it is in view.

**Acceptance Scenarios**:

1. **Given** a rival with fertile ground in reach, **When** it decides to farm, **Then** it
   places a Store House and a farm through the same commands the player uses.
2. **Given** a rival's building outside the player's vision, **When** the player looks there,
   **Then** it appears only as last-known information, marked as stale.
3. **Given** higher difficulty, **When** a round starts, **Then** rivals build earlier and more
   often, with no change to costs, limits, or rules.

---

### Edge Cases

- A map has too little fertile ground near a start: map generation must add or move patches until
  every mold has enough in reach, or fail the map and retry, as it does for food fairness.
- The player places a farm before any Store House: it is allowed on fertile ground, shown as
  unlinked, and starts paying as soon as a Store House joins its piece.
- A farm and a Store House end up in different pieces when veins are cut: the farm idles until
  they are joined again or its piece gains a Store House.
- A piece is over its cap when a Store House is lost: the stock is cut to the new cap, and the
  player is told.
- A piece is at its cap while the player spends nutrients: stock drops, farms speed back up, and
  nothing is lost.
- The dial is changed while the game is paused: the setting is accepted and takes effect when the
  game resumes, like growth targets.
- Two molds try to place on the same fertile cell in the same moment: the earlier order in the
  tick wins and the later one is refused, as with other buildings.
- A Store House boost covers a tip that arrives or a vein that is cut mid-boost: the bonus ends
  with the vein, and no refund is given for nutrients already spent.
- The player loses the last Store House of a piece while farms are working: the farms become
  unlinked at once and the interface shows it.

## Requirements *(mandatory)*

### Functional Requirements

**Stored nutrients**

- **FR-001**: Every piece of the mold MUST have a nutrient cap: a base cap plus a set amount for
  each Store House in it, with a limit on how many Store Houses count toward one piece. These
  amounts are tunable settings.
- **FR-002**: A piece's stock MUST NOT rise above its cap. Nutrients that would push it higher
  MUST NOT be gained.
- **FR-003**: When a piece's cap falls, any stock above the new cap MUST be lost at that moment.
- **FR-004**: The HUD MUST show a piece's stock against its cap, and MUST show when the stock is
  full.

**Store House**

- **FR-005**: A Store House MUST be a building under the rules of 002 (FR-001 to FR-007): placed
  on one of its owner's cells through the same command, with a cost, upkeep, and per-mold limit,
  destroyed with its cell, with no refund.
- **FR-006**: A Store House MUST raise the cap of the piece it stands in by its capacity, and
  MUST stop doing so the moment it is destroyed or its piece can no longer pay its upkeep.
- **FR-007**: The placement preview for a Store House MUST show the piece's cap before and after.

**Fertile ground and farms**

- **FR-008**: Fertile ground MUST be a kind of terrain, visible to everyone in the terrain layer
  including in fog, like obstacles and rough ground.
- **FR-009**: Farms MUST be placeable only on fertile ground. Other buildings MAY stand on fertile
  ground, but a cell still holds at most one building (002 FR-004).
- **FR-010**: A farm MUST pay nutrients to its piece only while at least one working Store House
  stands in the same piece. Otherwise it MUST produce nothing and be shown as unlinked.
- **FR-011**: A farm's link to a Store House MUST depend only on being in the same connected
  piece, at any distance along the veins.
- **FR-012**: While its piece's stock is at the cap, a farm MUST slow its output so that no
  produced nutrients are wasted, and MUST resume as the stock drops.
- **FR-013**: The interface MUST warn when a farm would be, or is, unlinked, in the build bar
  preview and in the HUD.
- **FR-014**: A working farm MUST still count as a source of supply for its piece (002 FR-009),
  whether or not it is linked.
- **FR-015**: Map generation MUST place fertile ground in patches within reach of every mold's
  start, in comparable amounts, and a smaller number of patches in contested areas away from the
  starts. A map without enough fertile ground for every mold MUST be repaired or rejected.

**Farm output dial**

- **FR-016**: Each farm MUST have an output setting between zero and a maximum above its normal
  rate, and both its income and its upkeep MUST scale with that setting.
- **FR-017**: Income per unit of upkeep MUST fall as the setting rises (diminishing returns), so
  the maximum setting is never strictly better.
- **FR-018**: A farm at setting zero MUST produce nothing and cost no upkeep, and stay in place.
- **FR-019**: Changing a farm's setting MUST be a command available to every mold, with the same
  rules for the player and rivals, and MUST be accepted while paused.

**Store House boost**

- **FR-020**: A working Store House MUST speed up growth of tips and absorption by Harvesters on
  the vein it is connected to, strongest at the Store House and fading linearly with distance
  along the vein to nothing at a set reach.
- **FR-021**: The boost MUST spend stored nutrients from the Store House's piece at a set rate,
  but only while at least one tip or Harvester within its reach is actually being sped up.
- **FR-022**: The boost MUST stop when the piece's stock is below a set low level, and MUST resume
  when the stock recovers.
- **FR-023**: The boost MUST NOT change combat strength, farm output, or the total nutrients in
  any food item.
- **FR-024**: Overlapping Store House boosts MUST stack up to a cap.
- **FR-025**: The reach of a Store House MUST be visible to its owner as a glow along its vein,
  and visible to others only where they can see the Store House.

**Interface and rivals**

- **FR-026**: The build bar MUST show the Store House with its cost, limit, and count, like other
  buildings, and each new building and terrain MUST follow the comic / cel-shaded art direction
  and be recognizable by shape, not only color.
- **FR-027**: Rival molds MUST place Store Houses and farms on fertile ground, set farm output,
  and use Store Houses only through the same commands, costs, limits, and fog of war as the
  player. Difficulty MUST change only how early and how often they build.
- **FR-028**: The same seed, round, and commands, including all new commands, MUST produce the
  same outcome every time.

### Key Entities

- **Store House**: a building on one cell of a mold. It has an owner, a cell, a capacity it adds
  to its piece, a boost reach, and an upkeep cost.
- **Piece Stock and Cap**: the nutrients held by one connected piece of the mold, and the most it
  can hold, made of a base amount and its Store Houses.
- **Fertile Ground**: terrain that farms can stand on, generated in patches and visible in fog.
- **Farm Output Setting**: a per-farm number between zero and a maximum that scales income and
  upkeep.
- **Store House Boost**: the growth and harvest speed-up around a Store House, fading with
  distance along the vein.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can place a Store House and a linked farm within 90 seconds of being
  told they exist, with no other instructions, helped by the unlinked warning.
- **SC-002**: In a round, a mold with a Store House and a farm on fertile ground ends richer than
  the same mold with the farm and no Store House, which earns nothing from it.
- **SC-003**: At the same stock, a tip on a Store House's vein grows measurably faster than the
  same tip without one, and the speed-up is smaller further along the vein.
- **SC-004**: A Harvester on a Store House's vein shortens the time to use up a food item beyond
  its own speed-up, with identical total nutrients absorbed.
- **SC-005**: No produced or stored nutrients are lost to the cap while a farm's self-throttling
  is active, and the only nutrients ever lost are those above a cap that falls.
- **SC-006**: Every generated map gives each mold fertile ground within reach of its start, in
  amounts within a set fairness margin, across a large test set of seeds.
- **SC-007**: The same seed, round, and commands produce the same outcome in 100% of runs.
- **SC-008**: The game holds its smoothness target (SC-003 of the core game) with the maximum
  number of buildings and the boost active.

## Assumptions

- This feature changes the farm of 002: a farm no longer pays by itself and no longer works on
  any cell. The balance pass that follows must re-tune the economy with this in mind, including
  the base cap and starting nutrients, so a new round is still playable before the first Store
  House. A mold begins a round with no Store House.
- Costs, rates, caps, capacities, reach, boost strength, dial limits, the low-stock threshold,
  and the amount of fertile ground are set in planning and tuned in playtesting. They do not
  change any requirement here.
- A piece's stock is the existing pool of a connected piece of vein. This feature adds a cap to
  it and does not add a second kind of stock.
- Costs and yields are in nutrients only. There is no second resource.
- A tech tree that unlocks or upgrades buildings is still a separate, later feature. All of
  these buildings are available from the start of a round, and nothing carries over between
  rounds.
- Buildings are not soldiers. No new moving units are added.
- The Booster Factory keeps its combat-only effect (002) and is unchanged by this feature.
- Fertile ground is visible terrain but is not food and does not affect vein growth speed. It
  restricts only where farms can stand.
- Players adjust a farm's dial with mouse and keyboard on desktop, like the rest of the game.

## Clarifications

### Session 2026-10-25

- Q: How does the store house change nutrient storage? → A: Pools are capped; a Store House
  raises the cap, and farms must feed a Store House to pay.
- Q: How does it boost a vein? → A: It spends stored nutrients, tapering along the vein, and
  only boosts growth and harvesting.
- Q: Is the cap per piece or for the whole mold? → A: Per piece.
- Q: Which links count for a farm? → A: Same connected piece, any distance.
- Q: What does adjusting farm output trade off? → A: Income against upkeep, per farm.
- Q: How are fertile tiles placed? → A: Patches near each start plus a few contested ones.
- Q: What happens when a farm is unlinked or the store is full? → A: An unlinked farm idles;
  farms throttle themselves at the cap.
- Q: What does the boost speed up? → A: Growth and harvesting only.
