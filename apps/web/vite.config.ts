import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'KMXCNC — Workshop CNC Controller',
        short_name: 'KMXCNC',
        description: 'Modular browser-based CNC controller, 3D toolpath viewer, CAM pipeline, and KFLOP diagnostics.',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        // NEVER cache or intercept backend API, uploads, settings, or WebSocket endpoints
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/upload/,
          /^\/settings\//,
          /^\/ws/,
        ],
        // Explicit network-only rules with zero background sync for all backend routes
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') ||
              url.pathname.startsWith('/upload') ||
              url.pathname.startsWith('/settings/') ||
              url.pathname.startsWith('/ws'),
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@kmxcnc/kmx-protocol': path.resolve(rootDir, 'packages/kmx-protocol/src/index.ts'),
      '@kmxcnc/cnc-core': path.resolve(rootDir, 'packages/cnc-core/src/index.ts'),
      '@kmxcnc/igm': path.resolve(rootDir, 'packages/igm/src/index.ts'),
      '@kmxcnc/cam-engine': path.resolve(rootDir, 'packages/cam-engine/src/index.ts'),
      '@kmxcnc/viewer-3d': path.resolve(rootDir, 'packages/viewer-3d/src/index.ts'),
      '@kmxcnc/plugin-sdk': path.resolve(rootDir, 'packages/plugin-sdk/src/index.ts'),
      '@kmxcnc/plugin-kflop': path.resolve(rootDir, 'plugins/kflop/src/index.ts'),
      '@kmxcnc/plugin-laser': path.resolve(rootDir, 'plugins/laser/src/index.ts'),
      '@kmxcnc/plugin-generators': path.resolve(rootDir, 'plugins/generators/src/index.ts'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-dockview': ['dockview'],
          'vendor-codemirror': [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/search',
          ],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
