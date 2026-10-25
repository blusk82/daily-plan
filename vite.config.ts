/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ben is in Queensland; run tests in his timezone so local-date bugs show up.
process.env.TZ = 'Australia/Brisbane';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Forked workers race on Windows temp files (EBUSY); threads share memory instead.
    pool: 'threads',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    env: { TZ: 'Australia/Brisbane' },
  },
});
