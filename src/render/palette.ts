/** Colors and ink patterns (R18). Visual only: the sim never reads any of this. */

export const INK = 0x14110f;
export const INK_RGB: [number, number, number] = [0x14 / 255, 0x11 / 255, 0x0f / 255];

/** Player is warm yellow; rivals use a color-blind-safe (Okabe-Ito derived) set, pushed to comic saturation. */
export const MOLD_COLORS = [0xf2c744, 0xe8872b, 0x4fb0e8, 0x1fae7b, 0xe0432a, 0xc4709f] as const;

/** plain, diagonal hatching, halftone dots, dotted rings, cross-hatch */
export const PATTERN_COUNT = 5;
export const PATTERN_NAMES = ['plain', 'hatching', 'halftone', 'rings', 'cross-hatch'] as const;

export const moldColor = (index: number): number => MOLD_COLORS[index % MOLD_COLORS.length] as number;
export const moldPattern = (index: number): number => index % PATTERN_COUNT;

export const rgb = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
export const rgbUnit = (hex: number): [number, number, number] => {
  const [r, g, b] = rgb(hex);
  return [r / 255, g / 255, b / 255];
};

/** Muted, dirty map palette so the molds are the saturated accents. */
export const MAP = {
  base: 0x5b5d4b,
  mid: 0x50523f,
  dark: 0x44463a,
  rough: 0x4b4a39,
  roughHatch: 0x2c2b22,
  glass: 0x9bb3b5,
  glassDark: 0x6f8a8e,
  glassLight: 0xdcecec,
  wall: 0x24211e,
  wallLight: 0x3a3631,
  scratch: 0x70725f,
} as const;

export const FOOD = {
  oatFlake: { base: 0xd9c590, shade: 0xa8935c, light: 0xf2e6bd },
  breadCrumb: { base: 0xb9773a, shade: 0x84501f, light: 0xe8c58b },
  sugarCube: { base: 0xf1efe6, shade: 0xb5b2a4, light: 0xffffff },
  fruitSlice: { base: 0xd9452f, shade: 0x9e2d1e, light: 0xf5a08a },
} as const;
