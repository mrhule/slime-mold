export interface DebugStats {
  fps: number;
  tickMs: number;
  ticksPerFrame: number;
  droppedTicks: number;
  seed: number;
  round: number;
  tick: number;
  /** extra lines, e.g. per-rival AI info */
  extra?: string[];
}

/** Developer overlay: toggled with the backtick key, or open from the start with `?debug`. Dev builds only. */
export class DebugOverlay {
  private readonly el: HTMLElement;
  private visible: boolean;

  constructor(parent: HTMLElement, startVisible: boolean) {
    parent.insertAdjacentHTML('beforeend', '<pre class="debug" hidden></pre>');
    this.el = parent.querySelector('.debug') as HTMLElement;
    this.visible = startVisible;
    this.el.hidden = !startVisible;
    window.addEventListener('keydown', (e) => {
      if (e.key === '`') this.toggle();
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
  }

  update(s: DebugStats): void {
    if (!this.visible) return;
    const lines = [
      `fps ${s.fps.toFixed(0)}   tick ${s.tickMs.toFixed(2)} ms   ticks/frame ${s.ticksPerFrame}   dropped ${s.droppedTicks}`,
      `seed ${s.seed}   round ${s.round}   tick #${s.tick}`,
      ...(s.extra ?? []),
    ];
    this.el.textContent = lines.join('\n');
  }
}
