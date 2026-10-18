// Exemplo Vite + React com o pacote instalado do .tgz (build de produção)
import { expect, test, type Page } from '@playwright/test'

// Erros de página e de console durante o teste (devem ficar vazios)
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

test('básico: edita, formata, salva e exibe com o CSS de exibição', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  const content = page.locator('.ve-content')
  await expect(content).toBeVisible()
  // CSS do editor injetado (padrão) e barra completa
  await expect(page.locator('#versaedit-styles')).toHaveCount(1)
  await expect(page.getByRole('toolbar')).toBeVisible()

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
  // onChange chegou ao estado da aplicação
  await expect(page.getByTestId('length')).toContainText('characters')
  expect(errors).toEqual([])
})
