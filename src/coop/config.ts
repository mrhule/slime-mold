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
  /** supplies the commander can buy: the share restored and the price */
  supply: {
    heal: { health: 0.4, mana: 0, cost: 40, label: 'Heal 40%' },
    mana: { health: 0, mana: 1, cost: 30, label: 'Refill mana' },
  },
  /** seconds between looks at the war map for fronts */
  scanEvery: 0.5,
  /** the hero's dish is this wide, centred in the middle */
  arena: 2800,
  /** keep the room code in the URL as ?join= */
  roomParam: 'join',
} as const;
