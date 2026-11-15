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
          onLastRow:
            Math.round(g.top) === tops.at(-1) ||
            g.top >= Math.max(...items.slice(0, -1).map((r) => r.top)) - 1,
          rightGap: inner - g.right,
        }
      })
      expect(info.last).toBe(true)
      expect(info.onLastRow).toBe(true)
      expect(Math.abs(info.rightGap)).toBeLessThan(1)
      // A engrenagem não cria linha: o mesmo número de linhas que sem ela
      await mount(page, { initialContent: TEXT, width })
      const without = await page.evaluate(
        () =>
          new Set(
            [...document.querySelector('#host .ve-toolbar')!.children].map((el) =>
              Math.round(el.getBoundingClientRect().top),
            ),
          ).size,
      )
      expect(info.rows).toBe(without)
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
