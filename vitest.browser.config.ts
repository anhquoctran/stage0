import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import base from './vitest.config';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    // Actual browser coverage of layout, portals and focus complements JSDOM.
    include: [
      'frontend/common/components/CustomSelect.test.tsx',
      'frontend/common/components/CustomSelect.browser.test.tsx',
      'frontend/features/git/components/diff-viewer/FileEncodingPicker.test.tsx',
    ],
    exclude: [],
    coverage: { enabled: false },
    browser: {
      enabled: true,
      provider: playwright({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }),
      headless: true,
      instances: [{ browser: 'chromium' }],
      viewport: { width: 375, height: 700 },
    },
  },
});
