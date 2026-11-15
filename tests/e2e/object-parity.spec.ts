// Caixa de texto e imagem com o mesmo comportamento na área de edição (14/11/2026):
// alinhar à esquerda, ao centro e à direita leva os dois ao mesmo lugar; 25–100%
// dão o mesmo tamanho e nunca passam da área; a alça de redimensionar não dá salto,
// acompanha o ponteiro e não esconde texto; arrastar para baixo solta no parágrafo
// que está sob o ponteiro, sem deixar parágrafo vazio para trás.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { mount, PNG } from './helpers'

const TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '
const BOX = 'Caixa de texto com algum conteúdo para quebrar em várias linhas quando ficar estreita.'
const CONTENT =
  `<p>A ${TEXT}</p><p><img src="data:image/png;base64,${PNG}" style="width: 200px;"></p>` +
  `<p>B ${TEXT.repeat(2)}</p>` +
  `<div class="rich-textbox"><span class="textbox-handle" contenteditable="false">⠿</span>${BOX}</div>` +
  `<p>C ${TEXT.repeat(3)}</p><p>D ${TEXT.repeat(3)}</p>`

test.use({ viewport: { width: 1200, height: 1000 } })

const img = (page: Page) => page.locator('#host .ve-content img')
const box = (page: Page) => page.locator('#host .ve-content .rich-textbox')
const handle = (page: Page) => page.locator('#host .ve-resize-handle')

async function setup(page: Page) {
  await mount(page, { initialContent: CONTENT, width: 900, height: 900 })
}

/** Retângulo relativo à caixa de conteúdo da área de edição (sem o padding) */
const rel = (el: Locator) =>
  el.evaluate((n) => {
    const ed = n.closest('.ve-content') as HTMLElement
    const cs = getComputedStyle(ed)
    const e = ed.getBoundingClientRect()
    const r = n.getBoundingClientRect()
    const x0 = e.left + ed.clientLeft + parseFloat(cs.paddingLeft)
    const inner = ed.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    return { left: r.left - x0, right: r.right - x0, width: r.width, height: r.height, inner }
  })

const selectImage = async (page: Page) => {
  await img(page).click()
  await expect(img(page)).toHaveClass(/selected/)
}
const selectBox = async (page: Page) => {
  await box(page).getByText('Caixa de texto').click()
  await expect(box(page)).toHaveClass(/selected/)
}

const core = (page: Page, call: string) =>
  page.evaluate((c) => new Function('core', `core.${c}`)(window.__ref.current!.core), call)

test.describe('alinhar e redimensionar pelo menu: caixa e imagem iguais', () => {
  for (const side of ['left', 'center', 'right'] as const) {
    test(`50% e ${side}: mesmo lugar e mesmo tamanho`, async ({ page }) => {
      await setup(page)
      await selectImage(page)
      await core(page, 'resizeSelectedImage(50)')
      await core(page, `floatImage('${side === 'center' ? 'none' : side}')`)
      await selectBox(page)
      await core(page, 'resizeSelectedTextbox(50)')
      await core(page, `positionSelectedTextbox('${side}')`)
      const a = await rel(img(page))
      const b = await rel(box(page))
      expect(Math.abs(a.left - b.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1)
      // Texto ao lado nos flutuantes, como na imagem
      const float = await box(page).evaluate((n) => getComputedStyle(n).float)
      expect(float).toBe(side === 'center' ? 'none' : side)
    })
  }

  for (const side of ['left', 'center', 'right'] as const) {
    test(`100% e ${side}: nenhum dos dois passa da área de edição`, async ({ page }) => {
      await setup(page)
      await selectImage(page)
      await core(page, `floatImage('${side === 'center' ? 'none' : side}')`)
      await core(page, 'resizeSelectedImage(100)')
      await selectBox(page)
      await core(page, `positionSelectedTextbox('${side}')`)
      await core(page, 'resizeSelectedTextbox(100)')
      for (const el of [img(page), box(page)]) {
        const r = await rel(el)
        expect(r.left).toBeGreaterThanOrEqual(-0.5)
        expect(r.right).toBeLessThanOrEqual(r.inner + 0.5)
      }
    })
  }

  test('o texto de dentro da caixa continua com o próprio alinhamento', async ({ page }) => {
    await setup(page)
    await selectBox(page)
    await core(page, `positionSelectedTextbox('right')`)
    // Alinhar a caixa move a caixa; o texto dentro dela não muda de alinhamento
    expect(await box(page).evaluate((n) => (n as HTMLElement).style.textAlign)).toBe('')
  })
})

/** Arrasta a alça de (dx, dy) e devolve a distância final entre a alça e o ponteiro */
async function dragHandle(page: Page, dx: number, dy: number) {
  const h = (await handle(page).boundingBox())!
  const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 })
  const after = (await handle(page).boundingBox())!
  await page.mouse.up()
  await page.waitForTimeout(80)
  return {
    offX: after.x + after.width / 2 - (start.x + dx),
    offY: after.y + after.height / 2 - (start.y + dy),
  }
}

