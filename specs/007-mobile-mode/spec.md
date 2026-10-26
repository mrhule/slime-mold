# Feature Specification: Mobile Mode

**Feature Branch**: `007-mobile-mode`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "If mobile device detected, optimize for mobile." Decisions from the user:
landscape only (a rotate hint in portrait); tap, one-finger drag and pinch for the map, long-press to
cancel a target, tap-to-place with a confirm step; lighter graphics by default; bigger touch targets;
touch-first detection with a Settings override.

The game is live on GitHub Pages and today does not work with touch: placing targets, panning, zooming
and cancelling need a mouse, and most actions need a keyboard. This feature makes the game playable on
a phone held sideways. It changes no game rules and no simulation state, and the desktop experience
stays exactly as it is.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play a Whole Round by Touch (Priority: P1)

On a touch phone held in landscape, the player can do everything the game asks of them with fingers
alone: look around the map, steer growth, build, and run the game clock. Tapping the map sets a growth
target; one finger dragged across the map pans it; two fingers pinched or spread zoom it. A long press on
a target cancels it, and an on-screen control clears all targets. Everything that is a key today
(pause, speed, the Growth / Fight balance, jump back to your core) has a touch control on screen.

**Why this priority**: Without touch controls the game is unplayable on a phone, so this is the whole
point of the feature.

**Independent Test**: On a phone (or a touch emulator), start a round and win or lose it without a
keyboard or mouse: set and cancel targets, pan, zoom, pause, change speed, change the balance, and jump
home.

**Acceptance Scenarios**:

1. **Given** a round in progress on a touch device, **When** the player taps open ground, **Then** a
   growth target appears there, exactly as a click does on desktop.
2. **Given** the map, **When** the player drags one finger, **Then** the map pans with the finger and no
   target is set; **When** they pinch or spread two fingers, **Then** the map zooms around the point
   between them.
3. **Given** a growth target, **When** the player presses and holds it, **Then** it is cancelled;
   **When** they use the clear-all control, **Then** all targets are cancelled.
4. **Given** the HUD, **When** the player uses the touch controls for pause, speed, Growth / Fight and
   "go to my core", **Then** each does what its key does on desktop.
5. **Given** a very short tap or a finger that moves only a little, **Then** it counts as a tap; a drag
   that starts on the map never sets a target when it lifts.

---

### User Story 2 - Build Without Stray Taps (Priority: P1)

The player picks a building from the build bar, then taps the map to choose where it goes. The game
shows the placement preview at that spot (visible beside the finger, not hidden under it), says whether
it is allowed and why not, and waits for a Confirm or Cancel. Nothing is built until Confirm. Tapping an
existing farm selects it and shows a large output control to turn it up or down, replacing the keys.

**Why this priority**: Buildings cost nutrients, and fat fingers make accidental builds likely, so
placement needs a deliberate step. It also unlocks the whole store house / farm economy on touch.

**Independent Test**: Place each building type by touch, cancel one placement, try an invalid spot, and
change a farm's output, all without a keyboard.

**Acceptance Scenarios**:

1. **Given** a building chosen in the build bar, **When** the player taps a valid spot, **Then** a preview
   appears there with Confirm and Cancel, and nothing is built yet.
2. **Given** a preview, **When** the player taps Confirm, **Then** it is built (or the usual reason it
   cannot be is shown); **When** they tap Cancel or another building, **Then** nothing is built.
3. **Given** an invalid spot, **When** it is tapped, **Then** the reason is shown on screen without a
   hover, and Confirm is unavailable.
4. **Given** a farm, **When** the player taps it, **Then** it is selected and the output control appears
   with large increase and decrease buttons.
5. **Given** a placement in progress, **When** the player drags the map, **Then** the map pans and the
   placement stays pending.

---

### User Story 3 - A Layout Made for Thumbs (Priority: P2)

The interface fits a short landscape screen. The build bar, speed buttons, Growth / Fight slider and
farm control are large enough to hit accurately with a thumb, sit at the screen edges, and leave most of
the map visible. Hints that appear on hover on desktop are shown on tap instead. Menus and the Settings
panel fit on screen and can be scrolled with a finger. In portrait the game is replaced by a clear
"rotate your phone" message and resumes when the phone is turned back.

**Why this priority**: Controls that work but are tiny or cover the map make the game frustrating, but
the game is still playable with User Stories 1 and 2 alone.

