/** Copied from the hero repo's src/upgrades.ts (list and prices only). Keep in step with it. */
export type Levels = Record<string, number>;

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  baseCost: number;
  growth: number;
  max: number;
  /** what each level gives, shown in the shop */
  blurb: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'weapon', name: 'Weapon', icon: '🔫', baseCost: 40, growth: 1.45, max: 10, blurb: '+9% fire rate, +6% damage. Extra shot at 4 and 8, pierce at 6 and 10' },
  { id: 'strength', name: 'Strength', icon: '💪', baseCost: 30, growth: 1.4, max: 15, blurb: '+12% damage on every shot' },
  { id: 'armor', name: 'Armor', icon: '🛡️', baseCost: 35, growth: 1.4, max: 15, blurb: '+4 armor: less damage taken' },
  { id: 'vitality', name: 'Vitality', icon: '❤️', baseCost: 25, growth: 1.35, max: 20, blurb: '+25 max health (and heals that much)' },
  { id: 'regen', name: 'Regeneration', icon: '🌱', baseCost: 30, growth: 1.45, max: 12, blurb: '+0.8 health per second' },
  { id: 'magic', name: 'Arcane Power', icon: '🔮', baseCost: 35, growth: 1.4, max: 12, blurb: '+18% spell damage, +5% spell radius' },
  { id: 'mana', name: 'Mana Pool', icon: '💧', baseCost: 25, growth: 1.35, max: 12, blurb: '+25 max mana, +1.2 mana per second' },
  { id: 'quickcast', name: 'Quick Cast', icon: '⚡', baseCost: 45, growth: 1.5, max: 8, blurb: '-7% spell cooldown and mana cost' },
  { id: 'swift', name: 'Swiftness', icon: '👟', baseCost: 30, growth: 1.5, max: 8, blurb: '+4% move speed' },
  { id: 'magnet', name: 'Goo Magnet', icon: '🧲', baseCost: 20, growth: 1.5, max: 6, blurb: '+45 pickup range' },
];

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.growth, level));
}

