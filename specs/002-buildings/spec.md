# Feature Specification: Buildings — Nutrient Farms, Booster Factories, Harvesters

**Feature Branch**: `002-buildings`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Veins do not retract; they just grow slowly, so the player has to keep
finding nutrients. Add a way to place a nutrient farm. Add booster factories, which are not
soldiers: they simply make the area they are in stronger. Nutrients come in different sizes, and
larger pieces provide more, so the player can build a factory next to a large resource to mine
it faster. A tech tree may come later."

> **Update (003):** [003-store-house](../003-store-house/spec.md) changes the farm described
> here: farms now stand only on fertile ground, pay only while a store house is in their piece, and
> have an output dial. The booster now strengthens its whole vein (tapering with distance along it)
> instead of a square area. Read 003 for the current rules.

This builds on [001-core-game-loop](../001-core-game-loop/spec.md): the same sim, commands,
fog of war, and comic art direction (FR-032, FR-033) apply. It adds a second way to spend
nutrients: instead of only growing veins, the player can place **buildings** on their mold.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place a Nutrient Farm (Priority: P1)

The player picks "Nutrient Farm" from a build bar, hovers over their mold, and sees a preview
that shows whether the spot is valid and what it costs. Clicking places the farm. The farm
costs nutrients up front and then produces a slow, steady trickle of nutrients, so a mold can
keep growing even when there is no food nearby. Farms also cost upkeep and take space, so
placing many is a real decision.

**Why this priority**: It answers the main gap in the core loop (growth stalls when food runs
out) and creates the build mechanism every other building uses. With only this story, the game
gains a second economy to manage.

**Independent Test**: In a round with no rivals, grow a mold with no food nearby, place a farm,
and confirm that its income rises, that the farm pays back its cost over time, and that the
mold can keep growing on that income.

**Acceptance Scenarios**:

1. **Given** the player has enough nutrients, **When** they choose Nutrient Farm and click one of
   their own vein cells, **Then** the farm appears there, its cost is deducted, and the HUD shows
   the new income.
2. **Given** a spot that is off the mold, on an obstacle, on a food item, or already holding a
   building, **When** the player hovers or clicks it, **Then** the preview shows it as invalid
   with the reason and nothing is placed.
3. **Given** the player cannot afford the farm, **When** they try to place it, **Then** the
   placement is refused, the cost is shown, and no nutrients are spent.
4. **Given** a working farm, **When** time passes, **Then** the piece of the mold it sits in
   gains nutrients at the farm's rate, and the farm's upkeep is paid out of that piece's stock.
5. **Given** a farm whose piece of the mold is cut off from the rest, **When** it has no other
   source, **Then** it keeps feeding its own piece (the piece is not treated as cut off from
   supply while the farm works).
6. **Given** a cell holding a farm, **When** that cell is destroyed, **Then** the farm is
   destroyed with it and no refund is given.

---

### User Story 2 - Place a Booster Factory (Priority: P2)

The player places a Booster Factory on their mold. It does not make units. While it is working,
it makes the area around it stronger: the player's own cells inside its area fight harder and
are harder to destroy. The area is shown as a hand-inked ring so the player can see what it
covers. A factory is worth building near a front, or around a valuable spot the player wants to
hold.

**Why this priority**: It gives the grow-versus-fight decision a spatial dimension and a place
to invest nutrients beyond the front slider. It matters only once combat exists, so it follows
the farm.

**Independent Test**: Stage two identical fronts against a rival of fixed strength, one with a
factory covering the contact area and one without. Confirm that the covered front holds or
advances where the uncovered one loses.

**Acceptance Scenarios**:

1. **Given** the player has enough nutrients, **When** they place a Booster Factory on one of
   their vein cells, **Then** it appears, its cost is deducted, and its area ring is shown.
2. **Given** a front inside a factory's area, **When** both sides deliver equal nutrients,
   **Then** the factory's side wins the front.
3. **Given** a front outside every factory's area, **When** a fight happens, **Then** it plays out
   as in the core game, with no bonus.
4. **Given** a factory whose piece has no nutrients left to pay its upkeep, **When** that
   continues, **Then** its bonus stops until the upkeep can be paid again.
