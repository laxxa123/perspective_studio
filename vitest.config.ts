import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/modules/cube/{model,geometry,question,database}/**/*.ts', 'src/modules/sketch/core/**/*.ts', 'src/modules/sketch/storage/ProjectStore.ts', 'src/modules/publish/core/**/*.ts', 'src/modules/objects/core/**/*.ts', 'src/modules/publish/storage/**/*.ts', 'src/modules/publish/wp/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test-util.ts', 'src/core/**/index.ts', 'src/core/**/types.ts', 'src/modules/cube/database/NativeSqlite.ts'],
      // NFR-M-03
      thresholds: { lines: 90 },
    },
  },
});
