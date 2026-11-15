// Redimensionamento da área de edição — Lote 2 (15/11/2026): getSize/setSize,
// onResize (fases), campos de tamanho (sizeControls), limites configuráveis, largura
// em %, contêiner que encolhe e truncateOnOverflow medido no tamanho configurado.
import { expect, test, type Page } from '@playwright/test'
import { mount, selectText } from './helpers'

test.use({ viewport: { width: 1300, height: 1000 } })

const TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '
const BASE = `<p>A ${TEXT}</p><p>B ${TEXT}</p><p>C ${TEXT}</p>`

type Size = { width: number; height: number }
const getSize = (page: Page) =>
  page.evaluate(() => window.__ref.current!.getSize()) as Promise<Size | null>
const setSize = (page: Page, size: Partial<Size>) =>
  page.evaluate((s) => window.__ref.current!.setSize(s), size) as Promise<Size | null>
const resizes = (page: Page) => page.evaluate(() => window.__out.resizes)
const html = (page: Page) => page.evaluate(() => window.__ref.current!.getHTML())
const changes = (page: Page) => page.evaluate(() => window.__out.changes)
const handle = (page: Page, kind: 'e' | 's' | 'se') =>
  page.locator(`#host .ve-frame-handle-${kind}`)
const field = (page: Page, name: 'Width' | 'Height') =>
  page.locator('#host .ve-size-controls').getByLabel(name)
const nextFrame = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))

async function drag(page: Page, kind: 'e' | 's' | 'se', dx: number, dy: number) {
  const b = (await handle(page, kind).boundingBox())!
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 5 })
  await page.mouse.up()
  await nextFrame(page)
}

test.describe('getSize e setSize', () => {
  test('tamanho visível em px, dentro dos limites; sem onResize nem onChange', async ({ page }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: { minWidth: 300, maxWidth: 900, minHeight: 150, maxHeight: 500 },
    })
    expect(await getSize(page)).toEqual({ width: 700, height: 300 })
    expect(await setSize(page, { width: 820 })).toEqual({ width: 820, height: 300 })
    expect(await setSize(page, { height: 9999 })).toEqual({ width: 820, height: 500 })
    expect(await setSize(page, { width: 10, height: 10 })).toEqual({ width: 300, height: 150 })
    expect(await getSize(page)).toEqual({ width: 300, height: 150 })
    expect(await resizes(page)).toEqual([])
    expect(await changes(page)).toBe(0)
  })

  test('sem resizable: getSize mede, setSize não faz nada', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300 })
    expect(await getSize(page)).toEqual({ width: 700, height: 300 })
    expect(await setSize(page, { width: 800 })).toBeNull()
    expect(await getSize(page)).toEqual({ width: 700, height: 300 })
  })

  test('limites padrão preservados (160 × 80, largura até o espaço disponível)', async ({
    page,
  }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    const room = await page.evaluate(
      () => document.querySelector<HTMLElement>('#host .ve-frame')!.parentElement!.clientWidth,
    )
    expect(await setSize(page, { width: 1, height: 1 })).toEqual({ width: 160, height: 80 })
    expect((await setSize(page, { width: 99999 }))!.width).toBe(room)
  })

  test('width/height mudados pela aplicação prevalecem sobre o tamanho escolhido', async ({
    page,
  }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    await setSize(page, { width: 900, height: 400 })
    await mount(page, { initialContent: BASE, width: 650, height: 280, resizable: true })
    expect(await getSize(page)).toEqual({ width: 650, height: 280 })
  })
})

