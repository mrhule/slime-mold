# Art prompts for Gemini, set 2: environments and weather

This is the second set of prompts, built on the first ([art-prompts.md](art-prompts.md), items 1 to
18) and the design rules in [design-language.md](design-language.md). It adds living things (trees
and fungi), more kinds of ground, water, weather and a few landmarks. The numbering continues from
the first file, so the new items run from 19.

Items 19 to 21 here replace the trees and organic matter prompt in `design-language.md` (section 5A);
the character, fortress, factory-explainer, interface and storyboard prompts stay there.

**How to use this file.** Paste the **style block** at the start of every prompt, then the
**background rule** for every cut-out asset (or the **overlay rule** for weather that covers the
screen). Generate each item on its own, then send the images back to me with the file names shown.

## What the game looks like (so every image fits)

The game is a damp forest floor seen from above, drawn as a comic-book field journal. The molds are
the only bright, saturated things on screen (warm gold for the player), so everything in this set
must stay muted and never compete with them.

- One light from the **upper left**, always. Hard shadows fall to the **lower right**.
- Heavy near-black ink outlines `#14110F`, a little thicker on the lower-right edges.
- Flat colour bands (base, shade, light), no gradients, no soft shadows.
- Palette: olive and soil `#5B5D4B`, dark olive `#44463A`, rough earth `#4B4A39`, slate rock,
  near-black walls `#24211E`. Warm gold is reserved for the player's mold; goo is toxic green.
- Diagonal hatching in shadows, cross-hatching on the roughest ground, halftone dots at most.

## Style block (prepend to every prompt)

> Top-down view, as seen from directly above. Comic-book ink illustration style with cel shading:
> heavy near-black ink outlines (slightly thicker on the lower-right edges), flat colour bands with
> no gradients, a few hard-edged highlights, light coming from the upper left, and a small hard-edged
> drop shadow falling to the lower right. Gritty, grimy, damp forest-floor mood (leaf litter, soil, twigs, stones, snails). Muted
> olive, moss green, soil brown and slate grey, with warm gold as the only bright accent. No text,
> no letters, no watermark, no border, no UI.

## Background rule (cut-out assets)

> Place the subject on a perfectly flat solid magenta (#FF00FF) background with nothing else in the
> frame and a clear margin around it, so the background can be removed cleanly.

## Overlay rule (weather that covers the screen)

For rain, fog, frost and similar full-screen layers, a flat magenta background does not work, so ask
for a mask instead. I turn the white into a see-through layer.

> Draw the marks in pure white on a pure black background, nothing grey except the antialiased edges
> of the marks, and nothing coloured. The image must tile seamlessly: whatever leaves one edge
> re-enters the opposite edge.

## Size and sheet rules

- Cut-out sheets: ask for a 2048 x 2048 canvas so each item stays sharp, with generous spacing.
- Floor tiles: exactly 1024 x 1024 and seamless (judge by placing four copies side by side).
- Overlays: 1024 x 1024 and seamless.
- Draw things at believable relative sizes: a mushroom is small, a stump is medium, a tree is large.

---

# Part A: living things

## 19. Small forest floor life (floor-life-sheet.png)

> [style block] A sheet of 16 small separate things found on a forest floor, drawn from above:
> 1) a cluster of five small brown button mushrooms; 2) a single tall pale mushroom with a flat cap;
> 3) a ring of tiny white mushrooms; 4) a bracket fungus shelf, fan-shaped; 5) a tuft of bright green
> moss; 6) a flat green lichen patch on a bark scrap; 7) a clump of three fern fronds; 8) a young
> sapling with four leaves; 9) a tuft of tall grass blades; 10) a small bramble sprig with two red
> berries; 11) a dandelion going to seed; 12) a pile of acorns and acorn caps; 13) a curled dry
> leaf with a hole in it; 14) a pair of snail shells; 15) a small tangle of white roots; 16) a pinecone.
> Muted olive, moss, brown and slate; only the berries and one mushroom cap may be a warm accent
> colour. Small, simple shapes with thick ink outlines. [background rule]

## 20. Trees, seen from above (trees-sheet.png)

