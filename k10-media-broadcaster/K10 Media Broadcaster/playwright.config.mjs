import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 600 },
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  projects: [
    // Original dashboard (dashboard.html)
    {
      name: 'original',
      testDir: './tests/original',
      testMatch: /dashboard\.spec\.mjs$/,
    },
    // Vanilla TS build (dashboard-build.html)
    {
      name: 'build',
      testDir: './tests/build',
      testMatch: /dashboard\.spec\.mjs$/,
    },
    // Non-dashboard tests (Discord OAuth, etc.) — run once
    {
      name: 'unit',
      testDir: './tests/unit',
    },
  ],
});