test.describe('onResize', () => {
  test('arraste: start, move só quando muda, end uma vez', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    await drag(page, 'se', 60, 40)
    const r = await resizes(page)
    expect(r[0]).toEqual({ phase: 'start', width: 700, height: 300 })
    expect(r.at(-1)).toEqual({ phase: 'end', width: 760, height: 340 })
    expect(r.filter((x) => x.phase === 'start')).toHaveLength(1)
    expect(r.filter((x) => x.phase === 'end')).toHaveLength(1)
    const moves = r.filter((x) => x.phase === 'move')
    expect(moves.length).toBeGreaterThan(0)
    // Nenhum 'move' repetido com o mesmo tamanho
    for (let i = 1; i < moves.length; i++) {
      expect(moves[i].width !== moves[i - 1].width || moves[i].height !== moves[i - 1].height).toBe(
        true,
      )
    }
  })

  test('setas: só end, e nada quando o limite impede a mudança', async ({ page }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: { maxWidth: 710 },
    })
    await handle(page, 'e').focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    expect(await resizes(page)).toEqual([{ phase: 'end', width: 710, height: 300 }])
  })

  test('campos: só end ao aplicar; setSize e props não chamam', async ({ page }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: true,
      sizeControls: true,
    })
    await field(page, 'Width').fill('760')
    await field(page, 'Width').press('Enter')
    // Mesmo valor de novo: nada muda, nada é avisado
    await field(page, 'Width').fill('760')
    await field(page, 'Width').press('Enter')
    await setSize(page, { height: 350 })
    expect(await resizes(page)).toEqual([{ phase: 'end', width: 760, height: 300 }])
  })
})

test.describe('campos de tamanho (sizeControls)', () => {
  test('mostram o tamanho e acompanham o arraste', async ({ page }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: true,
      sizeControls: true,
    })
    await expect(field(page, 'Width')).toHaveValue('700')
    await expect(field(page, 'Height')).toHaveValue('300')
    await drag(page, 'se', 50, 30)
    await expect(field(page, 'Width')).toHaveValue('750')
    await expect(field(page, 'Height')).toHaveValue('330')
  })

  test('Enter e sair do campo aplicam; Esc desfaz; vazio ou fora dos limites', async ({ page }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: { minHeight: 200 },
      sizeControls: true,
    })
    await field(page, 'Width').fill('800')
    await field(page, 'Width').press('Enter')
    expect(await getSize(page)).toEqual({ width: 800, height: 300 })
    await field(page, 'Height').fill('360')
    await field(page, 'Width').focus()
    expect(await getSize(page)).toEqual({ width: 800, height: 360 })
    // Esc desfaz o que foi digitado
    await field(page, 'Width').fill('500')
    await field(page, 'Width').press('Escape')
    await expect(field(page, 'Width')).toHaveValue('800')
    await field(page, 'Height').focus()
    expect(await getSize(page)).toEqual({ width: 800, height: 360 })
    // Vazio: volta ao tamanho atual; abaixo do mínimo: o mínimo
    await field(page, 'Height').fill('')
    await field(page, 'Height').press('Enter')
    await expect(field(page, 'Height')).toHaveValue('360')
    await field(page, 'Height').fill('50')
    await field(page, 'Height').press('Enter')
    await expect(field(page, 'Height')).toHaveValue('200')
    expect(await getSize(page)).toEqual({ width: 800, height: 200 })
  })

  test('HTML, onChange, histórico e seleção preservados', async ({ page }) => {
    const t = await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: true,
      sizeControls: true,
    })
    await t.caretToEnd()
    await page.keyboard.type(' fim')
    await selectText(page, 'consectetur')
    const typed = await html(page)
    const before = await changes(page)
    await field(page, 'Width').fill('820')
    await field(page, 'Width').press('Enter')
    await field(page, 'Height').fill('260')
    await field(page, 'Height').press('Enter')
    expect(await html(page)).toBe(typed)
    expect(await changes(page)).toBe(before)
    // De volta ao editor: a seleção de antes volta
    await page.evaluate(() => window.__ref.current!.focus())
    expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('consectetur')
    // Desfazer volta a digitação (os campos não são um passo)
    await page.keyboard.press('Control+z')
    expect(await html(page)).not.toContain(' fim')
  })

  test('sem resizable os campos não aparecem', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, sizeControls: true })
    await expect(page.locator('#host .ve-size-controls')).toHaveCount(0)
  })
})

