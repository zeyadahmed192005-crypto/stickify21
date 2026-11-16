// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'msedge'
  },
  webServer: {
    command: 'python scripts/server.py 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 15000
  }
});
