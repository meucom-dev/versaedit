// Engrenagem da barra de ferramentas (prop settingsPanel) — 15/11/2026. Botão no
// fim da barra, encostado à direita da última linha (sem linhas artificiais);
// painel com o conteúdo da aplicação, aberto e fechado pela biblioteca (Esc,
// clique fora, close(), começo de redimensionamento), com foco, acessibilidade,
// teclado, seleção e histórico preservados.
import { expect, test, type Page } from '@playwright/test'
import { mount, selectText } from './helpers'

const TEXT = '<p>Primeiro parágrafo com algumas palavras.</p><p>Segundo parágrafo.</p>'
const gear = (page: Page) =>
  page.locator('#host .ve-toolbar').getByRole('button', { name: 'Settings' })
const panel = (page: Page) => page.locator('#host').getByRole('dialog', { name: 'Settings' })
const html = (page: Page) => page.evaluate(() => window.__ref.current!.getHTML())

test.describe('sem settingsPanel', () => {
  test('nenhuma engrenagem; a barra é a de sempre', async ({ page }) => {
    await mount(page, { initialContent: TEXT })
    await expect(gear(page)).toHaveCount(0)
    await expect(page.locator('#host .ve-settings-wrap')).toHaveCount(0)
    // Último botão da barra continua sendo o Limpar formatação
    const last = page.locator('#host .ve-toolbar > *').last()
    await expect(last).toHaveAttribute('aria-label', 'Clear formatting')
  })

  test('toolbar vazia sem settingsPanel: nenhuma barra (como antes)', async ({ page }) => {
    await mount(page, { initialContent: TEXT, toolbar: [] })
    await expect(page.locator('#host .ve-toolbar')).toHaveCount(0)
  })
})