test.describe('largura em % e contêiner que muda', () => {
  const setHostWidth = (page: Page, px: number) =>
    page.evaluate((w) => {
      document.getElementById('host')!.style.width = `${w}px`
    }, px)

  test("width='100%': acompanha o contêiner até ser redimensionada; depois fica em px", async ({
    page,
  }) => {
    await setHostWidth(page, 1000).catch(() => {})
    await mount(page, { initialContent: BASE, width: '100%', height: 300, resizable: true })
    await setHostWidth(page, 1000)
    await nextFrame(page)
    expect((await getSize(page))!.width).toBe(1000)
    // Contêiner menor, sem redimensionar: acompanha, sem onResize
    await setHostWidth(page, 900)
    await nextFrame(page)
    expect((await getSize(page))!.width).toBe(900)
    expect(await resizes(page)).toEqual([])
    // Redimensionada: px
    await drag(page, 'se', -200, 0)
    expect((await getSize(page))!.width).toBe(700)
    await setHostWidth(page, 1100)
    await nextFrame(page)
    expect((await getSize(page))!.width).toBe(700)
  })

  test('contêiner encolhe abaixo do tamanho escolhido: a moldura cabe nele e avisa com end', async ({
    page,
  }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    await setSize(page, { width: 900 })
    await page.evaluate(() => {
      document.getElementById('host')!.style.width = '640px'
    })
    await nextFrame(page)
    await nextFrame(page)
    expect((await getSize(page))!.width).toBe(640)
    expect(await resizes(page)).toEqual([{ phase: 'end', width: 640, height: 300 }])
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })
})

