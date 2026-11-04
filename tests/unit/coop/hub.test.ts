import { describe, expect, it } from 'vitest';
import { Link } from '../../../link/client';
import { MemoryTransport } from '../../../link/memory';
import type { Envelope } from '../../../link/protocol';
import { Relay } from '../../../link/relay';
import { climateMessage } from '../../../src/coop/climate';
import { findFronts } from '../../../src/coop/fronts';
import { CoopHub } from '../../../src/coop/hub';
import { scanFronts } from '../../../src/sim/combat';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import type { Command } from '../../../src/sim/types';
import { cellOf, createOpenWorld } from '../../helpers';

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

function setup() {
  const world = createOpenWorld(60, 40);
  const me = addMold(world, 'player', cellOf(world, 8, 20), 500);
  const rival = addMold(world, 'rival', cellOf(world, 50, 20), 200);
  for (let y = 10; y < 30; y++) {
    addCell(world, me.id, cellOf(world, 25, y), -1);
    addCell(world, rival.id, cellOf(world, 26, y), -1);
  }
  scanFronts(world);
  const relay = new Relay();
  const commands: Command[] = [];
  const notices: string[] = [];
  const hub = new CoopHub({ world: () => world, playerId: me.id, enqueue: (c) => commands.push(c), notice: (t) => notices.push(t), transport: () => new MemoryTransport(relay) });
  const hero = new Link(() => new MemoryTransport(relay), { role: 'hero', name: 'Hero' });
  const heard: Envelope[] = [];
  hero.onMessage((e) => heard.push(e));
  const heroState = { mold: 'goo', wave: 1, harvested: 0, roaming: true, hp: 100, maxHp: 100, mana: 50, maxMana: 50, levels: {} as Record<string, number> };
  return { world, me: me.id, rival: rival.id, hub, hero, heard, commands, notices, heroState };
}

async function link(s: ReturnType<typeof setup>): Promise<void> {
  const code = await s.hub.host();
  await s.hero.join(code);
  await settle();
  s.hero.send('hero.state', s.heroState);
  s.hub.update(1);
  await settle();
}

describe('fronts', () => {
  it('finds a front where veins touch, with a pool, tier and pressure from the war', () => {
    const { world, me, rival } = setup();
    const fronts = findFronts(world, me);
    expect(fronts).toHaveLength(1);
    const f = fronts[0]!;
    expect(f.rival).toBe(rival);
    expect(f.id).toBe(`F${rival - 1}`);
    expect(f.pool).toBeGreaterThanOrEqual(30);
    expect(f.pressure).toBeGreaterThan(0);
    expect(f.pressure).toBeLessThan(1);
  });
});