5. **Given** two factories whose areas overlap, **When** a front sits in the overlap, **Then**
   the bonus is larger than from one factory but capped, so stacking does not grow without limit.
6. **Given** a factory whose cell is destroyed, **When** that happens, **Then** its area bonus
   ends at once.

---

### User Story 3 - Harvest Large Food Faster (Priority: P2)

Food comes in different sizes, and larger pieces hold more nutrients but take longer to absorb.
The player can place a Harvester on one of their cells touching a large food item. While it
works, that item is absorbed faster. It does not add nutrients, it only pays them out sooner,
which matters when a rival is racing for the same food or when time is short. Small food is not
worth a Harvester, so only items of at least a set size can have one.

**Why this priority**: It makes food size matter and gives the player a way to win races for big
drops. It needs only the core economy, so it can ship alongside or just after the farm.

**Independent Test**: Place a Harvester on a mold cell touching a large food item and confirm
that the item is used up faster than the same item without one, with the same total nutrients.

**Acceptance Scenarios**:

1. **Given** the player's cell touches a food item that is large enough, **When** they place a
   Harvester there, **Then** it is placed and its cost is deducted.
2. **Given** a food item below the minimum size, or no food touching the cell, **When** the
   player tries to place a Harvester, **Then** the preview shows it as invalid with the reason.
3. **Given** a food item with a working Harvester, **When** time passes, **Then** it is absorbed
   at a higher rate than without one, and its total nutrients are unchanged.
4. **Given** a food item that is used up, **When** that happens, **Then** its Harvester stops
   having any effect and the player can see that it is idle.
5. **Given** a food item that two molds are both absorbing, **When** only one has a Harvester,
   **Then** only that mold's share is sped up.

---

### User Story 4 - Rivals Build Too (Priority: P3)

Rival molds place farms, boosters, and harvesters under exactly the same rules, costs, and
fog of war as the player. Harder rounds make them build sooner and more, but never give them
cheaper buildings or hidden information.

**Why this priority**: It keeps the fairness rule from the core game, but the buildings are
playable and testable without it.

**Independent Test**: Run a round with one rival and confirm that it places buildings only with
the same commands, costs, and limits the player has, and that a rival's building appears for the
player only when it is in view.

**Acceptance Scenarios**:

1. **Given** a rival with enough nutrients, **When** it decides to build, **Then** it uses the
   same placement action and pays the same cost as the player.
2. **Given** a rival's building outside the player's vision, **When** the player looks there,
   **Then** it appears only as last-known information, marked as stale.
3. **Given** higher difficulty, **When** a round starts, **Then** rivals build earlier and more
   often, with no change to costs, limits, or rules.

---

### Edge Cases

- A building is placed on a cell that is then split off or starved: it is lost with the cell.
- The player places a building while the game is paused: the order is accepted and takes effect
  when the game resumes, like growth targets.
- Two molds try to place on the same cell in the same moment: the earlier order in the tick
  wins and the later one is refused.
- A farm is placed in a piece that is already starving for upkeep: the placement is allowed, but
  the extra upkeep makes starvation worse until the farm's income arrives, and the preview warns
  about it.
- A food item is partly covered by two molds and one builds a Harvester: only cells that mold
  holds are sped up.
- The player cancels a placement mid-way (Esc or right-click): no cost is charged.
- The mold has reached the building limit: the preview shows the limit instead of a cost.

## Requirements *(mandatory)*

### Functional Requirements

**Placing buildings**

- **FR-001**: Players MUST be able to place a building by choosing it from a build bar and
  clicking a cell of their own mold. A preview MUST show whether the spot is valid, the reason if
  not, and the cost.
- **FR-002**: Placement MUST be a command available to every mold, using the same rules, costs,
  and limits for the player and rivals.
- **FR-003**: A building MUST cost nutrients, paid up front from the stock of the piece of the
  mold it is placed in. Placement MUST be refused, with no cost, if that stock is too low.
- **FR-004**: Each cell MUST hold at most one building, and a building MUST sit only on a cell
  of its owner's mold. A cell holding a building MUST NOT be a food cell, except for Harvesters.
- **FR-005**: A building MUST be destroyed when its cell is destroyed, with no refund.
- **FR-006**: Each building MUST cost ongoing upkeep, paid from the stock of its piece, in
  addition to the mold's per-cell upkeep.
