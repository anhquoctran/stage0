import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import strictReporter from './scripts/strict-react-test-reporter.mjs';
import { fileURLToPath } from 'node:url';

// Do not merge vite.config.ts: loading it writes application build metadata.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./frontend', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    reporters: ['default', strictReporter],
    retry: 0,
    include: ['frontend/**/*.test.{ts,tsx}'],
    exclude: ['frontend/**/*.browser.test.tsx'],
    setupFiles: ['tests/react/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    allowOnly: !process.env.CI,
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      include: ['frontend/**/*.{ts,tsx}'],
      exclude: ['frontend/**/*.test.{ts,tsx}', 'frontend/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'lcovonly', 'json-summary'],
      reportsDirectory: 'coverage/react',
      reportOnFailure: true,
    },
  },
});
