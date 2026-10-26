import type { BuildOption, BuildingType } from '../sim/types';

const NAMES: Record<BuildingType, string> = { storehouse: 'Store House', booster: 'Booster Factory', harvester: 'Harvester' };
const SHORT: Record<BuildingType, string> = { storehouse: 'Store', booster: 'Booster', harvester: 'Harvest' };
/** what each building does, for the button tooltip */
const BLURB: Record<BuildingType, string> = {
  storehouse: 'Raises how many nutrients its vein can hold, and goo pools on the vein pay into it. Pools only pay with a store house on their vein.',
  booster: 'Strengthens the whole vein it sits on in fights, fading with distance along the vein.',
  harvester: 'Place beside big food to absorb it faster (same total).',
};
/** hotkeys shown on the buttons and handled by the input controller */
export const BUILD_HOTKEYS: Record<string, BuildingType> = { t: 'storehouse', b: 'booster', m: 'harvester' };

const ICONS: Record<BuildingType, string> = {
  storehouse: '',
  booster: '',
  harvester: '',
};

const BOOSTER_ICON = `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
    <ellipse cx="21" cy="32" rx="15" ry="3.4" fill="#14110f" opacity=".45"/>
    <g stroke="#14110f" stroke-width="2.4" stroke-linejoin="round">
      <rect x="24" y="6" width="6" height="14" fill="#4b4f53"/>
      <circle cx="28" cy="4" r="3.2" fill="#e8e6de"/>
      <rect x="8" y="14" width="24" height="16" rx="2" fill="#4b4f53"/>
      <rect x="10" y="16" width="20" height="8" fill="#7a7f84" stroke="none"/>
      <polygon points="19,16 14,24 19,23 16,30 26,21 21,22 24,16" fill="#ffd23a" stroke-width="1.8"/>
    </g>
  </svg>`;
const HARVESTER_ICON = `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
    <ellipse cx="21" cy="32" rx="14" ry="3.2" fill="#14110f" opacity=".45"/>
    <g stroke="#14110f" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M20 5 L9 30 M20 5 L31 30 M20 5 L20 31" fill="none" stroke-width="5"/>
      <path d="M20 5 L9 30 M20 5 L31 30 M20 5 L20 31" fill="none" stroke="#2f6a77" stroke-width="2"/>
      <path d="M20 5 V21" fill="none" stroke-width="1.8"/>
      <polygon points="14,21 26,21 24,28 16,28" fill="#4f9aa8"/>
      <circle cx="20" cy="5" r="3.2" fill="#f2c744"/>
    </g>
  </svg>`;

const STOREHOUSE_ICON = `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
    <ellipse cx="21" cy="32" rx="15" ry="3.4" fill="#14110f" opacity=".45"/>
    <g stroke="#14110f" stroke-width="2.4" stroke-linejoin="round">
      <rect x="23" y="12" width="11" height="18" rx="4" fill="#b8b9a8"/>
      <rect x="6" y="15" width="18" height="15" fill="#9a6a3a"/>
      <polygon points="4,16 15,5 26,16" fill="#a8432f"/>
      <rect x="11.5" y="21" width="7" height="9" fill="#5e3a1b"/>
    </g>
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
