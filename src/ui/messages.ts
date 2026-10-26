/** Plain-words messages for sim rejection reasons (growth targets and building placement). */
export const REASONS: Record<string, string> = {
  'no-open-cell-nearby': "Can't grow there!",
  unreachable: 'No way through!',
  'already-owned': 'Already yours!',
  'out-of-bounds': 'Off the map!',
  'mold-eliminated': 'Your mold is gone!',
  'unknown-building': "Can't build that!",
  'not-your-cell': 'Build on your own mold!',
  occupied: "Something's already there!",
  'on-food': "Can't build on food!",
  'limit-reached': 'No more of those allowed!',
  'cant-afford': 'Not enough nutrients!',
  'no-vein': 'No vein there to cut!',
  'no-building': 'No building there!',
  locked: 'Evolve to unlock that!',
  'max-tier': 'Fully evolved!',
  'not-upgradable': "Only factories can be upgraded!",
  'max-level': 'Already fully upgraded!',
  'no-food-nearby': 'Build next to big food!',
  'food-too-small': 'That food is too small!',
  'already-harvested': 'Already harvesting that!',
  'not-fertile': 'Pools need fertile ground!',
  'not-your-building': 'That is not your building!',
  'not-a-farm': 'Only pools have an output dial!',
  'bad-level': 'That output level is not allowed!',
  'burst-locked': 'The spore burst is not ready yet!',
  'burst-used': 'The spore burst is already spent!',
  'burst-cost': 'Not enough nutrients for a burst!',
};

export const FOOD_NAMES: Record<string, string> = {
  oatFlake: 'Oat flake',
  breadCrumb: 'Bread crumb',
  sugarCube: 'Sugar cube',
  fruitSlice: 'Fruit slice',
  goo: 'Goo pool',
};

export const reasonText = (reason: string): string => REASONS[reason] ?? reason;
