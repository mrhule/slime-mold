# Contract: Audio Cues

How game state becomes sound. The director is a pure function; the engine plays what it returns.

## Director

```ts
interface DirectorSnapshot {
  playerCells: number;
  playerGathered: number;
  runState: 'title' | 'playing' | 'paused' | 'roundEnd';
  visibleDeaths: { own: boolean; byEnemy: boolean }[]; // cellDied events visible to the player now
  events: SimEvent[];                                   // the frame's other events
}
interface CueRequest { cue: CueName; strength: number } // strength 0..1 scales volume/pitch

director.update(snapshot): CueRequest[]  // keeps the previous snapshot to compute deltas
```

## Mapping

| Condition | Cue | Strength |
|---|---|---|
| `playerCells` rose vs last frame | `grow` | by how many cells (capped) |
| `playerGathered` rose vs last frame | `squelch` | by amount (capped) |
| `dropWarning` event | `warn` | 1 |
| `dropLanded` event | `land` | 1 |
| `buildingPlaced` for the player | `place` | 1 |
| `commandRejected` for the player | `refuse` | 1 |
| visible deaths in the last second: more enemy cells died than own | `frontWon` | by count |
| visible deaths in the last second: more own cells died than enemy | `frontLost` | by count |
| run state to `playing` from `title` or `roundEnd` | `roundStart` | 1 |
| run state to `roundEnd` after a win / a loss | `roundWin` / `roundLose` | 1 |

## Rules

- **Fog**: only deaths whose cell has `vision === 2` are in `visibleDeaths`. Nothing about a hidden
  event may produce a cue (FR-005). Growth and absorption are the player's own mold only.
- **Limiter**: every request passes `limiter.admit(cue, nowMs)`; see the cue table in
  [data-model.md](../data-model.md). Cues marked bypass skip the interval but still count to the
  voice cap.
- **Pause**: the engine ignores requests unless it is running; the context is suspended when the run
  is not `playing` or the tab is hidden.
- **Speed**: the director is called once per rendered frame, not per tick, so 2x/3x does not
  multiply cues.

## Engine

```ts
engine.unlock(): void                      // call from the first pointerdown/keydown
engine.play(request: CueRequest): void
engine.setSettings(settings): void         // muted, sfxVolume, musicVolume
engine.setRunning(playing: boolean): void  // suspend/resume the context
engine.startMusic(): void
```

A missing or blocked `AudioContext` makes every call a no-op.
