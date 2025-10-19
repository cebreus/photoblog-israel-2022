import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    // Umožní importovat .svelte komponenty v SSR/unit testech (např. Picture.svelte)
    svelte(),
  ],
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/integration/**/*.spec.ts',
      'tests/e2e-images/**/*.spec.ts',
    ],
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    globals: true,
    alias: {
      $lib: path.resolve(__dirname, './src/lib'),
    },
  },
});
