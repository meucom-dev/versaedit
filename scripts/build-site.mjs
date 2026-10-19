// Site público (https://versaedit.dev, GitHub Pages): página inicial com links
// e o playground em /playground/. Saída em site/ (fora do git).
//   npm run build:site
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = path.join(ROOT, 'site')
const REPO = 'https://github.com/meucom-dev/versaedit'

fs.rmSync(SITE, { recursive: true, force: true })
execSync('npx vite build --config vite.playground.config.ts --mode site', {
  cwd: ROOT,
  stdio: 'inherit',
})

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="VersaEdit — lightweight rich text editor for React applications (beta)." />
    <link rel="icon" href="data:," />
    <title>VersaEdit</title>
    <style>
      :root { --bg: #ffffff; --fg: #1f2328; --muted: #59636e; --link: #0969da; --line: #d0d7de; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #0d1117; --fg: #e6edf3; --muted: #9198a1; --link: #4493f8; --line: #30363d; }
      }
      body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, sans-serif; }
      main { max-width: 680px; margin: 0 auto; padding: 48px 16px; }
      h1 { margin: 0 0 4px; font-size: 2rem; }
      .tag { display: inline-block; padding: 0 8px; border: 1px solid var(--line); border-radius: 999px; font-size: 0.8rem; color: var(--muted); }
      a { color: var(--link); }
      code { padding: 2px 6px; border: 1px solid var(--line); border-radius: 6px; }
      ul { padding-left: 20px; }
      footer { margin-top: 40px; border-top: 1px solid var(--line); padding-top: 12px; font-size: 0.85rem; color: var(--muted); }
    </style>
  </head>
  <body>
    <main>
      <h1>VersaEdit <span class="tag">beta</span></h1>
      <p>Lightweight rich text editor for React applications. Editor de texto rico leve para aplicações React.</p>
      <p><code>npm install versaedit@beta</code></p>
      <ul>
        <li><a href="/playground/">Playground</a> — try it in the browser / experimente no navegador</li>
        <li><a href="${REPO}#readme">Documentation (English)</a> · <a href="${REPO}/blob/main/README.pt-BR.md">Documentação (português)</a></li>
        <li><a href="${REPO}/blob/main/docs/integration.md">Integration guide</a> · <a href="${REPO}/blob/main/docs/integration.pt-BR.md">Guia de integração</a></li>
        <li><a href="${REPO}/blob/main/CHANGELOG.md">Changelog</a> · <a href="${REPO}/security/policy">Security / Segurança</a></li>
      </ul>
      <p>Beta: the API may change before 1.0 and there are known limitations (see the README). /
        Beta: a API pode mudar antes da 1.0 e há limitações conhecidas (veja o README).</p>
      <footer>
        MIT License · <a href="mailto:support@versaedit.dev">support@versaedit.dev</a> ·
        This site sets no cookies and has no analytics. / Este site não usa cookies nem análise de acesso.
      </footer>
    </main>
  </body>
</html>
`
fs.writeFileSync(path.join(SITE, 'index.html'), INDEX)
// Domínio próprio no GitHub Pages; sem processamento Jekyll
fs.writeFileSync(path.join(SITE, 'CNAME'), 'versaedit.dev\n')
fs.writeFileSync(path.join(SITE, '.nojekyll'), '')
console.log('\n✔ site/ pronto: index.html, playground/, CNAME')
