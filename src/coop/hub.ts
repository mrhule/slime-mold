import { Link, WebSocketTransport, type Transport } from '../../link/client';
import type { Envelope, Messages } from '../../link/protocol';
import { RELAY_PATH } from '../../link/relay-path';
import { UPGRADES, upgradeCost } from '../../link/hero-upgrades';
import { storedNutrients } from '../sim/hud';
import { TICK_DT } from '../sim/types';
import type { Command, MoldId, World } from '../sim/types';
import { COOP } from './config';
import { findFronts, type FrontInfo } from './fronts';
import { dispatch } from './messages';

/** the front the hero is deployed to */
export interface Deployment {
  id: string;
  rival: MoldId;
  progress: Messages['front.progress'] | null;
}

export interface HubOptions {
  world: () => World;
  playerId: MoldId;
  /** queue a command in the sim (spending and front results go through it so replays stay true) */
  enqueue: (cmd: Command) => void;
  /** a line for the player, like "The hero won F1" */
  notice?: (text: string) => void;
  /** where the relay lives; the page's own host by default */
  url?: string;
  /** a different way to reach the relay (the tests use an in-memory one) */
  transport?: () => Transport;
}

/**
 * The commander's side of the co-op link. The RTS stays in charge of the economy and the map: this
 * class turns what the player does into messages for the hero, and what the hero reports into
 * commands for the sim. With nobody linked it does nothing, so solo play is untouched.
 */
export class CoopHub {
  readonly link: Link;
  hero: Messages['hero.state'] | null = null;
  fronts: FrontInfo[] = [];
  deployed: Deployment | null = null;
  /** arena markers placed this deployment, for the arena view */
  markers: { x: number; y: number }[] = [];
  private changeHandlers: (() => void)[] = [];
  private world: World;
  private reserved = 0;
  private reservedTick = -1;
  private scanClock = 0;
  private drainTick = 0;
  private lastLevels = '';
  /** the front as it was when the hero was sent, kept on the map if the veins stop touching mid-fight */
  private deployedFront: FrontInfo | null = null;

