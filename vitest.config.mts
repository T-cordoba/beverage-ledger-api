import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest transpiles with esbuild, which does not emit the decorator metadata
  // Nest needs to resolve a constructor. swc does.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    // One file at a time: they share the database, and each one boots Nest.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