test.describe('posição: último item, à direita da última linha', () => {
  for (const width of [1600, 900, 390]) {
    test(`barra de ${width}px (uma, várias linhas)`, async ({ page }) => {
      await page.setViewportSize({ width: Math.max(width + 40, 420), height: 900 })
      await mount(page, { initialContent: TEXT, width }, { settings: 'node' })
      const info = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>('#host .ve-toolbar')!
        const cs = getComputedStyle(bar)
        const inner =
          bar.getBoundingClientRect().right -
          parseFloat(cs.paddingRight) -
          parseFloat(cs.borderRightWidth)
        const items = [...bar.children].map((el) => el.getBoundingClientRect())
        const tops = [...new Set(items.map((r) => Math.round(r.top)))].sort((a, b) => a - b)
        const wrap = bar.querySelector('.ve-settings-wrap')!
        const g = wrap.getBoundingClientRect()
        return {
          last: bar.lastElementChild === wrap,
          rows: tops.length,
          gearWidth: g.width,
          gap: parseFloat(cs.columnGap) || 0,
          aloneOnLastRow: items.filter((r) => Math.round(r.top) === Math.round(g.top)).length === 1,
          onLastRow:
            Math.round(g.top) === tops.at(-1) ||
            g.top >= Math.max(...items.slice(0, -1).map((r) => r.top)) - 1,
          rightGap: inner - g.right,
        }
      })
      expect(info.last).toBe(true)
      expect(info.onLastRow).toBe(true)
      expect(Math.abs(info.rightGap)).toBeLessThan(1)
      // Sem a engrenagem: linhas da barra e espaço livre no fim da última linha.
      // A engrenagem entra na última linha quando cabe nela; senão, fica sozinha
      // numa linha própria (as fontes de cada sistema mudam a largura dos itens)
      await mount(page, { initialContent: TEXT, width })
      const without = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>('#host .ve-toolbar')!
        const cs = getComputedStyle(bar)
        const inner =
          bar.getBoundingClientRect().right -
          parseFloat(cs.paddingRight) -
          parseFloat(cs.borderRightWidth)
        const items = [...bar.children].map((el) => el.getBoundingClientRect())
        const tops = [...new Set(items.map((r) => Math.round(r.top)))]
        const lastTop = Math.max(...tops)
        const lastRight = Math.max(
          ...items.filter((r) => Math.round(r.top) === lastTop).map((r) => r.right),
        )
        return { rows: tops.length, free: inner - lastRight }
      })
      if (without.free >= info.gearWidth + info.gap) {
        expect(info.rows, 'cabe na última linha: nenhuma linha a mais').toBe(without.rows)
        expect(info.aloneOnLastRow).toBe(false)
      } else {
        expect(info.rows, 'última linha cheia: uma linha só para a engrenagem').toBe(
          without.rows + 1,
        )
        expect(info.aloneOnLastRow).toBe(true)
      }
      await mount(page, { initialContent: TEXT, width }, { settings: 'node' })
      // Aberto: painel inteiro dentro da janela, sem rolagem lateral
      await gear(page).click()
      await expect(panel(page)).toBeVisible()
      const box = (await panel(page).boundingBox())!
      const view = page.viewportSize()!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(view.width)
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(scroll).toBe(0)
    })
  }

  test('toolbar vazia com settingsPanel: a barra mostra só a engrenagem', async ({ page }) => {
    await mount(page, { initialContent: TEXT, toolbar: [] }, { settings: 'node' })
    await expect(page.locator('#host .ve-toolbar > *')).toHaveCount(1)
    await expect(gear(page)).toBeVisible()
  })
  test('várias larguras: na última linha quando cabe; senão, numa linha própria à direita', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1300, height: 900 })
    const WIDTHS = Array.from({ length: 36 }, (_, i) => 420 + i * 20)
    // Barra na largura do contêiner (#host), medida em cada largura
    const measure = (withGear: boolean) =>
      page.evaluate(
        ([ws, gear]) =>
          ws.map((w) => {
            document.getElementById('host')!.style.width = `${w}px`
            const bar = document.querySelector<HTMLElement>('#host .ve-toolbar')!
            const cs = getComputedStyle(bar)
            const inner =
              bar.getBoundingClientRect().right -
              parseFloat(cs.paddingRight) -
              parseFloat(cs.borderRightWidth)
            const items = [...bar.children].map((el) => el.getBoundingClientRect())
            const tops = [...new Set(items.map((r) => Math.round(r.top)))]
            const lastTop = Math.max(...tops)
            const onLast = items.filter((r) => Math.round(r.top) === lastTop)
            if (!gear)
              return { rows: tops.length, free: inner - Math.max(...onLast.map((r) => r.right)) }
            const g = bar.querySelector('.ve-settings-wrap')!.getBoundingClientRect()
            return {
              rows: tops.length,
              gearOnLast: Math.round(g.top) === lastTop,
              alone: onLast.length === 1,
              rightGap: Math.abs(inner - g.right),
              gearWidth: g.width,
              gap: parseFloat(cs.columnGap) || 0,
            }
          }),
        [WIDTHS, withGear] as const,
      )
    await mount(page, { initialContent: TEXT, width: '100%' })
    const without = await measure(false)
    await mount(page, { initialContent: TEXT, width: '100%' }, { settings: 'node' })
    const withGear = await measure(true)
    const cases = { fits: 0, ownRow: 0 }
    WIDTHS.forEach((w, i) => {
      const a = without[i] as { rows: number; free: number }
      const b = withGear[i] as {
        rows: number
        gearOnLast: boolean
        alone: boolean
        rightGap: number
        gearWidth: number
        gap: number
      }
      expect(b.gearOnLast, `${w}px: engrenagem na última linha`).toBe(true)
      expect(b.rightGap, `${w}px: encostada à direita`).toBeLessThan(1)
      if (a.free >= b.gearWidth + b.gap) {
        cases.fits++
        expect(b.rows, `${w}px: cabe, sem linha a mais`).toBe(a.rows)
        expect(b.alone, `${w}px: divide a linha com outros itens`).toBe(false)
      } else {
        cases.ownRow++
        expect(b.rows, `${w}px: linha cheia, uma linha a mais`).toBe(a.rows + 1)
        expect(b.alone, `${w}px: sozinha na linha nova`).toBe(true)
      }
    })
    // As larguras cobrem os dois casos
    expect(cases.fits).toBeGreaterThan(0)
    expect(cases.ownRow).toBeGreaterThan(0)
  })
})

