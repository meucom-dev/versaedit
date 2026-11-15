// Redimensionamento da área de edição — Lote 1 (15/11/2026): alças à direita, embaixo
// e no canto (prop resizable), com mouse, toque e teclado. Muda só a área visível:
// HTML, histórico, onChange, foco e seleção ficam como estavam; as alças de imagens e
// caixas continuam funcionando; a reorganização dos objetos acompanha a largura.
import { expect, test, type Page } from '@playwright/test'
import { LEGACY_OBJECT_MARGIN, mount, PNG, selectText } from './helpers'

test.use({ viewport: { width: 1300, height: 1000 } })

const TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '
const BASE = `<p>A ${TEXT}</p><p>B ${TEXT}</p><p>C ${TEXT}</p>`

const content = (page: Page) => page.locator('#host .ve-content')
const handle = (page: Page, kind: 'e' | 's' | 'se') =>
  page.locator(`#host .ve-frame-handle-${kind}`)

const size = (page: Page) =>
  page.evaluate(() => {
    const f = document.querySelector<HTMLElement>('#host .ve-frame')!
    const c = f.querySelector<HTMLElement>('.ve-content')!
    return { width: f.offsetWidth, height: f.offsetHeight, cw: c.offsetWidth, ch: c.offsetHeight }
  })

/** Arrasta a alça com o mouse por (dx, dy), em passos */
async function dragHandle(page: Page, kind: 'e' | 's' | 'se', dx: number, dy: number) {
  const box = (await handle(page, kind).boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 6 })
  await page.mouse.up()
  // O último quadro já foi aplicado no fim do arraste
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))
}

const html = (page: Page) => page.evaluate(() => window.__ref.current!.getHTML())
const changes = (page: Page) => page.evaluate(() => window.__out.changes)

test.describe('redimensionar a área de edição: compatibilidade', () => {
  test('sem resizable: nenhuma alça e o tamanho de sempre', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300 })
    await expect(page.locator('#host .ve-frame-handle')).toHaveCount(0)
    expect(await size(page)).toMatchObject({ width: 700, height: 300, cw: 698, ch: 298 })
  })

  test('com truncateOnOverflow as alças aparecem (o limite de conteúdo é o configurado)', async ({
    page,
  }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: true,
      truncateOnOverflow: true,
    })
    await expect(page.locator('#host .ve-frame-handle')).toHaveCount(3)
  })

  test('três alças, com nome acessível e fora da área editável', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    for (const kind of ['e', 's', 'se'] as const) {
      const h = handle(page, kind)
      await expect(h).toHaveCount(1)
      await expect(h).toHaveAttribute('role', 'separator')
      await expect(h).toHaveAttribute('aria-label', /editing area/)
    }
    expect(await content(page).locator('.ve-frame-handle').count()).toBe(0)
    expect(await html(page)).not.toContain('ve-frame-handle')
  })
})