test.describe('truncateOnOverflow: limite no tamanho configurado', () => {
  const LONG = '<p>' + 'linha longa de texto '.repeat(30) + '</p>'
  const cfg = { width: 600, height: 220, truncateOnOverflow: true }
  const text = (page: Page) =>
    page.evaluate(() => document.querySelector('#host .ve-content')!.textContent!)

  /** Mesmos passos num editor nunca redimensionado e num redimensionado */
  async function compare(
    page: Page,
    visible: Partial<Size>,
    steps: (page: Page) => Promise<void>,
    initialContent = LONG,
  ) {
    await mount(page, { initialContent, ...cfg })
    await steps(page)
    const baseline = await html(page)
    await mount(page, { initialContent, ...cfg, resizable: true })
    await setSize(page, visible)
    await steps(page)
    return { baseline, resized: await html(page) }
  }

  const typeAtEnd = async (page: Page) => {
    await page.locator('#host .ve-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' mais texto digitado depois '.repeat(6))
  }

  for (const [name, visible] of [
    ['menor', { height: 120 }],
    ['mais estreita', { width: 300 }],
    ['maior', { width: 900, height: 500 }],
  ] as const) {
    test(`área ${name}: digitar corta exatamente como sem redimensionar`, async ({
      page,
      browserName,
    }) => {
      const { baseline, resized } = await compare(page, visible, typeAtEnd)
      // No WebKit, os espaços digitados depois do ponto de corte viram espaço ou
      // &nbsp; conforme a quebra de linha visível na hora da tecla (antes de qualquer
      // medida do editor); o texto e o ponto de corte são os mesmos
      const trailing = (h: string) =>
        browserName === 'webkit' ? h.replace(/(?:\s|&nbsp;)+<\/p>$/, '</p>') : h
      expect(trailing(resized)).toBe(trailing(baseline))
    })
  }

  test('reduzir a área não corta nada, nem na próxima digitação; o resto rola', async ({
    page,
  }) => {
    await mount(page, { initialContent: LONG, ...cfg, resizable: true })
    const full = await text(page)
    await setSize(page, { width: 260, height: 100 })
    expect(await text(page)).toBe(full)
    // Uma letra no começo: nada do fim é perdido por causa da área menor
    await page.locator('#host .ve-content').click({ position: { x: 20, y: 15 } })
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('Z')
    expect(await text(page)).toBe('Z' + full)
    const r = await page
      .locator('#host .ve-content')
      .evaluate((el) => el.scrollHeight > el.clientHeight)
    expect(r).toBe(true)
  })

  test('Enter bloqueado como sem redimensionar (área visível maior)', async ({ page }) => {
    const { baseline, resized } = await compare(page, { height: 600 }, async (p) => {
      await p.locator('#host .ve-content').click()
      await p.keyboard.press('Control+End')
      for (let i = 0; i < 6; i++) await p.keyboard.press('Enter')
    })
    expect(resized).toBe(baseline)
  })

  test('colar: mesmo resultado que sem redimensionar', async ({ page }) => {
    const pasteAtEnd = (p: Page) =>
      p.locator('#host .ve-content').evaluate((el) => {
        el.focus()
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        getSelection()!.removeAllRanges()
        getSelection()!.addRange(range)
        const dt = new DataTransfer()
        const t = 'texto colado '.repeat(80)
        dt.setData('text/html', `<p>${t}</p>`)
        dt.setData('text/plain', t)
        el.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
        )
      })
    const { baseline, resized } = await compare(
      page,
      { width: 280, height: 110 },
      pasteAtEnd,
      '<p>início</p>',
    )
    expect(resized).toBe(baseline)
  })

  test('carregar HTML: mesmo resultado que sem redimensionar', async ({ page }) => {
    const big = '<p>' + 'conteúdo carregado '.repeat(120) + '</p>'
    const { baseline, resized } = await compare(
      page,
      { width: 300, height: 100 },
      (p) => p.evaluate((h) => window.__ref.current!.setHTML(h), big),
      '<p>x</p>',
    )
    expect(resized).toBe(baseline)
  })

  test('onOverflowChange também mede no tamanho configurado', async ({ page }) => {
    // Quatro linhas: passam dos 90px visíveis, cabem nos 220px configurados
    await mount(page, {
      initialContent: '<p>um</p><p>dois</p><p>três</p><p>quatro</p>',
      width: 600,
      height: 220,
      resizable: true,
    })
    await setSize(page, { height: 90 })
    await page.locator('#host .ve-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' a')
    expect(await page.evaluate(() => window.__out.overflow)).toBe(false)
  })

  test('scrollable=false: área menor rola; no tamanho configurado, não', async ({ page }) => {
    await mount(page, { initialContent: LONG, ...cfg, scrollable: false, resizable: true })
    const area = page.locator('#host .ve-content')
    await expect(area).toHaveCSS('overflow-y', 'hidden')
    await setSize(page, { height: 100 })
    // A rolagem entra na renderização seguinte do React
    await expect(area).toHaveCSS('overflow-y', 'auto')
  })

  test('medir no tamanho configurado não mexe na rolagem nem na seleção', async ({ page }) => {
    await mount(page, { initialContent: LONG, ...cfg, resizable: true })
    await setSize(page, { height: 100 })
    await selectText(page, 'longa')
    const before = await page.locator('#host .ve-content').evaluate((el) => {
      el.scrollTop = 40
      return el.scrollTop
    })
    expect(before).toBeGreaterThan(0)
    await page.evaluate(() => window.__ref.current!.core!.emitChange())
    const after = await page.locator('#host .ve-content').evaluate((el) => el.scrollTop)
    expect(after).toBe(before)
    expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('longa')
  })
})

test.describe('menus fechados por sinal interno, sem eventos na página', () => {
  test('arrastar a moldura não dispara mousedown na página nem tira o foco de outro controle', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: true })
    // Menu de fonte aberto antes, e um campo da página com o foco
    await t.toolbar.locator('.ve-font-button').click()
    await expect(page.locator('#host .ve-font-options')).toBeVisible()
    await page.evaluate(() => {
      const input = document.createElement('input')
      input.id = 'outside-input'
      document.body.appendChild(input)
      input.focus()
      const log: string[] = []
      ;(window as unknown as { __md: string[] }).__md = log
      for (const type of ['mousedown', 'mouseup', 'click'])
        document.addEventListener(type, (e) => log.push(`${type}:${e.isTrusted}`), true)
    })
    const b = (await page.locator('#host .ve-frame-handle-se').boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 10, { steps: 3 })
    await page.mouse.up()
    // O menu fechou pelo sinal; nenhum mousedown (sintético ou do navegador) chegou
    await expect(page.locator('#host .ve-font-options')).toHaveCount(0)
    const log = await page.evaluate(() => (window as unknown as { __md: string[] }).__md)
    expect(log.filter((x) => x.startsWith('mousedown'))).toEqual([])
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('outside-input')
  })
})

// ─── Lote 3 (15/11/2026) ───────────────────────────────────────────────────────────

/** Moldura centralizada no contêiner (espaço dos dois lados); o contêiner muda de
 * largura para as alças recalcularem o espaço ao lado */
