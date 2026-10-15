import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

// Build da biblioteca: ESM + tipos. React e DOMPurify ficam fora do pacote.
export default defineConfig({
  plugins: [react(), dts({ include: ['src'], tsconfigPath: './tsconfig.build.json' })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'versaedit',
    },
    sourcemap: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'dompurify'],
    },
  },
})
