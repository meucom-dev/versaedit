// Prop toolbar: grupos de ferramentas ligados (padrão: todos)
import { expect, test } from '@playwright/test'
import { mount, selectText } from './helpers'

const labels = (page: import('@playwright/test').Page) =>
  page
    .locator('#host .ve-toolbar')
    .locator('button[aria-label], select[aria-label]')
    .evaluateAll((els) =>
      els
        .filter((el) => !el.closest('.ve-palette, .ve-font-options, .ve-highlight-palette'))
        .map((el) => el.getAttribute('aria-label')),
    )

test('só os grupos pedidos, na ordem da barra, com separador só entre eles', async ({ page }) => {
  // Ordem pedida diferente da ordem da barra: vale a ordem da barra
  await mount(page, { toolbar: ['clear', 'format', 'link'] })
  expect(await labels(page)).toEqual([
    'Bold (Ctrl+B)',
    'Italic (Ctrl+I)',
    'Underline (Ctrl+U)',
    'Insert link (Ctrl+K)',
    'Remove link',
    'Clear the editing area (deletes all content)',
    'Clear formatting',
  ])
  await expect(page.locator('#host .ve-toolbar .ve-sep')).toHaveCount(2)
})

test('teclado percorre só os controles que ficaram', async ({ page }) => {
  await mount(page, { toolbar: ['history', 'align'] })
  const toolbar = page.locator('#host .ve-toolbar')
  await expect(toolbar.locator('[tabindex="0"]')).toHaveCount(1)
  await toolbar.locator('button').first().focus()
  await page.keyboard.press('End')
  expect(await page.evaluate(() => document.activeElement!.getAttribute('aria-label'))).toBe(
    'Align right',
  )
  await page.keyboard.press('ArrowRight')
  expect(await page.evaluate(() => document.activeElement!.getAttribute('aria-label'))).toBe(
    'Undo (Ctrl+Z)',
  )
})

test('sem "format", Ctrl+B não formata; sem "link", Ctrl+K não abre; Ctrl+Z sempre', async ({
  page,
}) => {
  const t = await mount(page, { initialContent: '<p>alpha beta</p>', toolbar: ['history'] })
  await selectText(page, 'alpha')
  await page.keyboard.press('Control+b')
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe('<p>alpha beta</p>')
  await page.keyboard.press('Control+k')
  await expect(page.locator('#host .ve-link-popover')).toHaveCount(0)
  // Desfazer continua
  await t.caretToEnd()
  await page.keyboard.type('X')
  await page.waitForTimeout(500)
  await page.keyboard.press('Control+z')
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe('<p>alpha beta</p>')
})

test('com "format", Ctrl+B formata (padrão)', async ({ page }) => {
  await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'alpha')
  await page.keyboard.press('Control+b')
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(
    '<p><b>alpha</b> beta</p>',
  )
})

test('toolbar vazia esconde a barra; o editor continua funcionando', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>a</p>', toolbar: [] })
  await expect(page.locator('#host .ve-toolbar')).toHaveCount(0)
  await t.caretToEnd()
  await page.keyboard.type('b')
  expect(await t.html()).toBe('<p>ab</p>')
})
