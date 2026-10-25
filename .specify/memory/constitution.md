# Slime Mold Constitution

## Core Principles

### I. Simulation Is the Source of Truth

- All game state (mold networks, nutrients, food, combat, AI decisions) MUST live in a
  simulation core that has no dependency on rendering, the DOM, audio, or input devices.
- The simulation MUST advance in fixed timesteps. Rendering reads simulation state and
  MUST NOT mutate it. Input is translated into commands that the simulation consumes.
- Rationale: keeps the rules testable headless, lets game speed (pause/1x/2x/3x) be a
  matter of how many ticks run, and keeps visuals free to change without breaking balance.

### II. Same Rules for Every Mold

- Rival molds MUST obey the same growth, nutrient, and combat rules as the player, and MUST
  act only through the same command interface the player uses.
- Difficulty MUST come from tunable parameters (rival count, aggression, starting biomass,
  food scarcity, map size), never from hidden rule exceptions or perfect information the
  player cannot obtain.
- Rationale: fairness the player can feel and reason about; one rule set to balance.

### III. Seeded & Reproducible

- Every source of randomness (map generation, food drops, AI choices) MUST draw from a
  seeded generator owned by the simulation. `Math.random()` MUST NOT be used in sim code.
- Given the same seed, round number, and command stream, a round MUST replay identically.
- Rationale: reproducible bugs, shareable maps, and deterministic tests.

### IV. Test the Rules, Playtest the Fun

- Simulation rules (growth, flow, combat resolution, food absorption, win/loss, difficulty
  scaling, map generation validity) MUST have automated tests that run headless.
- Rendering and feel are verified by playtesting; each user story MUST include a manual
  playtest checklist in its tasks.
- Balance constants MUST live in one tunable configuration, not scattered literals.
- Rationale: logic bugs are caught by tests; whether it is fun is caught by playing.

### V. Smooth at Scale

- The game MUST hold 60 fps on a mid-range laptop browser at the largest map and rival count
  the difficulty curve can produce. A simulation tick MUST fit within its frame budget.
- Performance-sensitive paths (vein network updates, flow, rendering of veins) MUST avoid
  per-tick allocations of large structures and MUST be profiled before a story is closed.
- Rationale: an RTS that stutters during the big late-round battles fails at its core moment.

### VI. Playable Increments, Simplest Thing First

- Each user story MUST end in a build that can be played start to finish for what it covers.
- Prefer the simplest mechanic that produces the intended feeling; added systems (new
  resources, unit types, upgrades, persistence) MUST be justified in the plan's complexity
  tracking before they are built.
- Rationale: find the fun early and avoid building systems the game does not need.

## Technical Constraints

- Language: TypeScript in strict mode. Rendering: PixiJS (WebGL). Build/dev server: Vite.
  Test runner: Vitest.
- Runs entirely in a modern desktop browser (current Chrome, Firefox, Edge, Safari) with no
  backend. The production build MUST be deployable as static files.
- Local persistence, when needed, MUST use browser storage only and MUST degrade gracefully
  when storage is unavailable.
- Third-party runtime dependencies beyond PixiJS MUST be justified in the plan.
- Art direction: "Borderlands-inspired" comic / cel-shaded, heavily outlined, hand-drawn, and
  gritty. All visuals (map, molds, food, fog, effects, HUD) MUST follow it. Stylization lives
  in render code and shaders only and MUST NOT affect simulation state. Mold identity MUST NOT
  rely on color alone.

## Development Workflow

- Work follows Spec Kit: `/speckit-specify` → `/speckit-clarify` (as needed) →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` (recommended) → `/speckit-implement`.
- Each feature lives in `specs/NNN-short-name/` and is developed on its own branch.
- A story is done when its automated tests pass, its playtest checklist is completed, the
  performance budget in Principle V holds, and the build runs from a clean checkout.
- Commits are small and describe the behavior change, not just the files touched.

## Governance

- This constitution supersedes other project practices. Plans MUST include a Constitution
  Check against these principles; any violation MUST be recorded with justification in the
  plan's complexity tracking.
- Amendments are made by editing this file with a Sync Impact Report, bumping the version
  (MAJOR: principle removed or redefined; MINOR: principle or section added or materially
  expanded; PATCH: clarifications), and updating the Last Amended date.
- Compliance is reviewed at plan time and again before a feature branch is merged.

**Version**: 1.1.0 | **Ratified**: 2026-10-25 | **Last Amended**: 2026-10-25
