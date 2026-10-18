// Exemplo Vite + React com o pacote instalado do .tgz (build de produção).
// Cada aba do exemplo tem aqui o teste do que ela demonstra.
import { expect, test, type Page } from '@playwright/test'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgaPj/HwAEhQJ/UhG2BwAAAABJRU5ErkJggg==',
  'base64',
)

// Erros de página e de console durante o teste (devem ficar vazios)
let errors: string[] = []
test.beforeEach(({ page }) => {
  errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
})
test.afterEach(() => expect(errors).toEqual([]))

async function open(page: Page, tab: string) {
  await page.goto(`/#${tab}`)
  await expect(page.locator('.ve-content')).toBeVisible()
}

test('básico: edita, formata, salva e exibe com o CSS de exibição', async ({ page }) => {
  await open(page, 'basic')
  // CSS do editor injetado (padrão) e barra completa
  await expect(page.locator('#versaedit-styles')).toHaveCount(1)
  await expect(page.getByRole('toolbar')).toBeVisible()

  const content = page.locator('.ve-content')
  await content.locator('p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Typed from the test.')
  await page.keyboard.down('Shift')
  for (let i = 0; i < 'test.'.length; i++) await page.keyboard.press('ArrowLeft')
  await page.keyboard.up('Shift')
  await page.getByRole('button', { name: /^Bold/ }).click()

  await page.getByRole('button', { name: 'Save draft' }).click()
  const preview = page.getByTestId('preview')
  await expect(preview.locator('b', { hasText: 'test.' })).toBeVisible()
  await expect(preview.locator('h2')).toHaveText('Hello, VersaEdit')
  // CSS de exibição: caixa de texto visível, alça escondida, sem contenteditable
  await expect(preview.locator('.rich-textbox')).toBeVisible()
  await expect(preview.locator('.textbox-handle')).toBeHidden()
  await expect(preview.locator('.rich-textbox')).not.toHaveAttribute('contenteditable')
  // onChange chegou ao estado da aplicação; clear() pela ref
  const length = page.getByTestId('length')
  await expect(length).toContainText('characters')
  const before = await length.textContent()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(length).not.toHaveText(before!)
  await expect(content).not.toContainText('Hello')
})

test('integração: envio de imagem, erro e confirmação pela interface da aplicação', async ({
  page,
}) => {
  page.on('dialog', (d) => {
    errors.push(`janela do navegador: ${d.message()}`)
    void d.dismiss()
  })
  await open(page, 'integration')
  const content = page.locator('.ve-content')

  // onImageUpload: a imagem entra pela URL devolvida (não em base64)
  await content.locator('p').click()
  let chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Insert image' }).click()
  await (await chooser).setFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG })
  await expect(content.locator('img')).toHaveAttribute('src', /^blob:/)

  // Falha no envio: onError recebe o código, sem alert()
  await page.getByLabel('Simulate image upload failure').check()
  await content.locator('p').click()
  chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Insert image' }).click()
  await (await chooser).setFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('alert')).toHaveAttribute('data-code', 'image-upload')
  await expect(content.locator('img')).toHaveCount(1)

  // onConfirm com Promise: a janela da aplicação decide se o arquivo substitui o texto
  const openFile = async () => {
    const fc = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Open file (.html)' }).click()
    await (
      await fc
    ).setFiles({
      name: 'doc.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<html><body><p>From file</p></body></html>'),
    })
  }
  await openFile()
  await page.getByRole('button', { name: 'Keep current text' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(content).not.toContainText('From file')
  await openFile()
  await page.getByRole('button', { name: 'Replace' }).click()
  await expect(content).toContainText('From file')

  // onSave: o botão Salvar entrega o HTML à aplicação (sem download)
  await page.getByRole('button', { name: 'Save to file (.html)' }).click()
  await expect(page.getByTestId('saved')).toContainText('characters')
})

test('personalizado: só os grupos escolhidos, pt-BR, cor e moldura da marca', async ({ page }) => {
  await open(page, 'customized')
  const toolbar = page.getByRole('toolbar')
  await expect(toolbar.getByRole('button', { name: 'Negrito (Ctrl+B)' })).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Inserir imagem' })).toHaveCount(0)
  await expect(toolbar.getByRole('button', { name: /Família da fonte/ })).toHaveCount(0)
  const accent = await page
    .locator('.ve-root')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--ve-accent').trim())
  expect(accent).toBe('#0f766e')
  // Largura fluida: o editor ocupa a largura da coluna
  const [root, main] = await Promise.all([
    page.locator('.ve-root').boundingBox(),
    page.locator('main').boundingBox(),
  ])
  expect(root!.width).toBeGreaterThan(main!.width - 40)
})

test('CSP: sem <style> injetado, com a aparência vinda do CSS importado', async ({ page }) => {
  await open(page, 'csp')
  await expect(page.locator('#versaedit-styles')).toHaveCount(0)
  await expect(page.locator('style')).toHaveCount(0)
  const display = await page.locator('.ve-toolbar').evaluate((el) => getComputedStyle(el).display)
  expect(display).toBe('flex')
})

test('exibição: imagem posicionada, alça escondida, tabela', async ({ page }) => {
  await page.goto('/#display')
  const display = page.getByTestId('display')
  await expect(display.locator('img')).toHaveCSS('float', 'right')
  await expect(display.locator('.textbox-handle')).toBeHidden()
  await expect(display.locator('table th').first()).toHaveText('Item')
})

test('ditado externo: microfone fora da barra só onde há reconhecimento de voz', async ({
  page,
}) => {
  await open(page, 'dictation')
  const supported = await page.evaluate(
    () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
  )
  const mic = page.locator('.actions').getByRole('button', { name: /Dictate/ })
  await expect(mic).toHaveCount(supported ? 1 : 0)
  await expect(page.getByRole('toolbar').getByRole('button', { name: /Dictate/ })).toHaveCount(0)
})