Ask for these one image each if Gemini crowds them: "one tree per image, 1024 x 1024".

> [style block] A sheet of 4 treetops seen from directly above, each separate and large: 1) a broadleaf
> tree, a rounded crown of dark green leaves in overlapping clumps with lighter leaves catching the
> light at the upper left; 2) a conifer, a star of dark needle branches in rings around a pale
> centre; 3) a dead leafless tree, bare crooked grey branches radiating from a trunk with a few
> clinging dry leaves; 4) a young birch, a small crown of pale yellow-green leaves around a thin
> white trunk. Each tree casts a hard offset shadow of its crown to the lower right. [background rule]

## 21. Stumps, logs and fallen branches (wood-sheet.png)

> [style block] A sheet of 8 pieces of dead wood, seen from above: 1) a cut stump with visible growth
> rings; 2) a stump covered in bracket mushrooms; 3) a long fallen log, mossy on the upper side, with
> one broken end showing pale wood; 4) a hollow log with a dark hole at one end; 5) a short thick
> branch with a few twigs; 6) a rotting log crumbling into a heap of soft brown dust; 7) a Y-shaped
> forked branch; 8) a bundle of three thin dry sticks. Brown and grey with ink outlines, lit from the
> upper left, hard shadows to the lower right. [background rule]

## 22. Big landmarks (landmarks-sheet.png)

Large single features that give the map recognisable places. Ask for one per image if needed.

> [style block] A sheet of 4 large landmarks, each separate and drawn from above: 1) a cluster of three
> large grey boulders leaning together with a dark crevice between them and moss on top; 2) an
> arch of thick exposed tree roots curving over a hollow of dark soil; 3) a termite or ant mound,
> a rough dome of packed earth with a few small holes; 4) a collapsed hollow tree trunk lying across
> the ground with a wide dark opening, ferns growing around it. Muted earth tones, thick ink
> outlines, hatching in the shadows, hard shadow to the lower right. [background rule]

---

# Part B: more kinds of ground

All of these are seamless tiles, 1024 x 1024, that use the same low contrast as the first two floors
(items 6 and 7) so game pieces on top stay readable.

## 23. Floor, mud (floor-mud.png)

> [style block, but skip the drop shadow] A seamless tileable square texture, 1024 x 1024 pixels, of
> dark wet mud seen from above: dark brown with a slight olive tint, smooth glossy patches with one
> hard white highlight streak here and there, a few boot-print-like dents, small stones pressed
> in, and thin cracks drying at the edges of some patches. Flat colour bands only, low contrast.
> The edges must wrap perfectly when tiled.

## 24. Floor, pine needles (floor-needles.png)

> [style block, but skip the drop shadow] A seamless tileable square texture, 1024 x 1024 pixels, of a
> forest floor covered in fallen pine needles and small cones: a dense thatch of short thin
> straw-brown and dark olive needles in all directions, a few tiny twigs. Flat colour bands, low
> contrast, no large objects. The edges must wrap perfectly when tiled.

## 25. Floor, gravel (floor-gravel.png)

> [style block, but skip the drop shadow] A seamless tileable square texture, 1024 x 1024 pixels, of
> loose grey-brown gravel and coarse grit seen from above: many small rounded stones of different
> sizes in slate grey, tan and olive, each with a thin ink outline and a tiny hard highlight, packed
> closely with dark gaps between. Low contrast. The edges must wrap perfectly when tiled.

## 26. Floor, wet leaves (floor-wet.png)

> [style block, but skip the drop shadow] A seamless tileable square texture, 1024 x 1024 pixels, of
> damp dark ground after rain: dark soil with scattered flat wet leaves pressed into it, a few
> shiny puddle sheens as pale blue-grey patches with one hard highlight, everything slightly darker
> and cooler than the open ground tile. Low contrast. The edges must wrap perfectly when tiled.

## 27. Floor, snow (floor-snow.png)