test.describe('abrir e fechar', () => {
  test('acessibilidade; ao abrir, foco no primeiro controle; Esc fecha e devolve o foco', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'node' })
    await expect(gear(page)).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(gear(page)).toHaveAttribute('aria-expanded', 'false')
    await gear(page).click()
    await expect(gear(page)).toHaveAttribute('aria-expanded', 'true')
    const id = await gear(page).getAttribute('aria-controls')
    await expect(panel(page)).toHaveAttribute('id', id!)
    await expect(page.getByTestId('settings-name')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(gear(page)).toBeFocused()
    await expect(gear(page)).toHaveAttribute('aria-expanded', 'false')
  })

  test('Esc usado por um controle do painel (desfazer o digitado) não fecha o painel', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'node' })
    await gear(page).click()
    // Um campo que usa o Esc para si (como os campos numéricos do playground)
    await page.getByTestId('settings-name').evaluate((el) =>
      el.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape') e.preventDefault()
      }),
    )
    await page.getByTestId('settings-name').press('Escape')
    await expect(panel(page)).toBeVisible()
    // No painel (fora do campo), o Esc fecha
    await panel(page).getByText('Opção').click()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
  })

  test('controles do painel não o fecham; clique fora fecha sem roubar o foco', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'node' })
    await gear(page).click()
    await page.getByTestId('settings-name').fill('abc')
    await page.getByTestId('settings-check').check()
    await page.getByText('Opção').click()
    await expect(panel(page)).toBeVisible()
    // Clique no texto do editor: fecha, e o foco fica no editor
    await page.locator('#host .ve-content p').first().click()
    await expect(panel(page)).toHaveCount(0)
    expect(
      await page.evaluate(() => document.activeElement?.classList.contains('ve-content')),
    ).toBe(true)
  })

  test('função com close: o botão do conteúdo fecha e devolve o foco à engrenagem', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'function' })
    await gear(page).click()
    await panel(page).getByRole('button', { name: 'Fechar' }).click()
    await expect(panel(page)).toHaveCount(0)
    await expect(gear(page)).toBeFocused()
  })

  test('a engrenagem fecha o que abriu; um segundo clique não reabre por engano', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'node' })
    await gear(page).click()
    await expect(panel(page)).toBeVisible()
    await gear(page).click()
    await expect(panel(page)).toHaveCount(0)
  })

  test('começar a redimensionar a área fecha o painel', async ({ page }) => {
    await mount(page, { initialContent: TEXT, resizable: true }, { settings: 'node' })
    await gear(page).click()
    await expect(panel(page)).toBeVisible()
    const h = (await page.locator('#host .ve-frame-handle-se').boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + 30, h.y + 20, { steps: 3 })
    await page.mouse.up()
    await expect(panel(page)).toHaveCount(0)
  })

  test('abrir um menu da barra com o painel aberto: o painel fecha', async ({ page }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'node' })
    await gear(page).click()
    await page.locator('#host .ve-toolbar .ve-font-button').click()
    await expect(panel(page)).toHaveCount(0)
    await expect(page.locator('#host .ve-font-options')).toBeVisible()
  })
})