**Independent Test**: Open the game on a small phone in landscape and check that every control can be
hit and read, that the map stays mostly visible, that menus fit, and that rotating to portrait and back
behaves.

**Acceptance Scenarios**:

1. **Given** a touch device in landscape, **When** the round is shown, **Then** all controls are at least
   a comfortable finger size and the map has most of the screen.
2. **Given** any control with a hover hint on desktop, **When** the player taps it on touch, **Then** the
   hint is shown and the control does not fire by accident.
3. **Given** a touch device in portrait, **When** the page is open, **Then** a "rotate your phone"
   message is shown and the game clock is paused; **When** turned back, **Then** play resumes where it
   was (or stays paused if the player had paused).
4. **Given** the title, pause, round-end and Settings screens, **When** viewed on a short phone screen,
   **Then** every button is reachable.
5. **Given** a phone-sized landscape screen, **When** the round is shown, **Then** the stats sit in one thin
   bar along the top, the clock buttons and the Growth / Fight control in a small group at the bottom
   left, and the buildings as icon buttons in a narrow column at the right, so that together they cover
   no more than about a quarter of the screen.
6. **Given** the Growth / Fight control, **When** the player taps its button, **Then** a large slider opens
   and closes again when released or when they tap elsewhere.

---

### User Story 4 - Lighter Graphics and a Steady Page (Priority: P2)

On a touch device the game starts on Low quality with a cap on how finely it draws the screen, to save
battery and keep it cool, and Auto can still raise the quality if the phone copes. While playing, the page
never zooms, scrolls, bounces or pulls to refresh, text is not selected, and the first tap unlocks sound.
Touch mode is chosen automatically on touch-first devices, and a Settings switch lets the player turn it
on or off regardless.

**Why this priority**: It keeps the game smooth and the phone usable, but the game can be played without
it.

**Independent Test**: Load the game on a phone with fresh settings and check the starting quality, that
no page gesture interferes, that sound plays after the first tap, and that the Settings switch changes the
mode on both a phone and a desktop.

**Acceptance Scenarios**:

1. **Given** a touch-first device with no saved settings, **When** the game loads, **Then** touch mode is
   on, quality starts at Low, and the drawing resolution is capped below the device's native density.
2. **Given** a player who sets Quality themselves, **Then** their choice is kept and not overridden.
3. **Given** touch mode, **When** the player swipes, pinches or double-taps, **Then** the browser page
   never zooms, scrolls or refreshes.
4. **Given** a desktop browser, **When** the player turns touch mode on in Settings, **Then** the touch
   layout and controls appear; turning it off restores the desktop layout.
5. **Given** a laptop with a touchscreen and a mouse, **When** it loads, **Then** the desktop mode is
   used unless the player turns touch mode on.

---

### Edge Cases

- A third finger or a finger that leaves mid-pinch: the gesture ends cleanly and no target or building
  results.
- Starting a drag on a build-bar button or HUD control does not move the map or set a target.
- A tap just after a pinch or pan does not set a target.
- A long press on a target while the finger drifts slightly still cancels it; a long press on open
  ground does nothing (it neither sets a target nor opens a menu).
- Rotating the phone mid-round pauses and resumes without losing state; rotating while a placement
  preview is open keeps or cleanly cancels it.
- Fog of war: a tap on fogged ground behaves as a click does today, and the preview and hints never
  reveal anything hidden.
- Very small screens: controls shrink no further than a usable size and the interface scrolls rather
  than clipping.
- The browser's own back gesture, address bar and system menus are not blocked.
- Audio blocked until a gesture: the first tap unlocks it without also doing a game action by surprise.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST detect a touch-first device (a coarse primary pointer and no hover) and
  switch to touch mode automatically, and MUST NOT do so on a desktop or a mouse-driven laptop.
- **FR-002**: Settings MUST have a Touch mode switch (Auto, On, Off) that overrides detection either
  way and is remembered.
- **FR-003**: In touch mode a tap on the map MUST set a growth target the same way a click does, and a
  tap that follows a pan, a pinch or a long press MUST NOT.
- **FR-004**: In touch mode one-finger drag MUST pan the map and two-finger pinch MUST zoom it around
  the gesture, within the same limits as desktop.
- **FR-005**: A long press on a growth target MUST cancel it, and an on-screen control MUST cancel all
  targets.
