# Feature Specification: Core Game Loop — Slime Mold RTS

**Feature Branch**: `001-core-game-loop`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "A single-player, browser-based RTS. You are a slime mold competing
against rival molds. Gather resources, fight off enemies, and try to take over the full map.
Each round is a generated map, and difficulty slowly scales up. Food is sometimes dropped (a
piece of sugar, a bread crumb, etc.). The player chooses where to grow toward and how to
allocate resources: send nutrients to the front for battle, or focus on growing faster to
reach food." Decisions so far: the mold is a branching, thickening vein network; controls are
click-to-target plus a global allocation slider; real-time with pause and speed control;
rounds last 5–15 minutes; rivals play by the same rules as the player; rounds escalate with no
carry-over between rounds.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Grow and Forage (Priority: P1)

The player starts a round on a generated map with a small mold at its start point. They click
spots on the map to set growth targets, and the mold extends veins toward them. When the mold
reaches food, it absorbs nutrients over time, which pays for more growth. Veins that carry a
lot of nutrient flow visibly thicken; branches that stop carrying flow slowly thin out.

**Why this priority**: Growing and foraging is the core feeling of being a slime mold and the
economy every other system depends on. With only this story the game is a playable foraging
sandbox.

**Independent Test**: Start a round with no rivals, set growth targets toward food, and confirm
the mold reaches the food, absorbs it, and the nutrient total rises enough to fund more growth.

**Acceptance Scenarios**:

1. **Given** a new round, **When** the player clicks an open spot on the map, **Then** the mold
   begins extending a vein from its nearest point toward that spot and the target is marked.
2. **Given** a vein that reaches a food source, **When** time passes, **Then** the food shrinks,
   the player's nutrient total and income rise, and the food disappears when used up.
3. **Given** the player has no nutrients, **When** a growth target is set, **Then** growth stalls
   and the HUD shows that growth is starved.
4. **Given** an obstacle between the mold and a target, **When** the mold grows, **Then** it routes
   around the obstacle and never grows through it.
5. **Given** a branch that carries no nutrient flow for a sustained period, **When** time passes,
   **Then** that branch thins and eventually retracts, returning part of its nutrients.

---

### User Story 2 - Rival Molds and Battle Fronts (Priority: P1)

Rival molds start elsewhere on the map and grow, forage, and fight under the same rules. Where
two molds touch, a battle front forms. The side that delivers more nutrients to that front
pushes forward and consumes the other's veins. The player uses the allocation slider to shift
nutrients between expanding (growth speed) and fighting (strength at the fronts). Cutting a
rival's vein disconnects everything beyond the cut, which then starves and withers.

**Why this priority**: Competition is what makes this an RTS rather than a sandbox, and it is
where the grow-vs-fight decision the player described becomes meaningful.

**Independent Test**: Start a round with one rival of fixed strength. Confirm that moving the
slider toward fighting wins a front the player was losing, and that eliminating the rival ends
the round in victory.

**Acceptance Scenarios**:

1. **Given** the player's mold and a rival's mold meet, **When** they are in contact, **Then** a
   visible battle front appears and both sides lose veins at the contact point at rates set by
   the nutrients each delivers there.
2. **Given** the slider set toward fighting, **When** a front is active, **Then** more nutrients
   flow to the front and growth elsewhere slows by a matching amount.
3. **Given** a vein section that becomes disconnected from the rest of its mold, **When** time
   passes, **Then** that section can no longer receive nutrients and withers away.
4. **Given** a rival mold, **When** it acts, **Then** it uses only the same kinds of actions open to
   the player (set targets, set allocation) and sees only what its own veins reveal, as the
   player does.
5. **Given** all rival molds are eliminated, or the player controls at least 75% of the map,
   **Then** the round ends in victory. **Given** the player's mold is eliminated, **Then** the
   run ends in defeat and the next run starts at round 1.
6. **Given** a rival out of vision range, **When** the player looks at that area, **Then** they
   see only the last-known state, marked as stale, until their veins come back within range.