test.describe('redimensionar a área de edição: mouse', () => {
  test('direita, embaixo e canto mudam largura e altura', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    await dragHandle(page, 'e', 120, 0)
    expect(await size(page)).toMatchObject({ width: 820, height: 300, cw: 818 })
    await dragHandle(page, 's', 0, 90)
    expect(await size(page)).toMatchObject({ width: 820, height: 390, ch: 388 })
    await dragHandle(page, 'se', -200, -100)
    expect(await size(page)).toMatchObject({ width: 620, height: 290 })
  })

  test('limites: nunca passa do espaço disponível nem fica menor que o mínimo', async ({
    page,
  }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    const room = await page.evaluate(
      () => document.querySelector<HTMLElement>('#host .ve-frame')!.parentElement!.clientWidth,
    )
    // Até a beira da janela (fora dela, o Playwright no Firefox entrega coordenadas
    // inválidas): já passa do espaço que a moldura tem
    const e = (await handle(page, 'e').boundingBox())!
    await dragHandle(page, 'e', 1298 - (e.x + e.width / 2), 0)
    expect((await size(page)).width).toBe(room)
    const se = (await handle(page, 'se').boundingBox())!
    await dragHandle(page, 'se', 2 - (se.x + se.width / 2), 2 - (se.y + se.height / 2))
    expect(await size(page)).toMatchObject({ width: 160, height: 80 })
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(scroll).toBe(0)
  })

  test('HTML igual, sem onChange e sem passo no histórico', async ({ page }) => {
    const { caretToEnd } = await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: true,
    })
    await caretToEnd()
    await page.keyboard.type(' fim')
    const typed = await html(page)
    const before = await changes(page)
    await dragHandle(page, 'se', 80, 60)
    await dragHandle(page, 'e', -150, 0)
    expect(await html(page)).toBe(typed)
    expect(await changes(page)).toBe(before)
    // Desfazer volta a digitação (o redimensionamento não é um passo)
    await page.keyboard.press('Control+z')
    expect(await html(page)).not.toContain(' fim')
    await page.keyboard.press('Control+y')
    expect(await html(page)).toBe(typed)
  })

  test('foco, seleção e cursor ficam onde estavam', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    await selectText(page, 'consectetur')
    const selected = await page.evaluate(() => window.getSelection()!.toString())
    expect(selected).toBe('consectetur')
    await dragHandle(page, 'se', 100, 50)
    expect(await page.evaluate(() => window.getSelection()!.toString())).toBe(selected)
    expect(
      await page.evaluate(() => document.activeElement?.classList.contains('ve-content')),
    ).toBe(true)
    // Digitar continua no mesmo ponto: substitui a palavra selecionada
    await page.keyboard.type('TROCADA')
    expect(await html(page)).toContain('TROCADA')
    expect(await html(page)).toContain('amet, TROCADA adipiscing')
  })

  test('conteúdo maior que a altura: a área rola', async ({ page }) => {
    await mount(page, { initialContent: BASE.repeat(3), width: 700, height: 600, resizable: true })
    await dragHandle(page, 's', 0, -400)
    const r = await content(page).evaluate((el) => ({
      scroll: el.scrollHeight > el.clientHeight,
      overflow: getComputedStyle(el).overflowY,
    }))
    expect(r).toEqual({ scroll: true, overflow: 'auto' })
  })
})

test.describe('redimensionar a área de edição: toque e teclado', () => {
  test('toque: arrastar o canto com o dedo', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    const box = (await handle(page, 'se').boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const ev = (type: string, cx: number, cy: number) => ({
      type,
      init: {
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
        button: type === 'pointermove' ? -1 : 0,
        buttons: type === 'pointerup' ? 0 : 1,
        clientX: cx,
        clientY: cy,
        bubbles: true,
        cancelable: true,
      },
    })
    await page.evaluate(
      ([steps]) => {
        const h = document.querySelector('#host .ve-frame-handle-se')!
        for (const { type, init } of steps) {
          const e = new PointerEvent(type, init)
          ;(type === 'pointerdown' ? h : document).dispatchEvent(e)
        }
      },
      [
        [
          ev('pointerdown', x, y),
          ev('pointermove', x + 40, y + 20),
          ev('pointermove', x + 90, y + 50),
          ev('pointerup', x + 90, y + 50),
        ],
      ] as const,
    )
    expect(await size(page)).toMatchObject({ width: 790, height: 350 })
  })

  test('teclado: setas na alça focada (Shift: 1px) e valor anunciado', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    await handle(page, 'e').focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowLeft')
    expect((await size(page)).width).toBe(719)
    await expect(handle(page, 'e')).toHaveAttribute('aria-valuenow', '719')
    await handle(page, 's').focus()
    await page.keyboard.press('ArrowDown')
    // Seta do outro eixo não faz nada nessa alça
    await page.keyboard.press('ArrowRight')
    expect(await size(page)).toMatchObject({ width: 719, height: 310 })
    await expect(handle(page, 's')).toHaveAttribute('aria-valuenow', '310')
  })
})

