import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { CONTENT_CSS, EDITOR_CSS } from './src/core/styles.ts'

// Build da biblioteca: ESM minificado + tipos + CSS. React e DOMPurify ficam
// fora do pacote. Os arquivos de CSS saem das mesmas constantes que o editor
// injeta (src/core/styles.ts), então nunca divergem.
export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], tsconfigPath: './tsconfig.build.json' }),
    {
      name: 'versaedit-css',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'versaedit.css',
          source: EDITOR_CSS.trim() + '\n',
        })
        this.emitFile({
          type: 'asset',
          fileName: 'versaedit-content.css',
          source: CONTENT_CSS.trim() + '\n',
        })
      },
    },
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'versaedit',
    },
    sourcemap: true,
    minify: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'dompurify'],
      // Em biblioteca ESM o Vite só encurta nomes; isto tira também espaços
      output: { minify: true },
    },
  },
})
