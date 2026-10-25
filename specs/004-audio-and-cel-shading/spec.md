# Feature Specification: Audio and Cel-Shaded Look

**Feature Branch**: `004-audio-and-cel-shading`

**Created**: 2026-10-25

**Status**: Draft (to be built right after 003-store-house)

**Input**: User description: "Sound and juice (squelch sounds, a pulse along veins when nutrients
flow, screen shake on big fights)" combined with "make the graphics more cell-shaded" (a shared
light, banded vein thickness, grounding shadows, variable line weight, optional print texture).
This replaces the separate drafts 004-sound-and-juice and 007-cel-shaded-lighting.

This builds on [001](../001-core-game-loop/spec.md) and [002](../002-buildings/spec.md), and on the
smoother cel-shaded terrain and fog already in the game. It adds feedback and a stronger comic look
only. It changes no game rules and no simulation state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sound Effects and Mute (Priority: P1)

The game is silent today. The player hears short, gritty comic-style sounds for the things that
matter: growing a vein, absorbing food, a drop warning and landing, placing a building, a front
being won or lost, a round starting and ending. A mute toggle and a volume control are always
reachable, and the choice is remembered.

**Why this priority**: Sound is the biggest gain in feel for the least risk, and it needs no rule
changes.

**Independent Test**: Play a round and confirm each listed event makes its sound at the moment it
happens, that mute silences everything, and that the setting survives a reload.

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

### User Story 2 - One Light, Hard-Stepped Shading (Priority: P1)

The whole scene shares one light direction (from the upper left). Veins, buildings, food, and
obstacles each show a lit side, a mid tone, and a shadow side, in hard bands, never smooth
gradients. Veins look like slightly rounded tubes, not flat lines, and buildings look like small
objects standing on the ground.

**Why this priority**: It adds the one thing the look is missing, a consistent light, and builds on
what the glass obstacles already do.

**Independent Test**: View the same scene with every drawn kind of object and confirm each has a
lit and a shadow side on the same side everywhere.

**Acceptance Scenarios**:

1. **Given** any vein, building, food item, or obstacle on screen, **When** it is drawn, **Then**
   its lit side faces the light direction and its shadow side faces away, in hard bands.
2. **Given** the player zooms in and out, **When** the view changes, **Then** the bands keep their
   look and do not shimmer or turn into gradients.
3. **Given** a mold, **When** it is shaded, **Then** its identity is still clear from its ink
   pattern and shape, and shading never hides the pattern (001 FR-033).

---

### User Story 3 - Banded Vein Thickness and Flow Pulses (Priority: P1)

Veins no longer vary smoothly in thickness. They snap to a few widths (thin, medium, thick), so a
busy trunk reads as a chunky tube and idle branches read as fine lines. Nutrient flow also becomes
visible: small bright pulses travel along veins toward where nutrients are being spent, denser
where more is flowing. A busy trunk visibly throbs, an idle vein is still.

**Why this priority**: Both show the flow model the player is otherwise only told about, and they
make the growth/fight slider readable at a glance. Together they are the main "juice" for veins.

**Independent Test**: Grow toward food and confirm veins show distinct width bands that follow flow
and that pulses travel from the core toward the tip. Move the slider to Fight and confirm pulses
shift toward fronts.

**Acceptance Scenarios**:

1. **Given** veins carrying different amounts of flow, **When** they are drawn, **Then** they use a
   small fixed set of widths that follow flow, with trunks widest.
2. **Given** a vein's flow crossing a band threshold, **When** it changes, **Then** the width
   changes without flicker (small hysteresis).
3. **Given** a tip being fed, **When** flow reaches it, **Then** pulses travel along the veins to
   it, with density following the flow.
4. **Given** a vein carrying no flow, **When** time passes, **Then** it shows no pulses.
5. **Given** rival veins the player can see, **When** they are fed, **Then** they pulse too, and a
   vein in fog shows none.

---

### User Story 4 - Fight Impact and Screen Shake (Priority: P2)

Fights hit harder on screen: cells that die burst in ink-splat effects, a front changing hands
gives a short camera shake and a punchy sound, and big battles shake more than small ones. A
setting turns shake off, and it never covers the HUD.

