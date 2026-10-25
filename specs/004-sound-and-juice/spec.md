# Feature Specification: Sound and Juice

**Feature Branch**: `004-sound-and-juice`

**Created**: 2026-10-25

**Status**: Draft (to be built after 003-store-house)

**Input**: User description: "Make the game more fun: sound and juice (squelch sounds, a pulse
along veins when nutrients flow, screen shake on big fights)." Picked first from a list of
fun-adding ideas.

This builds on [001](../001-core-game-loop/spec.md) and [002](../002-buildings/spec.md). It adds
feedback only: sound, motion, and screen effects. It changes no game rules and no simulation
state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sound Effects and Mute (Priority: P1)

The game is silent today. The player hears short, gritty comic-style sounds for the things that
matter: growing a vein, absorbing food, a drop warning and landing, placing a building, a front
being won or lost, a round starting and ending. A mute toggle and a volume control are always
reachable, and the choice is remembered.

**Why this priority**: Sound is the biggest gain in feel for the least risk, and it needs no
rule changes.

**Independent Test**: Play a round and confirm each event in the list makes its sound at the
moment it happens, that mute silences everything, and that the setting survives a reload.

**Acceptance Scenarios**:

1. **Given** the player places a building, **When** it appears, **Then** a placement sound plays
   and a different sound plays if the placement is refused.
2. **Given** food is being absorbed, **When** the player's mold feeds, **Then** a soft squelch
   plays, without stacking into noise when many cells feed at once.
3. **Given** a drop warning, **When** it appears, **Then** a rising warning sound plays, and a
   landing sound plays when it lands.
4. **Given** the mute toggle, **When** it is on, **Then** nothing plays, and the setting is kept
   across reloads.
5. **Given** the game is paused or the window loses focus, **When** that happens, **Then**
   gameplay sounds stop until play resumes.

---

### User Story 2 - Pulse Along Veins (Priority: P2)

Nutrient flow becomes visible: small bright pulses travel along veins toward where nutrients are
being spent, faster and denser where more is flowing. A busy trunk visibly throbs, an idle vein
is still.

**Why this priority**: It shows the flow model the player is otherwise only told about, and it
makes the growth/fight slider readable at a glance.

**Independent Test**: Grow toward food and confirm pulses travel from the core toward the tip,
and move the slider to Fight and confirm pulses shift toward fronts.

**Acceptance Scenarios**:

1. **Given** a tip being fed, **When** flow reaches it, **Then** pulses travel along the veins
   to it, with density following the flow.
2. **Given** a vein carrying no flow, **When** time passes, **Then** it shows no pulses.
3. **Given** rival veins the player can see, **When** they are fed, **Then** they pulse too,
   and a vein in fog shows none.

---

### User Story 3 - Fight Impact and Screen Shake (Priority: P2)

Fights hit harder on screen: cells that die burst in ink-splat effects, a front changing hands
gives a short camera shake and a punchy sound, and big battles shake more than small ones. A
setting turns shake off, and it never covers the HUD.

**Why this priority**: It makes the moment the game is about feel important, and builds on the
combat events the simulation already reports.

**Independent Test**: Stage a fight and confirm death bursts, a shake scaled to its size, and
that turning shake off removes it.

**Acceptance Scenarios**:

1. **Given** cells destroyed in combat, **When** they die, **Then** a splat effect plays in the
   mold's color and ink pattern.
2. **Given** a front won or lost, **When** it changes hands, **Then** the camera shakes briefly
   and a sound plays, scaled by how many cells changed.
3. **Given** the reduced-motion setting, **When** it is on, **Then** shake and flashing are off.

---

### Edge Cases

- Browsers block audio until the first click: sound starts after the first player action, with
  no error.
- Hundreds of events in one tick: sounds are rate-limited per kind, so the mix never becomes a
  wall of noise.
- Fast-forward (2x/3x): sounds stay in step with game events without pitch or volume surprises.
- Effects for things in fog: nothing is played or shown for events the player cannot see.
- Audio unavailable or blocked: the game plays on silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST play sounds for at least: growing, absorbing food, drop warning and
  landing, building placed or refused, front won or lost, round start and end.
- **FR-002**: The player MUST be able to mute and set a volume at any time, and the choice MUST
  persist, degrading gracefully when storage is unavailable.
- **FR-003**: Sounds MUST be rate-limited per kind so many simultaneous events stay readable.
- **FR-004**: Sounds and effects MUST be driven only by events and state the simulation already
  exposes; they MUST NOT change simulation state or timing.
- **FR-005**: Nothing about events in fog MAY be played or shown to the player (fairness, 001
  FR-028).
- **FR-006**: Veins MUST show moving pulses whose density follows nutrient flow, and none where
  there is no flow.
- **FR-007**: Combat deaths and fronts changing hands MUST show effects, and a screen shake
  scaled by size.
- **FR-008**: The player MUST be able to reduce or disable shake and flashing effects.
- **FR-009**: All visuals MUST follow the comic / cel-shaded art direction, and mold identity
  MUST NOT rely on color alone.

### Key Entities

- **Sound Cue**: a named sound tied to a game event, with a rate limit and a volume.
- **Audio Settings**: mute, volume, and motion-reduction choices, saved per browser.
- **Flow Pulse**: a visual mark that travels along a vein in proportion to its flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a playtest, every listed event has a distinct, audible cue, and players can
  name what happened from sound alone for at least the main ones (growth, fight, warning).
- **SC-002**: Muting silences 100% of sounds at once, and the setting survives a reload.
- **SC-003**: The game holds its smoothness target (001 SC-003) with pulses and effects at the
  largest map and rival count.
- **SC-004**: The same seed and commands produce the same outcome with sound and effects on or
  off.

## Assumptions

- Sounds are short, original or royalty-free clips bundled with the game; no new runtime
  dependency is needed beyond the browser's audio support.
- Music is out of scope for this feature and can be a later addition.
- Desktop browsers only, as with the rest of the game.

## Open questions for the clarify step

- Original recorded clips or generated (synthesized) sounds?
- Is background music wanted now or later?
