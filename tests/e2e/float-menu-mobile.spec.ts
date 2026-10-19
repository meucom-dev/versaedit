// Menu flutuante da imagem/caixa de texto em telas pequenas: não passa da área
// nem da tela, quebra em linhas, não cobre o objeto e continua utilizável por
// toque e por teclado. No computador, continua numa linha só, como antes.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { mount, PNG } from './helpers'

const IMG = `<img src="data:image/png;base64,${PNG}" style="width: 120px; height: 120px">`
const CONTENT = `<p>Texto antes da imagem, numa linha.</p><p>${IMG}</p><p>Texto depois.</p>`
const TEXTBOX =
  '<p>Antes.</p><div class="rich-textbox" style="width: 160px"><span contenteditable="false" class="textbox-handle">⠿</span>Caixa</div><p>Depois.</p>'

const box = async (l: Locator) => (await l.boundingBox())!
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function expectInside(page: Page, menu: Locator) {
  const [m, frame] = await Promise.all([box(menu), box(page.locator('#host .ve-frame'))])
  const view = page.viewportSize()!.width
  expect(m.x, 'borda esquerda da área').toBeGreaterThanOrEqual(frame.x)
  expect(m.x + m.width, 'borda direita da área').toBeLessThanOrEqual(frame.x + frame.width)
  expect(m.x + m.width, 'borda da tela').toBeLessThanOrEqual(view)
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scroll, 'rolagem horizontal').toBeLessThanOrEqual(view)
  return m
}

for (const width of [375, 414]) {
  test.describe(`celular ${width}px`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true })

    test('imagem: menu dentro da área e da tela, em até duas linhas, sem cobrir a imagem', async ({
      page,
    }) => {
      await mount(page, { initialContent: CONTENT, width: '100%', height: 420 })
      const img = page.locator('#host .ve-content img')
      await img.tap()
      const menu = page.locator('#host .ve-float-toolbar')
      await expect(menu).toBeVisible()
      const m = await expectInside(page, menu)
      expect(m.height, 'no máximo duas linhas').toBeLessThan(70)
      expect(overlaps(m, await box(img)), 'menu sobre a imagem').toBe(false)
      // Todos os botões visíveis e dentro da área
      const frame = await box(page.locator('#host .ve-frame'))
      for (const b of await menu.locator('button').all()) {
        const r = await box(b)
        expect(r.x + r.width).toBeLessThanOrEqual(frame.x + frame.width)
      }
    })

    test('imagem: botões funcionam por toque e por teclado', async ({ page }) => {
      await mount(page, { initialContent: CONTENT, width: '100%', height: 420 })
      const img = page.locator('#host .ve-content img')
      await img.tap()
      const menu = page.locator('#host .ve-float-toolbar')
      // Toque: 50%
      await menu.getByRole('button', { name: '50%' }).tap()
      await expect(img).toHaveAttribute('style', /width: 50%/)
      // Teclado: foco no botão de flutuar à direita e Enter
      const right = menu.locator('button').nth(5)
      await right.focus()
      await expect(right).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(img).toHaveClass(/pos-right/)
      await expectInside(page, page.locator('#host .ve-float-toolbar'))
    })

    test('caixa de texto: menu também dentro da área e da tela', async ({ page }) => {
      await mount(page, { initialContent: TEXTBOX, width: '100%', height: 420 })
      await page.locator('#host .ve-content .textbox-handle').tap()
      const menu = page.locator('#host .ve-float-toolbar')
      await expect(menu).toBeVisible()
      await expectInside(page, menu)
    })
  })
}

test('computador: menu numa linha só, na largura natural e alinhado à imagem', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await mount(page, { initialContent: CONTENT, width: 900, height: 420 })
  const img = page.locator('#host .ve-content img')
  await img.click()
  const menu = page.locator('#host .ve-float-toolbar')
  const [m, i] = await Promise.all([box(menu), box(img)])
  expect(m.height, 'uma linha').toBeLessThan(40)
  expect(m.width, 'largura natural (sem quebra)').toBeGreaterThan(400)
  expect(Math.abs(m.x - i.x)).toBeLessThan(3)
  // Imagem perto do topo: o menu vai para baixo dela (regra das bordas), sem cobri-la
  expect(overlaps(m, i), 'menu sobre a imagem').toBe(false)
})