---

### User Story 3 - Food Drops (Priority: P2)

At intervals during a round, food drops onto the map: a sugar cube, a bread crumb, a fruit
slice, and so on. Each kind differs in nutrient value and size. A short warning marks where
food is about to land so every mold can race for it. Rivals react to drops too.

**Why this priority**: Drops create moments of tension that pull molds into contact. The game
plays without them, but rounds are flatter.

**Independent Test**: Run a round and confirm drops appear on schedule with a warning, that the
first mold to reach one absorbs it, and that contested drops produce battle fronts.

**Acceptance Scenarios**:

1. **Given** a round in progress, **When** a drop is scheduled, **Then** a warning marker appears
   where it will land a few seconds beforehand.
2. **Given** a drop has landed, **When** veins from more than one mold reach it, **Then** each
   absorbs only from the part it covers, and the molds can fight over it.
3. **Given** different food types, **When** they are absorbed, **Then** larger, richer foods give
   more nutrients in total and take longer to use up.

---

### User Story 4 - Generated Maps and Escalating Rounds (Priority: P2)

Each round generates a new map with terrain, obstacles, food, and start positions. Winning a
round moves the player to the next, harder one: more rivals, larger maps, scarcer food, more
aggressive rivals, and rivals that start stronger. Nothing carries over between rounds. The
player sees the current round number and their best round so far.

**Why this priority**: Gives replay value and a sense of progress, but depends on Stories 1–2
being fun first.

**Independent Test**: Win round 1, confirm round 2 has a new map with harder settings, and that
generating the same round from the same seed produces the same map.

**Acceptance Scenarios**:

1. **Given** a new round, **When** the map is generated, **Then** every start point can reach every
   other start point and each start has fair access to nearby food.
2. **Given** the player wins round N, **When** round N+1 begins, **Then** its difficulty settings
   are equal to or harder than round N's in every dimension and strictly harder in at least one.
3. **Given** the same seed and round number, **When** a map is generated twice, **Then** the two
   maps are identical.
4. **Given** the player reaches a new best round, **When** they return to the game later, **Then**
   their best round is still shown.

---

### User Story 5 - Time Control and HUD (Priority: P1)

The player can pause, and play at 1x, 2x, or 3x speed. While paused they can still set growth
targets and move the slider. The HUD shows nutrient total, income rate, the slider, share of
the map controlled, round number, and the status of each rival.

**Why this priority**: Pausing makes real-time decisions approachable. Without the HUD the
grow-vs-fight decision cannot be read.

**Independent Test**: Pause mid-round, set new targets and move the slider, then resume and
confirm the orders take effect. Check that each HUD value matches the game state.

**Acceptance Scenarios**:

1. **Given** a round in progress, **When** the player pauses, **Then** all growth, combat, drops,
   and rival actions stop until the game resumes.
2. **Given** the game is paused, **When** the player sets targets or moves the slider, **Then** the
   changes are queued and take effect on resume.
3. **Given** 2x or 3x speed, **When** the game runs, **Then** outcomes match what 1x would produce
   over the same game time.

---

### Edge Cases

- A growth target is set inside an obstacle or off the map: the target snaps to the nearest
  reachable point, or is rejected with feedback.
- A growth target is set on top of a rival's veins: the mold grows toward it and attacks on
  contact.
- The player's mold is cut into two pieces, each with its own food: each piece keeps receiving
  nutrients from its own food (see FR-013).
- A food drop lands on top of an existing mold: that mold starts absorbing it at once.
- All food on the map runs out: upkeep slowly drains every mold, which pushes the round to an
  end instead of a stalemate.
- The browser tab loses focus: the game auto-pauses.
- Browser storage is unavailable: the game runs normally but the best round is not saved.

## Requirements *(mandatory)*

### Functional Requirements

**Mold network and growth**

