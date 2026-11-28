import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@kmxcnc/kmx-protocol': path.resolve(__dirname, 'packages/kmx-protocol/src/index.ts'),
      '@kmxcnc/cnc-core': path.resolve(__dirname, 'packages/cnc-core/src/index.ts'),
      '@kmxcnc/igm': path.resolve(__dirname, 'packages/igm/src/index.ts'),
      '@kmxcnc/cam-engine': path.resolve(__dirname, 'packages/cam-engine/src/index.ts'),
      '@kmxcnc/viewer-3d': path.resolve(__dirname, 'packages/viewer-3d/src/index.ts'),
      '@kmxcnc/plugin-sdk': path.resolve(__dirname, 'packages/plugin-sdk/src/index.ts'),
      '@kmxcnc/plugin-kflop': path.resolve(__dirname, 'plugins/kflop/src/index.ts'),
      '@kmxcnc/plugin-laser': path.resolve(__dirname, 'plugins/laser/src/index.ts'),
      '@kmxcnc/plugin-generators': path.resolve(__dirname, 'plugins/generators/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'plugins/**/*.test.ts', 'apps/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