test.describe('alça de redimensionar', () => {
  for (const kind of ['imagem', 'caixa'] as const) {
    test(`${kind}: mover 1px não dá salto`, async ({ page }) => {
      await setup(page)
      const el = kind === 'imagem' ? img(page) : box(page)
      await (kind === 'imagem' ? selectImage(page) : selectBox(page))
      const before = (await el.boundingBox())!
      await dragHandle(page, 1, 1)
      const after = (await el.boundingBox())!
      expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(2)
      expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2)
    })

    for (const side of ['left', 'center', 'right'] as const) {
      test(`${kind} (${side}): a alça acompanha o ponteiro`, async ({ page }) => {
        await setup(page)
        if (kind === 'imagem') {
          await selectImage(page)
          await core(page, `floatImage('${side === 'center' ? 'none' : side}')`)
        } else {
          await selectBox(page)
          await core(page, 'resizeSelectedTextbox(50)')
          await core(page, `positionSelectedTextbox('${side}')`)
        }
        await page.waitForTimeout(80)
        const off = await dragHandle(page, -60, 0)
        expect(Math.abs(off.offX)).toBeLessThanOrEqual(3)
      })
    }
  }

  test('caixa estreitada pela alça cresce na altura: nenhum texto fica escondido', async ({
    page,
  }) => {
    await setup(page)
    await selectBox(page)
    await dragHandle(page, -500, -10)
    const fit = await box(page).evaluate((n) => ({ sh: n.scrollHeight, ch: n.clientHeight }))
    expect(fit.sh).toBeLessThanOrEqual(fit.ch + 1)
  })

  test('imagem pela alça mantém a proporção', async ({ page }) => {
    await setup(page)
    await selectImage(page)
    await dragHandle(page, 80, -40)
    const b = (await img(page).boundingBox())!
    expect(Math.abs(b.width / b.height - 1)).toBeLessThan(0.03)
  })

  test('alça arrastada além da borda: o objeto para na área de edição', async ({ page }) => {
    await setup(page)
    await selectBox(page)
    await core(page, 'resizeSelectedTextbox(50)')
    await dragHandle(page, 700, 0)
    const r = await rel(box(page))
    expect(r.right).toBeLessThanOrEqual(r.inner + 0.5)
  })
})

