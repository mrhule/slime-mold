import type { Envelope, Messages } from '../../link/protocol';
import type { CoopHub } from './hub';

/**
 * What the commander does with each message from the hero. One table, one place: a new message type
 * is one more entry (and, if it needs state, a field on CoopHub). Bodies come from another machine,
 * so each handler checks what it uses.
 */
type Handlers = { [K in keyof Messages]?: (hub: CoopHub, body: Messages[K], env: Envelope) => void };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const HANDLERS: Handlers = {
  'hero.state': (hub, b) => {
    if (typeof b?.mold !== 'string' || !num(b.hp) || !num(b.maxHp) || !num(b.mana) || !num(b.maxMana) || !b.levels || typeof b.levels !== 'object') return;
    hub.hero = { mold: b.mold, wave: num(b.wave) ? b.wave : 0, hp: b.hp, maxHp: Math.max(1, b.maxHp), mana: b.mana, maxMana: Math.max(1, b.maxMana), levels: { ...b.levels } };
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
    };
  },
  'front.result': (hub, b) => {
    if (typeof b?.id !== 'string' || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'recalled')) return;
    hub.resolve(b.id, b.outcome, num(b.kills) ? b.kills : 0);
  },
  pong: () => {},
};

export function dispatch(hub: CoopHub, env: Envelope): void {
  const handler = HANDLERS[env.type as keyof Messages] as ((hub: CoopHub, body: unknown, env: Envelope) => void) | undefined;
  handler?.(hub, env.body, env);
}