- **FR-001**: Each mold MUST be a connected network of veins growing from its start point.
- **FR-002**: Players MUST be able to set growth targets by clicking the map, and cancel a target.
  The game MUST allow at least 3 active targets at once.
- **FR-003**: Growth MUST cost nutrients. Growth speed MUST scale with the nutrients allocated
  to growth.
- **FR-004**: Veins MUST route around obstacles. Some terrain MAY slow growth without blocking it.
- **FR-005**: Vein thickness MUST reflect the nutrient flow it carries. Veins with no flow for a
  sustained period MUST thin and retract, returning part of their nutrient cost.
- **FR-006**: Each mold MUST pay ongoing upkeep in proportion to the size of its network.

**Resources**

- **FR-007**: Food sources MUST hold a finite amount of nutrients that a mold absorbs while its
  veins cover the food.
- **FR-008**: The game MUST track each mold's stored nutrients and net income.
- **FR-009**: Players MUST be able to set a single allocation between growth and fighting. The
  allocation MUST change how nutrients are spent across the whole network.

**Combat**

- **FR-010**: When two molds' veins touch, a battle front MUST form at the contact.
- **FR-011**: Battle outcomes at a front MUST be decided by the nutrients each side delivers there,
  which depends on the allocation and on how much flow reaches that point.
- **FR-012**: The winning side at a front MUST consume the losing side's veins and gain part of
  their nutrients.
- **FR-013**: Vein sections cut off from all of their mold's food and its start point MUST wither.
- **FR-014**: A mold MUST be eliminated when it has no veins left.

**Rivals**

- **FR-015**: Rival molds MUST act only through the actions open to the player (set or cancel
  targets, set allocation) and MUST follow the same rules.
- **FR-016**: Rival behavior MUST include foraging, racing for drops, defending fronts, and
  attacking weaker neighbors. How aggressive it is MUST be a difficulty setting.

**Food drops**

- **FR-017**: Food drops MUST occur at intervals during a round, with a warning shown at the
  landing spot before they land.
- **FR-018**: There MUST be at least 3 food types that differ in nutrient value and size.

**Rounds, maps, difficulty**

- **FR-019**: Each round MUST generate a new map from a seed, with terrain, obstacles, starting
  food, and one start point per mold.
- **FR-020**: Generated maps MUST guarantee that every start point can reach every other, and
  that each start has comparable access to nearby food.
- **FR-021**: Difficulty MUST rise with each round across rival count, map size, food scarcity,
  rival aggression, and rival starting nutrients, following a defined curve.
- **FR-022**: Victory MUST be declared when either every rival is eliminated or the player
  controls at least 75% of the reachable map area. The threshold is a tunable setting.
- **FR-023**: On defeat, the run MUST end and the next run MUST start at round 1, roguelike
  style. The best round reached is the player's score.
- **FR-024**: Nothing (upgrades, nutrients) MUST carry over between rounds. Only the best round
  reached MUST be stored, locally in the browser.

**Time and interface**

- **FR-025**: Players MUST be able to pause, resume, and pick 1x, 2x, or 3x speed. Orders MUST be
  accepted while paused.
- **FR-026**: The HUD MUST show stored nutrients, net income, the allocation, share of the map
  controlled, round number, and each rival's status (alive or eliminated). Rival size is
  shown only for what is in vision.
- **FR-027**: The game MUST auto-pause when the browser tab loses focus.
- **FR-028**: The map MUST use fog of war. Terrain and obstacles are always visible. Food
  and rival veins can be seen only within a vision radius of the player's own veins. Areas
  out of vision show the last-known food and rival veins, marked as stale.
- **FR-030**: Rival molds MUST be bound by the same fog of war. Their decisions MUST use only
  what their own veins can see, plus anything visible to every mold.
- **FR-031**: Food-drop warnings MUST be visible to every mold across the whole map, so that a
  drop starts a race.

**Visual style**