  constructor(private opts: HubOptions) {
    const url = (): string => opts.url ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${RELAY_PATH}`;
    this.link = new Link(opts.transport ?? (() => new WebSocketTransport(url())), { role: 'cmd', name: 'Commander' });
    this.world = opts.world();
    this.link.onState((s) => {
      if (s !== 'linked') {
        // the hero is gone: every front auto-resolves again, and nothing is charged
        this.hero = null;
        this.deployed = null;
        this.markers = [];
      }
      this.emit();
    });
    this.link.onMessage((env: Envelope) => {
      dispatch(this, env);
      this.emit();
    });
  }

  get linked(): boolean { return this.link.state === 'linked'; }
  get playerId(): MoldId { return this.opts.playerId; }
  onChange(fn: () => void): void { this.changeHandlers.push(fn); }
  emit(): void { for (const h of this.changeHandlers) h(); }
  notice(text: string): void { this.opts.notice?.(text); }
  command(cmd: Command): void { this.opts.enqueue(cmd); }

  host(): Promise<string> { return this.link.host(); }
  join(code: string): Promise<void> { return this.link.join(code); }
  leave(): void { this.link.leave(); }

  /** nutrients the player can spend right now */
  get stock(): number {
    const w = this.opts.world();
    if (w.tick !== this.reservedTick) {
      this.reservedTick = w.tick;
      this.reserved = 0;
    }
    return storedNutrients(w, this.opts.playerId) - this.reserved;
  }

  /** pay from the real stock; false (and nothing spent) when it is not there */
  pay(cost: number): boolean {
    if (this.stock < cost) return false;
    this.reserved += cost;
    this.command({ type: 'spend', mold: this.opts.playerId, amount: cost });
    return true;
  }

  upgradeLevel(id: string): number { return this.hero?.levels[id] ?? 0; }

  /** the price of the hero's next level, or null at the top */
  upgradePrice(id: string): number | null {
    const def = UPGRADES.find((u) => u.id === id);
    const lv = this.upgradeLevel(id);
    return def && lv < def.max ? upgradeCost(def, lv) : null;
  }

  buyUpgrade(id: string): boolean {
    const price = this.upgradePrice(id);
    if (!this.linked || !this.hero || price === null || !this.pay(price)) return false;
    const level = this.upgradeLevel(id) + 1;
    this.hero.levels[id] = level;
    this.link.send('upgrade', { mold: this.hero.mold, id, level });
    this.emit();
    return true;
  }

  buySupply(kind: keyof typeof COOP.supply): boolean {
    const s = COOP.supply[kind];
    if (!this.linked || !this.hero || !this.pay(s.cost)) return false;
    this.link.send('supply', { health: s.health, mana: s.mana });
    return true;
  }

  /** send the hero to a front; one hero fights one front at a time */
  deploy(frontId: string): boolean {
    const f = this.fronts.find((x) => x.id === frontId);
    if (!this.linked || !f || this.deployed) return false;
    this.deployed = { id: f.id, rival: f.rival, progress: null };
    this.deployedFront = f;
    this.markers = [];
    this.drainTick = this.opts.world().tick;
    this.link.send('front.open', { id: f.id, seed: f.seed, pool: f.pool, tier: f.tier, pressure: Math.round(f.pressure * 100) / 100 });
    this.emit();
    return true;
  }

  recall(): void {
    if (this.deployed) this.link.send('front.recall', { id: this.deployed.id });
  }

  /** a marker in arena space for the hero */
  mark(x: number, y: number, label = 'GO'): void {
    if (!this.linked || !this.deployed) return;
    this.markers.push({ x, y });
    this.link.send('marker', { x, y, label });
    this.emit();
  }

  /** the hero decided its front: the sim moves the line (a recall counts as a retreat) */
  resolve(frontId: string, outcome: Messages['front.result']['outcome'], kills: number): void {
    const d = this.deployed;
    if (!d || d.id !== frontId) return;
    this.deployed = null;
    this.markers = [];
    this.command({ type: 'frontResult', mold: this.opts.playerId, rival: d.rival, outcome: outcome === 'won' ? 'won' : 'lost' });
    this.notice(outcome === 'won' ? `The hero won ${frontId} (${kills} kills): the rival withers!` : `The hero left ${frontId}: our line recedes`);
  }

  /** call every frame; fronts are rescanned twice a second and an open front drains once a second of game time */
  update(dt: number): void {
    const w = this.opts.world();
    if (w !== this.world) {
      // a new round: the old fronts are gone
      this.world = w;
      this.fronts = [];
      if (this.deployed) {
        this.link.send('front.recall', { id: this.deployed.id });
        this.deployed = null;
      }
      this.emit();
    }
    if (!this.linked) {
      if (this.fronts.length) {
        this.fronts = [];
        this.emit();
      }
      return;
    }
    this.scanClock += dt;
    if (this.scanClock >= COOP.scanEvery) {
      this.scanClock = 0;
      this.fronts = findFronts(w, this.opts.playerId);
      if (this.deployedFront && this.deployed && !this.fronts.some((f) => f.id === this.deployed!.id)) this.fronts.push(this.deployedFront);
      if (this.deployed && w.molds[this.deployed.rival - 1]?.status !== 'alive') this.recall();
      this.emit();
    }
    const d = this.deployed;
    if (d && w.tick - this.drainTick >= 1 / TICK_DT) {
      this.drainTick = w.tick;
      if (this.stock <= COOP.frontDrain) {
        this.notice('Out of nutrients: the front collapses');
        this.recall();
      } else {
        this.command({ type: 'spend', mold: this.opts.playerId, amount: COOP.frontDrain, partial: true });
      }
    }
    // the hero panel stays current even when the hero sends nothing
    const key = this.hero ? JSON.stringify(this.hero.levels) : '';
    if (key !== this.lastLevels) {
      this.lastLevels = key;
      this.emit();
    }
  }
}
