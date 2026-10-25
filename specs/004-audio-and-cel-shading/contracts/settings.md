# Contract: Settings and Menu Controls

## Persisted settings

Key `slime-mold:v1:settings`, JSON, validated on load (see [data-model.md](../data-model.md)).
Reads and writes are wrapped in try/catch; with storage unavailable the game runs on the defaults
and simply does not remember changes.

```ts
interface Settings {
  muted: boolean;
  sfxVolume: number;
  musicVolume: number;
  reduceMotion: boolean;
  quality: 'auto' | 'high' | 'low';
  printTexture: boolean;
}
loadSettings(store?): Settings      // defaults for anything missing or invalid
saveSettings(settings, store?): void
```

## Controls

| Control | Where | Effect |
|---|---|---|
| Mute button (speaker icon) | HUD corner, always visible | toggles `muted`, takes effect at once |
| Sound volume slider | pause menu, Settings | `sfxVolume` |
| Music volume slider | pause menu, Settings | `musicVolume` |
| Reduce motion toggle | pause menu, Settings | `reduceMotion` (shake and flashing off) |
| Quality: Auto / High / Low | pause menu, Settings | `quality` |
| Print texture toggle | pause menu, Settings | `printTexture`; shown only once the print filter exists |

All controls are mouse and keyboard operable and follow the comic UI style. Changing a setting
applies immediately and is saved.