test.describe('redimensionar a área de edição: objetos', () => {
  const WITH_IMAGE = `<p>A ${TEXT}</p><p><img class="pos-left" src="data:image/png;base64,${PNG}" style="width: 200px;"></p><p>B ${TEXT.repeat(3)}</p>`

  test('menu e alça da imagem selecionada acompanham; a alça da imagem continua funcionando', async ({
    page,
  }) => {
    await mount(page, { initialContent: WITH_IMAGE, width: 700, height: 500, resizable: true })
    const img = page.locator('#host .ve-content img')
    await img.click()
    await expect(img).toHaveClass(/selected/)
    const corner = async () => {
      const i = (await img.boundingBox())!
      const h = (await page.locator('#host .ve-resize-handle').boundingBox())!
      return { dx: h.x + h.width / 2 - (i.x + i.width), dy: h.y + h.height / 2 - (i.y + i.height) }
    }
    const before = await corner()
    // Mais estreita: o texto sobe e a imagem muda de lugar na vertical
    await dragHandle(page, 'e', -250, 0)
    const after = await corner()
    expect(Math.abs(after.dx - before.dx)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.dy - before.dy)).toBeLessThanOrEqual(1)
    await expect(img).toHaveClass(/selected/)
    // A alça da imagem ainda redimensiona a imagem
    const w0 = (await img.boundingBox())!.width
    const h = (await page.locator('#host .ve-resize-handle').boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + h.width / 2 + 60, h.y + h.height / 2, { steps: 5 })
    await page.mouse.up()
    expect((await img.boundingBox())!.width).toBeGreaterThan(w0 + 40)
  })

  test('imagem e caixa lado a lado: sobem e descem com a largura, sem mudar o HTML', async ({
    page,
  }) => {
    // 40% + 30%: coluna de 120px a partir de ~934px de largura útil (limite gravado 960)
    const PAIR =
      `<p>A ${TEXT}</p><p><img class="pos-left" src="data:image/png;base64,${PNG}" style="width: 40%; max-width: 40%;"></p>` +
      `<p>B ${TEXT}</p><div class="rich-textbox tb-float-right" style="width: 30%; box-sizing: border-box;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>` +
      `<p>C ${TEXT.repeat(3)}</p>`
    const { caretToEnd } = await mount(page, {
      initialContent: PAIR,
      width: 900,
      height: 800,
      resizable: true,
      // Geometria medida com a margem anterior (40px em todos os lados)
      objectMargin: LEGACY_OBJECT_MARGIN,
    })
    // Uma edição grava o limite (data-ve-stack)
    await caretToEnd()
    await page.keyboard.type('.')
    await expect(page.locator('#host .rich-textbox')).toHaveAttribute('data-ve-stack', '960')
    const saved = await html(page)
    const pair = () =>
      page.evaluate(() => {
        const ed = document.querySelector<HTMLElement>('#host .ve-content')!
        const a = ed.querySelector('img')!.getBoundingClientRect()
        const b = ed.querySelector('.rich-textbox')!.getBoundingClientRect()
        return { side: a.bottom > b.top && b.bottom > a.top, gap: b.left - a.right }
      })
    expect((await pair()).side).toBe(false)
    await dragHandle(page, 'e', 150, 0)
    const wide = await pair()
    expect(wide.side).toBe(true)
    await dragHandle(page, 'e', -150, 0)
    expect((await pair()).side).toBe(false)
    expect(await html(page)).toBe(saved)
  })
})

// ─── Correções após a revisão do Lote 1 ───────────────────────────────────────────

/** Retângulos das alças visíveis e da área de edição */
const layout = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('#host .ve-content')!.getBoundingClientRect()
    const handles = [...document.querySelectorAll<HTMLElement>('#host .ve-frame-handle')]
      .filter((h) => !h.hidden)
      .map((h) => {
        const r = h.getBoundingClientRect()
        return {
          kind: h.dataset.handle!,
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
        }
      })
    return {
      content: { left: c.left, right: c.right, top: c.top, bottom: c.bottom },
      handles,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      coarse: matchMedia('(pointer: coarse)').matches,
    }
  })

const overlaps = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5

