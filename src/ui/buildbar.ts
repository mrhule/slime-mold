import type { BuildOption, BuildingType } from '../sim/types';

const NAMES: Record<BuildingType, string> = { storehouse: 'Factory', booster: 'Booster', harvester: 'Harvester' };
const SHORT: Record<BuildingType, string> = { storehouse: 'Factory', booster: 'Booster', harvester: 'Harvest' };
/** what each building does, for the button tooltip */
const BLURB: Record<BuildingType, string> = {
  storehouse: 'Keeps nearby veins alive and growing fast, holds more nutrients, and goo pools on the vein pay into it. Veins out of reach of a factory or your core fade and die. Click one to upgrade its range.',
  booster: 'Strengthens the whole vein it sits on in fights, fading with distance along the vein.',
  harvester: 'Place beside big food to absorb it faster (same total).',
};
/** hotkeys shown on the buttons and handled by the input controller */
export const BUILD_HOTKEYS: Record<string, BuildingType> = { f: 'storehouse', b: 'booster', m: 'harvester' };

const ICONS: Record<BuildingType, string> = {
  storehouse: '',
  booster: '',
  harvester: '',
};

// the same shapes as the map art: a pulse node, a digestor and a sac, drawn flat (the map ones move)
const BOOSTER_ICON = `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
    <ellipse cx="21" cy="33" rx="14" ry="3.2" fill="#14110f" opacity=".45"/>
    <g stroke="#14110f" stroke-width="2.4" stroke-linejoin="round">
      <polygon points="21,3 25,15 37,18 25,21 21,32 17,21 5,18 17,15" fill="#c9c27a"/>
      <polygon points="21,9 23.4,16 31,18 23.4,20 21,27 18.6,20 11,18 18.6,16" fill="#f5f2d2" stroke="none"/>
      <circle cx="21" cy="18" r="4.4" fill="#ffee4a"/>
      <circle cx="20" cy="17" r="1.5" fill="#ffffff" stroke="none"/>
    </g>
  </svg>`;
const HARVESTER_ICON = `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
    <ellipse cx="21" cy="33" rx="12" ry="3" fill="#14110f" opacity=".45"/>
    <g stroke="#14110f" stroke-linejoin="round" stroke-linecap="round" fill="none">
      <path d="M21 31 Q22 24 21 18" stroke-width="6.4"/>
      <path d="M21 31 Q22 24 21 18" stroke="#9ccc2e" stroke-width="3.4"/>
      <circle cx="21" cy="30" r="3.2" fill="#f2c744" stroke-width="2"/>
      <ellipse cx="21" cy="18" rx="8" ry="3.4" fill="#5c8a1a" stroke-width="2.4"/>
      <ellipse cx="21" cy="17.3" rx="5.6" ry="2" fill="#223a0c" stroke="none"/>
      <path d="M14.5 18 Q7 3 18 7" stroke-width="5.2"/>
      <path d="M14.5 18 Q7 3 18 7" stroke="#9ccc2e" stroke-width="2.6"/>
      <path d="M27.5 18 Q35 3 24 7" stroke-width="5.2"/>
      <path d="M27.5 18 Q35 3 24 7" stroke="#9ccc2e" stroke-width="2.6"/>
      <path d="M21 17 Q22 8 21 4" stroke-width="5.2"/>
      <path d="M21 17 Q22 8 21 4" stroke="#9ccc2e" stroke-width="2.6"/>
      <circle cx="18" cy="7" r="2" fill="#e3ff9c" stroke-width="1.8"/>
      <circle cx="24" cy="7" r="2" fill="#e3ff9c" stroke-width="1.8"/>
      <circle cx="21" cy="4" r="2" fill="#e3ff9c" stroke-width="1.8"/>
    </g>
  </svg>`;

