import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/modules/cube/{model,geometry,question,database}/**/*.ts', 'src/modules/sketch/core/**/*.ts', 'src/modules/sketch/storage/ProjectStore.ts'],
      exclude: ['src/**/*.test.ts', 'src/core/**/*.test-util.ts', 'src/core/**/index.ts', 'src/core/**/types.ts', 'src/modules/cube/database/NativeSqlite.ts'],
      // NFR-M-03
      thresholds: { lines: 90 },
    },
  },
});