test.describe('alças fora do conteúdo e da barra de rolagem', () => {
  test('mouse: nenhuma alça cobre a área de edição; a borda de dentro continua sendo da área', async ({
    page,
  }) => {
    await mount(page, { initialContent: BASE.repeat(4), width: 700, height: 300, resizable: true })
    const l = await layout(page)
    expect(l.handles.map((h) => h.kind).sort()).toEqual(['e', 's', 'se'])
    for (const h of l.handles) expect(overlaps(h, l.content), h.kind).toBe(false)
    // Pontos da beira de dentro (barra de rolagem, último texto visível): são da área
    const hits = await page.evaluate(
      ([c]) =>
        [
          [c.right - 3, (c.top + c.bottom) / 2],
          [c.right - 3, c.bottom - 3],
          [(c.left + c.right) / 2, c.bottom - 3],
        ].map(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.ve-content')),
      [l.content] as const,
    )
    expect(hits).toEqual([true, true, true])
  })

  test('moldura na largura toda (celular): sem rolagem lateral; o canto muda a largura', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await mount(page, { initialContent: BASE, width: '100%', height: 300, resizable: true })
    const l = await layout(page)
    expect(l.overflow).toBe(0)
    // Sem espaço à direita, a alça da direita some
    expect(l.handles.map((h) => h.kind).sort()).toEqual(['s', 'se'])
    for (const h of l.handles) expect(overlaps(h, l.content), h.kind).toBe(false)
    const before = (await size(page)).width
    await dragHandle(page, 'se', -80, 0)
    expect((await size(page)).width).toBe(before - 80)
    // Com espaço de novo, ela volta
    expect((await layout(page)).handles.map((h) => h.kind).sort()).toEqual(['e', 's', 'se'])
  })
})

test.describe('alças fora do conteúdo: tela de toque', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 800, height: 900 } })

  test('alvos maiores, ainda fora da área de edição', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'o Firefox não emula celular (isMobile)')
    await mount(page, { initialContent: BASE.repeat(4), width: 600, height: 300, resizable: true })
    const l = await layout(page)
    expect(l.coarse).toBe(true)
    expect(l.handles.length).toBe(3)
    for (const h of l.handles) {
      expect(overlaps(h, l.content), h.kind).toBe(false)
      // Alvo de toque confortável
      expect(Math.max(h.right - h.left, h.bottom - h.top), h.kind).toBeGreaterThanOrEqual(16)
    }
  })
})

test.describe('menus abertos ao redimensionar', () => {
  const MENUS = {
    fonte: { open: '.ve-font-button', menu: '.ve-font-options' },
    'cor do texto': { open: '.ve-color-picker > button >> nth=0', menu: '.ve-palette' },
    'marca-texto': { open: '.ve-highlight-wrap > button', menu: '.ve-highlight-palette' },
  }
  for (const [name, { open, menu }] of Object.entries(MENUS)) {
    test(`${name}: fecha ao começar o arraste, com seleção e foco mantidos`, async ({ page }) => {
      const t = await mount(page, {
        initialContent: BASE,
        width: 700,
        height: 300,
        resizable: true,
      })
      await selectText(page, 'consectetur')
      const before = await html(page)
      await t.toolbar.locator(open).click()
      await expect(page.locator(`#host ${menu}`)).toBeVisible()
      await dragHandle(page, 'se', 60, 30)
      await expect(page.locator(`#host ${menu}`)).toHaveCount(0)
      expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('consectetur')
      expect(
        await page.evaluate(() => document.activeElement?.classList.contains('ve-content')),
      ).toBe(true)
      expect(await html(page)).toBe(before)
      expect(await changes(page)).toBe(0)
    })
  }
})