/** Vão entre objetos flutuantes que se sobrepõem na vertical (o texto passa por ele) */
const narrowestGap = (page: Page) =>
  page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    const floats = [...ed.querySelectorAll<HTMLElement>('img, .rich-textbox')].filter(
      (el) => getComputedStyle(el).float !== 'none',
    )
    const outer = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        top: r.top - parseFloat(cs.marginTop),
        bottom: r.bottom + parseFloat(cs.marginBottom),
        left: r.left - parseFloat(cs.marginLeft),
        right: r.right + parseFloat(cs.marginRight),
      }
    }
    let min = Infinity
    for (const a of floats)
      for (const b of floats) {
        if (a === b) continue
        const A = outer(a)
        const B = outer(b)
        // Margens que só se encostam (o clear põe uma logo abaixo da outra) não são
        // a mesma faixa; 0,5px de tolerância para o arredondamento do Firefox
        if (A.bottom <= B.top + 0.5 || B.bottom <= A.top + 0.5 || A.right > B.left) continue
        min = Math.min(min, B.left - A.right)
      }
    return min
  })

test.describe('objetos lado a lado', () => {
  test('caixa estreitada ao lado de uma imagem: o texto não fica espremido entre os dois', async ({
    page,
  }) => {
    await setup(page)
    await selectImage(page)
    await core(page, 'resizeSelectedImage(50)')
    await core(page, `floatImage('left')`)
    await selectBox(page)
    await core(page, 'resizeSelectedTextbox(50)')
    await core(page, `positionSelectedTextbox('right')`)
    // A imagem (à esquerda) e a caixa (à direita) ficam na mesma faixa só se o texto
    // tiver uma coluna legível entre elas
    for (const pct of [50, 25]) {
      await core(page, `resizeSelectedTextbox(${pct})`)
      expect(await narrowestGap(page)).toBeGreaterThanOrEqual(120)
    }
    await dragHandle(page, 120, 0)
    expect(await narrowestGap(page)).toBeGreaterThanOrEqual(120)
  })
})

/** Arrasta o objeto (imagem pelo centro, caixa pela alça) até o ponto (x, y) da página */
async function dragObject(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(120)
}

/** Ponto no início da primeira linha do parágrafo que começa com `mark` */
const startOf = (page: Page, mark: string) =>
  page.evaluate((m) => {
    const p = [...document.querySelectorAll('#host .ve-content > p')].find((x) =>
      x.textContent!.startsWith(m),
    )!
    const r = document.createRange()
    r.setStart(p.firstChild!, 0)
    r.setEnd(p.firstChild!, 6)
    const b = r.getBoundingClientRect()
    return { x: b.left + 2, y: b.top + b.height / 2 }
  }, mark)

const blocks = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#host .ve-content > *')].map((e) =>
      e.classList.contains('rich-textbox')
        ? 'BOX'
        : e.querySelector('img')
          ? `${e.textContent!.trim().slice(0, 1) || '-'}+IMG`
          : e.textContent!.trim().slice(0, 1) || '(vazio)',
    ),
  )

test.describe('arrastar para baixo', () => {
  test('imagem solta no início do parágrafo C fica no parágrafo C', async ({ page }) => {
    await setup(page)
    await selectImage(page)
    const b = (await img(page).boundingBox())!
    await dragObject(
      page,
      { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      await startOf(page, 'C'),
    )
    expect(await blocks(page)).toEqual(['A', 'B', 'BOX', 'C+IMG', 'D'])
  })

  test('caixa solta no início do parágrafo D entra antes do D', async ({ page }) => {
    await setup(page)
    await selectBox(page)
    const h = (await box(page).locator('.textbox-handle').boundingBox())!
    const to = await startOf(page, 'D')
    await dragObject(
      page,
      { x: h.x + h.width / 2, y: h.y + h.height / 2 },
      { x: to.x, y: to.y - 4 },
    )
    const order = await blocks(page)
    expect(order.indexOf('BOX')).toBe(order.indexOf('D') - 1)
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('BOX'))
  })

  test('a imagem sai do parágrafo dela sem deixar parágrafo vazio', async ({ page }) => {
    await setup(page)
    await selectImage(page)
    const b = (await img(page).boundingBox())!
    await dragObject(
      page,
      { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      await startOf(page, 'C'),
    )
    expect(await blocks(page)).not.toContain('(vazio)')
  })
})

// ─── Revisão (14/11/2026): coluna legível responsiva e contrato da API ───────────
// A decisão de descer o objeto depende da largura do contêiner: o HTML guarda a
// largura abaixo da qual ele desce (data-ve-stack), e o CSS a aplica por consulta de
// contêiner em cada lugar (editor, site, celular), sem clear fixo no style.

/** Imagem e caixa no contêiner: na mesma faixa (lado a lado) e o vão entre elas */
const pairIn = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector<HTMLElement>(sel)!
    const [a, b] = [
      root.querySelector<HTMLElement>('img')!,
      root.querySelector<HTMLElement>('.rich-textbox')!,
    ]
    const outer = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        top: r.top - parseFloat(cs.marginTop),
        bottom: r.bottom + parseFloat(cs.marginBottom),
        left: r.left - parseFloat(cs.marginLeft),
        right: r.right + parseFloat(cs.marginRight),
      }
    }
    const A = outer(a)
    const B = outer(b)
    const sideBySide = A.bottom > B.top + 0.5 && B.bottom > A.top + 0.5
    const gap = A.right <= B.left ? B.left - A.right : A.left - B.right
    // Largura que sobra para o texto na faixa dos dois (entre eles ou ao lado deles)
    const cs = getComputedStyle(root)
    const inner = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const column = sideBySide ? inner - (A.right - A.left) - (B.right - B.left) : Infinity
    return { sideBySide, gap, column }
  }, selector)

