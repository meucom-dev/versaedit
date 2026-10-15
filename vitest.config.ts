import { defineConfig } from 'vitest/config'

// Testes do núcleo (src/core) em jsdom — sem navegador
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
})
