import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/stage0/',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm preview --port 4173',
    env: { BASE_PATH: '/stage0' },
    url: 'http://127.0.0.1:4173/stage0/',
    reuseExistingServer: !process.env.CI,
  },
});
