import { describe, expect, it } from 'vitest';
import { hintFor } from '../../../src/ui/tap-hints';

interface FakeEl {
  getAttribute(name: string): string | null;
  closest(selector: string): FakeEl | null;
}

/** a tiny stand-in for a DOM element: its own title, its parent, and whether it sits in the HUD area */
function el(title: string | null, inArea: boolean, parent?: FakeEl): FakeEl {
  const self: FakeEl = {
    getAttribute: (n) => (n === 'title' ? title : null),
    closest(sel) {
      if (sel === '[title]') return title ? self : parent ? parent.closest(sel) : null;
      return inArea ? self : null;
    },
  };
  return self;
}

describe('tap hints (M7)', () => {
  it('returns the title of the tapped element', () => {
    expect(hintFor(el('Income minus upkeep', true))).toBe('Income minus upkeep');
  });

  it('falls back to the nearest ancestor with a title', () => {
    const row = el('Share of the map you hold', true);
    expect(hintFor(el(null, true, row))).toBe('Share of the map you hold');
  });

  it('ignores taps outside the HUD and build bar, and elements with no title', () => {
    expect(hintFor(el('Somewhere else', false))).toBeNull();
    expect(hintFor(el(null, true))).toBeNull();
    expect(hintFor(null)).toBeNull();
  });
});
