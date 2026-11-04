/** Every co-op number in one place, so a playtest can change them together. */
export const COOP = {
  /** nutrients per second an open front costs the commander */
  frontDrain: 3,
  /** hero pool units per nutrient the rival holds at the front, and the bounds of the pool */
  poolPerNutrient: 0.5,
  poolMin: 30,
  poolMax: 400,
  /** the marker and the panel flash when pressure passes this */
  dangerPressure: 0.7,
  /** the line moves one step for each this much the hero's pressure rises or falls, and a step is this many cells */
  lineStep: 0.1,
  cellsPerStep: 2,
  /** supplies the commander can buy: the share restored and the price */
  supply: {
    heal: { health: 0.4, mana: 0, cost: 40, label: 'Heal 40%' },
    mana: { health: 0, mana: 1, cost: 30, label: 'Refill mana' },
  },
  /** the hero's arena tools from the zoomed view; the commander pays first and enforces the cooldown (values from the hero's TUNING) */
  strike: { cost: 60, cooldown: 12 },
  defense: { max: 8, turretCost: 80, wallCost: 30 },
  /** the zoomed view hides when no picture has arrived for this many seconds */
  viewStale: 2,
  /** seconds between overviews for the hero's war-room map */
  overviewEvery: 1,
  /** seconds between repeats of the season and weather sent to the hero */
  climateEvery: 3,
  /** seconds between looks at the war map for fronts */
  scanEvery: 0.5,
  /** the hero's dish is this wide, centred in the middle */
  arena: 2800,
  /** keep the room code in the URL as ?join= */
  roomParam: 'join',
} as const;