const centerFrame = (page: Page) =>
  page.evaluate(() => {
    const s = document.createElement('style')
    s.textContent = '#host .ve-frame { margin-left: auto; margin-right: auto; }'
    document.head.appendChild(s)
    document.getElementById('host')!.style.width = '1200px'
  })

test.describe('alças opcionais (resizable.handles)', () => {
  const ALL = ['e', 's', 'se', 'w', 'n', 'nw', 'ne', 'sw'] as const
  const boxes = (page: Page) =>
    page.evaluate(() => {
      const r = (el: Element) => {
        const b = el.getBoundingClientRect()
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }
      }
      return {
        content: r(document.querySelector('#host .ve-content')!),
        toolbar: r(document.querySelector('#host .ve-toolbar')!),
        handles: [...document.querySelectorAll<HTMLElement>('#host .ve-frame-handle')]
          .filter((h) => !h.hidden)
          .map((h) => ({ kind: h.dataset.handle!, ...r(h) })),
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

  test('padrão continua direita, embaixo e o canto', async ({ page }) => {
    await mount(page, { initialContent: BASE, width: 700, height: 300, resizable: {} })
    const kinds = await page
      .locator('#host .ve-frame-handle')
      .evaluateAll((l) => l.map((h) => (h as HTMLElement).dataset.handle))
    expect(kinds).toEqual(['e', 's', 'se'])
  })

  test('as oito: nenhuma cobre a área nem a barra de ferramentas; sem rolagem lateral', async ({
    page,
  }) => {
    // Moldura com espaço dos dois lados (centralizada no contêiner)
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: { handles: [...ALL] },
    })
    await centerFrame(page)
    await nextFrame(page)
    const b = await boxes(page)
    expect(b.handles.map((h) => h.kind).sort()).toEqual([...ALL].sort())
    for (const h of b.handles) {
      expect(overlaps(h, b.content), h.kind).toBe(false)
      expect(overlaps(h, b.toolbar), h.kind).toBe(false)
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })

  test('esquerda e cima: puxar para fora aumenta; os cantos mudam os dois eixos', async ({
    page,
  }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: { handles: [...ALL] },
    })
    await centerFrame(page)
    await nextFrame(page)
    await drag(page, 'w' as 'e', -60, 0)
    expect(await getSize(page)).toEqual({ width: 760, height: 300 })
    await drag(page, 'n' as 's', 0, -40)
    expect(await getSize(page)).toEqual({ width: 760, height: 340 })
    await drag(page, 'nw' as 'se', 30, 20)
    expect(await getSize(page)).toEqual({ width: 730, height: 320 })
    await drag(page, 'ne' as 'se', 20, 10)
    expect(await getSize(page)).toEqual({ width: 750, height: 310 })
    await drag(page, 'sw' as 'se', -10, 30)
    expect(await getSize(page)).toEqual({ width: 760, height: 340 })
    // Teclado: a seta move a borda da alça (para fora aumenta)
    await page.locator('#host .ve-frame-handle-w').focus()
    await page.keyboard.press('ArrowLeft')
    expect((await getSize(page))!.width).toBe(770)
    await page.locator('#host .ve-frame-handle-n').focus()
    await page.keyboard.press('ArrowDown')
    expect((await getSize(page))!.height).toBe(330)
  })

  test('esquerda sem espaço à esquerda: some (como a direita); a faixa de cima é reservada', async ({
    page,
  }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: { handles: ['w', 'n', 'nw'] },
    })
    const kinds = await page
      .locator('#host .ve-frame-handle:not([hidden])')
      .evaluateAll((l) => l.map((h) => (h as HTMLElement).dataset.handle))
    expect(kinds).toEqual(['n', 'nw'])
    const margin = await page
      .locator('#host .ve-frame')
      .evaluate((f) => getComputedStyle(f).marginTop)
    expect(margin).toBe('10px')
  })
})

