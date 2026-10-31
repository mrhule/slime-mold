# Design language and storyboard

This write-up pins down the look the game already has, names the gaps, lays out the key moments as a
storyboard, and gives Gemini prompts for the art the next jobs need. It is a draft to react to. Where
it proposes something new (the character cast, the propaganda register), it says so.

Related to-dos: design language (12), trees and organic matter (4), characters (3), Fortress (9),
factories (8), layouts (2), propaganda tone (11).

## 1. The look as built

**One sentence.** A damp forest floor drawn as a comic-book field journal: heavy ink, flat colour
bands, hard offset shadows, and warm gold as the only thing that glows.

**Light and ink**
- One light from the upper left, everywhere. Shadows fall lower right as a hard-edged offset, never
  soft.
- Near-black ink `#14110F` outlines every object. Lower-right edges are thicker than upper-left.
- Shading is flat colour bands (base, shade, light) with no gradients. Shadow areas get diagonal
  hatching; the roughest ground gets cross-hatching.

**Colour**
- The map is muted and dirty: olive and soil `#5B5D4B`, `#50523F`, `#44463A`, rough ground `#4B4A39`,
  slate rock, walls `#24211E`. This keeps the molds the only saturated things on screen.
- Molds are the accent: player warm yellow `#F2C744`; rivals orange `#E8872B`, blue `#4FB0E8`, green
  `#1FAE7B`, red `#E0432A`, pink `#C4709F`. Each mold also has its own ink pattern (plain, hatching,
  halftone, rings, cross-hatch, waves), so colour is never the only way to tell them apart.
- Warm gold means "yours, alive, producing". Goo green is the one other glow (pools).
- UI paper is cream `#F1E6C4` with darker paper `#D9C995`; danger is `#E0432A`.

**Type and interface**
- Display face: Bangers, uppercase, letter-spaced, for titles, buttons and key numbers. Body face is
  the system sans.
- Panels are cream paper with a thick ink border, a hard offset shadow, and a faint halftone. Buttons
  press down toward the lower right.
- Fog of war is scribbled ink over what has never been seen, and dots over what is only remembered.

**Motion and sound**
- Pulses along veins show nutrient flow. Ink splats show deaths. The screen no longer shakes.
- The extras are a mockumentary with a very serious narrator, a theme song, spoken stings and
  popups. Today the narrator is a voice and a card; there is no face.

## 2. Rules to hold the set together

1. **One light.** Upper left, always. A sprite lit from anywhere else gets regenerated.
2. **Ink first.** Every object has the ink outline, thicker on the shadow side.
3. **Flat bands.** Base, shade, light. No gradients, no soft shadows.
4. **Saturation is earned.** Only molds, food, goo and gold buildings are saturated. Terrain and
   decoration stay muted so they never compete.
5. **Gold means yours.** Anything the player owns or that produces for them is warm gold or amber.
   Anything defensive is grey-bone (Fortress). Anything hostile is another mold's colour.
6. **Shape tells the job.** Factory is a cluster of bubbles (it stores). Collector is a flat sun-dish
   (it soaks up light). Fortress is armoured plates (it defends). Relay is a ring of nodules (it
   extends reach). Keep these silhouettes distinct at a glance, at small size.
7. **State is drawn, not only written.** A hatched fill means a special state (see the Growth/War
   slider: green hatch explores, red hatch bleeds). Prefer hatch, pattern and ink weight over new
   colours.
8. **Top-down, with a little lean.** Objects are seen from above with the shadow cast lower right, so
   they read as standing on the floor.
9. **The tone is deadpan.** The art is serious and moody; the joke lives in the words and in the
   characters' conviction, not in goofy drawing.

## 3. Gaps this work should close

- **Trees and organic matter.** The map has rocks, twigs, litter and puddles, plus the snails. Nothing
  tall or alive: no trunks, roots, stumps, fungi, ferns, fallen logs.
- **Factories are hard to read.** How a factory feeds a piece and how a pool pays out is not visible.
- **Fortress** needs the new armoured look, consistent with rule 6.
- **Characters.** The embellishments have a voice but no faces.
- **Layouts.** The stats modal, overlays and popups were each built on their own; they need one
  panel system (rule: cream paper, ink border, hard shadow, display-face headings).

## 4. Storyboard: the key moments

Each beat lists what the player sees, the camera, and the sound. Beats marked **(new)** need art or
characters that do not exist yet.

1. **Title.** Dark forest edge. The title in Bangers over the vignette; four mold-colour dots. Quiet.
2. **Intro video.** 20 seconds. Fades into the round as the theme song comes up. (Exists.)
3. **First growth.** Camera close on the core. The player clicks; the first vein pushes out with a
   pulse. A single gold line in a muted world. Soft tick sounds.
