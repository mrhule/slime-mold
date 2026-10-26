# Playtest Checklist: Mobile Mode

Run on a real phone in landscape (or Chrome device mode), with Touch mode Auto or On.

## US1 Play by touch

- [ ] Tap sets a growth target; a drag pans without setting one; pinch zooms about the fingers
- [ ] A pan or pinch never leaves a stray target behind
- [ ] Long press on a target cancels it; long press on open ground does nothing
- [ ] Clear all (the round button, top right) removes every target; Home recentres on the core
- [ ] Pause, 1x, 2x, 3x and the Growth / Fight slider work by finger without a delay
- [ ] A whole round can be played with no keyboard or mouse (build comes with US2)

## US2 Build without stray taps

- [ ] Choose a building, tap a spot: the preview appears there and the bar at the bottom says whether it is allowed
- [ ] Nothing is built until Build is pressed; Cancel and choosing another building build nothing
- [ ] An invalid spot shows its reason in the bar and Build is greyed out
- [ ] Dragging the map keeps the chosen spot; tapping elsewhere moves it
- [ ] Ten placements in a row: none built by accident
- [ ] Tapping your own farm opens the output panel (below the round buttons) with big minus and plus buttons; tapping empty ground closes it

## US3 Layout for thumbs

- [ ] HUD strip, build bar column and round buttons are all easy to hit with a thumb; none covers the middle of the map
- [ ] The round buttons (menu, home, clear all) and the mute button do not overlap anything on your phone
- [ ] Tapping a HUD row or a build button shows its hint for a few seconds
- [ ] The menu button (top right) opens the pause menu with Settings; every button in it is reachable and the panel scrolls if tall
- [ ] Portrait shows "Rotate your phone" and pauses; turning back resumes (and stays paused if you had paused)

## US4 Lighter graphics and a steady page

- [ ] A fresh profile starts on Low quality; changing Quality in Settings is kept after a reload
- [ ] Five minutes of play: no page zoom, scroll, bounce, pull-to-refresh or text selection
- [ ] Music and sound start after the first tap (including on iPhone)
- [ ] Touch mode Auto / On / Off in Settings each behave; a laptop with a mouse stays in desktop mode on Auto

## Polish: performance (T028)

- [ ] Late-round frame rate on the phone with `?debug` (needs the dev server or a dev build): at least 30 fps

## US3 compact HUD (T035)

- [ ] Stats bar along the top, clock and Fight chip bottom left, build block (2 x 2 icons) bottom right, menu / home / clear / mute top right: nothing overlaps on your phone
- [ ] The Fight chip opens a big slider; it closes when you let go or tap the map
- [ ] The map between the bars is clearly larger than with the first touch layout
- [ ] Build icons are recognisable; tapping one shows its name and cost, then the placement bar
