import { defineConfig } from 'vitest/config';
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

function copyTestAssets() {
  return {
    name: 'copy-test-assets',
    async closeBundle() {
      if (existsSync('assets/test')) {
        await mkdir('dist/assets', { recursive: true });
        await cp('assets/test', 'dist/assets/test', { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [copyTestAssets()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
