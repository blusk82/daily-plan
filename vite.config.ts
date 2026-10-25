/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Run tests in a UTC+10 timezone so local-date bugs (UTC is still yesterday before 10am) show up.
process.env.TZ = 'Australia/Brisbane';

// GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-64.png'],
      manifest: {
        name: 'Daily Plan',
        short_name: 'Daily Plan',
        description: 'Meals, rehab exercise and shopping for the day.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        theme_color: '#2f5d50',
        background_color: '#f6f5f1',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs is precached: it must work with no signal.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // Forked workers race on Windows temp files (EBUSY); threads share memory instead.
    pool: 'threads',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    env: { TZ: 'Australia/Brisbane' },
  },
});