4. **First food.** A halo around an oat flake; the vein reaches it; a meter drains. Small gulp sound.
5. **Exploring at max Growth (new).** The slider's left end is hatched green. Veins splinter off the
   network and probe outward, one at a time, toward food and unseen ground. The note under the slider
   says so.
6. **First contact.** Fog edge, a rival's colour appears. Popup: "First contact!" with its reason.
   Rally sting if you are ahead; Last Stand if you are behind.
7. **A front.** Two colours push at a seam; ink splats on each death; a Fortress ring behind the line.
8. **Losing (new character beat).** Fading or Last Stand sting plays. A character appears in a corner
   panel and speaks. (The Last Stand line is in section 5C.)
9. **All-out war (new).** Slider hatched red. A warning band; veins slowly die back; nutrients bleed.
10. **Winning.** The round ends; the control bar's tick is passed. Victory card.
11. **Round change.** Whatever plays fades out; "The Spores Remember" starts; the next map fades in.
12. **Spore burst.** Seeds scatter across the map and bloom. The big gamble.
13. **Defeat.** The mold goes dim; the card reads the round reached.

## 5. Gemini prompts

Paste the **style block** from `docs/art-prompts.md` first, then the **background rule** for every
cut-out asset. Ask for 4 or 5 takes and keep the best; light must come from the upper left.

### A. Trees and organic matter (organic-sheet.png)

Replaces the idea of "more rocks" with things that are alive or rotting. All are drawn top-down; trees
are seen from above, so they show a crown and a short trunk shadow, not a side view.

> [style block] A sheet of 12 separate pieces of forest floor matter, drawn from above, each different:
> 1) the top of a small broadleaf tree, a round clump of dark green leaves with a few lighter leaves
> catching the light; 2) the top of a conifer, a star of dark needle branches; 3) a cut tree stump
> with visible growth rings and a ring of bracket mushrooms; 4) a fallen mossy log seen from above,
> long and rounded with one broken end; 5) a clump of tall ferns; 6) a cluster of small brown
> mushrooms; 7) a patch of bright green moss on soil; 8) a tangle of exposed roots; 9) a heap of
> rotting leaves with a pale fungus on it; 10) a bramble bush with a few red berries; 11) a hollow
> tree trunk top with a dark hole in the middle; 12) a few blades of tall grass. Sizes range from
> small (mushrooms, moss) to large (trees, log). Muted olive, moss, brown and slate, with only the
> berries and one mushroom cap allowed a warm accent. [background rule]

Large pieces (the two trees, stump, log) go on the sheet separately if Gemini crowds them: ask for
"one large item per image, 1024 x 1024".

### B. Factory: how it works (factory-explainer.png)

A teaching picture, shown in a help card and as the basis for how factories look in play. Three
panels left to right.

> [style block] A three-panel comic strip with thick ink panel borders, drawn from above, showing how
> a golden organic factory works. Panel 1: a thin gold vein runs from a glowing core to a cluster of
> glossy golden bubbles (the factory); small gold beads of energy travel along the vein toward the
> factory. Panel 2: the factory swells and its bubbles glow brighter as the beads arrive; a pale gold
> ring spreads outward from it over the veins nearby to show its reach. Panel 3: near the end of the
> reach the veins are strong and bright gold; far beyond the ring they are thin and grey-green and one
> tip is dying back. A goo pool glows bright green beside the factory, joined to it by a short line of
> gold beads. No text, no letters, no numbers. Flat colour bands, hard shadows to the lower right.

### C. Characters (characters-sheet.png) — proposed cast, to approve before art

These are proposals. They drive the embellishments and carry the propaganda tone (to-do 11) and the
Last Stand moment (to-do 10).

- **Mortimer P. Mold.** The hero. A smug, earnest golden mold with tiny arms, the documentary's
  subject. Already named in the embellishments popup.
- **The Narrator.** A field-naturalist beetle in a tiny pith helmet holding a microphone on a boom.
  Calm until things go badly.
- **Commissar Spore.** A glowing orange mold in a peaked cap with medals, the propaganda officer. The
  face of the Last Stand lines. Over-the-top, shouting through a megaphone.
- **The Rival Warlord.** A hard, blue-grey mold in spiked armour plates, one per rival colour (change
  only the colour and pattern).