describe('CoopHub', () => {
  it('does nothing when solo', () => {
    const { hub, commands } = setup();
    hub.update(1);
    expect(hub.fronts).toHaveLength(0);
    expect(hub.buyUpgrade('weapon')).toBe(false);
    expect(hub.deploy('F1')).toBe(false);
    expect(commands).toHaveLength(0);
  });

  it('buys an upgrade with real nutrients and tells the hero', async () => {
    const s = setup();
    await link(s);
    expect(s.hub.hero?.mold).toBe('goo');
    expect(s.hub.buyUpgrade('weapon')).toBe(true);
    await settle();
    expect(s.commands).toContainEqual({ type: 'spend', mold: s.me, amount: 40 });
    expect(s.heard.find((e) => e.type === 'upgrade')?.body).toEqual({ mold: 'goo', id: 'weapon', level: 1 });
  });

  it('will not buy what the stock cannot pay for', async () => {
    const s = setup();
    await link(s);
    for (const c of s.world.components.values()) c.pool = 0;
    expect(s.hub.buyUpgrade('weapon')).toBe(false);
    expect(s.hub.buySupply('heal')).toBe(false);
    expect(s.commands).toHaveLength(0);
  });

  it('deploys at a front, drains while it is open, and the hero\'s win moves the line', async () => {
    const s = setup();
    await link(s);
    expect(s.hub.deploy(`F${s.rival - 1}`)).toBe(true);
    await settle();
    const open = s.heard.find((e) => e.type === 'front.open')?.body as { pool: number; tier: number };
    expect(open.pool).toBeGreaterThan(0);
    s.world.tick += 20;
    s.hub.update(0.1);
    expect(s.commands).toContainEqual(expect.objectContaining({ type: 'spend', partial: true }));
    s.hero.send('front.progress', { id: s.hub.deployed!.id, wave: 2, kills: 5, hp: 0.8, pressure: 0.9, pool: 0.4, bounty: 0, bosses: 0 });
    await settle();
    expect(s.hub.deployed?.progress?.pressure).toBe(0.9);
    s.hero.send('front.result', { id: s.hub.deployed!.id, outcome: 'won', kills: 9, loot: { nutrients: 0, tech: 0, goo: 0 } });
    await settle();
    expect(s.hub.deployed).toBeNull();
    expect(s.commands).toContainEqual({ type: 'frontResult', mold: s.me, rival: s.rival, outcome: 'won' });
  });

  it('recalls when the nutrients run out', async () => {
    const s = setup();
    await link(s);
    s.hub.deploy(`F${s.rival - 1}`);
    for (const c of s.world.components.values()) c.pool = 0;
    s.world.tick += 20;
    s.hub.update(0.1);
    await settle();
    expect(s.heard.some((e) => e.type === 'front.recall')).toBe(true);
  });

  it('goes back to auto-resolve when the hero leaves', async () => {
    const s = setup();
    await link(s);
    s.hub.deploy(`F${s.rival - 1}`);
    s.hero.leave();
    await settle();
    expect(s.hub.deployed).toBeNull();
    expect(s.hub.linked).toBe(false);
  });
});

describe('roaming harvest and held fronts', () => {
  it('credits the difference of the running harvest, and reads a drop as a new game', async () => {
    const s = setup();
    await link(s);
    s.commands.length = 0;
    for (const h of [4, 12, 3]) {
      s.hero.send('hero.state', { ...s.heroState, harvested: h });
      await settle();
    }
    expect(s.commands.filter((c) => c.type === 'gain').map((c) => (c as { amount: number }).amount)).toEqual([4, 8, 3]);
  });

  it('holds the front while the hero is deployed, follows its pressure, and lets go when the link drops', async () => {
    const s = setup();
    await link(s);
    const frontId = `F${s.rival - 1}`;
    s.hub.deploy(frontId);
    expect(s.commands).toContainEqual({ type: 'frontHold', mold: s.me, rival: s.rival, held: true });
    s.commands.length = 0;
    s.hero.send('front.progress', { id: frontId, wave: 1, kills: 0, hp: 1, pressure: 1, pool: 1, bounty: 0, bosses: 0 });
    await settle();
    expect(s.commands.some((c) => c.type === 'frontShift' && c.cells > 0)).toBe(true);
    s.hero.leave();
    await settle();
    expect(s.commands).toContainEqual({ type: 'frontHold', mold: s.me, rival: s.rival, held: false });
  });
});

describe('climate for the hero', () => {
  it('says the season, weather and intensity of the commander\'s map', () => {
    const { world } = setup();
    world.season = 'winter';
    world.weather.kind = 'blizzard';
    expect(climateMessage(world)).toMatchObject({ season: 'winter', weather: 'blizzard' });
    const c = climateMessage(world);
    expect(c.intensity).toBeGreaterThanOrEqual(0);
    expect(c.intensity).toBeLessThanOrEqual(1);
  });

  it('is sent at link, when the sky changes, and every few seconds, without touching the RTS weather', async () => {
    const s = setup();
    await link(s); // the link helper's update() already ran once
    await settle();
    const heard = () => s.heard.filter((e) => e.type === 'climate');
    expect(heard()).toHaveLength(1);
    s.hub.update(0.5);
    await settle();
    expect(heard()).toHaveLength(1); // unchanged and not yet time
    s.world.weather.kind = 'storm';
    s.hub.update(0.1);
    await settle();
    expect(heard()).toHaveLength(2);
    expect((heard()[1]!.body as { weather: string }).weather).toBe('storm');
    s.hub.update(3.1);
    await settle();
    expect(heard()).toHaveLength(3); // the periodic repeat
    expect(s.world.weather.kind).toBe('storm'); // the hub only reads it
  });
});
