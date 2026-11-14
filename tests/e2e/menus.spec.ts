// Menus da barra (lote 2, 14/11/2026):
// - abertos perto da borda direita (janela estreita, celular, zoom alto) eles
//   passavam da janela e ficavam cortados — em todos os navegadores;
// - com o foco no texto (os botões da barra devolvem o foco ao editor para manter
//   a seleção), o Esc não fechava o menu de fontes, a paleta de cores nem o
//   marca-texto; o marca-texto também não fechava ao clicar fora.
import { expect, test, type Page } from '@playwright/test'
import { mount, selectText } from './helpers'

const MENUS = {
  fonte: { open: '.ve-font-button', menu: '.ve-font-options' },
  'cor do texto': { open: '.ve-color-picker > button >> nth=0', menu: '.ve-palette' },
  'cor do papel': { open: '.ve-color-picker >> nth=1 >> button >> nth=0', menu: '.ve-palette' },
  'marca-texto': { open: '.ve-highlight-wrap > button', menu: '.ve-highlight-palette' },
  link: { open: '.ve-link-wrap > button', menu: '.ve-link-popover' },
} as const

/** Posição do menu e do botão que o abriu, e a largura útil da janela */
const placement = (page: Page, menu: string, button: string) =>
  page.evaluate(
    ([menu, button]) => {
      const m = document.querySelector(`#host ${menu}`)!.getBoundingClientRect()
      const b = document.querySelector(`#host ${button}`)!.getBoundingClientRect()
      return {
        left: m.left,
        right: m.right,
        top: m.top,
        buttonLeft: b.left,
        buttonRight: b.right,
        buttonBottom: b.bottom,
        view: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }
    },
    [menu, button] as const,
  )

const selectorOf = (open: string) => open.split(' >> ')[0] // primeiro seletor CSS, para medir o botão

for (const [width, editorWidth] of [
  [800, undefined],
  [360, '100%'],
] as const) {
  test.describe(`janela de ${width}px`, () => {
    test.use({ viewport: { width, height: 760 } })

    for (const [name, { open, menu }] of Object.entries(MENUS)) {
      test(`${name}: o menu fica inteiro dentro da janela, junto do botão`, async ({ page }) => {
        const t = await mount(page, {
          initialContent: '<p>um texto aqui</p>',
          ...(editorWidth ? { width: editorWidth } : {}),
          height: 300,
        })
        await selectText(page, 'texto')
        const button = t.toolbar.locator(open)
        await button.click()
        await expect(page.locator(`#host ${menu}`)).toBeVisible()
        const p = await page.evaluate(
          ([menu]) => {
            const m = document.querySelector(`#host ${menu}`)!.getBoundingClientRect()
            return {
              left: m.left,
              right: m.right,
              top: m.top,
              view: document.documentElement.clientWidth,
            }
          },
          [menu] as const,
        )
        const b = (await button.boundingBox())!
        expect(p.left).toBeGreaterThanOrEqual(0)
        expect(p.right).toBeLessThanOrEqual(p.view)
        // Continua abaixo do botão e encostado nele na horizontal
        expect(p.top).toBeGreaterThanOrEqual(b.y + b.height - 1)
        expect(p.left).toBeLessThanOrEqual(b.x + b.width)
        expect(p.right).toBeGreaterThanOrEqual(b.x)
      })
    }
  })
}

test('menu longe da borda não se desloca', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>um texto aqui</p>' })
  await selectText(page, 'texto')
  await t.toolbar.locator('.ve-font-button').click()
  const p = await placement(page, '.ve-font-options', selectorOf('.ve-font-button'))
  expect(Math.abs(p.left - p.buttonLeft)).toBeLessThan(1)
  expect(await page.locator('#host .ve-font-options').evaluate((el) => el.style.translate)).toBe('')
})

test.describe('Esc com o foco no texto', () => {
  for (const [name, { open, menu }] of Object.entries(MENUS)) {
    test(`${name}: Esc fecha o menu e a seleção do texto continua`, async ({ page }) => {
      const t = await mount(page, { initialContent: '<p>um texto aqui</p>' })
      await selectText(page, 'texto')
      await t.toolbar.locator(open).click()
      await expect(page.locator(`#host ${menu}`)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator(`#host ${menu}`)).toHaveCount(0)
      expect(await page.evaluate(() => getSelection()!.toString())).toBe('texto')
      // Digitar substitui o trecho selecionado, como sempre
      await page.keyboard.type('Z')
      expect(await t.content.locator('p').textContent()).toBe('um Z aqui')
    })
  }

  test('sem menu aberto, Esc não mexe na seleção nem no texto', async ({ page }) => {
    await mount(page, { initialContent: '<p>um texto aqui</p>' })
    await selectText(page, 'texto')
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('texto')
    expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe('<p>um texto aqui</p>')
  })

  test('Esc fora do editor não fecha o menu de outro editor', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um texto aqui</p>' })
    await page.evaluate(() => {
      const input = document.createElement('input')
      input.id = 'fora'
      document.body.appendChild(input)
    })
    await t.toolbar.locator('.ve-highlight-wrap > button').click()
    await page.evaluate(() => document.getElementById('fora')!.focus())
    await page.keyboard.press('Escape')
    await expect(page.locator('#host .ve-highlight-palette')).toBeVisible()
  })
})

test('marca-texto fecha ao clicar fora, como os outros menus', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>um texto aqui</p>' })
  await t.toolbar.locator('.ve-highlight-wrap > button').click()
  await expect(page.locator('#host .ve-highlight-palette')).toBeVisible()
  await t.content.locator('p').click()
  await expect(page.locator('#host .ve-highlight-palette')).toHaveCount(0)
})
