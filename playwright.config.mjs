import { defineConfig } from '@playwright/test';

const externalURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalURL || 'http://127.0.0.1:4180';
const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/browser.spec.mjs',
  outputDir: './test-results',
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    browserName,
    baseURL,
    headless: true,
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    hasTouch: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: browserName === 'chromium' ? {
      ...(process.env.PLAYWRIGHT_CHROME_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
        : {}),
      args: ['--enable-unsafe-swiftshader'],
    } : {},
  },
  webServer: externalURL ? undefined : {
    command: 'npm run dev -- --port 4180 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