/** Imagem a 40% à esquerda e caixa a 30% à direita: coluna de ~100px numa área de 868px */
async function narrowPair(page: Page) {
  await setup(page)
  await selectImage(page)
  await core(page, 'resizeSelectedImage(40)')
  await core(page, `floatImage('left')`)
  await selectBox(page)
  await core(page, 'resizeSelectedTextbox(30)')
  await core(page, `positionSelectedTextbox('right')`)
}

// Como o width numérico da prop: a moldura e a área de edição (sem a borda da moldura)
const setEditorWidth = (page: Page, px: number) =>
  page.evaluate((w) => {
    const frame = document.querySelector<HTMLElement>('#host .ve-frame')!
    const content = frame.querySelector<HTMLElement>('.ve-content')!
    const border = frame.offsetWidth - content.offsetWidth
    frame.style.width = `${w}px`
    content.style.width = `${w - border}px`
  }, px)

test.describe('coluna legível: responsiva à largura do contêiner', () => {
  test('o HTML guarda a largura em que o objeto desce, não um clear fixo', async ({ page }) => {
    await narrowPair(page)
    expect((await pairIn(page, '#host .ve-content')).sideBySide).toBe(false)
    const html = await page.evaluate(() => window.__ref.current!.getHTML())
    expect(html).toMatch(/data-ve-stack="960"/)
    expect(html).not.toMatch(/clear/)
  })

  test('publicado mais largo fica lado a lado; mais estreito, um abaixo do outro', async ({
    page,
  }) => {
    await narrowPair(page)
    const saved = await page.evaluate(() => window.__ref.current!.getHTML())
    await page.evaluate((h) => window.__showPublished(h, { width: 1100 }), saved)
    const wide = await pairIn(page, '#published')
    expect(wide.sideBySide).toBe(true)
    expect(wide.gap).toBeGreaterThanOrEqual(120)
    expect(wide.column).toBeGreaterThanOrEqual(120)
    for (const width of [700, 360]) {
      await page.evaluate(([h, w]) => window.__showPublished(h, { width: w }), [
        saved,
        width,
      ] as const)
      expect((await pairIn(page, '#published')).sideBySide).toBe(false)
    }
  })

  test('a área de edição muda de largura: a posição acompanha, sem editar', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await narrowPair(page)
    await setEditorWidth(page, 1150)
    const wide = await pairIn(page, '#host .ve-content')
    expect(wide.sideBySide).toBe(true)
    expect(wide.gap).toBeGreaterThanOrEqual(120)
    expect(wide.column).toBeGreaterThanOrEqual(120)
    await setEditorWidth(page, 900)
    expect((await pairIn(page, '#host .ve-content')).sideBySide).toBe(false)
  })

  test('salvar, reabrir, redimensionar e mover de novo', async ({ page }) => {
    await narrowPair(page)
    const saved = await page.evaluate(() => window.__ref.current!.getHTML())
    await mount(page, { initialContent: saved, width: 900, height: 900 })
    // Reaberto: o atributo volta com o conteúdo e a posição é a mesma
    expect(await box(page).getAttribute('data-ve-stack')).toBe('960')
    expect((await pairIn(page, '#host .ve-content')).sideBySide).toBe(false)
    // Caixa menor: a coluna cabe nesta largura e o limite é recalculado
    await selectBox(page)
    await core(page, 'resizeSelectedTextbox(25)')
    const after = await pairIn(page, '#host .ve-content')
    expect(after.sideBySide).toBe(true)
    expect(after.gap).toBeGreaterThanOrEqual(120)
    expect(await box(page).getAttribute('data-ve-stack')).toBe('800')
    // Movida para o mesmo lado da imagem: nada espremido, nada descido à toa
    await core(page, `positionSelectedTextbox('left')`)
    const same = await pairIn(page, '#host .ve-content')
    expect(same.sideBySide).toBe(true)
    expect(same.column).toBeGreaterThanOrEqual(120)
    const html = await page.evaluate(() => window.__ref.current!.getHTML())
    expect(html).not.toMatch(/clear/)
  })

  test('a coluna mínima acompanha o tamanho da fonte do texto', async ({ page }) => {
    await setup(page)
    await selectImage(page)
    await core(page, 'resizeSelectedImage(40)')
    await core(page, `floatImage('left')`)
    await selectBox(page)
    await core(page, `positionSelectedTextbox('right')`)
    // 40% + 25% numa área de 868px: coluna de ~144px, legível em 16px
    await core(page, 'resizeSelectedTextbox(25)')
    expect((await pairIn(page, '#host .ve-content')).sideBySide).toBe(true)
    // Em 24px a coluna mínima é 180px: a caixa desce
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#host .ve-content')!.style.fontSize = '24px'
    })
    await core(page, 'resizeSelectedTextbox(25)')
    expect((await pairIn(page, '#host .ve-content')).sideBySide).toBe(false)
  })

  test('o clear que o usuário tem no style do objeto não é apagado', async ({ page }) => {
    await mount(page, {
      initialContent: CONTENT.replace(
        'style="width: 200px;"',
        'class="pos-left" style="width: 200px; clear: left;"',
      ),
      width: 900,
      height: 900,
    })
    await selectBox(page)
    await core(page, `positionSelectedTextbox('right')`)
    await core(page, 'resizeSelectedTextbox(30)')
    expect(await img(page).evaluate((n) => (n as HTMLElement).style.clear)).toBe('left')
  })
})

test.describe('API do núcleo: contrato da 0.5.0-beta.1', () => {
  test('alignSelectedTextbox continua alinhando o texto dentro da caixa, sem movê-la', async ({
    page,
  }) => {
    await setup(page)
    await selectBox(page)
    const before = await rel(box(page))
    await core(page, `alignSelectedTextbox('right')`)
    expect(await box(page).evaluate((n) => (n as HTMLElement).style.textAlign)).toBe('right')
    expect(await box(page).getAttribute('class')).not.toMatch(/tb-float|tb-center/)
    expect(await rel(box(page))).toEqual(before)
  })

  test('positionSelectedTextbox move a caixa e não mexe no alinhamento do texto', async ({
    page,
  }) => {
    await setup(page)
    await selectBox(page)
    await core(page, `positionSelectedTextbox('right')`)
    expect(await box(page).getAttribute('class')).toMatch(/tb-float-right/)
    expect(await box(page).evaluate((n) => (n as HTMLElement).style.textAlign)).toBe('')
  })
})
