import type { Envelope, Messages } from '../../link/protocol';
import type { CoopHub } from './hub';

/**
 * What the commander does with each message from the hero. One table, one place: a new message type
 * is one more entry (and, if it needs state, a field on CoopHub). Bodies come from another machine,
 * so each handler checks what it uses.
 */
type Handlers = { [K in keyof Messages]?: (hub: CoopHub, body: Messages[K], env: Envelope) => void };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** rows of plain numbers from another machine: keep only the whole rows, and not too many */
const rows = (v: unknown, width: number, max = 400): number[][] =>
  Array.isArray(v) ? v.filter((r): r is number[] => Array.isArray(r) && r.length >= width && r.slice(0, width).every(num)).slice(0, max) : [];

/** a picture of the hero's arena, checked; null when it is not one */
export function cleanView(b: Partial<Messages['arena.view']> | undefined): Messages['arena.view'] | null {
  const h = b?.hero;
  if (!b || !h || !num(h.x) || !num(h.y)) return null;
  const view: Messages['arena.view'] = {
    front: typeof b.front === 'string' ? b.front : null,
    hero: { x: h.x, y: h.y, hp: num(h.hp) ? h.hp : 0, aim: num(h.aim) ? h.aim : 0 },
    maxHp: num(b.maxHp) && b.maxHp > 0 ? b.maxHp : 1,
    enemies: rows(b.enemies, 4, 150),
    strikes: rows(b.strikes, 4, 16),
    defenses: rows(b.defenses, 4, 16),
    drops: rows(b.drops, 2, 32),
    markers: rows(b.markers, 2, 32),
  };
  if (b.obstacles) view.obstacles = rows(b.obstacles, 3, 200);
  return view;
}

export const HANDLERS: Handlers = {
  'hero.state': (hub, b) => {
    if (typeof b?.mold !== 'string' || !num(b.hp) || !num(b.maxHp) || !num(b.mana) || !num(b.maxMana) || !b.levels || typeof b.levels !== 'object') return;
    if (num(b.harvested)) hub.creditHarvest(b.harvested);
    hub.hero = { mold: b.mold, wave: num(b.wave) ? b.wave : 0, harvested: num(b.harvested) ? b.harvested : 0, roaming: b.roaming === true, hp: b.hp, maxHp: Math.max(1, b.maxHp), mana: b.mana, maxMana: Math.max(1, b.maxMana), levels: { ...b.levels } };
  },
  'front.progress': (hub, b) => {
    if (!hub.deployed || b?.id !== hub.deployed.id || !num(b.pressure) || !num(b.pool)) return;
    hub.deployed.progress = {
      id: b.id,
      wave: num(b.wave) ? b.wave : 0,
      kills: num(b.kills) ? b.kills : 0,
      hp: num(b.hp) ? b.hp : 1,
      pressure: Math.max(0, Math.min(1, b.pressure)),
      pool: Math.max(0, Math.min(1, b.pool)),
      bounty: num(b.bounty) ? b.bounty : 0,
      bosses: num(b.bosses) ? b.bosses : 0,
    };
    hub.creditBounty(num(b.bounty) ? b.bounty : 0);
    hub.followPressure();
  },
  'front.result': (hub, b) => {
    if (typeof b?.id !== 'string' || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'recalled')) return;
    const l = (b.loot ?? {}) as Partial<Record<'nutrients' | 'tech' | 'goo', unknown>>;
    hub.resolve(b.id, b.outcome, num(b.kills) ? b.kills : 0, { nutrients: num(l.nutrients) ? l.nutrients : 0, tech: num(l.tech) ? l.tech : 0, goo: num(l.goo) ? l.goo : 0 });
  },
  'arena.view': (hub, b) => {
    const view = cleanView(b);
    if (view) hub.setArena(view);
  },
  'defend.result': (hub, b) => {
    if ((b?.kind !== 'turret' && b?.kind !== 'wall') || !num(b.x) || !num(b.y)) return;
    hub.defendResult({ kind: b.kind, x: b.x, y: b.y, ok: b.ok === true });
  },
  pong: () => {},
};

export function dispatch(hub: CoopHub, env: Envelope): void {
  const handler = HANDLERS[env.type as keyof Messages] as ((hub: CoopHub, body: unknown, env: Envelope) => void) | undefined;
  handler?.(hub, env.body, env);
}
