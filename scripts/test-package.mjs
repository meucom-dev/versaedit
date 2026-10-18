// Testa o VersaEdit como dependência instalada, do jeito que um projeto de fora
// o receberia: gera o pacote (npm pack), confere o conteúdo, copia cada exemplo
// de examples/ para uma pasta temporária FORA do repositório (assim nada é
// resolvido a partir de src/ ou do node_modules da raiz), instala o .tgz,
// verifica os tipos, faz o build e roda os testes de navegador sobre o build.
//
//   npm run test:package                 todos os exemplos
//   npm run test:package -- vite-react   só um
//   npm run test:package -- --no-e2e     sem os testes de navegador
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORK = path.join(os.tmpdir(), 'versaedit-consumer')
const EXAMPLES = fs.readdirSync(path.join(ROOT, 'examples'))
const args = process.argv.slice(2)
const runE2e = !args.includes('--no-e2e')
const chosen = args.filter((a) => !a.startsWith('--'))
const examples = chosen.length ? chosen : EXAMPLES

// Arquivos que o pacote precisa ter, e o que nunca pode ir nele
const REQUIRED = [
  'package.json',
  'LICENSE',
  'README.md',
  'dist/versaedit.js',
  'dist/versaedit.js.map',
  'dist/index.d.ts',
  'dist/versaedit.css',
  'dist/versaedit-content.css',
]
const ALLOWED = /^(package\.json|LICENSE|README(\.pt-BR)?\.md|dist\/.+)$/
const SECRETS = [
  [/[A-Za-z]:[\\/]{1,2}(Users|AI_DEV)\b/i, 'caminho local do Windows'],
  [/\/(home|Users)\/[a-z]/, 'caminho local Unix/macOS'],
  [/service_role/, 'chave service_role'],
  [/sk-(or|ant|proj)-[A-Za-z0-9]/, 'chave de API'],
  [/eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/, 'token JWT'],
]

const run = (cmd, cwd = ROOT) => {
  console.log(`\n$ ${cmd}${cwd === ROOT ? '' : `   (${cwd})`}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}
const fail = (msg) => {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

// 1. Pacote
run('npm run build')
fs.rmSync(WORK, { recursive: true, force: true })
fs.mkdirSync(WORK, { recursive: true })
const [packed] = JSON.parse(
  execSync(`npm pack --json --pack-destination "${WORK}"`, { cwd: ROOT, encoding: 'utf8' }),
)
const tgz = path.join(WORK, packed.filename)
const files = packed.files.map((f) => f.path.replaceAll('\\', '/'))
console.log(`\nPacote: ${packed.filename} — ${files.length} arquivos, ${packed.size} bytes`)

// 2. Conteúdo do pacote
for (const f of REQUIRED) if (!files.includes(f)) fail(`falta no pacote: ${f}`)
const extra = files.filter((f) => !ALLOWED.test(f))
if (extra.length) fail(`arquivos inesperados no pacote: ${extra.join(', ')}`)
for (const f of files.filter((f) => /\.(js|map|css|d\.ts)$/.test(f))) {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8')
  for (const [re, what] of SECRETS) if (re.test(text)) fail(`${what} em ${f}`)
}
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
for (const field of ['name', 'version', 'license', 'types', 'exports', 'peerDependencies']) {
  if (!pkg[field]) fail(`package.json sem "${field}"`)
}
console.log('✔ conteúdo do pacote: arquivos, CSS, tipos, licença e mapas sem dados locais')

// 3. Cada exemplo, numa cópia fora do repositório
for (const name of examples) {
  const src = path.join(ROOT, 'examples', name)
  if (!fs.existsSync(src)) fail(`exemplo inexistente: ${name}`)
  const dir = path.join(WORK, name)
  fs.cpSync(src, dir, {
    recursive: true,
    filter: (p) => !/[\\/](node_modules|dist|\.next)([\\/]|$)/.test(p.slice(src.length)),
  })
  run('npm ci --no-audit --no-fund', dir)
  run(`npm install --no-audit --no-fund "${tgz}"`, dir)
  const installed = path.join(dir, 'node_modules', 'versaedit')
  if (fs.existsSync(path.join(installed, 'src'))) fail('o pacote instalado contém src/')
  run('npm run build', dir)
}
console.log(`\n✔ exemplos compilados com o pacote instalado: ${examples.join(', ')}`)

// 4. Tipos também para quem usa moduleResolution node16/nodenext (Node puro,
//    sem bundler): as importações internas dos .d.ts precisam de extensão
const typesDir = path.join(WORK, examples[0])
fs.writeFileSync(
  path.join(typesDir, 'nodenext-check.mts'),
  [
    "import { TOOLBAR_GROUPS, VersaEdit, VersaEditDictation } from 'versaedit'",
    "import type { VersaEditError, VersaEditHandle, VersaEditProps } from 'versaedit'",
    "export const props: VersaEditProps = { initialContent: '<p>x</p>', toolbar: [...TOOLBAR_GROUPS] }",
    'export const handle: VersaEditHandle | null = null',
    'export const error: VersaEditError | null = null',
    'export { VersaEdit, VersaEditDictation }',
    '',
  ].join('\n'),
)
fs.writeFileSync(
  path.join(typesDir, 'tsconfig.nodenext.json'),
  JSON.stringify({
    compilerOptions: {
      module: 'nodenext',
      moduleResolution: 'nodenext',
      target: 'ES2022',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      types: [],
    },
    files: ['nodenext-check.mts'],
  }),
)
run('npx tsc -p tsconfig.nodenext.json', typesDir)
console.log('✔ tipos com moduleResolution nodenext')

// 5. Navegador, sobre os builds de produção
if (runE2e) {
  const projects = examples.map((e) => `--project=${e}`).join(' ')
  execSync(`npx playwright test -c playwright.package.config.ts ${projects}`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VE_PKG_WORK: WORK },
  })
}
