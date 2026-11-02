import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL,
  },
  // Only spin up a local dev server when no external preview URL was given.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
