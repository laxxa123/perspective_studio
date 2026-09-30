import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts', 'src/core/**/*.test-util.ts', 'src/core/**/index.ts', 'src/core/**/types.ts'],
      // NFR-M-03
      thresholds: { lines: 90 },
    },
  },
});
