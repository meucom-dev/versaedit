import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { CONTENT_CSS, EDITOR_CSS } from './src/core/styles.ts'

// Os .d.ts saem com importações sem extensão ('./core/editor'), que o
// TypeScript recusa com moduleResolution node16/nodenext. Acrescenta .js (ou
// /index.js para pastas), conferindo no código-fonte o que cada uma aponta.
const DIST = path.resolve('dist')
const SRC = path.resolve('src')
function withExtensions(filePath: string, content: string) {
  const srcDir = path.join(SRC, path.relative(DIST, path.dirname(filePath)))
  const fix = (spec: string) => {
    if (!spec.startsWith('.') || /\.(js|css|json)$/.test(spec)) return spec
    const target = path.join(srcDir, spec)
    if (['.ts', '.tsx'].some((ext) => fs.existsSync(target + ext))) return `${spec}.js`
    if (fs.existsSync(path.join(target, 'index.ts'))) return `${spec}/index.js`
    throw new Error(`d.ts: importação sem destino conhecido: ${spec} em ${filePath}`)
  }
  return content.replace(
    /(\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(['"])(\.[^'"]+)\2/gm,
    (_m, head: string, quote: string, spec: string) => `${head}${quote}${fix(spec)}${quote}`,
  )
}

// Build da biblioteca: ESM minificado + tipos + CSS. React e DOMPurify ficam
// fora do pacote. Os arquivos de CSS saem das mesmas constantes que o editor
// injeta (src/core/styles.ts), então nunca divergem.
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.build.json',
      beforeWriteFile: (filePath, content) => ({
        filePath,
        content: withExtensions(filePath, content),
      }),
    }),
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