const STOREHOUSE_ICON = `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
    <ellipse cx="21" cy="33" rx="16" ry="3.4" fill="#14110f" opacity=".45"/>
    <g stroke="#14110f" stroke-linecap="round" fill="none">
      <path d="M13 24 Q5 30 3 31 M18 25 Q16 31 16 31 M25 25 Q27 31 27 31 M29 24 Q36 30 38 31" stroke-width="4.4"/>
      <path d="M13 24 Q5 30 3 31 M18 25 Q16 31 16 31 M25 25 Q27 31 27 31 M29 24 Q36 30 38 31" stroke="#a8620c" stroke-width="1.8"/>
    </g>
    <g stroke="#14110f" stroke-width="2.4">
      <circle cx="9" cy="21" r="6" fill="#e8a21e"/>
      <circle cx="9" cy="21" r="3.6" fill="#ffcf3a" stroke="none" opacity=".7"/>
      <circle cx="32" cy="22" r="5.4" fill="#e8a21e"/>
      <circle cx="32" cy="22" r="3.2" fill="#ffcf3a" stroke="none" opacity=".7"/>
      <circle cx="21" cy="17" r="9.4" fill="#e8a21e"/>
      <circle cx="21" cy="17.5" r="5.8" fill="#ffcf3a" stroke="none" opacity=".8"/>
    </g>
    <path d="M14.5 12 A8 8 0 0 1 20 8" fill="none" stroke="#ffe9a0" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;

ICONS.storehouse = STOREHOUSE_ICON;
ICONS.booster = BOOSTER_ICON;
ICONS.harvester = HARVESTER_ICON;

/** Comic build bar (R19): one button per building, showing cost and count/limit. */
export class BuildBar {
  private readonly root: HTMLElement;
  private readonly buttons = new Map<BuildingType, HTMLButtonElement>();
  private readonly tooltip: HTMLElement;

  constructor(parent: HTMLElement, onSelect: (type: BuildingType) => void) {
    // touch mode: the bar is a modal list behind one Build button (CSS shows it only under `.touch`)
    parent.insertAdjacentHTML(
      'beforeend',
      '<button type="button" class="build-menu-btn" aria-haspopup="dialog">Build</button><div class="buildbar"><button type="button" class="build-close" aria-label="Close">&#10005;</button></div><div class="cursor-tip" hidden></div>',
    );
    this.root = parent.querySelector('.buildbar') as HTMLElement;
    this.tooltip = parent.querySelector('.cursor-tip') as HTMLElement;
    const open = parent.querySelector('.build-menu-btn') as HTMLElement;
    open.addEventListener('click', () => this.root.classList.add('open'));
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === this.root || target.closest('.build-close')) {
        this.root.classList.remove('open');
        return;
      }
      const btn = target.closest('button[data-building]') as HTMLButtonElement | null;
      if (btn) {
        this.root.classList.remove('open');
        onSelect(btn.dataset.building as BuildingType);
      }
    });
  }

  update(options: BuildOption[], selected: BuildingType | null): void {
    for (const opt of options) {
      let btn = this.buttons.get(opt.type);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.building = opt.type;
        const hotkey = Object.entries(BUILD_HOTKEYS).find(([, t]) => t === opt.type)?.[0] ?? '';
        btn.innerHTML = `<span class="key">${hotkey}</span>${ICONS[opt.type]}
          <span class="name">${SHORT[opt.type]}</span>
          <span class="fullname">${NAMES[opt.type]}</span>
          <span class="cost" data-f="cost"></span>
          <span class="count" data-f="count"></span>
          <span class="blurb">${BLURB[opt.type]}</span>`;
        this.root.appendChild(btn);
        this.buttons.set(opt.type, btn);
      }
      (btn.querySelector('[data-f="cost"]') as HTMLElement).textContent = `${opt.cost}`;
      (btn.querySelector('[data-f="count"]') as HTMLElement).textContent = `${opt.count}/${opt.limit}`;
      btn.classList.toggle('selected', selected === opt.type);
      const full = opt.count >= opt.limit;
      btn.classList.toggle('disabled', !opt.affordable || full);
      btn.title = `${NAMES[opt.type]}: ${BLURB[opt.type]} ${opt.upkeep}/s upkeep. Costs ${opt.cost}.${full ? ' Limit reached.' : !opt.affordable ? ' Not enough nutrients yet.' : ''}`;
    }
  }

  /** nudge the player toward one button (null clears it) */
  highlight(type: BuildingType | null): void {
    for (const [t, btn] of this.buttons) btn.classList.toggle('hint-pulse', t === type);
  }

  /** small tooltip that follows the cursor in placement mode; null hides it */
  showHint(text: string | null, x: number, y: number, ok: boolean): void {
    if (text === null) {
      this.tooltip.hidden = true;
      return;
    }
    this.tooltip.hidden = false;
    this.tooltip.textContent = text;
    this.tooltip.classList.toggle('bad', !ok);
    this.tooltip.style.left = `${x + 18}px`;
    this.tooltip.style.top = `${y + 18}px`;
  }
}