test.describe('limites dos campos acompanham o controlador', () => {
  test('min/max nos campos; o máximo de largura muda com o contêiner', async ({ page }) => {
    await mount(page, {
      initialContent: BASE,
      width: 700,
      height: 300,
      resizable: { minWidth: 300, maxHeight: 600 },
      sizeControls: true,
    })
    const w = field(page, 'Width')
    const h = field(page, 'Height')
    await expect(w).toHaveAttribute('min', '300')
    await expect(h).toHaveAttribute('max', '600')
    const room = await page.evaluate(
      () => document.querySelector<HTMLElement>('#host .ve-frame')!.parentElement!.clientWidth,
    )
    await expect(w).toHaveAttribute('max', String(room))
    // Contêiner menor sem mudar o tamanho da moldura (ela continua cabendo)
    await page.evaluate(() => {
      document.getElementById('host')!.style.width = '1000px'
    })
    await expect(w).toHaveAttribute('max', '1000')
    await page.evaluate(() => {
      document.getElementById('host')!.style.width = '1100px'
    })
    await expect(w).toHaveAttribute('max', '1100')
  })
})

test.describe('medida no tamanho configurado: robustez e desempenho', () => {
  test('erro durante a medida: tamanho, rolagem e seleção voltam ao visível', async ({ page }) => {
    const LONG = '<p>' + 'linha longa de texto '.repeat(30) + '</p>'
    await mount(page, { initialContent: LONG, width: 600, height: 220, resizable: true })
    await setSize(page, { width: 400, height: 100 })
    await selectText(page, 'longa')
    const before = await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      ed.scrollTop = 30
      const f = ed.parentElement!
      return { fw: f.style.width, cw: ed.style.width, ch: ed.style.height, top: ed.scrollTop }
    })
    const result = await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      // A medida lê scrollHeight: falha de propósito, uma vez
      Object.defineProperty(ed, 'scrollHeight', {
        configurable: true,
        get() {
          throw new Error('falha simulada')
        },
      })
      let thrown = ''
      try {
        window.__ref.current!.core!.emitChange()
      } catch (e) {
        thrown = (e as Error).message
      }
      delete (ed as unknown as Record<string, unknown>).scrollHeight
      const f = ed.parentElement!
      return {
        thrown,
        fw: f.style.width,
        cw: ed.style.width,
        ch: ed.style.height,
        top: ed.scrollTop,
      }
    })
    expect(result).toEqual({ thrown: 'falha simulada', ...before })
    expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('longa')
  })

  for (const paragraphs of [100, 400, 1500]) {
    test(`desempenho com ${paragraphs} parágrafos: custo da medida por edição`, async ({
      page,
    }) => {
      const BIG = `<p>${TEXT.repeat(4)}</p>`.repeat(paragraphs)
      await mount(page, { initialContent: BIG, width: 800, height: 400, resizable: true })
      const time = () =>
        page.evaluate(() => {
          const core = window.__ref.current!.core!
          const runs = 20
          const t0 = performance.now()
          for (let i = 0; i < runs; i++) core.emitChange()
          return (performance.now() - t0) / runs
        })
      const unresized = await time()
      await setSize(page, { width: 500, height: 250 })
      const resized = await time()
      await setSize(page, { width: 800, height: 250 })
      const heightOnly = await time()
      console.log(
        `PERF ${paragraphs} parágrafos: ${unresized.toFixed(1)} ms sem redimensionar, ` +
          `${resized.toFixed(1)} ms largura e altura, ${heightOnly.toFixed(1)} ms só altura`,
      )
      expect(resized).toBeLessThan(250)
    })
  }
})

// Espaços comuns × &nbsp; (investigação do Lote 3): sem truncateOnOverflow, digitar
// numa área redimensionada grava exatamente o mesmo HTML que numa área nunca
// redimensionada, em qualquer navegador. Com o corte ligado, o WebKit pode gravar
// um número diferente de espaços DEPOIS do ponto de corte (o texto e o ponto de
// corte são os mesmos): ver o teste "digitar corta exatamente como sem
// redimensionar". A diferença está no HTML salvo (não é só serialização).
test('espaços digitados numa área redimensionada: HTML idêntico ao da área original', async ({
  page,
}) => {
  const seq = 'palavra '.repeat(40) + '   fim  '
  const typed = async (resize: boolean) => {
    await mount(page, { initialContent: '<p>início</p>', width: 600, height: 600, resizable: true })
    if (resize) await setSize(page, { width: 300 })
    await page.locator('#host .ve-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(seq)
    return html(page)
  }
  expect(await typed(true)).toBe(await typed(false))
})
