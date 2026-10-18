// Exemplo Next.js (App Router) com o pacote instalado do .tgz: build de
// produção (página gerada no servidor) servido por `next start`
import { expect, test } from '@playwright/test'

test('o servidor entrega o editor e o conteúdo já renderizados no HTML', async ({ request }) => {
  const res = await request.get('/')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('class="ve-root"')
  expect(html).toContain('class="ve-toolbar"')
  expect(html).toContain('Edit me. The editor was server-rendered')
  expect(html).toContain('This post was rendered on the <b>server</b>.')
})

test('hidrata sem erros e edita no navegador', async ({ page }) => {
  // DEFEITO CONHECIDO (v0.4.x, aguardando autorização para corrigir): onde há
  // reconhecimento de voz (Chrome, Edge, Safari), o botão de ditado aparece no
  // primeiro render do navegador mas não no do servidor — React #418. Quando
  // corrigido, este test.fail passa a falhar e deve ser retirado.
  test.fail()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text())
  })
  await page.goto('/')
  const content = page.locator('.ve-content')
  await expect(content).toHaveAttribute('contenteditable', 'true')
  const length = page.getByTestId('length')
  const before = await length.textContent()
  await content.locator('p').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Typed.')
  await expect(length).not.toHaveText(before!)
  await expect(content).toContainText('Typed.')
  // Conteúdo publicado com o CSS de exibição
  await expect(page.getByTestId('published').locator('.textbox-handle')).toBeHidden()
  // CSS do editor injetado no navegador
  await expect(page.locator('#versaedit-styles')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('sem reconhecimento de voz (como no Firefox), hidrata sem erros', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text())
  })
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.SpeechRecognition
    delete w.webkitSpeechRecognition
  })
  await page.goto('/')
  await expect(page.locator('.ve-content')).toHaveAttribute('contenteditable', 'true')
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})