- **FR-032**: The whole game MUST follow one comic / cel-shaded art direction, in the spirit of
  Borderlands: heavy dark ink outlines on every mold, vein, food item, obstacle, and HUD
  panel; flat color bands (2–3 tones) instead of smooth gradients; hand-drawn line wobble;
  gritty hatching, halftone, and grunge texture in shadows and surfaces; and no soft glow or
  bloom. Comic-style effects (such as angular bursts) MUST be used for combat and drop alerts.
- **FR-033**: Each mold MUST be distinguishable by a hatching or ink pattern as well as by color,
  and outlines MUST keep every mold, vein, and food item readable against the map at all
  zoom levels.
- **FR-029**: The game MUST provide a start screen, a round-end screen (victory or defeat with
  summary stats), and a way to start the next round or retry.

### Key Entities

- **Mold**: one competitor (the player or a rival). It has an owner, stored nutrients, income, an
  allocation setting, active growth targets, and a status (alive or eliminated).
- **Vein Network**: the connected veins of a mold. Each vein has a position, a thickness, and the
  flow it carries. The network can split into disconnected pieces.
- **Growth Target**: a map position a mold is growing toward. It belongs to one mold.
- **Food Source**: a spot holding a finite amount of nutrients, with a type (starting food or a
  dropped sugar cube, bread crumb, and so on), size, and remaining amount.
- **Food Drop Event**: a scheduled drop with a type, landing position, warning time, and land time.
- **Battle Front**: a contact zone between two molds that tracks the nutrients each side delivers.
- **Map**: generated terrain, obstacles, food, and start points, built from a seed and size.
- **Round**: a round number, seed, difficulty settings, elapsed game time, and outcome.
- **Difficulty Profile**: the tunable settings for a round (rival count, map size, food scarcity,
  aggression, rival starting nutrients, drop frequency).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can start a round and successfully grow to their first food source
  within 60 seconds without reading instructions.
- **SC-002**: Typical rounds last 5–15 minutes of game time at 1x speed in rounds 1–10.
- **SC-003**: The game stays visibly smooth with no noticeable stutter on a mid-range laptop at
  the largest map and rival count reached by round 10.
- **SC-004**: In playtests, at least 80% of players change the allocation slider at least once
  per round, showing the grow-vs-fight decision matters.
- **SC-005**: A player of average skill wins round 1 more than 80% of the time, and fewer than 20%
  of runs reach round 10, showing that difficulty rises.
- **SC-006**: Replaying the same seed, round, and input sequence produces the same outcome in 100%
  of runs.
- **SC-007**: Pausing, setting orders, and resuming works with no lost orders in 100% of attempts.

## Assumptions

- Desktop browser with mouse and keyboard. Touch and mobile layouts are out of scope for v1.
- Single player only. No accounts, online play, leaderboards, or server.
- Audio is limited to simple feedback sounds and is not needed to meet any requirement.
- Art direction (FR-032): "Borderlands-inspired" comic / cel-shaded, heavily outlined,
  hand-drawn, and gritty. It sets the look of the map, molds, food, fog, effects, and HUD.
  It replaces the earlier glowing, bioluminescent petri-dish idea.
- Rival molds are told apart by color and by a distinct hatching or ink pattern, so color
  alone is never the only cue (FR-033).
- Balance numbers (growth cost, upkeep, absorption rates, difficulty curve) are set in planning
  and tuned through playtesting. Those values do not change any requirement in this spec.
- "Take over the full map" is the fantasy. FR-022's 75% threshold keeps rounds from dragging
  while the player hunts down the last scraps of a rival.
- Vision radius is a balance setting tuned in playtesting, not a fixed requirement.

## Clarifications

### Session 2026-10-25

- Q: When do you win a round? → A: When every rival is eliminated or the player controls 75% of the map.
- Q: What happens when you lose a round? → A: The run ends and the next one restarts at round 1, roguelike style.
- Q: How much of the map can you see? → A: Fog of war. Terrain is always visible; food and
  rivals only near your veins, with last-known state remembered. Rivals obey the same fog.
