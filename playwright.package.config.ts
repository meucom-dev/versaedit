import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Testes do pacote instalado (scripts/test-package.mjs prepara as cópias dos
// exemplos em VE_PKG_WORK e faz o build de cada uma antes). Só entram os
// exemplos preparados nesta execução.
const WORK = process.env.VE_PKG_WORK ?? path.join(os.tmpdir(), 'versaedit-consumer')
const chromium = { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'msedge' }

const EXAMPLES = [
  { name: 'vite-react', port: 5191, command: 'npx vite preview --port 5191 --strictPort' },
  { name: 'nextjs', port: 5192, command: 'npx next start --port 5192' },
].filter((e) => fs.existsSync(path.join(WORK, e.name)))

export default defineConfig({
  testDir: 'tests/package',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  projects: EXAMPLES.map((e) => ({
    name: e.name,
    testMatch: `${e.name}.spec.ts`,
    use: { ...chromium, baseURL: `http://localhost:${e.port}` },
  })),
  webServer: EXAMPLES.map((e) => ({
    command: e.command,
    cwd: path.join(WORK, e.name),
    url: `http://localhost:${e.port}`,
    reuseExistingServer: false,
  })),
})
