// Barra de ferramentas em telas estreitas: o grupo de controles da caixa de
// texto (.ve-group) quebra em linhas e não cria rolagem horizontal; de 375px
// para cima, e no computador, continua numa linha só, como antes.
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

const group = (page: Page) => page.getByRole('group', { name: 'Text box tools' })

async function layout(page: Page) {
  return page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect()
    const g = r('#host .ve-group')
    const t = r('#host .ve-toolbar')
    const controls = [...document.querySelectorAll('#host .ve-group > *')].map((e) => {
      const b = e.getBoundingClientRect()
      return { right: b.right, left: b.left, w: b.width, h: b.height }
    })
    return {
      scroll: document.documentElement.scrollWidth,
      view: window.innerWidth,
      group: { left: g.left, right: g.right, height: g.height },
      toolbar: { left: t.left, right: t.right },
      controls,
    }
  })
}

for (const width of [320, 340, 375]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true })

    test('sem rolagem horizontal; grupo e controles dentro da barra e da tela', async ({
      page,
      browserName,
    }) => {
      await mount(page, { width: '100%', height: 300 })
      const l = await layout(page)
      expect(l.scroll, 'rolagem horizontal').toBeLessThanOrEqual(l.view)
      expect(l.group.right).toBeLessThanOrEqual(l.toolbar.right)
      expect(l.group.left).toBeGreaterThanOrEqual(l.toolbar.left)
      for (const c of l.controls) {
        expect(c.w, 'controle visível').toBeGreaterThan(0)
        expect(c.right, 'controle dentro do grupo').toBeLessThanOrEqual(l.group.right)
      }
      // Até 340px o grupo ocupa duas linhas. Em 375px, uma linha no Chromium; no
      // WebKit o grupo (312px) é 1px mais largo que a área útil da barra e quebra
      // em duas (antes da correção ele invadia o respiro interno da barra)
      if (width >= 375 && browserName === 'chromium')
        expect(l.group.height, 'uma linha').toBeLessThan(40)
      else expect(l.group.height, 'no máximo duas linhas').toBeLessThan(75)
    })

    test('controles da caixa de texto funcionam por toque', async ({ page }) => {
      await mount(page, { width: '100%', height: 300, initialContent: '<p>alpha</p>' })
      const g = group(page)
      await page.locator('#host .ve-content p').tap()
      await g.getByRole('button', { name: 'Insert text box' }).tap()
      const box = page.locator('#host .ve-content .rich-textbox')
      await expect(box).toHaveCount(1)
      await box.locator('.textbox-handle').tap()
      // Espessura e estilo da borda (selects do grupo, inclusive na 2ª linha)
      await g.getByLabel('Text box border width').selectOption('3')
      await g.getByLabel('Text box border line style').selectOption('solid')
      await expect(box).toHaveAttribute('style', /border/)
      await g.getByRole('button', { name: 'Delete text box' }).tap()
      await expect(box).toHaveCount(0)
    })
  })
}

test('computador (1200px): grupo numa linha só, na largura natural', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await mount(page, { width: 900, height: 420 })
  const l = await layout(page)
  expect(l.scroll).toBeLessThanOrEqual(l.view)
  expect(l.group.height, 'uma linha').toBeLessThan(40)
  // Os controles ficam lado a lado, na mesma linha
  const tops = await page.evaluate(() =>
    [...document.querySelectorAll('#host .ve-group > *')].map((e) =>
      Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2),
    ),
  )
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2)
})