**Why this priority**: It makes the moment the game is about feel important, and builds on the
combat events the simulation already reports. It reuses the sound system from User Story 1.

**Independent Test**: Stage a fight and confirm death bursts, a shake scaled to its size, and that
turning shake off removes it.

**Acceptance Scenarios**:

1. **Given** cells destroyed in combat, **When** they die, **Then** a splat effect plays in the
   mold's color and ink pattern.
2. **Given** a front won or lost, **When** it changes hands, **Then** the camera shakes briefly and
   a sound plays, scaled by how many cells changed.
3. **Given** the reduced-motion setting, **When** it is on, **Then** shake and flashing are off.

---

### User Story 5 - Grounding Shadows and Variable Line Weight (Priority: P2)

Things cast short, flat, hard-edged shadows on the ground in the same hatched style the glass
already uses. Outlines are thicker on the shadow side and thinner on the lit side, like hand-inked
comic lines.

**Why this priority**: It adds depth and a hand-drawn feel, but it is polish on top of the first
stories.

**Independent Test**: Place veins, buildings, and food near each other and confirm each casts a
shadow toward the lower right and that outlines vary in weight by side.

**Acceptance Scenarios**:

1. **Given** a building or food item, **When** it is drawn, **Then** it casts a short hard-edged
   shadow on the ground away from the light.
2. **Given** an outline, **When** it is drawn, **Then** it is heavier on the shadow side and
   lighter on the lit side, within a limited range.
3. **Given** the fog, **When** things are hidden or remembered, **Then** their shadows follow the
   same visibility as the things themselves, so nothing leaks through fog (001 FR-028).

---

### User Story 6 - Print Texture and Halftone (Optional, Priority: P3)

An optional pass adds comic-print touches: halftone dots in shadow bands, and a subtle paper grain
with a slight off-register colour fringe. It can be toggled off in settings, and it is tuned so it
never hurts readability.

**Why this priority**: It is flavor, with the highest risk of looking busy or pixelated, so it ships
last and only if it improves the look in playtests.

**Independent Test**: Toggle it on and off in a busy fight and confirm it can be switched off and
that molds, food, and fronts stay readable with it on.

**Acceptance Scenarios**:

1. **Given** the print texture setting, **When** it is off, **Then** the game looks as it did after
   the earlier stories.
2. **Given** the setting is on, **When** a busy scene is shown, **Then** every mold, food item, and
   front is still readable at a glance.
3. **Given** zoom changes, **When** dots are drawn, **Then** their size scales with the view so
   they never look like single large pixels.

---

### Edge Cases

- Browsers block audio until the first click: sound starts after the first player action, with no
  error. If audio is unavailable or blocked, the game plays on silently.
- Hundreds of events in one tick: sounds are rate-limited per kind, so the mix never becomes a
  wall of noise.
- Fast-forward (2x/3x): sounds stay in step with game events without pitch or volume surprises.
- Effects for things in fog: nothing is played or shown for events the player cannot see.
- Very small zoom (large map view): bands, shadows, and pulses simplify so they do not become
  noise. Very large zoom: lines stay crisp and bands stay hard-edged.
- A dense network: shadows, thick bands, and pulses never hide the flow information or the ink
  patterns.
- Low-end hardware: costlier effects can be reduced by a quality setting to hold the smoothness
  target.
- Rival veins seen in fog memory: they are drawn in the muted remembered style, with no live
  shading, pulse, or sound leaking from fog.

## Requirements *(mandatory)*

### Functional Requirements

**Audio**

- **FR-001**: The game MUST play sounds for at least: growing, absorbing food, drop warning and
  landing, building placed or refused, front won or lost, round start and end.
- **FR-002**: The player MUST be able to mute and set a volume at any time, and the choice MUST
  persist, degrading gracefully when storage is unavailable.
- **FR-003**: Sounds MUST be rate-limited per kind so many simultaneous events stay readable.
- **FR-004**: Sounds and effects MUST be driven only by events and state the simulation already
  exposes; they MUST NOT change simulation state or timing.
- **FR-005**: Nothing about events in fog MAY be played or shown to the player (fairness, 001
  FR-028).

