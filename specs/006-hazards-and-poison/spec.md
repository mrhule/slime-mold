# Feature Specification: Hazards and Poison Food

**Feature Branch**: `006-hazards-and-poison`

**Created**: 2026-10-25

**Status**: Draft (to be built after 005-mutations)

**Input**: User description: "Hazards on the map: a cold or dry zone that slows growth, a bleach
drop that kills cells. Poison food: some drops damage the mold that absorbs them, so a rival can
be lured into one." Chosen as the third pick from a list of fun-adding ideas.

This builds on [001](../001-core-game-loop/spec.md) (drops, fog of war, terrain) and
[002](../002-buildings/spec.md). It adds map hazards and a new kind of food, under the same
rules for every mold.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Slow Zones (Priority: P1)

Some generated maps include **cold or dry zones**: patches of ground where veins grow more slowly
and cost more to build. They are visible terrain, even in fog, drawn in the comic style. The
player decides whether to cross one, go around, or avoid it. Rivals treat the zones the same way.

**Why this priority**: It adds spatial decisions with the least new machinery: a terrain kind
with a cost, like rough ground.

**Independent Test**: Grow a tip across a zone and confirm it grows slower and costs more, and
that path planning prefers going around a short zone but crosses a wide one when it is the only
way.

**Acceptance Scenarios**:

1. **Given** a map with zones, **When** the player views it, **Then** zones are visible
   terrain, including in fog.
2. **Given** a tip crossing a zone, **When** it grows, **Then** each cell costs more and takes
   longer than on open ground, by the zone's stated factor.
3. **Given** map generation, **When** a map is made, **Then** every mold has a route to the
   others that is not blocked by zones, and no start sits in one.

---

### User Story 2 - Poison Food (Priority: P1)

Some drops are **poison food**: they look like food but damage the mold that absorbs them instead
of feeding it. The player can tell them apart on close inspection (a shape cue, never color
alone), but a rival that only sees a distant lump may not. A mold that touches poison loses
nutrients or biomass in the cells that engulfed it, then the item is used up.

**Why this priority**: It rewards scouting through the fog and gives the player a way to bait a
rival.

**Independent Test**: Place poison food, let a mold absorb it, and confirm the stated damage and
that the item is consumed. Confirm that a poison item in view is marked, and in fog is not
revealed.

**Acceptance Scenarios**:

1. **Given** a poison food item in view, **When** the player looks at it, **Then** it is marked
   by a shape cue, and its tooltip says what it does.
2. **Given** a poison item the player cannot see, **When** the player looks there, **Then**
   nothing about it is revealed.
3. **Given** a mold that reaches poison, **When** it engulfs it, **Then** the stated damage
   applies, the item is used up, and an event tells the owner what happened.
4. **Given** the rival AI, **When** it decides where to grow, **Then** it uses only what it
   can see: it avoids poison it has identified and may walk into poison it has not.

---

### User Story 3 - Bleach Drops (Priority: P2)

Now and then a drop warning announces **bleach**: a patch that, when it lands, kills the cells
of any mold under it and leaves the ground temporarily harmful, then fades. The warning shows
the area and a countdown, like food drops, giving players time to react, for example by
cutting a vein or moving away.

**Why this priority**: It adds drama and a timing decision, building on the existing drop warning
system, after the first two stories prove out hazards.

**Independent Test**: Schedule a bleach drop over a mold, confirm the warning shows its area
and time, and that the stated cells are destroyed on landing and the ground recovers after the
stated time.

**Acceptance Scenarios**:

1. **Given** a bleach drop is scheduled, **When** its warning appears, **Then** it shows the
   area and a countdown to every mold, whatever the fog.
2. **Given** the drop lands, **When** it does, **Then** cells under it are destroyed (buildings
   with them) and no mold is favored.
3. **Given** the affected ground, **When** time passes, **Then** growing on it is blocked or
   penalized until the stated recovery time ends.

---

### Edge Cases

- A bleach area covers a mold's core: the core survives, but its piece is cut off from the
  rest, so the core can never be killed by a drop alone.
- Poison and food overlap on the same item: the item is either food or poison, never both.
- A poison item is the only food in reach for a rival: the AI may choose to take it, as it
  would with any item it believes is food.
- Hazards in a small round: counts scale with map size and round number, with a hard cap.
- Fast-forward and pause: warnings and landings use the same timing as food drops.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Maps MUST be able to contain slow zones as a kind of terrain that raises growth
  cost and time by stated factors, visible to everyone including in fog.
- **FR-002**: Map generation MUST keep every start out of a zone, and MUST keep every mold able
  to reach every other without crossing a zone.
- **FR-003**: Food drops MUST be able to be poison, with a stated damage to the mold that
  absorbs it, and MUST be distinguishable by a shape cue when in view.
- **FR-004**: A poison item out of the player's view MUST NOT be revealed; the rival AI MUST
  obey the same visibility (001 FR-028, Constitution II).
- **FR-005**: Bleach drops MUST announce their area and countdown to all molds, destroy cells
  in the area on landing without regard to owner, and MUST NOT be able to destroy a core.
- **FR-006**: Bleached ground MUST recover after a stated time, and until then MUST block or
  penalize growth by a stated amount.
- **FR-007**: Counts, strengths, and timings of hazards MUST come from tunable difficulty
  settings and grow with round number within caps.
- **FR-008**: Hazard placement and timing MUST come from the seeded generator so a round replays
  identically.
- **FR-009**: Hazards MUST follow the comic / cel-shaded art direction, and mold identity and
  hazard type MUST NOT rely on color alone.

### Key Entities

- **Slow Zone**: terrain with a growth cost factor.
- **Poison Food**: a food item whose absorption damages the absorber.
- **Bleach Drop**: a scheduled hazard with an area, a warning time, a landing, and a recovery.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can tell poison from food in view within a few seconds, in a playtest, and
  can say what a bleach warning means without help.
- **SC-002**: Over a large seed set, every generated map keeps starts out of zones and routes
  clear of them.
- **SC-003**: In batch simulations, hazards change round outcomes within a target band and do
  not make any round unwinnable by design.
- **SC-004**: The same seed, round, and commands produce the same outcome in 100% of runs.
- **SC-005**: The game holds its smoothness target (001 SC-003) with the maximum number of
  hazards on the map.

## Assumptions

- Hazards start rare and ramp up with the round, so early rounds teach the basics.
- Poison and bleach use the existing drop schedule and warning machinery where possible.
- Exact factors, damage amounts, areas, and timings are set in planning and tuning.
- Desktop browsers only, as with the rest of the game.

## Open questions for the clarify step

- Should poison be visible to the player only after a short time in view, or immediately when
  seen?
- Should bleach be allowed to hit the player at all in round 1, or start from a later round?
