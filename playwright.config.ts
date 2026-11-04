import { defineConfig } from '@playwright/test';

export const E2E_PORT = 4317;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node e2e/serve.mjs ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/article.html`,
    reuseExistingServer: !process.env.CI,
  },
});
