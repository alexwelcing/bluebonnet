import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
