// Site público (https://versaedit.dev, GitHub Pages), gerado em site/ (fora do git):
//   /             página inicial em inglês
//   /pt/          página inicial em português
//   /es/          página inicial em espanhol
//   /playground/  playground (build do Vite com --mode site)
//   /assets/      logo
//   npm run build:site
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTENT } from './site/content.mjs'
import { renderPage } from './site/template.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = path.join(ROOT, 'site')

fs.rmSync(SITE, { recursive: true, force: true })
execSync('npx vite build --config vite.playground.config.ts --mode site', {
  cwd: ROOT,
  stdio: 'inherit',
})

// Data da última edição: a do último commit (o mesmo commit gera sempre o mesmo site)
let editedDate = new Date()
try {
  editedDate = new Date(execSync('git log -1 --format=%cI', { cwd: ROOT, encoding: 'utf8' }).trim())
} catch {
  // fora de um repositório git: usa a data atual
}

for (const t of Object.values(CONTENT)) {
  const dir = path.join(SITE, t.path)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), renderPage(t, { editedDate }))
}
fs.cpSync(path.join(ROOT, 'site-src', 'assets'), path.join(SITE, 'assets'), { recursive: true })
// Domínio próprio no GitHub Pages; sem processamento Jekyll
fs.writeFileSync(path.join(SITE, 'CNAME'), 'versaedit.dev\n')
fs.writeFileSync(path.join(SITE, '.nojekyll'), '')
const pages = Object.values(CONTENT).map((t) => t.path)
console.log(`\n✔ site/ pronto: ${pages.join(', ')}, /playground/, /assets/, CNAME`)
