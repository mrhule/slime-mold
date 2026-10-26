import { describe, expect, it } from 'vitest';
import { applyTouchClass, detectTouch, resolveTouch } from '../../../src/ui/touch-mode';

const media = (coarse: boolean, hover: boolean) => (q: string) => ({
  matches: q.includes('coarse') ? coarse : q.includes('hover: none') ? !hover : false,
});

describe('touch mode detection (M1)', () => {
  it('a phone (coarse pointer, no hover) is touch-first', () => {
    expect(detectTouch(media(true, false))).toBe(true);
  });

  it('a desktop (fine pointer, hover) is not', () => {
    expect(detectTouch(media(false, true))).toBe(false);
  });

  it('a touchscreen laptop with a mouse (fine pointer, hover) is not', () => {
    expect(detectTouch(media(false, true))).toBe(false);
    expect(detectTouch(media(true, true))).toBe(false);
  });

  it('is false where matchMedia is missing or throws', () => {
    expect(detectTouch(undefined)).toBe(false);
    expect(detectTouch(() => { throw new Error('no'); })).toBe(false);
  });

  it('on and off override detection either way; auto follows it', () => {
    expect(resolveTouch('on', false)).toBe(true);
    expect(resolveTouch('off', true)).toBe(false);
    expect(resolveTouch('auto', true)).toBe(true);
    expect(resolveTouch('auto', false)).toBe(false);
  });

  it('applyTouchClass toggles the touch class on the root', () => {
    const classes = new Set<string>();
    const root = { classList: { toggle: (n: string, f?: boolean) => { if (f) classes.add(n); else classes.delete(n); return !!f; } } };
    applyTouchClass(true, root);
    expect(classes.has('touch')).toBe(true);
    applyTouchClass(false, root);
    expect(classes.has('touch')).toBe(false);
  });
});