> [style block, but front-facing, not top-down, and full figure] A character sheet in the same comic ink
> style, four separate characters standing side by side with room between them, all lit from the upper
> left. 1) Mortimer P. Mold: a round, glossy golden slime mold blob with two tiny arms, big confident
> eyes and a small smug smile, standing proudly. 2) The Narrator: a field-naturalist beetle in a tiny
> cream pith helmet and khaki vest holding a microphone on a boom pole, calm and amused. 3) Commissar
> Spore: a glowing orange mold in a peaked military cap covered in medals, mouth wide open shouting
> through a cone megaphone, one fist raised, like a propaganda-poster officer. 4) The Rival Warlord: a
> slate-blue mold wearing spiked bone-grey armour plates, arms crossed, a scowling grin. Thick ink
> outlines, flat colour bands, hard highlights, serious expressions played completely straight.
> No text, no letters. [background rule]

Follow-ups, one character per image: "same character, five expressions (calm, shouting, worried, smug,
defeated), head and shoulders, on a flat magenta background" for the popups.

### D. Last Stand poster (poster-last-stand.png)

The character beat from to-do 10. The line: "Yes! Yes! Use the music to turn you into the mindless
killing machine. Consume. Consume all!"

> [style block, but front-facing] A propaganda poster in comic ink style, portrait 1024 x 1536. Commissar
> Spore, a glowing orange mold in a peaked cap and medals, leans out of a dramatic low angle, one
> hand pointing at the viewer, mouth wide open shouting. Behind it, radial speed lines in dark red
> and black, and the silhouettes of many tiny golden molds marching toward the viewer. Limited
> palette: black ink, blood red, cream and warm gold. A halftone dot texture in the shadows. Leave
> a clear empty banner shape across the bottom for text, with no letters in the picture.

### E. Fortress redo (fortress-v2-sheet.png)

> [style block] A sheet of 3 versions of a small organic fortress, drawn from above: small, medium and
> large (level 1 to 3). A squat ring of thick, knobbly bone-grey and pale steel plates like fused
> beetle shells, with a notch gate on one side, around a glowing orange-red core that grows
> brighter at higher levels. Darker slate shade band on the lower right, hard white rim light on the
> upper left, a few cracks, thick ink outline and a hard shadow to the lower right. It must read at
> a glance as defensive and tough, clearly different from the round gold factory and the flat
> sun-dish collector. [background rule]

### F. Panel system for the interface (ui-kit.png)

For the layouts job (to-do 2): one coherent set of panels for the stats modal, popups, overlays and
cards.

> [style block, but flat, no drop shadow, no characters] A UI kit sheet, 2048 x 1536, on a flat magenta
> (#FF00FF) background. Six separate empty panels in the same cream parchment and thick ink
> style, no text or letters anywhere, only grey placeholder bars where text would go: 1) a tall
> stats modal with a header band, three rows of label and value bars and a footer button; 2) a wide
> banner for a popup with a small icon box at the left; 3) a small tooltip bubble with a pointer; 4)
> a square card with a corner tab; 5) a full-width bottom strip for narration with a portrait frame at
> the left (for a character's face); 6) a pause overlay panel with three stacked buttons. Hard
> offset shadows to the lower right, a faint halftone texture, slightly worn edges.

### G. Storyboard frames (storyboard-01.png and so on)

One image per beat from section 4, drawn as comic frames. Ask for the same prompt for each beat, with
the beat's description swapped in.

> [style block, but a cinematic wide frame, 1920 x 1080, from above with a little perspective] A single
> comic storyboard frame in thick ink panel borders, showing: [BEAT]. Muted forest-floor palette with
> warm gold as the only bright accent. No text, no letters, no UI.

Beats to fill in (from section 4): "a lone gold vein pushing out from a glowing core across dark
soil"; "a gold vein reaching an oat flake with a bright halo"; "thin gold veins splintering off a
network and probing outward in many directions"; "a blue mold's edge meeting a gold mold's edge at a
fog boundary"; "two colours pushing at a seam with ink splats and a grey bone-plated fortress behind
the gold line"; "gold veins turning pale and dying back at the tips with a red warning glow"; "a
round ending, gold across most of the map".

### H. Design language reference board (language-board.png)

A single reference image to keep every later prompt consistent.

> A single mood and style reference board, 2048 x 1365, in comic ink style: a muted damp forest floor
> background with a few examples laid out on it, each drawn from above and lit from the upper left:
> a golden vein with a gold bubble-cluster factory, a grey slate rock with hatching on its shadow
> side, a blue rival mold edge with halftone dots, a green goo pool, a snail, and a cream paper
> panel with a thick ink border and a hard offset shadow. Show the palette by the objects
> themselves, not by swatches. No text, no letters, no UI labels.

## 6. Tips

- Always feed the previous best result back in ("same style as this image") when one asset in a set
  comes out different; it fixes drift better than rewording.
- Check every new sprite on the real map before keeping it: put it next to a rock and a vein at game
  zoom. A good sprite is readable at about 40 pixels.
- Keep a short list of rejected looks in this file so the same mistakes are not generated twice.
