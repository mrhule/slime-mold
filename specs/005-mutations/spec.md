# Feature Specification: Mutations Between Rounds

**Feature Branch**: `005-mutations`

**Created**: 2026-10-25

**Status**: Draft (to be built after 004-audio-and-cel-shading)

**Input**: User description: "Mutations between rounds: after each round, pick one of three
perks, such as thicker veins, faster growth, or cheaper buildings." A deliberately small
version of the tech tree idea from earlier discussions.

This builds on [001](../001-core-game-loop/spec.md) and [002](../002-buildings/spec.md).
In 001 nothing carried over between rounds except the saved best round; this adds a small,
bounded carry-over of chosen perks within a single run.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick a Mutation After a Round (Priority: P1)

After winning a round, the player sees three mutation cards drawn from a pool and picks one. The
chosen mutation applies from the next round on, for the rest of the run. Cards are comic-style,
each with a name, a one-line effect, and an icon recognizable by shape.

**Why this priority**: It gives the player a reason to look forward to the next round and a way
to shape their play style, with very little new rules surface.

**Independent Test**: Win a round, pick a mutation, start the next round, and confirm its effect
is active and shown.

**Acceptance Scenarios**:

1. **Given** a round is won, **When** the round-end screen appears, **Then** three different
   mutations are offered and the player picks one before continuing.
2. **Given** a mutation was picked, **When** the next round starts, **Then** its effect applies
   and the HUD lists the active mutations.
3. **Given** a run ends in defeat, **When** a new run starts, **Then** all mutations are gone.
4. **Given** the same seed and picks, **When** a round is replayed, **Then** the offered cards
   and the outcome are identical.

---

### User Story 2 - A Small Pool of Distinct Mutations (Priority: P1)

The pool holds a handful of mutations, each changing one existing setting in an easy-to-read way,
for example: thicker veins (more carrying capacity), faster tip growth, cheaper buildings, a
larger starting stock, stronger fronts, slower starvation. Some are rare and stronger. A mutation
can be offered more than once only if it can stack, and stacking is capped.

**Why this priority**: The choice is only interesting if the cards differ meaningfully.

**Independent Test**: For each mutation, run a staged scenario with and without it and confirm
the stated effect, and that a capped stack does not exceed its cap.

**Acceptance Scenarios**:

1. **Given** each mutation in the pool, **When** it is active, **Then** exactly the stated
   setting changes by the stated amount, and nothing else.
2. **Given** a stackable mutation picked twice, **When** its effect is computed, **Then** it
   stacks up to its cap and is not offered again after that.
3. **Given** a rare mutation, **When** the pool is drawn, **Then** it appears less often than
   common ones.

---

### User Story 3 - Rivals Get Matching Strength (Priority: P2)

To keep fights fair as the player grows stronger, the round's difficulty already escalates
(001); rivals do not get mutations themselves, but difficulty accounts for how many the player
has, so mutations make the player stronger relative to the same round without them, not
relative to a runaway curve.

**Why this priority**: It protects the difficulty curve from the new power, but needs the first
two stories to exist.

**Independent Test**: Run batch simulations with 0 to 5 mutations and confirm win rates stay
within a target band.

**Acceptance Scenarios**:

1. **Given** more mutations picked, **When** the next round is generated, **Then** its
   difficulty profile reflects them and is shown in the round start summary.
2. **Given** the same round, **When** mutations differ, **Then** the player's win rate varies
   within the target band, not by orders of magnitude.

---

### Edge Cases

- The pool runs out of new options: the offer shows fewer than three, or a stronger version of
  an existing one, and never an empty screen.
- The player closes the tab on the pick screen: the pick is asked again on return, and a
  mutation is never granted twice.
- A mutation interacts with a building spec changed by another feature: it scales whatever the
  current spec is, never a stored copy.
- The player wants to see what each mutation does: cards and the HUD list show the exact change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After each won round, the game MUST offer three different mutations and require a
  pick before the next round starts.
- **FR-002**: A chosen mutation MUST apply for the rest of the run and MUST reset when a run
  ends.
- **FR-003**: Each mutation MUST change one named setting by a stated amount, expressed in the
  balance configuration, never as a hidden rule exception (Constitution II).
- **FR-004**: Mutation draws MUST come from the seeded generator so a run replays identically.
- **FR-005**: Stackable mutations MUST be capped, and capped ones MUST NOT be offered again.
- **FR-006**: Rare mutations MUST be offered less often than common ones.
- **FR-007**: The HUD MUST list active mutations with their effects.
- **FR-008**: Rival molds MUST NOT gain mutations, but round difficulty MUST take the player's
  mutations into account through the existing tunable difficulty settings.
- **FR-009**: Mutations MUST follow the comic / cel-shaded art direction.

### Key Entities

- **Mutation**: a named perk with an effect on one balance setting, a rarity, and a stack cap.
- **Run Loadout**: the mutations the player holds in the current run.
- **Offer**: the three mutations drawn after a round.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a playtest, players can say what each offered mutation does without help.
- **SC-002**: Across the pool, no single mutation is picked in more than 40% of offers where it
  is available, over a batch of simulated runs (no mandatory pick).
- **SC-003**: Batch-simulated win rates with 0 to 5 mutations stay within a target band set in
  planning.
- **SC-004**: The same seed and picks give the same offers and outcomes in 100% of runs.

## Assumptions

- Mutations are per run only; the best round is still the only thing kept between runs.
- The first version has a pool of about eight to ten mutations, tuned in playtesting.
- This is not a full tech tree. If it proves loved, a tree can be a later feature built on the
  same loadout idea.
- Exact amounts, rarity weights, and stack caps are set in planning and tuning.

## Open questions for the clarify step

- Should defeat keep one mutation as a consolation, or reset everything?
- Do mutations appear only on wins, or also as an optional reward for hitting a goal in a round?
