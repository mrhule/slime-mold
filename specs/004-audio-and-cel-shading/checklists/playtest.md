# Playtest checklist: 004 Audio and Cel-Shaded Look

Run with `npm run dev` (add `?seed=7&nopause` for a fixed map). Tick each item when seen or heard.

## US1: Sound effects, music, and mute

- [ ] Every listed event has its own sound: growing, absorbing food, a drop warning, a drop landing,
      placing a building, a refused order, winning a fight, losing a fight, round start, round win,
      round lose.
- [ ] Nothing turns into a wall of noise in a big fight at 3x speed.
- [ ] The speaker button (bottom right) mutes and unmutes at once; the Settings sliders change the
      sound and music volume; all of it survives a reload.
- [ ] Space and Esc stop the sound and resume it; switching tabs and back resumes cleanly.
- [ ] The music is pleasant on loop for ten minutes and not tiring; it never drowns the effects.
- [ ] A fight you cannot see (in fog) makes no sound.
