// Exemplo do Quick Start (versaedit.dev/quick-start/) com o pacote instalado e
// build de produção: o mesmo código mostrado no site, nos três idiomas
import { expect, test } from '@playwright/test'

let errors: string[] = []
test.beforeEach(({ page }) => {
  errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
})
test.afterEach(() => expect(errors).toEqual([]))

test('Quick Start: renderiza, edita, captura o HTML e o exibe como texto', async ({ page }) => {
  await page.goto('/')
  const content = page.locator('.ve-content')
  await expect(content).toBeVisible()
  await expect(page.getByRole('toolbar')).toBeVisible()
  // injectStyles={false} + import 'versaedit/versaedit.css': nenhum <style> injetado,
  // e o CSS importado chega (a barra tem o estilo do editor)
  await expect(page.locator('#versaedit-styles')).toHaveCount(0)
  await expect(page.getByRole('toolbar')).toHaveCSS('display', 'flex')
  await expect(content.locator('h2')).toHaveText('Hello, VersaEdit')

  const pre = page.locator('pre')
  await expect(pre).toHaveText('Click "Save content" to capture the HTML.')

  // Edição → onChange atualiza o estado (contador)
  const counter = page.locator('small')
  const before = await counter.textContent()
  await content.locator('p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Typed in the Quick Start.')
  await expect(counter).not.toHaveText(before!)

  // Salvar → getHTML() pela ref → HTML exibido como texto (não interpretado)
  await page.getByRole('button', { name: 'Save content' }).click()
  await expect(pre).toContainText('<h2>Hello, VersaEdit</h2>')
  await expect(pre).toContainText('Typed in the Quick Start.</p>')
  await expect(pre.locator('h2')).toHaveCount(0)
})
