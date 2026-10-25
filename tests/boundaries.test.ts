import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function importsOf(src: string): string[] {
  const found: string[] = [];
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of src.matchAll(re)) found.push((m[1] ?? m[2] ?? m[3]) as string);
  return found;
}

const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('import boundaries (Constitution I, II)', () => {
  const simFiles = files(join(root, 'src', 'sim'));

  it('finds the sim sources', () => {
    expect(simFiles.length).toBeGreaterThan(5);
  });

  it('src/sim is pure: no pixi, render, ui, game, or DOM', () => {
    for (const f of simFiles) {
      const src = strip(readFileSync(f, 'utf8'));
      const rel = relative(root, f);
      for (const imp of importsOf(src)) {
        expect(imp, `${rel} imports ${imp}`).not.toMatch(/pixi|\/render|\/ui|\/game|^\.\.\/(render|ui|game)/);
      }
      expect(src, `${rel} touches the DOM`).not.toMatch(/\b(window|document|navigator|localStorage|requestAnimationFrame)\b/);
      expect(src, `${rel} uses Math.random`).not.toMatch(/Math\.random/);
      expect(src, `${rel} uses non-reproducible math`).not.toMatch(/Math\.(sin|cos|tan|pow|exp|log|atan2?|hypot)\b/);
    }
  });

  it('src/sim/ai only sees the view, commands, and rng', () => {
    const aiFiles = simFiles.filter((f) => relative(root, f).replace(/\\/g, '/').startsWith('src/sim/ai/'));
    const allowed = /^\.\.\/(types|rng|view|grid)$|^\.\/[\w-]+$/;
    for (const f of aiFiles) {
      for (const imp of importsOf(strip(readFileSync(f, 'utf8')))) {
        expect(imp, `${relative(root, f)} imports ${imp}`).toMatch(allowed);
      }
    }
  });

  it('nothing in src/sim imports src/audio (or render, ui, game)', () => {
    for (const f of simFiles) {
      for (const imp of importsOf(strip(readFileSync(f, 'utf8')))) {
        expect(imp, `${relative(root, f)} imports ${imp}`).not.toMatch(/audio/);
      }
    }
  });

  it('src/audio imports only sim types, the sim entry point (types), and other audio files', () => {
    const audioDir = join(root, 'src', 'audio');
    let exists = true;
    try {
      statSync(audioDir);
    } catch {
      exists = false;
    }
    if (!exists) return;
    const allowed = /^\.\.\/sim\/(types|index)$|^\.\/[\w-]+$/;
    for (const f of files(audioDir)) {
      const src = strip(readFileSync(f, 'utf8'));
      for (const imp of importsOf(src)) {
        expect(imp, `${relative(root, f)} imports ${imp}`).toMatch(allowed);
        expect(imp, `${relative(root, f)} imports pixi, render, ui or game code`).not.toMatch(/pixi|\/render|\/ui|\/game/);
      }
    }
  });

  it('render only reads the sim through its public entry points', () => {
    const renderDir = join(root, 'src', 'render');
    let exists = true;
    try {
      statSync(renderDir);
    } catch {
      exists = false;
    }
    if (!exists) return;
    for (const f of files(renderDir)) {
      for (const imp of importsOf(readFileSync(f, 'utf8'))) {
        if (imp.includes('/sim/')) {
          expect(imp, `${relative(root, f)} imports ${imp}`).toMatch(/\/sim\/(types|grid|noise|rng|index)$/);
        }
      }
    }
  });
});
