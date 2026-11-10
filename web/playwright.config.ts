import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  // One worker: every test shares a single local Firebase emulator.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec vite preview --outDir dist-e2e --port ${String(port)} --strictPort`,
    port,
    reuseExistingServer: !isCi,
  },
});
