import os from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Testes do pacote instalado (scripts/test-package.mjs prepara as cópias dos
// exemplos em VE_PKG_WORK e faz o build de cada uma antes)
const WORK = process.env.VE_PKG_WORK ?? path.join(os.tmpdir(), 'versaedit-consumer')
const chromium = { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'msedge' }

export default defineConfig({
  testDir: 'tests/package',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  projects: [
    {
      name: 'vite-react',
      testMatch: 'vite-react.spec.ts',
      use: { ...chromium, baseURL: 'http://localhost:5191' },
    },
  ],
  webServer: [
    {
      command: 'npx vite preview --port 5191 --strictPort',
      cwd: path.join(WORK, 'vite-react'),
      url: 'http://localhost:5191',
      reuseExistingServer: false,
    },
  ],
})
