# Feature Specification: Cel-Shaded Lighting and Ink

**Feature Branch**: `007-cel-shaded-lighting`

**Created**: 2026-10-25

**Status**: Draft (to be built after 003-store-house; independent of 004–006)

**Input**: User description: "Thoughts on making the graphics more cell-shaded?" Followed by a
request to spec the lighting and ink ideas discussed.

This builds on the art direction in [001](../001-core-game-loop/spec.md) (FR-032, FR-033) and
the smoother cel-shaded terrain and fog already in the game. It changes how things are drawn
only. It changes no game rules and no simulation state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One Light, Hard-Stepped Shading (Priority: P1)

The whole scene shares one light direction (from the upper left). Veins, buildings, food, and
obstacles each show a lit side, a mid tone, and a shadow side, in hard bands, never smooth
gradients. Veins look like slightly rounded tubes, not flat lines, and buildings look like small
objects standing on the ground.

**Why this priority**: It adds the one thing the look is missing, a consistent light, and builds
on what the glass obstacles already do.

**Independent Test**: View the same scene before and after, with every drawn kind of object, and
confirm each has a lit and a shadow side on the same side everywhere.

**Acceptance Scenarios**:

1. **Given** any vein, building, food item, or obstacle on screen, **When** it is drawn, **Then**
   its lit side faces the light direction and its shadow side faces away, in hard bands.
2. **Given** the player zooms in and out, **When** the view changes, **Then** the bands keep
   their look and do not shimmer or turn into gradients.
3. **Given** a mold, **When** it is shaded, **Then** its identity is still clear from its ink
   pattern and shape, and shading never hides the pattern (001 FR-033).

---

### User Story 2 - Banded Vein Thickness (Priority: P1)

Veins no longer vary smoothly in thickness. They snap to a few widths (for example thin, medium,
thick), so a busy trunk reads as a chunky tube and idle branches read as fine lines. Changes
between bands are quick but not jarring.

**Why this priority**: It reinforces the flow information the player already relies on and fits
the hard-stepped look. It needs only the existing vein data.

**Independent Test**: Grow a network with a trunk and side branches, and confirm veins show
distinct width bands that follow their flow, with no in-between widths.

**Acceptance Scenarios**:

1. **Given** veins carrying different amounts of flow, **When** they are drawn, **Then** they use
   a small fixed set of widths that follow flow, with trunks widest.
2. **Given** a vein's flow crossing a band threshold, **When** it changes, **Then** the width
   changes without flicker (small hysteresis).
3. **Given** the same state, **When** it is drawn at any time, **Then** the result is the same
   (drawing depends only on state, not on randomness).

---

### User Story 3 - Grounding Shadows and Variable Line Weight (Priority: P2)

Things cast short, flat, hard-edged shadows on the ground in the same hatched style the glass
already uses. Outlines are thicker on the shadow side and thinner on the lit side, like hand-
inked comic lines.

**Why this priority**: It adds depth and a hand-drawn feel, but it is polish on top of the first
two stories.

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

### User Story 4 - Print Texture and Halftone (Optional, Priority: P3)

An optional pass adds comic-print touches: halftone dots in shadow bands, and a subtle paper
grain with a slight off-register colour fringe. It can be toggled off in settings, and it is
tuned so it never hurts readability.

**Why this priority**: It is flavor, with the highest risk of looking busy or pixelated, so it
ships last and only if it improves the look in playtests.

**Independent Test**: Toggle it on and off in a busy fight and confirm it can be switched off and
that molds, food, and fronts stay readable with it on.

**Acceptance Scenarios**:

1. **Given** the print texture setting, **When** it is off, **Then** the game looks as it did
   after the first three stories.
2. **Given** the setting is on, **When** a busy scene is shown, **Then** every mold, food item,
   and front is still readable at a glance.
3. **Given** zoom changes, **When** dots are drawn, **Then** their size scales with the view so
   they never look like single large pixels.

---

### Edge Cases

- Very small zoom (large map view): bands and shadows simplify so they do not become noise.
- Very large zoom: lines stay crisp and bands stay hard-edged.
- A dense network: shadows and thick bands never hide the flow information or the ink patterns.
- Low-end hardware: effects can be reduced by a quality setting to hold the smoothness target.
- Rival veins seen in fog memory: they are drawn in the muted remembered style, with no live
  shading detail leaking from fog.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST use one shared light direction for veins, buildings, food, and
  obstacles, with hard-stepped lit, mid, and shadow bands (no smooth gradients on objects).
- **FR-002**: Vein width MUST snap to a small, fixed set of widths that follow flow, with
  hysteresis so it does not flicker at thresholds.
- **FR-003**: Objects MUST cast short, flat, hard-edged ground shadows away from the light, in
  the hatched style already used for obstacles.
- **FR-004**: Outlines MUST vary in weight by side, heavier on the shadow side, within a limited
  range, and MUST stay readable at all zoom levels.
- **FR-005**: All shading and shadows MUST follow the same fog and visibility rules as the
  objects they belong to, so nothing about hidden objects is revealed.
- **FR-006**: Shading MUST NOT hide mold ink patterns or shapes, and mold identity MUST NOT rely
  on colour alone (001 FR-033).
- **FR-007**: An optional print-texture pass (halftone, grain, colour fringe) MUST be switchable
  off, MUST scale with zoom, and MUST keep every mold, food item, and front readable.
- **FR-008**: A quality setting MUST be able to turn off the costlier effects so the game keeps
  its smoothness target on mid-range laptops.
- **FR-009**: All of this MUST live in render code and shaders only. It MUST NOT read or change
  anything but the existing simulation state, and MUST NOT affect the outcome of a round.
- **FR-010**: Colours and band thresholds MUST come from a single palette and settings file, not
  scattered values.

### Key Entities

- **Light**: the shared direction and band thresholds used by every shaded object.
- **Shading Style**: the set of bands, outline weights, and shadow settings in one place.
- **Vein Width Band**: one of a few fixed widths a vein snaps to, from its flow.
- **Print Texture Setting**: an optional pass with its own on/off toggle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a side-by-side playtest of before and after, most players describe the new look
  as more "comic" or "cel-shaded", without being prompted with those words.
- **SC-002**: In a busy late-round scene, testers can still pick out their own mold, a rival
  front, and the nearest food within a couple of seconds.
- **SC-003**: The game holds its smoothness target (001 SC-003) at the largest map and rival
  count, with the quality setting at its default.
- **SC-004**: The same seed and commands produce the same outcome with the new shading on or off
  in 100% of runs.
- **SC-005**: Turning the optional print texture off returns the previous look exactly.

## Assumptions

- Lighting is faked by drawing (bands, offsets, and shadows), not a real 3D light model.
- The light comes from the upper left, matching the glass obstacles that already exist.
- The terrain and fog already moved to smooth cel-shaded shapes; this feature extends the same
  idea to objects on top of them.
- This feature does not depend on 003–006, but it touches the same drawing files as building
  visuals, so it is best built when no other rendering feature is in progress.
- Exact widths, thresholds, weights, and quality levels are set in planning and tuned by eye.

## Open questions for the clarify step

- Should the light direction ever change between rounds (for variety), or stay fixed?
- Should halftone and paper grain ship at all, or wait until the first three stories are judged?
- Do you want a visible quality setting in the menu, or only automatic scaling?
