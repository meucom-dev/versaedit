// Playground (playground/index.html): o painel "Propriedades", dentro da área
// de desenvolvimento recolhida, muda o editor ao vivo
import { expect, test, type Page } from '@playwright/test'

async function openPanel(page: Page) {
  await page.goto('/')
  await expect(page.locator('.ve-content')).toBeVisible()
  // Tudo recolhido na tela inicial
  // (no WebKit, o que fica dentro de um <details> fechado ainda tem tamanho,
  // então a conferência é pelo atributo open e pelo checkVisibility)
  await expect(page.locator('#root details').first()).not.toHaveAttribute('open')
  expect(await page.getByTestId('props-panel').evaluate((el) => el.checkVisibility())).toBe(false)
  await page.getByText('Show HTML', { exact: true }).click()
  await page.getByText('Properties', { exact: true }).click()
  await expect(page.getByTestId('events')).toBeVisible()
}

test('grupos da barra, largura e JSX equivalente', async ({ page }) => {
  await openPanel(page)
  const toolbar = page.getByRole('toolbar').first()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toBeVisible()
  await page.getByLabel('insert', { exact: true }).uncheck()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toHaveCount(0)
  await expect(page.getByTestId('jsx')).toContainText("toolbar={['file'")

  await page
    .locator('label', { hasText: /^Width/ })
    .locator('select')
    .selectOption('100%')
  await expect(page.getByTestId('jsx')).toContainText('width="100%"')
  const [root, column] = await Promise.all([
    page.locator('.ve-root').first().boundingBox(),
    page.locator('#root > div').boundingBox(),
  ])
  expect(root!.width).toBeGreaterThan(column!.width - 40)

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toBeVisible()
  await expect(page.getByTestId('jsx')).not.toContainText('toolbar=')
})

test('conteúdos de exemplo e registro de eventos', async ({ page }) => {
  await openPanel(page)
  await page.getByRole('button', { name: 'Load: Table' }).click()
  await expect(page.locator('.ve-content table th').first()).toHaveText('Item')
  await expect(page.getByTestId('events')).toContainText('setHTML')
  // A área "Show HTML" acompanha o conteúdo carregado
  await expect(page.locator('pre').first()).toContainText('<th>Item</th>')
  await page.locator('.ve-content td').first().click()
  await expect(page.getByTestId('events')).toContainText('onFocus')
  await page.keyboard.type('x')
  await expect(page.getByTestId('events')).toContainText('onChange')
  await page.getByRole('button', { name: 'Load: Long content' }).click()
  await expect(page.getByTestId('events')).toContainText('onOverflowChange (true)')
})

test('onError ligado: aviso no registro, sem alert do navegador', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.dismiss()
  })
  await openPanel(page)
  await page.getByLabel('onError (log instead of alert)').check()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open file (.html)' }).first().click()
  await (
    await chooser
  ).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  await expect(page.getByTestId('events')).toContainText('onError file-wrong-type')
  expect(dialogs).toEqual([])
})
