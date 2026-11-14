// Alinhamento do texto isolado do CSS da página (lote 2, 14/11/2026): o editor
// herdava o text-align do elemento pai — no modelo do Vite (body centralizado) o
// texto do editor aparecia centralizado. O alinhamento inicial é o padrão do
// navegador (à esquerda em textos da esquerda para a direita); o HTML gravado
// não ganha estilo nenhum por isso.
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

const centerPage = (page: Page) =>
  page.evaluate(() => {
    document.body.style.textAlign = 'center'
  })

/** Alinhamento calculado e distância do texto à borda esquerda da área de edição */
const alignOf = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)!
    const content = document.querySelector<HTMLElement>('#host .ve-content')!
    const range = document.createRange()
    range.selectNodeContents(el)
    const text = range.getBoundingClientRect()
    const box = content.getBoundingClientRect()
    return {
      align: getComputedStyle(el).textAlign,
      fromLeft: Math.round(text.left - box.left),
    }
  }, selector)

const LEFT = /^(start|left)$/

test.describe('página com text-align: center', () => {
  test('o texto do editor começa à esquerda e o HTML não muda', async ({ page }) => {
    await mount(page, { initialContent: '<p>abc</p>', width: 600, height: 200 })
    await centerPage(page)
    const p = await alignOf(page, '#host .ve-content p')
    expect(p.align).toMatch(LEFT)
    // padding da área de edição: 16px
    expect(p.fromLeft).toBeLessThanOrEqual(17)
    expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe('<p>abc</p>')
  })

  test('texto digitado num editor vazio também fica à esquerda', async ({ page }) => {
    const t = await mount(page, { width: 600, height: 200 })
    await centerPage(page)
    await t.content.click()
    await page.keyboard.type('digitado')
    const first = await page.evaluate(() => {
      const c = document.querySelector<HTMLElement>('#host .ve-content')!
      const r = document.createRange()
      r.selectNodeContents(c)
      return Math.round(r.getBoundingClientRect().left - c.getBoundingClientRect().left)
    })
    expect(first).toBeLessThanOrEqual(17)
    expect(await t.html()).not.toContain('text-align')
  })

  test('alinhar ao centro, à direita e de volta à esquerda continua funcionando', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>abc</p>', width: 600, height: 200 })
    await centerPage(page)
    await t.content.locator('p').click()
    await t.btn('Center').click()
    expect((await alignOf(page, '#host .ve-content p')).align).toBe('center')
    await t.btn('Align right').click()
    expect((await alignOf(page, '#host .ve-content p')).align).toBe('right')
    await t.btn('Align left').click()
    const left = await alignOf(page, '#host .ve-content p')
    expect(left.align).toMatch(LEFT)
    expect(left.fromLeft).toBeLessThanOrEqual(17)
  })

  test('conteúdo carregado com alinhamento explícito o mantém', async ({ page }) => {
    const html =
      '<p style="text-align: right;">dir</p><p style="text-align: center;">cen</p>' +
      '<p style="text-align: justify;">jus</p><p style="text-align: left;">esq</p>'
    const t = await mount(page, { initialContent: html, width: 600, height: 300 })
    await centerPage(page)
    const aligns = await t.content
      .locator('p')
      .evaluateAll((ps) => ps.map((p) => getComputedStyle(p).textAlign))
    expect(aligns).toEqual(['right', 'center', 'justify', 'left'])
    expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(html)
  })

  test('menus da barra não herdam o alinhamento da página', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>abc</p>', width: 600, height: 200 })
    await centerPage(page)
    await t.content.locator('p').click()
    await t.btn('Insert link (Ctrl+K)').click()
    const label = await page
      .locator('#host .ve-link-popover label')
      .first()
      .evaluate((el) => getComputedStyle(el).textAlign)
    expect(label).toMatch(LEFT)
  })

  test('conteúdo publicado (versaedit-content.css) também fica à esquerda', async ({ page }) => {
    await mount(page)
    await centerPage(page)
    await page.evaluate(() => window.__showContent('<p>publicado</p>'))
    expect(
      await page
        .locator('#host .versaedit-content p')
        .evaluate((el) => getComputedStyle(el).textAlign),
    ).toMatch(LEFT)
  })
})

test('página da direita para a esquerda: o início do texto acompanha a direção', async ({
  page,
}) => {
  await mount(page, { initialContent: '<p>abc</p>', width: 600, height: 200 })
  await page.evaluate(() => {
    document.body.style.textAlign = 'center'
    document.documentElement.dir = 'rtl'
  })
  // text-align: start — à direita numa página rtl, nunca centralizado
  expect(
    await page.locator('#host .ve-content p').evaluate((el) => getComputedStyle(el).textAlign),
  ).toMatch(/^(start|right)$/)
})
