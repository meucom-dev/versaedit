import { defineConfig, devices } from '@playwright/test'

const PORT = 5181

// Testes de navegador: usam a página playground/harness.html servida pelo Vite.
// Localmente roda no Edge instalado no Windows; no CI, no Chromium do Playwright.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // Resultados de referência (um arquivo por ação), iguais em qualquer sistema
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileName}/{arg}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1200, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'msedge' },
    },
    // Diagnóstico de compatibilidade (fora do CI por enquanto):
    //   VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit
    ...(process.env.VE_ALL_BROWSERS
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
  webServer: {
    command: `npx vite --config vite.playground.config.ts --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/harness.html`,
    reuseExistingServer: !process.env.CI,
  },
})
