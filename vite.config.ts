import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const MUSIC_EXT = /\.(mp3|ogg|wav|m4a|flac)$/i;

/**
 * Lists the audio files in `public/music` as `virtual:music-tracks`, so dropping a track into that
 * folder is all it takes to add it to the game. The list is read when the dev server starts (and
 * again, with a reload, when a file is added or removed there) and when the game is built.
 */
function musicTracks(): Plugin {
  const id = 'virtual:music-tracks';
  const resolved = `\0${id}`;
  let base = '/';
  let root = process.cwd();
  const dir = (): string => join(root, 'public', 'music');
  return {
    name: 'music-tracks',
    configResolved(config) {
      base = config.base;
      root = config.root;
    },
    resolveId(source) {
      return source === id ? resolved : undefined;
    },
    load(source) {
      if (source !== resolved) return undefined;
      let files: string[] = [];
      try {
        files = readdirSync(dir()).filter((f) => MUSIC_EXT.test(f)).sort();
      } catch {
        /* no music folder: the game plays its generated music */
      }
      return `export default ${JSON.stringify(files.map((f) => `${base}music/${encodeURIComponent(f)}`))};`;
    },
    configureServer(server) {
      server.watcher.add(dir());
      const refresh = (file: string): void => {
        if (!MUSIC_EXT.test(file) || !file.replace(/\\/g, '/').includes('/public/music/')) return;
        const mod = server.moduleGraph.getModuleById(resolved);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the game under /<repo>/, so the deploy workflow sets BASE_PATH
  base: process.env.BASE_PATH ?? '/',
  plugins: [musicTracks()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
