/** The tutorial's prompt card: one short instruction, how far along the lessons are, and a way out. */
export class Coach {
  private readonly el: HTMLElement;
  private readonly text: HTMLElement;
  private readonly step: HTMLElement;
  private shown = '';

  constructor(root: HTMLElement, onSkip: () => void) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="panel coach" role="status" aria-live="polite" hidden>
        <div class="coach-head"><span class="coach-step"></span><button type="button" class="coach-skip" title="Turn the guide off">Skip guide</button></div>
        <div class="coach-text"></div>
      </div>`,
    );
    this.el = root.querySelector('.coach') as HTMLElement;
    this.text = this.el.querySelector('.coach-text') as HTMLElement;
    this.step = this.el.querySelector('.coach-step') as HTMLElement;
    (this.el.querySelector('.coach-skip') as HTMLElement).addEventListener('click', onSkip);
  }

  show(text: string, step: number, total: number): void {
    const key = `${step}/${total}:${text}`;
    if (key !== this.shown) {
      this.shown = key;
      this.text.textContent = text;
      this.step.textContent = `Guide ${step} of ${total}`;
    }
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
