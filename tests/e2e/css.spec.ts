// CSS do editor: injetado (padrão) ou importado (injectStyles={false}), com a
// mesma aparência; e o CSS de exibição do conteúdo publicado.
import { expect, test } from '@playwright/test'
import { mount, PNG } from './helpers'

const CONTENT = `<p>Texto <b>forte</b> e <i>itálico</i>.</p><div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>caixa</div><table><tbody><tr><th>A</th><td>1</td></tr></tbody></table>`

test('injectStyles={false} não injeta nada', async ({ page }) => {
  await mount(page, {}, { css: 'none' })
  await expect(page.locator('#versaedit-styles')).toHaveCount(0)
})

test('CSS importado tem a mesma aparência do injetado (pixel a pixel)', async ({ browser }) => {
  const shot = async (css: 'inject' | 'import') => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
    await mount(page, { initialContent: CONTENT, locale: 'pt-BR' }, { css })
    expect(await page.locator('#versaedit-styles').count()).toBe(css === 'inject' ? 1 : 0)
    const image = await page.locator('#host .ve-root').screenshot({ animations: 'disabled' })
    await page.close()
    return image
  }
  const injected = await shot('inject')
  const imported = await shot('import')
  expect(imported.equals(injected)).toBe(true)
})

test('CSS de exibição: alça escondida, imagem posicionada, tabela com borda', async ({ page }) => {
  await page.goto('/harness.html')
  await page.waitForFunction(() => typeof window.__showContent === 'function')
  await page.evaluate(
    (html) => window.__showContent(html),
    `${CONTENT}<img class="pos-left" src="data:image/png;base64,${PNG}" style="width:40px"><p>depois</p>`,
  )
  const box = page.locator('.versaedit-content')
  await expect(box.locator('.textbox-handle')).toBeHidden()
  expect(await box.locator('img').evaluate((el) => getComputedStyle(el).float)).toBe('left')
  expect(await box.locator('td').evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe(
    'solid',
  )
  expect(
    await box.locator('.rich-textbox').evaluate((el) => getComputedStyle(el).borderTopStyle),
  ).toBe('dashed')
})

test('CSS de exibição: recuo antigo (sem role) não vira citação; citações não mudam', async ({
  page,
}) => {
  await page.goto('/harness.html')
  await page.waitForFunction(() => typeof window.__showContent === 'function')
  const LEGACY = 'margin: 0 0 0 40px; border: none; padding: 0px;'
  await page.evaluate(
    (html) => window.__showContent(html),
    [
      `<blockquote id="legado" style="${LEGACY}"><p>recuo antigo</p></blockquote>`,
      `<blockquote id="novo" style="${LEGACY}" role="presentation"><p>recuo novo</p></blockquote>`,
      '<blockquote id="citacao"><p>citação</p></blockquote>',
      `<blockquote style="${LEGACY}"><blockquote id="dentro"><p>citação recuada</p></blockquote></blockquote>`,
      '<blockquote id="firefox" style="margin-left: 40px;"><p>citação recuada (Firefox)</p></blockquote>',
      '<blockquote id="borda" style="margin: 0 0 0 40px; border-left: 3px solid red;"><p>citação com margem</p></blockquote>',
    ].join(''),
  )
  const fontStyle = (id: string) =>
    page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).fontStyle)
  expect(await fontStyle('legado')).toBe('normal')
  expect(await fontStyle('novo')).toBe('normal')
  expect(await fontStyle('citacao')).toBe('italic')
  expect(await fontStyle('dentro')).toBe('italic')
  expect(await fontStyle('firefox')).toBe('italic')
  expect(await fontStyle('borda')).toBe('italic')
})
