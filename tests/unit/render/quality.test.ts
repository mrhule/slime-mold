import { describe, expect, it } from 'vitest';
import { QualityGovernor } from '../../../src/render/quality';
import { style } from '../../../src/render/style';

const g = style.governor;

/** feed `seconds` of frames at `fps`, 60 frames per second of wall time steps */
function run(gov: QualityGovernor, seconds: number, fps: number, setting: 'auto' | 'high' | 'low' = 'auto'): void {
  const dt = 1 / 20;
  for (let t = 0; t < seconds; t += dt) gov.update(dt, fps, setting);
}

describe('QualityGovernor (A14)', () => {
  it('starts on high', () => {
    expect(new QualityGovernor().level).toBe('high');
  });

  it('drops after sustained low fps, not after a single slow frame', () => {
    const gov = new QualityGovernor();
    gov.update(0.5, 10, 'auto'); // one terrible frame
    expect(gov.level).toBe('high');
    run(gov, 1, 60); // the next frames are fine, which resets the clock
    run(gov, g.dropSeconds - 0.5, g.dropFps - 10);
    expect(gov.level).toBe('high');
    run(gov, 1, g.dropFps - 10);
    expect(gov.level).toBe('low');
  });

  it('recovers only after sustained high fps', () => {
    const gov = new QualityGovernor();
    run(gov, g.dropSeconds + 1, 20);
    expect(gov.level).toBe('low');
    run(gov, g.raiseSeconds - 2, 60);
    expect(gov.level).toBe('low');
    run(gov, 3, 60);
    expect(gov.level).toBe('high');
  });

  it('pinned settings ignore the frame rate', () => {
    const gov = new QualityGovernor();
    run(gov, 30, 5, 'high');
    expect(gov.level).toBe('high');
    run(gov, 30, 120, 'low');
    expect(gov.level).toBe('low');
    run(gov, 30, 120, 'high');
    expect(gov.level).toBe('high');
  });

  it('switching back to auto starts counting from scratch', () => {
    const gov = new QualityGovernor();
    run(gov, 5, 10, 'high');
    expect(gov.level).toBe('high');
    gov.update(0.05, 10, 'auto');
    expect(gov.level).toBe('high');
  });

  it('a rate hovering between the thresholds never flips', () => {
    const gov = new QualityGovernor();
    const levels = new Set<string>();
    const dt = 1 / 20;
    for (let t = 0; t < 120; t += dt) {
      // alternate just under the drop line and just over the raise line every second or so
      const fps = Math.floor(t) % 2 === 0 ? g.dropFps - 1 : g.raiseFps + 1;
      gov.update(dt, fps, 'auto');
      levels.add(gov.level);
    }
    expect(levels.size).toBe(1);
    expect([...levels][0]).toBe('high');
  });

  it('does not flip repeatedly once low while fps sits near the raise line', () => {
    const gov = new QualityGovernor();
    run(gov, g.dropSeconds + 1, 20);
    expect(gov.level).toBe('low');
    let flips = 0;
    let last = gov.level;
    const dt = 1 / 20;
    for (let t = 0; t < 60; t += dt) {
      gov.update(dt, g.raiseFps - 1, 'auto');
      if (gov.level !== last) flips++;
      last = gov.level;
    }
    expect(flips).toBe(0);
  });
});
