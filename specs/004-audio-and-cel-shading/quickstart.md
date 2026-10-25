# Quickstart: Audio and Cel-Shaded Look

How to run and check this feature end to end. Contracts: [audio-cues](contracts/audio-cues.md),
[settings](contracts/settings.md), [render-style](contracts/render-style.md).

## Prerequisites

Node and the repo as in the main README, on the `004-audio-and-cel-shading` branch (or later).

```bash
npm install
```

## Automated checks

```bash
npm run typecheck
npm test
npx tsx tests/bench/tick.bench.ts
```

Expect every test to pass, including the audio determinism test (the same `stateHash` with the
director attached) and the extended import boundary test. The tick benchmark must stay within budget
(this feature does not touch the sim, so it should not change).

## Run the game

```bash
npm run dev
```

Open the printed local address. Click Start (this is also the first gesture that unlocks audio).

## Scenarios

1. **Sound cues**: grow toward food (soft ticks, then a squelch as it feeds); wait for a drop
   (warning rises, landing thumps); place a building (blip) and try an invalid spot (buzz).
2. **Mute and volume**: click the speaker in the corner (everything stops); open the pause menu and
   move the sound and music sliders; reload and confirm the choices are kept.
3. **Pause**: press Space and Esc; confirm sound and music stop and resume. Switch tabs and back.
4. **Light and bands**: look at veins, buildings, food and obstacles; each is lit on the upper left.
   Grow a long trunk with side branches and watch veins change in three distinct widths with no
   flicker.
5. **Pulses**: confirm pulses travel along fed veins toward the tip; move the slider to Fight and
   confirm they shift toward fronts; idle veins are still.
6. **Fight**: stage a fight (`?seed=...` with a rival nearby). Confirm splats, a shake scaled to the
   fight, and the front sounds. Turn Reduce motion on and confirm shake stops. Hide a fight in fog and
   confirm no sound, splat, or shake.
7. **Shadows and outlines**: confirm short shadows toward the lower right and heavier lines on that
   side.
8. **Quality**: set Quality to Low and confirm pulses, vein shadows and print texture turn off. Set it
   to Auto on a throttled tab and confirm it drops by itself.
9. **Print texture (last)**: turn it on and check readability of molds, food and fronts; keep it only
   if it looks good.

## Playtest checklist

See the checklist produced with the tasks: each story ends with its own sound and look review,
including readability in a busy late round and frame rate at the largest map.
