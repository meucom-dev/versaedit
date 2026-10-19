import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Página local para testar o editor durante o desenvolvimento (npm run dev).
// Com --mode site (npm run build:site), gera o playground público servido em
// https://versaedit.dev/playground/ — só a página principal, sem o harness
// dos testes.
export default defineConfig(({ mode }) => ({
  root: 'playground',
  plugins: [react()],
  server: { port: 5180 },
  base: mode === 'site' ? '/playground/' : '/',
  build: {
    outDir: '../site/playground',
    emptyOutDir: true,
  },
  preview: { port: 5182, strictPort: true },
}))