test.describe('um gesto por vez: moldura e objetos', () => {
  const WITH_IMAGE = `<p>A ${TEXT}</p><p><img class="pos-left" src="data:image/png;base64,${PNG}" style="width: 200px;"></p><p>B ${TEXT.repeat(3)}</p>`
  const pointer = (type: string, id: number, x: number, y: number) => ({
    type,
    init: {
      // Mouse (1) e toque (2) ao mesmo tempo: cada um é o ponteiro principal do seu tipo
      pointerId: id,
      pointerType: id === 1 ? 'mouse' : 'touch',
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    },
  })
  /** Dispara eventos de ponteiro; o pointerdown vai ao alvo, o resto ao documento */
  const fire = (page: Page, target: string, events: ReturnType<typeof pointer>[]) =>
    page.evaluate(
      ([sel, list]) => {
        const el = document.querySelector(sel)!
        for (const { type, init } of list)
          (type === 'pointerdown' ? el : document).dispatchEvent(new PointerEvent(type, init))
      },
      [target, events] as const,
    )

  test('moldura sendo redimensionada: a imagem não começa a ser arrastada', async ({ page }) => {
    await mount(page, { initialContent: WITH_IMAGE, width: 700, height: 500, resizable: true })
    const img = page.locator('#host .ve-content img')
    const h = (await handle(page, 'se').boundingBox())!
    const i = (await img.boundingBox())!
    const before = await html(page)
    // Mouse na alça do canto; dedo na imagem durante o arraste
    await fire(page, '#host .ve-frame-handle-se', [pointer('pointerdown', 1, h.x + 5, h.y + 5)])
    await fire(page, '#host .ve-content img', [
      pointer('pointerdown', 2, i.x + 20, i.y + 20),
      pointer('pointermove', 2, i.x + 120, i.y + 80),
    ])
    await expect(img).not.toHaveClass(/dragging/)
    await fire(page, '#host .ve-frame-handle-se', [
      pointer('pointermove', 1, h.x + 45, h.y + 25),
      pointer('pointerup', 2, i.x + 120, i.y + 80),
      pointer('pointerup', 1, h.x + 45, h.y + 25),
    ])
    expect(await size(page)).toMatchObject({ width: 740, height: 520 })
    expect(await html(page)).toBe(before)
    // Depois do arraste da moldura, a imagem volta a poder ser arrastada
    await fire(page, '#host .ve-content img', [pointer('pointerdown', 1, i.x + 20, i.y + 20)])
    await expect(img).toHaveClass(/dragging/)
    await fire(page, '#host .ve-content img', [pointer('pointerup', 1, i.x + 20, i.y + 20)])
  })

  test('imagem sendo arrastada ou redimensionada: a moldura não muda', async ({ page }) => {
    await mount(page, { initialContent: WITH_IMAGE, width: 700, height: 500, resizable: true })
    const img = page.locator('#host .ve-content img')
    const i = (await img.boundingBox())!
    const h = (await handle(page, 'se').boundingBox())!
    // Arraste da imagem em andamento (mouse); dedo na alça da moldura
    await fire(page, '#host .ve-content img', [pointer('pointerdown', 1, i.x + 20, i.y + 20)])
    await expect(img).toHaveClass(/dragging/)
    await fire(page, '#host .ve-frame-handle-se', [
      pointer('pointerdown', 2, h.x + 5, h.y + 5),
      pointer('pointermove', 2, h.x + 105, h.y + 65),
      pointer('pointerup', 2, h.x + 105, h.y + 65),
    ])
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))
    expect(await size(page)).toMatchObject({ width: 700, height: 500 })
    await fire(page, '#host .ve-content img', [pointer('pointerup', 1, i.x + 20, i.y + 20)])
    // Alça de redimensionar da imagem em uso: o teclado na alça da moldura não muda nada
    await img.click()
    const r = (await page.locator('#host .ve-resize-handle').boundingBox())!
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
    await page.mouse.down()
    await page.mouse.move(r.x + r.width / 2 + 30, r.y + r.height / 2, { steps: 3 })
    await page.evaluate(() =>
      document
        .querySelector('#host .ve-frame-handle-e')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    )
    await page.mouse.up()
    expect((await size(page)).width).toBe(700)
    // Terminado o gesto da imagem, a moldura volta a responder
    await dragHandle(page, 'e', 50, 0)
    expect((await size(page)).width).toBe(750)
  })
})
