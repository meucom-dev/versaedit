// Colagem de tabelas, imagens, linhas e código, e a vida da tabela colada:
// edição, salvamento (getHTML/onChange), reabertura (setHTML) e arquivo .html.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

async function paste(page: Page, html: string, text = 'x') {
  await page.locator('#host .ve-content').evaluate(
    (el, [h, t]) => {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(range)
      const dt = new DataTransfer()
      dt.setData('text/html', h)
      dt.setData('text/plain', t)
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      )
    },
    [html, text] as const,
  )
}

const TABLE =
  '<table border="1" style="width:400px"><caption>Idades</caption><thead><tr><th scope="col">Nome</th><th>Idade</th></tr></thead>' +
  '<tbody><tr><td style="background-color:#ffeeaa">Ana</td><td>30</td></tr><tr><td colspan="2">Total: 1</td></tr></tbody></table>'
const TABLE_CLEAN =
  '<table><caption>Idades</caption><thead><tr><th scope="col">Nome</th><th>Idade</th></tr></thead>' +
  '<tbody><tr><td style="background-color: rgb(255, 238, 170);">Ana</td><td>30</td></tr><tr><td colspan="2">Total: 1</td></tr></tbody></table>'

test('tabela colada: estrutura preservada ao colar, editar, salvar e reabrir', async ({ page }) => {
  const t = await mount(page)
  await paste(page, TABLE, 'Nome Idade Ana 30')
  expect(await t.html()).toBe(TABLE_CLEAN)

  // Editar uma célula
  await page.locator('#host .ve-content td', { hasText: '30' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type('1')
  const edited = TABLE_CLEAN.replace('<td>30</td>', '<td>301</td>')
  expect(await t.html()).toBe(edited)

  // Salvar e reabrir (como um banco de dados faria)
  const reopened = await page.evaluate((h) => {
    window.__ref.current!.setHTML(h)
    return window.__ref.current!.getHTML()
  }, edited)
  expect(reopened).toBe(edited)

  // Desfazer a reabertura não existe (setHTML reinicia o histórico); desfazer a edição sim
  await mount(page)
  await paste(page, TABLE, 'x')
  await page.waitForTimeout(500)
  await page.locator('#host .ve-content td', { hasText: '30' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type('9')
  await page.waitForTimeout(500)
  await page.keyboard.press('Control+z')
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(TABLE_CLEAN)
})

test('tabela colada: salvar em arquivo .html e abrir de novo', async ({ page }) => {
  const t = await mount(page)
  await paste(page, TABLE, 'x')
  const downloading = page.waitForEvent('download')
  await t.btn('Save to file (.html)').click()
  const file = readFileSync((await (await downloading).path())!, 'utf-8')
  await t.btn('Clear the editing area (deletes all content)').click()
  expect(await t.html()).toBe('')
  const chooser = page.waitForEvent('filechooser')
  await t.btn('Open file (.html)').click()
  await (
    await chooser
  ).setFiles({ name: 'tabela.html', mimeType: 'text/html', buffer: Buffer.from(file) })
  await expect.poll(t.html).toBe(TABLE_CLEAN)
})

test('imagem, linha horizontal e bloco de código colados', async ({ page }) => {
  const t = await mount(page)
  await paste(
    page,
    '<p>antes <img src="https://site.example/a.png" alt="foto"> depois</p><hr><pre><code>const x = 1;\n  y()</code></pre>',
  )
  expect(await t.html()).toBe(
    '<p>antes <img src="https://site.example/a.png" alt="foto" style="max-width: 100%;"> depois</p><hr><pre><code>const x = 1;\n  y()</code></pre>',
  )
})

test('pasteImages={false}: imagens coladas são descartadas', async ({ page }) => {
  const t = await mount(page, { pasteImages: false })
  await paste(page, '<p>antes <img src="https://site.example/a.png"> depois</p>')
  expect(await t.html()).toBe('<p>antes  depois</p>')
})

test('colar só uma imagem (sem texto) cola a imagem', async ({ page }) => {
  const t = await mount(page)
  await paste(page, '<img src="https://site.example/a.png">', '')
  expect(await t.html()).toContain('<img src="https://site.example/a.png"')
})