> [style block, but skip the drop shadow] A seamless tileable square texture, 1024 x 1024 pixels, of
> ground under a thin layer of snow seen from above: off-white and pale blue-grey patches with
> dark soil, grit and tiny leaves poking through, small hard-edged sparkle highlights, faint
> animal tracks pressed in. Slightly cool and clean but still muted so a warm gold mold stands out
> against it. Low contrast. The edges must wrap perfectly when tiled.

## 28. Ground blend (ground-blend-sheet.png)

For the borders where one kind of ground meets another, so tile changes do not look like hard
squares.

> [style block, but skip the drop shadow] A sheet of 6 irregular, wobbly-edged blobs of ground, each
> about 512 x 512, with a thick inked outline and a thin dark soil rim: 1) mud; 2) pine needles;
> 3) gravel; 4) wet leaves; 5) snow; 6) bare dark soil. Each blob is a flat patch as if it were a
> piece of that ground cut from a map, edges ragged and organic, no shadow. [background rule]

---

# Part C: water

## 29. Streams (stream-sheet.png)

> [style block] A sheet of 6 separate pieces of a narrow stream seen from above, each about 512 x 512:
> 1) a straight section; 2) a gentle bend; 3) a sharp turn; 4) a Y-shaped fork; 5) a wide shallow
> ford with stepping stones; 6) a dead end where the stream widens into a small pool. Pale
> blue-grey water with short curved white highlight dashes to show the flow direction, a dark inked
> bank with mud and a few reeds and small rocks along both edges. Flat colour bands. Every piece
> must meet its neighbours at the middle of its edges, with the water the same width at the join,
> so the pieces can be linked. [background rule]

## 30. Pond (pond-sheet.png)

> [style block] A sheet of 3 ponds seen from above, large and irregular: 1) a round pond with a ring
> of reeds and cattails, two lily pads and a pale highlight; 2) an oval pond with a mossy rock
> in the middle and a fallen branch across one end; 3) a muddy dried-out pond with a dark wet
> centre and cracked mud around it. Pale blue-grey water in flat colour bands with one hard
> white highlight streak, dark inked rim, mud and reeds along the shore. [background rule]

## 31. Rain puddles with ripples (puddle-ripples-sheet.png)

For rain: the same look as the first puddles (item 3), but with rings spreading across them.

> [style block] A sheet of 5 shallow puddles seen from above, the same dark-rimmed pale blue-grey look,
> each with a different set of ink-outlined ripple rings spreading across the water (one ring, two
> overlapping rings, three small rings, one large faint ring, and a ring just starting as a small
> dot). Each puddle a different shape. Hard white highlight streak on each. [background rule]

---

# Part D: weather

None of the weather is in the game yet. These are the pictures it will need. Everything is lit from
the upper left, and none of it may hide the molds: it stays muted and thin.

## 32. Rain streaks (rain-streaks.png), overlay

> [overlay rule] A seamless tileable 1024 x 1024 overlay of falling rain seen from above and slightly
> from the side: many thin straight diagonal streaks, all slanting the same way from the upper
> right to the lower left at about 70 degrees, in three lengths (short, medium, long) and two
> thicknesses, spaced unevenly like hand-inked comic rain lines. No other marks.

## 33. Raindrop splashes (rain-splash-sheet.png)

> [style block] A sheet of 12 tiny raindrop impacts on soil and leaves, seen from above, in a grid of
> 4 across and 3 down: each is a small ink-outlined ring or crown of droplets, from a single dot to
> a wide ring with six small droplets flying outward. Pale blue-grey with a white highlight and a
> thin dark outline. Small and simple. [background rule]

## 34. Snowflakes (snowflakes-sheet.png)

> [style block] A sheet of 16 separate snowflakes and snow clumps, seen from above, in a grid of 4
> across and 4 down: 6 tiny round soft flakes of different sizes, 4 six-armed star flakes, 3
> irregular fluffy clumps, and 3 big flat flakes. Pure white and pale blue-grey with a thin dark
> outline on the larger ones, a hard white highlight on each. Simple chunky comic shapes. [background rule]

## 35. Falling snow (snow-fall.png), overlay

> [overlay rule] A seamless tileable 1024 x 1024 overlay of falling snow: many round dots and a few
> small six-armed flakes of three sizes, scattered unevenly, with a few tiny streaks to show they
> drift down and a little to the left. No other marks. Sparse enough that the picture underneath
> still reads.

