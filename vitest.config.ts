import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    // Hermetic: no network. Tests read only the vendored snapshot.
  },
});
