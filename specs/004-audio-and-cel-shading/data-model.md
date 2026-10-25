# Data Model: Audio and Cel-Shaded Look

No simulation state is added or changed. Everything below is presentation state or settings, owned
by `src/audio/` and `src/render/`, and none of it is part of `stateHash`.

## Settings (persisted)

Stored as JSON under `slime-mold:v1:settings`; every field is validated on load and defaults apply
to anything missing or invalid.

| Field | Type | Default | Notes |
|---|---|---|---|
| `muted` | boolean | false | silences sound effects and music |
| `sfxVolume` | number 0..1 | 0.8 | sound effects bus |
| `musicVolume` | number 0..1 | 0.5 | music bus |
| `reduceMotion` | boolean | from `prefers-reduced-motion` | turns shake and flashing off |
| `quality` | `'auto' \| 'high' \| 'low'` | `'auto'` | menu choice |
| `printTexture` | boolean | false | optional halftone/grain/fringe; ships off |

## Style table (`src/render/style.ts`, not persisted)

| Group | Fields |
|---|---|
| Light | `light: [x, y]` unit vector toward the light, `(-0.6, -0.8)` normalized |
| Vein bands | `halfWidth: [thin, medium, thick]`, `up: [t1, t2]`, `down: [t1, t2]` (conductivity thresholds with hysteresis) |
| Outlines | `padLit`, `padShade`, `strokeShift: [dx, dy]` for Graphics outlines |
| Shadows | `veinShadowOffset: [dx, dy]`, `veinShadowAlpha`, `groundShadowOffset`, `groundShadowAlpha` |
| Pulses | `minFlow`, `lightFlow`, `heavyFlow`, `speed` |
| Shake | `max`, `k`, `decaySeconds` |
| Splats | `maxPerFrame`, `lifeSeconds` |
| Quality levels | for `high` and `low`: `veinShadow`, `pulses`, `printFilter`, `splatScale` |

## Cue table (`src/audio/director.ts`)

| Cue | Min interval | Max/s | Bypass limiter | Recipe (synth.ts) |
|---|---|---|---|---|
| `grow` | 90 ms | 6 | no | short soft tick, pitch rises with count |
| `squelch` | 200 ms | 3 | no | noise burst through a falling low-pass |
| `warn` | 0 | 2 | yes | rising two-tone alarm |
| `land` | 0 | 2 | yes | low thump plus a pop |
| `place` | 80 ms | 4 | no | bright two-note blip |
| `refuse` | 150 ms | 3 | no | flat low buzz |
| `frontWon` / `frontLost` | 600 ms | 1 | no | punchy hit, major / minor flavour; scaled by size |
| `roundStart` / `roundWin` / `roundLose` | 0 | 1 | yes | short jingle |

A global cap of about 12 simultaneous voices applies; extra requests are dropped.

## Director snapshot (per frame, read-only input)

| Field | Meaning |
|---|---|
| `playerCells` | player's current cell count |
| `playerGathered` | player's `stats.nutrientsGathered` |
| `runState` | `title`, `playing`, `paused`, `roundEnd` |
| `visibleDeaths` | list of `{ own: boolean, byEnemy: boolean }` for `cellDied` events whose cell is visible now |
| `events` | the frame's other `SimEvent`s (drops, buildings, rejections) |

## Vein band state (`VeinLayer`)

| Field | Type | Notes |
|---|---|---|
| `band` | `Uint8Array(width * height * 4)` | previous band (0, 1, 2) per edge slot, for hysteresis |
| `lastBuild` | number | existing: flow-cadence rebuild index |

## Shake state (`Camera`)

| Field | Meaning |
|---|---|
| `shakeAmount` | current amplitude in screen px, decays with `decaySeconds` |
| `shakeSeed` | local generator state for a stable pattern |

## Quality state

| Field | Meaning |
|---|---|
| `level` | `'high' \| 'low'` currently applied |
| `fpsEma` | smoothed frames per second |
| `lowSince` / `highSince` | how long fps has been under or over the thresholds |

## State transitions

- **Vein edge band**: thin to medium when conductivity passes `up[0]`; medium to thin below
  `down[0]`; medium to thick above `up[1]`; thick to medium below `down[1]`.
- **Quality (auto)**: high to low after about 3 s under 45 fps; low to high after about 20 s over
  58 fps. A manual High or Low pins the level.
- **Audio engine**: `locked` (no gesture yet) to `running` on first gesture; `running` to `suspended`
  when the run is not playing or the tab is hidden; back to `running` on resume.

## Relationships

- The **director** reads the snapshot and emits **cue requests**; the **limiter** admits or drops
  them; the **synth** plays admitted cues on the **sfx bus**; **music** plays on the **music bus**;
  both buses feed a **master** gain that **muted** sets to zero.
- **Vein layer** reads `world.edges`, `world.conductivity`, `world.edgeFlow` and the style table to
  build geometry; the **quality** level decides which passes are included.
- **Shake** is fed by the same filtered visible-death count as the director and the splats.