**Light and shading**

- **FR-006**: The game MUST use one shared light direction for veins, buildings, food, and
  obstacles, with hard-stepped lit, mid, and shadow bands (no smooth gradients on objects).
- **FR-007**: Vein width MUST snap to a small, fixed set of widths that follow flow, with hysteresis
  so it does not flicker at thresholds.
- **FR-008**: Veins MUST show moving pulses whose density follows nutrient flow, and none where
  there is no flow.
- **FR-009**: Objects MUST cast short, flat, hard-edged ground shadows away from the light, in the
  hatched style already used for obstacles.
- **FR-010**: Outlines MUST vary in weight by side, heavier on the shadow side, within a limited
  range, and MUST stay readable at all zoom levels.
- **FR-011**: Shading, pulses, and shadows MUST follow the same fog and visibility rules as the
  objects they belong to.
- **FR-012**: Shading MUST NOT hide mold ink patterns or shapes, and mold identity MUST NOT rely on
  colour alone (001 FR-033).

**Fight feedback and print look**

- **FR-013**: Combat deaths and fronts changing hands MUST show effects, and a screen shake scaled
  by size.
- **FR-014**: The player MUST be able to reduce or disable shake and flashing effects.
- **FR-015**: An optional print-texture pass (halftone, grain, colour fringe) MUST be switchable
  off, MUST scale with zoom, and MUST keep every mold, food item, and front readable.

**Cross-cutting**

- **FR-016**: A quality setting MUST be able to turn off the costlier effects so the game keeps its
  smoothness target on mid-range laptops.
- **FR-017**: All of this MUST live in render and audio code only. It MUST NOT change anything in
  the simulation, and MUST NOT affect the outcome of a round.
- **FR-018**: Colours, band thresholds, line weights, and sound volumes MUST come from a single
  palette and settings file, not scattered values.
- **FR-019**: All visuals MUST follow the comic / cel-shaded art direction.

### Key Entities

- **Sound Cue**: a named sound tied to a game event, with a rate limit and a volume.
- **Audio and Display Settings**: mute, volume, motion reduction, print texture, and quality
  choices, saved per browser.
- **Light**: the shared direction and band thresholds used by every shaded object.
- **Vein Width Band**: one of a few fixed widths a vein snaps to, from its flow.
- **Flow Pulse**: a visual mark that travels along a vein in proportion to its flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a playtest, every listed event has a distinct, audible cue, and players can name
  what happened from sound alone for the main ones (growth, fight, warning).
- **SC-002**: Muting silences 100% of sounds at once, and the setting survives a reload.
- **SC-003**: In a side-by-side playtest of before and after, most players describe the new look as
  more "comic" or "cel-shaded", without being prompted with those words.
- **SC-004**: In a busy late-round scene, testers can still pick out their own mold, a rival front,
  and the nearest food within a couple of seconds.
- **SC-005**: The game holds its smoothness target (001 SC-003) at the largest map and rival count,
  with the quality setting at its default.
- **SC-006**: The same seed and commands produce the same outcome with sound and visual effects on
  or off in 100% of runs.
- **SC-007**: Turning the optional print texture off returns the previous look exactly.

## Assumptions

- Sounds are short, original or royalty-free clips bundled with the game, or generated in the
  browser; no new runtime dependency is needed beyond the browser's audio support.
- Music is out of scope for this feature and can be a later addition.
- Lighting is faked by drawing (bands, offsets, and shadows), not a real 3D light model, and the
  light comes from the upper left, matching the glass obstacles that already exist.
- This feature does not depend on 005 or 006, but it touches the same drawing files as building
  visuals, so it is best built when no other rendering feature is in progress. It follows 003.
- Desktop browsers only, as with the rest of the game.
- Exact widths, thresholds, weights, volumes, and quality levels are set in planning and tuned by
  eye and ear.

## Open questions for the clarify step

- Original recorded clips or sounds generated in the browser?
- Is background music wanted now or later?
- Should the light direction ever change between rounds, or stay fixed?
- Should halftone and paper grain ship at all, or wait until the earlier stories are judged?
- A visible quality setting in the menu, or only automatic scaling?
