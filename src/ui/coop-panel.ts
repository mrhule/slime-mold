import { UPGRADES } from '../../link/hero-upgrades';
import { COOP } from '../coop/config';
import type { CoopHub } from '../coop/hub';
import type { FrontInfo } from '../coop/fronts';
import { CELL } from '../render/units';

const STATE_TEXT = { solo: 'Co-op', hosting: 'Waiting', linked: 'Linked', dropped: 'Link lost' } as const;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/**
 * The co-op screens: a status pill, the lobby (host or join), and once a hero is linked the hero panel
 * (supplies, upgrades, fronts), the arena view for markers, and a pressure meter beside every front on the map.
 * Plain DOM that re-renders only when its text changes.
 */
export class CoopPanel {
  private readonly pill: HTMLButtonElement;
  private readonly lobby: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly arena: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly markerLayer: HTMLElement;
  private lobbyOpen = false;
  private lobbyKey = '';
  private panelKey = '';
  private markerKey = '';
  private upgradesOpen = false;
  private lastState = '';

  constructor(root: HTMLElement, private hub: CoopHub, private toScreen: (wx: number, wy: number) => [number, number]) {
    root.insertAdjacentHTML(
      'beforeend',
      `<button class="coop-pill" type="button" data-coop="pill"></button>
       <div class="panel coop-lobby" data-coop="lobby" hidden></div>
       <div class="panel coop-panel" data-coop="panel" hidden></div>
       <div class="panel coop-arena" data-coop="arena" hidden><div class="coop-arena-title">Arena: click to mark</div><canvas width="220" height="220"></canvas></div>
       <div class="coop-markers" data-coop="markers"></div>`,
    );
    const q = <T extends HTMLElement>(n: string): T => root.querySelector(`[data-coop="${n}"]`) as T;
    this.pill = q('pill');
    this.lobby = q('lobby');
    this.panel = q('panel');
    this.arena = q('arena');
    this.canvas = this.arena.querySelector('canvas') as HTMLCanvasElement;
    this.markerLayer = q('markers');

    this.pill.addEventListener('click', () => {
      this.lobbyOpen = !this.lobbyOpen;
      this.renderLobby();
    });
    this.lobby.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'host') void this.hub.host().catch(() => this.renderLobby(true));
      if (t.dataset.act === 'join') {
        const code = (this.lobby.querySelector('input') as HTMLInputElement).value;
        void this.hub.join(code).catch(() => this.renderLobby(true));
      }
      if (t.dataset.act === 'leave') this.hub.leave();
      if (t.dataset.act === 'close') this.lobbyOpen = false;
      this.renderLobby(true);
    });
    this.lobby.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing the code must not trigger the game's keys
      if (e.key === 'Enter') (this.lobby.querySelector('[data-act="join"]') as HTMLElement | null)?.click();
    });
    this.panel.addEventListener('click', (e) => this.onAction(e.target as HTMLElement));
    this.markerLayer.addEventListener('click', (e) => this.onAction(e.target as HTMLElement));
    this.canvas.addEventListener('pointerdown', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.hub.mark(((e.clientX - r.left) / r.width) * COOP.arena, ((e.clientY - r.top) / r.height) * COOP.arena);
    });
    hub.onChange(() => this.render());
    this.render();
  }

  private onAction(target: HTMLElement): void {
    const t = target.closest<HTMLElement>('[data-act]');
    if (!t) return;
    const id = t.dataset.id ?? '';
    switch (t.dataset.act) {
      case 'upgrade': this.hub.buyUpgrade(id); break;
      case 'heal': this.hub.buySupply('heal'); break;
      case 'mana': this.hub.buySupply('mana'); break;
      case 'deploy': this.hub.deploy(id); break;
      case 'recall': this.hub.recall(); break;
      case 'toggle-ups': this.upgradesOpen = !this.upgradesOpen; break;
    }
    this.render(true);
  }

  render(force = false): void {
    const linked = this.hub.link.state;
    // the lobby gets out of the way once the hero is in, and comes back with the pill
    if (linked === 'linked' && this.lastState !== 'linked') this.lobbyOpen = false;
    this.lastState = linked;
    this.pill.textContent = linked === 'solo' ? STATE_TEXT.solo : `${STATE_TEXT[linked]} ${this.hub.link.code ?? ''}`.trim();
    this.pill.dataset.state = linked;
    this.renderLobby(force);
    this.renderPanel(force);
  }

  private renderLobby(force = false): void {
    const { link } = this.hub;
    const html = !this.lobbyOpen
      ? ''
      : link.state === 'solo'
        ? `<div class="coop-title">Co-op with a hero</div>
           <p>Play Slime Mold: Hero on another device, then host a room here and join it with the code, or join the hero's room.</p>
           <div class="coop-row"><button class="btn" data-act="host">Host a room</button></div>
           <div class="coop-row"><input maxlength="4" placeholder="CODE" autocomplete="off" aria-label="Room code" /><button class="btn" data-act="join">Join</button></div>
           ${link.error ? `<p class="coop-error">${esc(link.error)}</p>` : ''}
           <button class="coop-x" data-act="close">Close</button>`
        : `<div class="coop-title">${link.state === 'hosting' ? 'Waiting for the hero' : link.state === 'linked' ? 'Hero linked' : 'Link lost, trying to come back'}</div>
           <div class="coop-code">${esc(link.code ?? '')}</div>
           <p>${link.state === 'hosting' ? 'In Slime Mold: Hero, join this code.' : 'Share this code to add another device.'}</p>
           <div class="coop-row"><button class="btn" data-act="leave">Leave</button><button class="coop-x" data-act="close">Close</button></div>`;
    if (!force && html === this.lobbyKey) return;
    this.lobbyKey = html;
    const hadFocus = this.lobby.contains(document.activeElement);
    const typed = (this.lobby.querySelector('input') as HTMLInputElement | null)?.value ?? '';
    this.lobby.hidden = html === '';
    this.lobby.innerHTML = html;
    const input = this.lobby.querySelector('input') as HTMLInputElement | null;
    if (input) {
      input.value = typed;
      if (hadFocus) input.focus();
    }
  }

  private renderPanel(force = false): void {
    const hub = this.hub;
    const show = hub.linked;
    const hero = hub.hero;
    const d = hub.deployed;
    let html = '';
    if (show) {
      const stock = Math.floor(hub.stock);
      const bar = (cls: string, v: number, max: number, text: string): string =>
        `<div class="coop-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i><span>${text}</span></div>`;
      const heroHtml = hero
        ? `${bar('hp', hero.hp, hero.maxHp, `HP ${hero.hp} / ${hero.maxHp}`)}${bar('mana', hero.mana, hero.maxMana, `Mana ${hero.mana} / ${hero.maxMana}`)}
           <div class="coop-row">
             <button class="btn" data-act="heal" ${stock < COOP.supply.heal.cost ? 'disabled' : ''}>${COOP.supply.heal.label} · ${COOP.supply.heal.cost}</button>
             <button class="btn" data-act="mana" ${stock < COOP.supply.mana.cost ? 'disabled' : ''}>${COOP.supply.mana.label} · ${COOP.supply.mana.cost}</button>
           </div>`
        : '<p>Waiting for the hero…</p>';
      const upgrades = hero && this.upgradesOpen
        ? `<div class="coop-ups">${UPGRADES.map((u) => {
            const price = hub.upgradePrice(u.id);
            return `<div class="coop-up" title="${esc(u.blurb)}"><span>${u.icon} ${esc(u.name)} <small>${hub.upgradeLevel(u.id)}/${u.max}</small></span><button class="btn" data-act="upgrade" data-id="${u.id}" ${price === null || stock < price ? 'disabled' : ''}>${price === null ? 'MAX' : price}</button></div>`;
          }).join('')}</div>`
        : '';
      const fronts = hub.fronts.length
        ? hub.fronts.map((f) => this.frontRow(f)).join('')
        : '<p>No front yet: grow your veins until they touch a rival.</p>';
      html = `<div class="coop-title">Hero · <span class="coop-nut">${stock} nutrients</span></div>
        ${heroHtml}
        <button class="coop-x" data-act="toggle-ups">${this.upgradesOpen ? 'Hide upgrades' : 'Upgrades'}</button>${upgrades}
        <div class="coop-title">Fronts</div>${fronts}`;
    }
    if (force || html !== this.panelKey) {
      this.panelKey = html;
      this.panel.hidden = html === '';
      this.panel.innerHTML = html;
    }
    this.arena.hidden = !(show && d);
    if (show && d) this.drawArena();
  }

  private pressureOf(f: FrontInfo): number {
    const d = this.hub.deployed;
    return d && d.id === f.id && d.progress ? d.progress.pressure : f.pressure;
  }

  private frontRow(f: FrontInfo): string {
    const hub = this.hub;
    const mine = hub.deployed?.id === f.id;
    const p = this.pressureOf(f);
    const pool = mine && hub.deployed?.progress ? Math.round(hub.deployed.progress.pool * 100) : 100;
    const btn = mine
      ? '<button class="btn" data-act="recall">Recall</button>'
      : `<button class="btn" data-act="deploy" data-id="${f.id}" ${hub.deployed ? 'disabled' : ''}>Send hero</button>`;
    return `<div class="coop-front ${p >= COOP.dangerPressure ? 'danger' : ''}">
      <span class="coop-fid">${mine ? '🦸 ' : ''}${f.id}</span>
      <div class="coop-meter" title="Pressure ${Math.round(p * 100)}%: right is the rival's side"><i style="width:${Math.round(p * 100)}%"></i><b style="width:${pool}%"></b></div>
      ${btn}</div>`;
  }

  /** the little dish the markers are placed on */
  private drawArena(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const s = this.canvas.width;
    ctx.clearRect(0, 0, s, s);
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2);
    ctx.fillStyle = '#2a3322';
    ctx.fill();
    ctx.strokeStyle = '#6f7a55';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    for (const m of this.hub.markers) {
      ctx.beginPath();
      ctx.arc((m.x / COOP.arena) * s, (m.y / COOP.arena) * s, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** every frame: keep the pressure meters on the map beside their fronts */
  layout(): void {
    const hub = this.hub;
    const key = hub.linked ? hub.fronts.map((f) => `${f.id}:${Math.round(this.pressureOf(f) * 20)}:${hub.deployed?.id === f.id ? 1 : 0}:${hub.deployed?.progress ? Math.round(hub.deployed.progress.pool * 20) : 20}`).join('|') : '';
    if (key !== this.markerKey) {
      this.markerKey = key;
      this.markerLayer.innerHTML = hub.linked
        ? hub.fronts
            .map((f) => {
              const mine = hub.deployed?.id === f.id;
              const p = this.pressureOf(f);
              const pool = mine && hub.deployed?.progress ? Math.round(hub.deployed.progress.pool * 100) : 100;
              return `<div class="coop-marker ${p >= COOP.dangerPressure ? 'danger' : ''} ${mine ? 'mine' : ''}" data-front="${f.id}" data-act="${mine ? 'recall' : hub.deployed ? '' : 'deploy'}" data-id="${f.id}" title="${f.id}: pressure ${Math.round(p * 100)}%. Click to ${mine ? 'recall the hero' : 'send the hero'}">
                <span class="coop-mhead">${mine ? '🦸' : '⚔'} ${f.id}</span>
                <span class="coop-meter"><i style="width:${Math.round(p * 100)}%"></i><b style="width:${pool}%"></b></span></div>`;
            })
            .join('')
        : '';
    }
    if (!hub.linked) return;
    for (const el of Array.from(this.markerLayer.children) as HTMLElement[]) {
      const f = hub.fronts.find((x) => x.id === el.dataset.front);
      if (!f) continue;
      const [sx, sy] = this.toScreen(f.cx * CELL + CELL / 2, f.cy * CELL + CELL / 2);
      el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -140%)`;
    }
  }
}