## 36. Snow drifts and patches (snow-patches-sheet.png)

> [style block] A sheet of 8 separate patches of snow lying on the ground, seen from above: 3 thin
> irregular patches with soil poking through, 2 round soft mounds with a hard blue-grey shadow band
> to the lower right, a long drift piled against an unseen wall, a small heap on a flat rock, and a
> snow-covered log. Off-white and pale blue-grey, thick inked outlines, flat bands, hard highlights.
> [background rule]

## 37. Frost (frost-overlay.png), overlay

> [overlay rule] A seamless tileable 1024 x 1024 frost overlay: delicate branching ice crystals, fern-
> like frost patterns and small star crystals growing from scattered points, thin lines of varied
> thickness, denser toward the edges of the image and clear in the middle. No other marks.

## 38. Fog banks (fog-overlay.png), overlay

The game already has an inked fog of war, so this fog is paler and drifts: ink-scribbled, not soft.

> [overlay rule] A seamless tileable 1024 x 1024 overlay of low drifting fog drawn in the same hand-
> inked style as a comic: long loose horizontal wisps made of thin parallel hatching lines and
> small scribbled curls, in several bands of different density, with gaps between. No gradients
> and no soft airbrushing, only line work. Sparse enough that the ground underneath still reads.

## 39. Wind and falling leaves (leaves-sheet.png)

> [style block] A sheet of 12 separate falling leaves seen from above, in a grid of 4 across and 3
> down, each at a different tilt and curl: 4 oak leaves, 3 maple leaves, 3 small birch leaves and 2
> curled brown dry leaves. Muted olive, brown and a dull orange; each with a thin ink outline,
> a hard highlight on the upper left and a small hard shadow to the lower right. [background rule]

## 40. Storm darkening (storm-vignette.png), overlay

> A 2048 x 1152 image in pure white on pure black: a stormy darkness for the edges of the screen
> made of dense hand-inked diagonal hatching lines and cross-hatching that is thick and dark
> at all four corners and edges and thins out completely to clear black in the middle, with a few
> long jagged crack-like lines at the corners as if lightning had scratched the picture. No grey
> gradient, only line work. No text.

## 41. Lightning flash (lightning-sheet.png)

> [style block] A sheet of 4 separate lightning bolt flashes drawn in a bold comic style, seen
> from the side as if striking toward the ground from above the frame: a jagged white bolt with a
> hard yellow glow band and a thick black ink outline, a forked bolt, a double bolt and a short
> flash with a starburst at the end. Flat colour bands, no soft glow. Warm white and pale yellow only,
> so it does not look like the player's gold. [background rule]

---

## Tips

- If Gemini adds text or labels, ask for "no text anywhere" again; it often sneaks in.
- For the tiles and overlays, check seams by placing four copies side by side, and send me the best.
- Keep every asset's light coming from the upper left. If one is lit from elsewhere, regenerate it.
- If an asset looks too saturated or too bright, add "muted, dusty, desaturated" and try again: the
  molds must stay the brightest thing in the game.
- Ask for 3 or 4 takes of each and keep the best. Feed a good result back in ("same style as this
  image") when another in the same set comes out different.
- Judge each sprite on a dark map at about 40 pixels. If it is not readable at that size, simplify it.
- Files to send back, one per item: `floor-life-sheet.png`, `trees-sheet.png`, `wood-sheet.png`,
  `landmarks-sheet.png`, `floor-mud.png`, `floor-needles.png`, `floor-gravel.png`, `floor-wet.png`,
  `floor-snow.png`, `ground-blend-sheet.png`, `stream-sheet.png`, `pond-sheet.png`,
  `puddle-ripples-sheet.png`, `rain-streaks.png`, `rain-splash-sheet.png`, `snowflakes-sheet.png`,
  `snow-fall.png`, `snow-patches-sheet.png`, `frost-overlay.png`, `fog-overlay.png`,
  `leaves-sheet.png`, `storm-vignette.png`, `lightning-sheet.png`.
