// Barra de ferramentas em telas estreitas: o grupo de controles da caixa de
// texto (.ve-group) quebra em até duas linhas e não cria rolagem horizontal. Em
// 375px o grupo fica no limite da área útil da barra: cabe numa linha ou quebra
// em duas conforme as fontes do sistema e o navegador (Chromium no Windows: uma;
// Chromium no Linux e WebKit: duas). No computador continua numa linha só.
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

const group = (page: Page) => page.getByRole('group', { name: 'Text box tools' })

// Controles do grupo, pelo nome acessível
const CONTROLS = [
  ['button', 'Insert text box'],
  ['button', 'Text box border color'],
  ['combobox', 'Text box border width'],
  ['combobox', 'Text box border line style'],
  ['button', 'Delete text box'],
] as const

async function layout(page: Page) {
  return page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect()
    const g = r('#host .ve-group')
    const t = r('#host .ve-toolbar')
    const controls = [...document.querySelectorAll('#host .ve-group > *')].map((e) => {
      const b = e.getBoundingClientRect()
      return { right: b.right, left: b.left, top: b.top, bottom: b.bottom, w: b.width, h: b.height }
    })
    return {
      scroll: document.documentElement.scrollWidth,
      view: window.innerWidth,
      group: { left: g.left, right: g.right, top: g.top, bottom: g.bottom, height: g.height },
      toolbar: { left: t.left, right: t.right },
      controls,
    }
  })
}

// Linhas ocupadas pelos controles: um controle começa outra linha quando fica
// inteiro abaixo do anterior
function rows(controls: { top: number; bottom: number }[]) {
  const sorted = [...controls].sort((a, b) => a.top - b.top)
  let n = 0
  let bottom = -Infinity
  for (const c of sorted) {
    if (c.top >= bottom - 1) n++
    bottom = Math.max(bottom, c.bottom)
  }
  return n
}

for (const width of [320, 340, 375]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true })

    test('sem rolagem horizontal; grupo e controles dentro da barra e da tela', async ({
      page,
    }) => {
      await mount(page, { width: '100%', height: 300 })
      // Todos os controles presentes, visíveis e com nome acessível
      const g = group(page)
      for (const [role, name] of CONTROLS) await expect(g.getByRole(role, { name })).toBeVisible()

      const l = await layout(page)
      expect(l.scroll, 'rolagem horizontal').toBeLessThanOrEqual(l.view)
      expect(l.group.right).toBeLessThanOrEqual(l.toolbar.right)
      expect(l.group.left).toBeGreaterThanOrEqual(l.toolbar.left)
      expect(l.controls).toHaveLength(CONTROLS.length)
      for (const c of l.controls) {
        expect(c.w, 'controle visível').toBeGreaterThan(0)
        expect(c.h, 'controle visível').toBeGreaterThan(0)
        // Inteiro dentro do grupo (sem corte) e da tela
        expect(c.right, 'controle dentro do grupo').toBeLessThanOrEqual(l.group.right)
        expect(c.left, 'controle dentro do grupo').toBeGreaterThanOrEqual(l.group.left)
        expect(c.top, 'controle dentro do grupo').toBeGreaterThanOrEqual(l.group.top - 0.5)
        expect(c.bottom, 'controle dentro do grupo').toBeLessThanOrEqual(l.group.bottom + 0.5)
        expect(c.left, 'controle dentro da tela').toBeGreaterThanOrEqual(0)
        expect(c.right, 'controle dentro da tela').toBeLessThanOrEqual(l.view)
      }
      // Nenhum controle sobre outro
      for (const [i, a] of l.controls.entries())
        for (const b of l.controls.slice(i + 1)) {
          const overlap =
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
          expect(overlap, 'controles sobrepostos').toBe(false)
        }
      // No máximo duas linhas, em qualquer sistema e navegador; a altura do grupo
      // acompanha (uma linha tem ~30px, duas ~66px)
      expect(rows(l.controls), 'no máximo duas linhas').toBeLessThanOrEqual(2)
      expect(l.group.height, 'no máximo duas linhas').toBeLessThan(75)
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
