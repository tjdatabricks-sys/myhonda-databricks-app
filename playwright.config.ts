import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  use: { baseURL: 'http://127.0.0.1:8016', browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:8016',
    env: { DATABRICKS_APP_PORT: '8016' },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
