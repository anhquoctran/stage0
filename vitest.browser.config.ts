import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import base from './vitest.config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  ...base,
  plugins: [...(base.plugins ?? []), tailwindcss()],
  optimizeDeps: { include: [
    'react', 'react-dom/client', 'react-i18next', '@testing-library/react',
    '@tauri-apps/api/core', '@tauri-apps/api/path', '@tauri-apps/api/window',
    '@tauri-apps/api/dpi', '@tauri-apps/api/event',
  ] },
  test: {
    ...base.test,
    // Actual browser coverage of layout, portals and focus complements JSDOM.
    include: [
      'frontend/core/components/layout/HighDpi.browser.test.tsx',
      'frontend/features/preferences/components/tabs/PreferencesDensityTab.browser.test.tsx',
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
      instances: [
        // Preserve the original narrow-window case, then exercise HD/4K
        // desktops at fractional/integer scales using logical viewports.
        { scale: 1, width: 375, height: 700 },
        { scale: 1.25, width: 1536, height: 864 },
        { scale: 1.5, width: 1280, height: 720 },
        { scale: 1.75, width: 1097, height: 617 },
        { scale: 2, width: 1920, height: 1080 },
        { scale: 2.5, width: 1536, height: 864 },
        { scale: 3, width: 1280, height: 720 },
        { scale: 4, width: 960, height: 540 },
      ].map(({ scale, width, height }) => ({
        browser: 'chromium', name: `chromium-${scale}x`,
        viewport: { width, height },
        provider: playwright({
          launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
          contextOptions: { deviceScaleFactor: scale },
        }),
      })),
      viewport: { width: 375, height: 700 },
    },
  },
});
