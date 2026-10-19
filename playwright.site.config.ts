import { defineConfig, devices } from '@playwright/test'

// Site público já gerado (npm run build:site), servido como no GitHub Pages
export default defineConfig({
  testDir: 'tests/site',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.CI ? undefined : 'msedge',
    baseURL: 'http://localhost:5183',
  },
  webServer: {
    command: 'node scripts/serve-static.mjs site 5183',
    url: 'http://localhost:5183/',
    reuseExistingServer: false,
  },
})
