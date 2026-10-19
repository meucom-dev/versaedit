// Site público (site/, gerado por npm run build:site): página inicial e
// playground em /playground/, sem erros e sem requisições a outros endereços
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

let errors: string[] = []
let external: string[] = []
test.beforeEach(({ page }) => {
  errors = []
  external = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== 'localhost' && url.protocol !== 'data:') external.push(r.url())
  })
})
test.afterEach(() => {
  expect(errors, 'erros no console').toEqual([])
  expect(external, 'requisições externas').toEqual([])
})

const goto = async (page: Page, url: string) => {
  const res = await page.goto(url)
  expect(res?.status()).toBe(200)
}

test('página inicial: aviso de beta, links e contato', async ({ page }) => {
  await goto(page, '/')
  await expect(page.locator('h1')).toContainText('VersaEdit')
  await expect(page.locator('.tag')).toHaveText('beta')
  await expect(page.getByRole('link', { name: 'Playground' })).toHaveAttribute(
    'href',
    '/playground/',
  )
  await expect(page.getByRole('link', { name: 'support@versaedit.dev' })).toHaveAttribute(
    'href',
    'mailto:support@versaedit.dev',
  )
})

test('playground em /playground/: edita, nota de privacidade, sem o harness', async ({ page }) => {
  await goto(page, '/playground/')
  const content = page.locator('.ve-content')
  await expect(content).toBeVisible()
  await content.click()
  await page.keyboard.type('Hello from the public playground')
  await expect(content).toContainText('Hello from the public playground')
  await expect(page.getByTestId('site-note')).toContainText('VersaEdit has no server')
  await page.getByRole('combobox').first().selectOption('pt-BR')
  await expect(page.getByTestId('site-note')).toContainText('o VersaEdit não tem servidor')
  // A página de testes (harness) não vai para o site
  expect((await page.request.get('/playground/harness.html')).status()).toBe(404)
})

test('arquivos do site: CNAME do domínio e nada de dados locais ou chaves', () => {
  const site = path.resolve('site')
  expect(fs.readFileSync(path.join(site, 'CNAME'), 'utf8').trim()).toBe('versaedit.dev')
  const files = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  for (const file of files(site)) {
    const text = fs.readFileSync(file, 'utf8')
    expect(text, file).not.toMatch(/[A-Za-z]:[\\/]{1,2}Users\b|\/home\/[a-z]/)
    expect(text, file).not.toMatch(/service_role|sk-(or|ant|proj)-|eyJ[A-Za-z0-9_-]{30,}\./)
  }
})
