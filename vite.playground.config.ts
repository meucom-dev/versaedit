import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Página local para testar o editor durante o desenvolvimento (npm run dev)
export default defineConfig({
  root: 'playground',
  plugins: [react()],
  server: { port: 5180 },
})
