import { UPGRADES } from '../../link/hero-upgrades';
import { defaultPeer, joinUrl, relayHost, savePeer } from '../coop/address';
import { COOP } from '../coop/config';
import { qrSvg } from '../coop/qr';
import type { CoopHub, PairInfo } from '../coop/hub';
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
  /** the live arena view: shown while a picture of it keeps arriving and the player has it open */
  private viewOpen = false;
  private follow = true;
  private tool: 'marker' | 'strike' | 'wall' | 'turret' = 'marker';
  private lastDeployed: string | null = null;

  constructor(root: HTMLElement, private hub: CoopHub, private toScreen: (wx: number, wy: number) => [number, number]) {
    root.insertAdjacentHTML(
      'beforeend',
      `<button class="coop-pill" type="button" data-coop="pill"></button>
       <div class="panel coop-lobby" data-coop="lobby" hidden></div>
       <div class="panel coop-panel" data-coop="panel" hidden></div>
       <div class="panel coop-arena" data-coop="arena" hidden>
         <div class="coop-arena-head"><span class="coop-arena-title" data-v="title">Live view</span><span><button class="coop-x" data-v="zoom">Whole dish</button> <button class="coop-x" data-v="close">Close</button></span></div>
         <canvas width="300" height="300"></canvas>
         <div class="coop-tools">
           <button class="btn" data-tool="marker">Marker</button>
           <button class="btn" data-tool="strike" data-v="strike">Strike</button>
           <button class="btn" data-tool="wall" data-v="wall">Wall</button>
           <button class="btn" data-tool="turret" data-v="turret">Turret</button>
         </div>
         <div class="coop-arena-note" data-v="note"></div>
       </div>
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
        const code = (this.lobby.querySelector('input:not(.coop-peer)') as HTMLInputElement).value;
        void this.hub.join(code).catch(() => this.renderLobby(true));
      }
      const pairText = (): string => (this.lobby.querySelector('#pairIn') as HTMLTextAreaElement | null)?.value ?? '';
      if (t.dataset.act === 'leave') this.hub.leave();
      if (t.dataset.act === 'pair-host') void this.hub.pairHost();
      if (t.dataset.act === 'pair-join-start') this.hub.pairJoinStart();
      if (t.dataset.act === 'pair-accept') void this.hub.pairAccept(pairText());
      if (t.dataset.act === 'pair-join') void this.hub.pairJoin(pairText());
      if (t.dataset.act === 'pair-cancel') this.hub.pairCancel();
      if (t.dataset.act === 'pair-copy') {
        const box = this.lobby.querySelector('#pairOut') as HTMLTextAreaElement | null;
        if (box) {
          box.select();
          void navigator.clipboard?.writeText(box.value).catch(() => document.execCommand('copy'));
        }
        return;
      }
      if (t.dataset.act === 'close') this.lobbyOpen = false;
      this.renderLobby(true);
    });
    this.lobby.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.classList.contains('coop-peer')) return;
      savePeer(t.value.trim());
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
      const [x, y] = this.fromCanvas(((e.clientX - r.left) / r.width) * this.canvas.width, ((e.clientY - r.top) / r.height) * this.canvas.height);
      if (this.tool === 'marker') this.hub.mark(x, y);
      else if (this.tool === 'strike') this.hub.strike(x, y);
      else this.hub.defend(this.tool, x, y);
    });
    this.arena.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const tool = t.closest<HTMLElement>('[data-tool]')?.dataset.tool;
      if (tool) this.tool = tool as typeof this.tool;
      const v = t.closest<HTMLElement>('[data-v]')?.dataset.v;
      if (v === 'zoom') this.follow = !this.follow;
      if (v === 'close') this.viewOpen = false;
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
      case 'view': this.viewOpen = true; break;
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
    const html = this.hub.pair
      ? this.pairHtml(this.hub.pair)
      : !this.lobbyOpen
      ? ''
      : link.state === 'solo'
        ? `<div class="coop-title">Co-op with a hero</div>
           <p>Play Slime Mold: Hero on another device, then host a room here and join it with the code, or join the hero's room.</p>
           <div class="coop-row"><button class="btn" data-act="host">Host a room</button></div>
           <div class="coop-row"><input maxlength="4" placeholder="CODE" autocomplete="off" aria-label="Room code" /><button class="btn" data-act="join">Join</button></div>
           <p>No server on this network? Pair by copy and paste.</p>
           <div class="coop-row"><button class="btn" data-act="pair-host">Host by paste</button><button class="btn" data-act="pair-join-start">Join by paste</button></div>
           ${link.error ? `<p class="coop-error">${esc(link.error)}</p>` : ''}
           <button class="coop-x" data-act="close">Close</button>`
        : `<div class="coop-title">${link.state === 'hosting' ? 'Waiting for the hero' : link.state === 'linked' ? 'Hero linked' : 'Link lost, trying to come back'}</div>
           <div class="coop-code">${esc(link.code ?? '')}</div>
           ${link.state === 'hosting' ? this.qrHtml(link.code ?? '') : '<p>Share this code to add another device.</p>'}
           <div class="coop-row"><button class="btn" data-act="leave">Leave</button><button class="coop-x" data-act="close">Close</button></div>`;
    if (!force && html === this.lobbyKey) return;
    this.lobbyKey = html;
    const hadFocus = this.lobby.contains(document.activeElement);
    const typed = (this.lobby.querySelector('input:not(.coop-peer)') as HTMLInputElement | null)?.value ?? '';
    const pasted = (this.lobby.querySelector('#pairIn') as HTMLTextAreaElement | null)?.value ?? '';
    this.lobby.hidden = html === '';
    this.lobby.innerHTML = html;
    const input = this.lobby.querySelector('input:not(.coop-peer)') as HTMLInputElement | null;
    if (input) {
      input.value = typed;
      if (hadFocus) input.focus();
    }
    const pasteBox = this.lobby.querySelector('#pairIn') as HTMLTextAreaElement | null;
    if (pasteBox) pasteBox.value = pasted;
  }

  /** a QR code that opens the hero game and joins this room on this machine's relay, with the code and the address it points at */
  private qrHtml(code: string): string {
    const peer = defaultPeer();
    const url = joinUrl(peer, code, relayHost());
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    return `<p>Scan with the other device's camera, or in Slime Mold: Hero join this code.</p>
      ${url ? `<div class="coop-qr">${qrSvg(url)}</div>` : ''}
      ${local ? '<p class="coop-error">This page is open as localhost, so another device cannot reach it. Open it by the network address of this computer instead.</p>' : ''}
      <label>Other game's address <input class="coop-peer" value="${esc(peer)}" spellcheck="false" autocapitalize="off" /></label>`;
  }

  /** the paste-pairing steps: the host sends a block and takes a reply, the guest does the opposite */
  private pairHtml(p: PairInfo): string {
    const out = (label: string, text: string): string =>
      `<p>${label}</p><textarea id="pairOut" readonly rows="4">${esc(text)}</textarea><button class="btn" data-act="pair-copy">Copy</button>`;
    let body: string;
    if (p.mode === 'host') {
      body = p.offer
        ? `${out('1. Send this to the other device, any way you like.', p.offer)}<p>2. Paste the reply it gives you.</p><textarea id="pairIn" rows="3" placeholder="Paste the reply" spellcheck="false"></textarea><button class="btn" data-act="pair-accept" ${p.busy ? 'disabled' : ''}>Connect</button>`
        : '<p>Preparing…</p>';
    } else if (p.answer) {
      body = `${out('Send this reply back to the host. It connects when they paste it.', p.answer)}<p>Waiting for the host…</p>`;
    } else {
      body = `<p>Paste the block from the host device.</p><textarea id="pairIn" rows="4" placeholder="Paste the host block" spellcheck="false"></textarea><button class="btn" data-act="pair-join" ${p.busy ? 'disabled' : ''}>Make reply</button>`;
    }
    return `<div class="coop-title">Pair by paste</div>${body}${p.error ? `<p class="coop-error">${esc(p.error)}</p>` : ''}<button class="coop-x" data-act="pair-cancel">Cancel</button>`;
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
        ? `<p class="coop-status">${d ? `Fighting at ${d.id}` : hero.roaming ? 'Roaming: harvesting nutrients for you' : 'Waiting at base'} <button class="coop-x" data-act="view">Watch live</button></p>${bar('hp', hero.hp, hero.maxHp, `HP ${hero.hp} / ${hero.maxHp}`)}${bar('mana', hero.mana, hero.maxMana, `Mana ${hero.mana} / ${hero.maxMana}`)}
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
    // sending the hero to a front opens its live view
    if (d?.id !== this.lastDeployed) {
      this.lastDeployed = d?.id ?? null;
      if (d) this.viewOpen = true;
    }
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

  /** the arena view's window: following the hero closely, or the whole dish */
  private window(): { cx: number; cy: number; size: number } {
    const v = this.hub.arena;
    return this.follow && v ? { cx: v.hero.x, cy: v.hero.y, size: 900 } : { cx: COOP.arena / 2, cy: COOP.arena / 2, size: COOP.arena };
  }

  private toCanvas(x: number, y: number): [number, number] {
    const w = this.window();
    const k = this.canvas.width / w.size;
    return [(x - w.cx) * k + this.canvas.width / 2, (y - w.cy) * k + this.canvas.height / 2];
  }

  private fromCanvas(px: number, py: number): [number, number] {
    const w = this.window();
    const k = this.canvas.width / w.size;
    return [Math.round((px - this.canvas.width / 2) / k + w.cx), Math.round((py - this.canvas.height / 2) / k + w.cy)];
  }

  /** the live picture of the arena the hero is fighting in (or roaming), drawn every frame from the latest report */
  private drawArena(): void {
    const ctx = this.canvas.getContext('2d');
    const v = this.hub.arena;
    if (!ctx || !v) return;
    const s = this.canvas.width;
    const k = s / this.window().size;
    ctx.clearRect(0, 0, s, s);
    const [dx, dy] = this.toCanvas(COOP.arena / 2, COOP.arena / 2);
    ctx.beginPath();
    ctx.arc(dx, dy, (COOP.arena / 2) * k, 0, Math.PI * 2);
    ctx.fillStyle = '#2a3322';
    ctx.fill();
    ctx.strokeStyle = '#6f7a55';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#4b5239';
    for (const [x, y, r] of this.hub.obstacles) {
      const [px, py] = this.toCanvas(x as number, y as number);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, (r as number) * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7bd24a';
    for (const [x, y] of v.drops) {
      const [px, py] = this.toCanvas(x as number, y as number);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [kind, x, y, hp] of v.defenses) {
      const [px, py] = this.toCanvas(x as number, y as number);
      ctx.globalAlpha = 0.4 + 0.6 * Math.max(0, Math.min(1, (hp as number) / 100));
      ctx.fillStyle = kind === 1 ? '#5aa0e6' : '#c9b27a';
      if (kind === 1) {
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(px - 8, py - 8, 16, 16);
      ctx.globalAlpha = 1;
    }
    for (const [x, y, kind, hp] of v.enemies) {
      const [px, py] = this.toCanvas(x as number, y as number);
      ctx.fillStyle = `hsl(${(((kind as number) * 67) % 360 + 360) % 360} 65% ${35 + 25 * Math.max(0, Math.min(1, (hp as number) / 100))}%)`;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 2;
    for (const [x, y, r, progress] of v.strikes) {
      const [px, py] = this.toCanvas(x as number, y as number);
      ctx.strokeStyle = '#e0432a';
      ctx.beginPath();
      ctx.arc(px, py, (r as number) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, (r as number) * k * Math.max(0, Math.min(1, (progress as number) / 100)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd23f';
    for (const [x, y] of v.markers.length ? v.markers : this.hub.markers.map((m) => [m.x, m.y])) {
      const [px, py] = this.toCanvas(x as number, y as number);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const [hx, hy] = this.toCanvas(v.hero.x, v.hero.y);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(v.hero.aim) * 16, hy + Math.sin(v.hero.aim) * 16);
    ctx.stroke();
    ctx.fillStyle = '#f2c744';
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#11140e';
    ctx.fillRect(hx - 14, hy - 16, 28, 4);
    ctx.fillStyle = '#d8503a';
    ctx.fillRect(hx - 14, hy - 16, 28 * Math.max(0, Math.min(1, v.hero.hp / v.maxHp)), 4);
  }

  /** show or hide the live view and keep its tool buttons current; runs every frame so a view that stops arriving goes away */
  private updateArena(): void {
    const hub = this.hub;
    const show = hub.linked && this.viewOpen && hub.arenaFresh();
    this.arena.hidden = !show;
    if (!show) return;
    const q = (n: string): HTMLElement => this.arena.querySelector(`[data-v="${n}"]`) as HTMLElement;
    const stock = hub.stock;
    const cd = hub.strikeCooldown;
    const strike = q('strike') as HTMLButtonElement;
    strike.textContent = cd > 0 ? `Strike ${Math.ceil(cd)}s` : `Strike · ${COOP.strike.cost}`;
    strike.disabled = cd > 0 || stock < COOP.strike.cost;
    (q('wall') as HTMLButtonElement).textContent = `Wall · ${COOP.defense.wallCost}`;
    (q('turret') as HTMLButtonElement).textContent = `Turret · ${COOP.defense.turretCost}`;
    (q('wall') as HTMLButtonElement).disabled = stock < COOP.defense.wallCost;
    (q('turret') as HTMLButtonElement).disabled = stock < COOP.defense.turretCost;
    for (const b of Array.from(this.arena.querySelectorAll<HTMLElement>('[data-tool]'))) b.classList.toggle('on', b.dataset.tool === this.tool);
    q('title').textContent = hub.arena?.front ? `Live view · ${hub.arena.front}` : 'Live view · roaming';
    q('zoom').textContent = this.follow ? 'Whole dish' : 'Follow hero';
    q('note').textContent = `${hub.arena?.defenses.length ?? 0} / ${COOP.defense.max} defenses · ${Math.floor(stock)} nutrients`;
    this.drawArena();
  }

  /** every frame: keep the pressure meters on the map beside their fronts */
  layout(): void {
    const hub = this.hub;
    this.updateArena();
    const key = hub.linked ? hub.fronts.map((f) => `${f.id}:${Math.round(this.pressureOf(f) * 20)}:${hub.deployed?.id === f.id ? 1 : 0}:${hub.deployed?.progress ? Math.round(hub.deployed.progress.pool * 20) : 20}`).join('|') : '';
    if (key !== this.markerKey) {
      this.markerKey = key;
      this.markerLayer.innerHTML = hub.linked
        ? hub.fronts
            .map((f) => {
              const mine = hub.deployed?.id === f.id;
              const p = this.pressureOf(f);
              const pool = mine && hub.deployed?.progress ? Math.round(hub.deployed.progress.pool * 100) : 100;
              return `<div class="coop-marker ${p >= COOP.dangerPressure ? 'danger' : ''} ${mine ? 'mine' : ''}" data-front="${f.id}" data-act="${mine ? 'view' : hub.deployed ? '' : 'deploy'}" data-id="${f.id}" title="${f.id}: pressure ${Math.round(p * 100)}%. Click to ${mine ? 'watch the hero live' : 'send the hero'}">
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
