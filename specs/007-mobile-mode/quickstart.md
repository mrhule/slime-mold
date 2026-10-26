# Quickstart: Mobile Mode

Contracts: [touch-controls](contracts/touch-controls.md). Data: [data-model](data-model.md).

## Automated checks

```bash
npm run typecheck
npm test
npm run build
```

Expect every test to pass, including the new gesture, touch-mode and input tests and the determinism test
(identical state hash through mouse-style and touch-style input).

## Run on a computer with touch emulation

```bash
npm run dev
```

Open the address in Chrome, open DevTools, turn on device mode (a phone preset in landscape), reload.
Or on any browser, open Settings and set Touch mode to On.

## Run on a real phone

Deploy (push to `main`) and open `https://mrhule.github.io/slime-mold/`, or on the same network open
`http://<computer-ip>:5173` after `npm run dev -- --host`.

## Scenarios

1. **Detection**: on a phone the touch layout appears with no setting changed; on a desktop browser it does
   not. Settings has Touch mode Auto / On / Off and each works.
2. **Map**: tap sets a target; drag pans without setting one; pinch zooms; long-press on a target cancels
   it; Clear all removes every target; Home recentres.
3. **Clock and balance**: pause, 1x, 2x, 3x and the Growth / Fight slider work by finger.
4. **Build**: choose a building, tap a spot, see the preview and its reason, Confirm builds, Cancel does not;
   an invalid spot shows why and Confirm is disabled; dragging the map keeps the pending placement.
5. **Farm**: tap an own farm; the large dial changes its output.
6. **Layout**: all controls are at least 44 px and the map is mostly visible on a short landscape screen;
   menus and Settings scroll and every button is reachable.
7. **Hints**: tapping a HUD row or build button shows its hint.
8. **Portrait**: rotating to portrait shows the rotate message and pauses; rotating back resumes.
9. **Page**: no zoom, scroll, bounce or pull-to-refresh in 5 minutes of play; the first tap starts sound.
10. **Quality**: fresh settings on a phone start on Low; setting Quality yourself is kept.
11. **Desktop**: with touch mode off everything is exactly as before.