test.describe('teclado, seleção e histórico', () => {
  test('setas da barra chegam à engrenagem; Enter abre; setas no painel ficam no painel', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'node' })
    // Primeiro controle da barra, depois End: a engrenagem (último item)
    await page.locator('#host .ve-toolbar button').first().focus()
    await page.keyboard.press('End')
    await expect(gear(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('settings-name')).toBeFocused()
    await page.keyboard.type('xy')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Home')
    // O foco continua no campo do painel (as setas não foram para a barra)
    await expect(page.getByTestId('settings-name')).toBeFocused()
  })

  test('a seleção do texto e o HTML ficam como estavam; nada vai para o histórico', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: TEXT }, { settings: 'node' })
    await t.caretToEnd()
    await page.keyboard.type(' fim')
    await selectText(page, 'algumas')
    const before = await html(page)
    const changes = await page.evaluate(() => window.__out.changes)
    await gear(page).click()
    await page.getByTestId('settings-name').fill('qualquer coisa')
    await page.keyboard.press('Escape')
    expect(await html(page)).toBe(before)
    expect(await page.evaluate(() => window.__out.changes)).toBe(changes)
    // De volta ao editor: a seleção de antes volta
    await page.evaluate(() => window.__ref.current!.focus())
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('algumas')
    // Desfazer volta a digitação (abrir e usar o painel não é um passo)
    await page.keyboard.press('Control+z')
    expect(await html(page)).not.toContain(' fim')
  })
})

test.describe('acessibilidade (revisão)', () => {
  test('estrutura exposta: botão expandido e diálogo com nome, com os controles dentro', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'function' })
    await gear(page).click()
    await expect(page.locator('#host .ve-settings-wrap')).toMatchAriaSnapshot(`
      - button "Settings" [expanded]
      - dialog "Settings":
        - textbox "Nome"
        - checkbox "Opção"
        - button "Fechar"
    `)
  })

  test('Tab depois do último controle: o foco segue e o painel fecha (não fica aberto sobre o texto)', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'function' })
    await gear(page).click()
    await panel(page).getByRole('button', { name: 'Fechar' }).focus()
    await page.keyboard.press('Tab')
    await expect(panel(page)).toHaveCount(0)
    await expect(gear(page)).toHaveAttribute('aria-expanded', 'false')
    // O foco foi para onde o Tab o levou (não voltou à engrenagem)
    await expect(gear(page)).not.toBeFocused()
  })

  test('Shift+Tab do primeiro controle volta à engrenagem com o painel aberto', async ({
    page,
  }) => {
    await mount(page, { initialContent: TEXT }, { settings: 'node' })
    await gear(page).click()
    await expect(page.getByTestId('settings-name')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(gear(page)).toBeFocused()
    await expect(panel(page)).toBeVisible()
  })
})

test.describe('dimensões padrão da biblioteca', () => {
  for (const viewport of [390, 1300]) {
    test(`sem width/height: largura do contêiner e altura de 500px (${viewport}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport, height: 900 })
      await mount(page, { initialContent: TEXT }, { librarySize: true })
      const r = await page.evaluate(() => {
        const host = document.getElementById('host')!
        const frame = document.querySelector<HTMLElement>('#host .ve-frame')!
        return {
          host: host.clientWidth,
          frame: frame.getBoundingClientRect().width,
          height: frame.getBoundingClientRect().height,
          scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      expect(Math.abs(r.frame - r.host)).toBeLessThan(1)
      expect(r.height).toBe(500)
      expect(r.scroll).toBe(0)
    })
  }

  test('dimensões fixadas pelo integrador continuam valendo', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 900 })
    await mount(page, { initialContent: TEXT, width: 700, height: 300 }, { librarySize: true })
    const box = (await page.locator('#host .ve-frame').boundingBox())!
    expect(box.width).toBe(700)
    expect(box.height).toBe(300)
  })

  test('largura fixa maior que a tela encolhe, sem rolagem horizontal (390px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await mount(page, { initialContent: TEXT, width: 800, height: 500 }, { librarySize: true })
    const r = await page.evaluate(() => ({
      host: document.getElementById('host')!.clientWidth,
      frame: document.querySelector('#host .ve-frame')!.getBoundingClientRect().width,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(r.frame).toBeLessThanOrEqual(r.host)
    expect(r.scroll).toBe(0)
  })
})