- **FR-006**: Every action that has a key on desktop (pause, speed, Growth / Fight, jump to core, farm
  output up and down, clear targets) MUST have an on-screen touch control with the same effect.
- **FR-007**: Placing a building by touch MUST be a two-step flow: choose the type, tap a spot to see
  the preview with its allowed or not-allowed reason, then Confirm or Cancel; nothing is built before
  Confirm.
- **FR-008**: The placement preview and its reason MUST be visible without being hidden by the finger,
  and MUST not need hover.
- **FR-009**: Tapping a farm MUST select it and show a large output control; tapping elsewhere MUST
  deselect it.
- **FR-010**: Touch controls MUST be large enough to hit accurately with a thumb, MUST sit so most of
  the map stays visible on a short landscape screen, and MUST NOT depend on hover.
- **FR-011**: Hover hints MUST be shown on tap in touch mode.
- **FR-011a**: In touch mode the interface MUST use a compact layout (a thin stats bar, a small clock and
  Growth / Fight group, icon-only build buttons) that leaves most of the screen to the map, with every
  control still at least 44 by 44 CSS pixels.
- **FR-012**: In portrait the game MUST show a "rotate your phone" message in place of play, pause the
  game clock, and resume when the phone is rotated back.
- **FR-013**: While in touch mode the page MUST NOT zoom, scroll, bounce, pull to refresh, or select
  text during play, and MUST NOT block the system back gesture.
- **FR-014**: Audio MUST unlock on the first tap, and that tap MUST NOT also trigger a game action.
- **FR-015**: With no saved Quality setting, touch mode MUST start on Low quality and cap the drawing
  resolution below the device's native density; a saved Quality choice MUST be respected, and Auto MUST
  still be able to raise quality.
- **FR-016**: The title, pause, round-end and Settings screens MUST fit and be fully usable on a short
  landscape phone screen, scrolling by touch where needed.
- **FR-017**: Desktop behavior (mouse, keyboard, layout, quality) MUST be unchanged when touch mode is
  off.
- **FR-018**: This feature MUST NOT change the simulation: the same seed and commands MUST produce the
  same state hash with or without touch mode, and touch input MUST reach the simulation only as the
  same commands the mouse and keyboard produce.
- **FR-019**: Touch input MUST obey the same fog and information limits as mouse input and MUST NOT
  reveal anything the player cannot see.

### Key Entities

- **Input mode**: Whether the game is in touch mode or desktop mode, with Auto, On or Off as the
  player's saved choice and the detected default.
- **Touch gesture**: A tap, a one-finger pan, a two-finger pinch or a long press, and how each maps to
  the same actions as the mouse and keyboard.
- **Pending placement**: The chosen building type and spot waiting for Confirm or Cancel, with its
  allowed or not-allowed reason.
- **Settings**: Existing saved preferences, extended with the Touch mode choice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player on a phone in landscape can finish a full round using only their fingers, with no
  action that needs a keyboard or mouse.
- **SC-002**: In a playtest of 10 placements on a phone, none are built by accident, and at least 9 of
  10 intended placements succeed on the first attempt.
- **SC-003**: Every on-screen control measures at least 44 by 44 CSS pixels in touch mode.
- **SC-003a**: On a phone-sized landscape screen the interface covers no more than about a quarter of the
  screen, leaving the middle of the map clear.
- **SC-004**: On a typical recent phone in a late-round scene, the game holds at least 30 frames per
  second on the default settings without the player changing anything.
- **SC-005**: No page zoom, scroll, bounce or pull-to-refresh occurs in 5 minutes of play on a phone.
- **SC-006**: The same seed and commands give an identical final state hash with touch mode on and off,
  and every existing automated test still passes.
- **SC-007**: With touch mode off, the desktop interface looks and plays exactly as before.

## Assumptions

- Targets modern phone browsers (current iOS Safari and Android Chrome) in landscape; tablets that are
  touch-first get touch mode too.
- Portrait play, installing the game as an app, offline play and multi-touch beyond pinch are out of
  scope.
- Touch controls reuse the existing command interface; no new game rules or abilities are added.
- 44 CSS pixels is the minimum comfortable touch size.
- Low quality means the existing Low level (no flow pulses or vein shadows, fewer splats, no print
  texture); the resolution cap is a new, separate limit on how finely the screen is drawn.
- The mute button, volume controls and other Settings stay as they are, with Touch mode added to the
  same menu.
- The game stays served from the same GitHub Pages address, so no server changes are involved.
