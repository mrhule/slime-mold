# Contract: Render Style

The rules every drawn object follows. Values live in `src/render/style.ts`.

## Light

One fixed direction toward the light (upper left). Every shaded object has a lit side facing it and a
shadow side facing away, in hard bands. No gradients on objects.

| Object | Lit side | Shadow side |
|---|---|---|
| Vein | highlight stripe along the side facing the light (the layer flips each edge's cross-axis so this holds) | darker band on the far side |
| Building / food | highlight on the upper left | darker lower right, flat offset ground shadow |
| Obstacle (existing) | lit rim on the upper left | hatched drop shadow to the lower right (existing) |

## Vein widths

Half-width snaps to three bands by conductivity, with hysteresis (thresholds in `style.ts`). Trunks
are widest. No in-between widths are ever drawn.

## Pulses

Bright hard-edged blobs travel in the flow direction. None where `|flow|` is under `minFlow`; one per
cell for light flow; two for heavy flow. Phase offsets are hashed per edge. Veins not visible to the
player are not drawn, so they show no pulses.

## Shadows and outlines

- Veins: a flat dark pass offset toward the lower right under the outline pass.
- Outlines are heavier on the shadow side (`padShade`) and lighter on the lit side (`padLit`) for
  veins; for buildings and food, a second stroke shifted toward the lower right.
- Shadows and outlines are drawn by the same code that draws the object, so they follow the same
  fog and visibility rule and never leak.

## Quality levels

| Effect | High | Low |
|---|---|---|
| Vein shadow pass | on | off |
| Pulses | on | off |
| Splat count | full | half |
| Print filter | if enabled | off |
| Everything else (light, bands, outlines, shake) | on | on |

Auto switches between them by frame rate (research A14); High and Low pin the level.

## Readability rule

Shading must never hide a mold's ink pattern or shape (001 FR-033), and a mold, food item or front
must remain pickable at a glance in a busy scene. If an effect fails this in a playtest, it is turned
down or removed.
