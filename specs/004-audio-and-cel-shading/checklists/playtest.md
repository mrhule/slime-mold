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

## US2: One light and hard-stepped shading

- [ ] Veins, buildings, food and glass obstacles are all lit on the upper left and shaded toward the
      lower right.
- [ ] Mold ink patterns still read on the lit and shadow sides, also in grayscale.
- [ ] Zoomed all the way in and out the bands do not shimmer or pop.

## US3: Banded veins and flow pulses

- [ ] The three widths read as thin line, tube and trunk, and a vein never flickers between widths.
- [ ] A busy trunk shows cream pulses moving toward the tip; an idle branch is still.
- [ ] Pulses shift toward the fronts when the slider goes to Fight.
- [ ] Rival veins in view pulse; rival veins in fog are not drawn and show nothing.
- [ ] On Low quality (once the setting exists) pulses are off and nothing else breaks.