- **FR-007**: Buildings MUST have a limit per mold, set per building type, which is a tunable
  setting.

**Nutrient Farm**

- **FR-008**: A Nutrient Farm MUST produce nutrients at a steady rate for its piece while it
  stands, regardless of food on the map.
- **FR-009**: A farm MUST count as a source of supply for its piece, so a piece that holds a
  working farm is not treated as cut off from supply.

**Booster Factory**

- **FR-010**: A Booster Factory MUST strengthen its owner's cells inside a fixed area around it
  while it works, in combat only: those cells MUST deliver stronger pressure at fronts and MUST
  be harder to destroy. It MUST NOT change growth speed or income.
- **FR-011**: The factory's bonus MUST stop while its piece cannot pay its upkeep.
- **FR-012**: Overlapping factory areas MUST stack with a cap, so stacking does not grow without
  limit.
- **FR-013**: The factory's area MUST be visible to its owner, and visible to others only where
  they can see the factory (FR-030 of the core game).

**Harvester**

- **FR-014**: Food items MUST come in different sizes with different totals (as in the core
  game), and a Harvester MUST be placeable only on a cell touching a food item at or above a
  minimum size.
- **FR-015**: A Harvester MUST raise the rate at which its owner absorbs that food item and MUST
  NOT change the item's total nutrients.
- **FR-016**: A Harvester MUST have no effect once its food item is used up, and the interface
  MUST show it as idle.

**Interface and rivals**

- **FR-017**: The HUD MUST show the build bar with each building's cost and limit, how many of
  each the mold has, and total income from buildings.
- **FR-018**: Placement preview and building visuals MUST follow the comic / cel-shaded art
  direction, and each building type MUST be recognizable by shape, not only by color.
- **FR-019**: Rival molds MUST place buildings only through the same command, with the same
  fog of war, as the player, and difficulty MUST change only how early and how often they build.

### Key Entities

- **Building**: a structure on one cell of a mold. It has a type, an owner, a cell, a working or
  idle state, and an upkeep cost.
- **Building Type**: farm, booster factory, or harvester, each with a cost, upkeep, limit, and
  effect settings.
- **Booster Area**: the set of cells around a booster factory where its bonus applies.
- **Food Item**: as in the core game, now with a size that decides whether a Harvester can be
  placed on it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can find the build bar and place their first farm within 60 seconds
  of being told it exists, with no other instructions.
- **SC-002**: A farm pays back its cost within a target time that the balance pass sets, and a
  mold with farms can keep growing when no food is in reach.
- **SC-003**: In staged fights of equal strength, a front covered by a booster factory is won
  at least 65% of the time, and an uncovered front shows no change from the core game.
- **SC-004**: A Harvester shortens the time to use up a large food item by a clear margin, and
  the total nutrients absorbed are identical with and without one.
- **SC-005**: Players never lose nutrients to an invalid or refused placement.
- **SC-006**: The same seed, round, and commands, including building commands, produce the same
  outcome in 100% of runs.
- **SC-007**: The game holds its smoothness target (SC-003 of the core game) with the maximum
  number of buildings on the map.

## Assumptions

- This feature needs the core game (001) through the fog of war and the pause and HUD work. The
  Booster Factory only matters once combat exists (001 User Story 2).
- All three buildings are available from the start of a round. A tech tree that unlocks and
  upgrades them is a separate later feature (003). Nothing carries over between rounds, as in
  the core game.
- Costs and yields are in nutrients only. There is no second resource.
- Buildings are not soldiers. No new moving units are added.
- Exact costs, rates, areas, limits, and the minimum food size are set in planning and tuned in
  playtesting. They do not change any requirement here.
- In the core game, idle veins no longer retract (001 FR-005), and a piece that cannot pay its
  upkeep loses its outermost cells (001 FR-006). That makes income, and so farms and food, the
  limit on how big a mold can grow.
- Buildings are placed by mouse and keyboard on desktop, like the rest of the game.

## Clarifications

### Session 2026-10-25

- Q: What should a Booster Factory make stronger? → A: Combat only (attack pressure and
  toughness of cells at fronts). No growth or income bonus.
