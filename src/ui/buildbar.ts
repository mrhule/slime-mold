import type { BuildOption, BuildingType } from '../sim/types';

const NAMES: Record<BuildingType, string> = { farm: 'Nutrient Farm', storehouse: 'Store House', booster: 'Booster Factory', harvester: 'Harvester' };
const SHORT: Record<BuildingType, string> = { farm: 'Farm', storehouse: 'Store', booster: 'Booster', harvester: 'Harvest' };
/** what each building does, for the button tooltip */
const BLURB: Record<BuildingType, string> = {
  farm: 'Slow, steady nutrient income. Only on fertile ground, and only pays with a store house on its vein.',
  storehouse: 'Raises how many nutrients its vein can hold, and farms on the vein pay into it.',
  booster: 'Strengthens the whole vein it sits on in fights, fading with distance along the vein.',
  harvester: 'Place beside big food to absorb it faster (same total).',
};
/** hotkeys shown on the buttons and handled by the input controller */
export const BUILD_HOTKEYS: Record<string, BuildingType> = { f: 'farm', t: 'storehouse', b: 'booster', m: 'harvester' };

const ICONS: Record<BuildingType, string> = {
  storehouse: '',
  booster: '',
  harvester: '',
  farm: `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true">
    <ellipse cx="21" cy="31" rx="15" ry="4" fill="#14110f" opacity=".45"/>
    <g stroke="#14110f" stroke-width="2.4" stroke-linejoin="round">
      <rect x="8.5" y="14" width="3.6" height="10" rx="1.4" fill="#fff6dc"/>
      <ellipse cx="10.3" cy="13" rx="6.2" ry="4.6" fill="#f2c744"/>
      <rect x="19" y="9" width="3.8" height="14" rx="1.4" fill="#fff6dc"/>
      <ellipse cx="20.9" cy="8" rx="7.2" ry="5.2" fill="#f2c744"/>
      <rect x="29" y="15" width="3.4" height="9" rx="1.4" fill="#fff6dc"/>
      <ellipse cx="30.7" cy="14" rx="5.8" ry="4.3" fill="#f2c744"/>
      <ellipse cx="20" cy="26" rx="15" ry="8" fill="#5e3a1b"/>
      <ellipse cx="20" cy="24.4" rx="15" ry="6.6" fill="#8a5a2b"/>
    </g>
    <ellipse cx="14" cy="22.6" rx="5" ry="1.6" fill="#c58a4e"/>
  </svg>`,
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
    parent.insertAdjacentHTML('beforeend', '<div class="buildbar"></div><div class="cursor-tip" hidden></div>');
    this.root = parent.querySelector('.buildbar') as HTMLElement;
    this.tooltip = parent.querySelector('.cursor-tip') as HTMLElement;
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-building]') as HTMLButtonElement | null;
      if (btn) onSelect(btn.dataset.building as BuildingType);
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
          <span class="cost" data-f="cost"></span>
          <span class="count" data-f="count"></span>`;
        this.root.appendChild(btn);
        this.buttons.set(opt.type, btn);
      }
      (btn.querySelector('[data-f="cost"]') as HTMLElement).textContent = `${opt.cost}`;
      (btn.querySelector('[data-f="count"]') as HTMLElement).textContent = `${opt.count}/${opt.limit}`;
      btn.classList.toggle('selected', selected === opt.type);
      const full = opt.count >= opt.limit;
      btn.classList.toggle('disabled', !opt.affordable || full);
      const income = opt.income !== undefined ? `+${opt.income}/s income, ` : '';
      btn.title = `${NAMES[opt.type]}: ${BLURB[opt.type]} ${income}${opt.upkeep}/s upkeep. Costs ${opt.cost}.${full ? ' Limit reached.' : !opt.affordable ? ' Not enough nutrients yet.' : ''}`;
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
