import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the game under /<repo>/, so the deploy workflow sets BASE_PATH
  base: process.env.BASE_PATH ?? '/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
