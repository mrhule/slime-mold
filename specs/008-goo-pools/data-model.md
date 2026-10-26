# Data Model: Pools of Primordial Goo

## Food type `goo` (balance)

| Field | Value | Notes |
|-------|-------|-------|
| `w`, `h` | 4, 3 | the pool's footprint, engulfed whole on touch |
| `nutrients` | n/a | cells hold a constant amount; nothing is ever subtracted |
| `absorbRate` | 0.125 per cell per second | so a fully held pool pays 1.5/s |
| `infinite` | true | never depletes, ignored by harvesters, drops and the food budget |

## `balance.pools`

`contested` (extra pools between starts), `nearDistance` (distance of each start's own pool),
`minGap` (spacing between pools).

## Food source (existing record)

`type: 'goo'`, `origin: 'map'`, `remaining` and `total` constant, `depleted` always false.

## Derived at runtime (no new world arrays)

- **Pool income of a mold**: the sum over goo cells it owns whose piece has a working store house, times
  `absorbRate`. Added to the piece's stock and to the mold's income counters, as food already is.
- **Pool waiting**: a goo source in which a mold owns at least one cell, on a piece with no working store
  house. Exposed in the HUD model and `MoldView`.

## Removed

`BuildingType 'farm'`, `Building.level` and `linked` for farms, `setFarmOutput`, `world.fertile`, and the
farm balance block.
