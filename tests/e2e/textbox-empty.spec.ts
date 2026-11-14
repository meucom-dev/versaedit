// Caixa de texto vazia (defeito do playground, 13/11/2026): a caixa inserida no
// editor vazio era o único bloco — não havia linha antes nem depois dela (o clique
// na primeira linha caía dentro da caixa) e ela não tinha para onde ser arrastada.
// Ao soltar uma caixa sobre um parágrafo, ela entrava DENTRO do <p> (HTML
// inválido, que o navegador desmonta ao reabrir).
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

const HANDLE = '<span class="textbox-handle" contenteditable="false" title="Drag text box">⠿</span>'
const EMPTY_BOX = `<div class="rich-textbox">${HANDLE}</div>`
const LINE = '<p><br></p>'
const TEXT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. '

const html = (page: Page) => page.evaluate(() => window.__ref.current!.getHTML())

/** Clique no fundo do editor, na altura `y` (coordenada da página), perto da margem esquerda */
async function clickEditorAt(page: Page, y: number) {
  const area = (await page.locator('#host .ve-content').boundingBox())!
  await page.mouse.click(area.x + 30, y)
}

/** Arrasta a caixa `index` pela alça até (x, y) */
async function dragBox(page: Page, index: number, x: number, y: number) {
  const handle = page.locator('#host .ve-content .rich-textbox .textbox-handle').nth(index)
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(100)
}

/** Posição de cada filho direto do editor: 'box' para caixa, o texto do resto */
const layout = (page: Page) =>
  page
    .locator('#host .ve-content')
    .evaluate((ed) =>
      Array.from(ed.children).map((c) =>
        c.classList.contains('rich-textbox') ? 'box' : `${c.tagName}:${c.textContent}`,
      ),
    )

/** O HTML é válido: reabrir pelo parser do navegador não muda nada (nenhuma <div>
 * dentro de <p>) e não há atributo de evento nem contenteditable sobrando */
async function expectValidHtml(page: Page) {
  const out = await html(page)
  const reparsed = await page.evaluate(
    (h) => new DOMParser().parseFromString(h, 'text/html').body.innerHTML,
    out,
  )
  expect(reparsed).toBe(out)
  expect(out).not.toMatch(/<p[^>]*>(?:(?!<\/p>).)*<div/s)
  expect(out).not.toMatch(/\son\w+=/i)
  expect(out).not.toContain('contenteditable="true"')
}

test.describe('caixa de texto vazia', () => {
  test('inserida no editor vazio: linha antes e depois, cursor dentro da caixa', async ({
    page,
  }) => {
    const t = await mount(page, { width: 800, height: 400 })
    await t.content.click()
    await t.btn('Insert text box').click()
    expect(await html(page)).toBe(`${LINE}${EMPTY_BOX}${LINE}`)
    await page.keyboard.type('dentro')
    expect(await html(page)).toBe(`${LINE}<div class="rich-textbox">${HANDLE}dentro</div>${LINE}`)
  })

  test('digitar na primeira linha, antes da caixa, e na linha depois dela', async ({ page }) => {
    const t = await mount(page, { width: 800, height: 400 })
    await t.content.click()
    await t.btn('Insert text box').click()
    const box = (await t.content.locator('.rich-textbox').boundingBox())!
    await clickEditorAt(page, box.y - 20)
    await page.keyboard.type('antes')
    await clickEditorAt(page, box.y + box.height + 25)
    await page.keyboard.type('depois')
    expect(await html(page)).toBe(`<p>antes</p>${EMPTY_BOX}<p>depois</p>`)
  })

  test('HTML carregado só com a caixa: o clique acima/abaixo cria a linha (sem mudar o HTML ao carregar)', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: EMPTY_BOX, width: 800, height: 400 })
    // Carregar não acrescenta nada
    expect(await t.dom()).toBe(EMPTY_BOX)
    const box = (await t.content.locator('.rich-textbox').boundingBox())!
    await clickEditorAt(page, box.y - 15)
    await page.keyboard.type('topo')
    const box2 = (await t.content.locator('.rich-textbox').boundingBox())!
    await clickEditorAt(page, box2.y + box2.height + 25)
    await page.keyboard.type('fim')
    expect(await html(page)).toBe(`<p>topo</p>${EMPTY_BOX}<p>fim</p>`)
  })

  test('entre duas caixas seguidas: o clique no espaço entre elas cria a linha', async ({
    page,
  }) => {
    const t = await mount(page, {
      initialContent: `${EMPTY_BOX}${EMPTY_BOX}`,
      width: 800,
      height: 400,
    })
    const [a, b] = await Promise.all([
      t.content.locator('.rich-textbox').nth(0).boundingBox(),
      t.content.locator('.rich-textbox').nth(1).boundingBox(),
    ])
    await clickEditorAt(page, (a!.y + a!.height + b!.y) / 2)
    await page.keyboard.type('meio')
    expect(await html(page)).toBe(`${EMPTY_BOX}<p>meio</p>${EMPTY_BOX}`)
  })

  test('nada invisível cobre a primeira linha: o ponto dela é o parágrafo', async ({ page }) => {
    const t = await mount(page, { width: 800, height: 400 })
    await t.content.click()
    await t.btn('Insert text box').click()
    const first = (await t.content.locator('p').first().boundingBox())!
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y)
        return el?.tagName === 'P' ? 'P' : `${el?.tagName}.${el?.className}`
      },
      [first.x + 10, first.y + first.height / 2],
    )
    expect(hit).toBe('P')
  })
})

test.describe('mover caixa de texto', () => {
  test('caixa vazia sozinha no editor: arrastar para cima a leva para antes da 1ª linha', async ({
    page,
  }) => {
    const t = await mount(page, { width: 800, height: 400 })
    await t.content.click()
    await t.btn('Insert text box').click()
    expect(await layout(page)).toEqual(['P:', 'box', 'P:'])
    const first = (await t.content.locator('p').first().boundingBox())!
    await dragBox(page, 0, first.x + 60, first.y + 2)
    expect(await layout(page)).toEqual(['box', 'P:', 'P:'])
    await expectValidHtml(page)
  })

  test('caixa vazia entre parágrafos: arrastar muda de lugar e fica entre blocos', async ({
    page,
  }) => {
    const t = await mount(page, {
      initialContent: `<p>um ${TEXT}</p><p>dois ${TEXT}</p><p>tres ${TEXT}</p>${EMPTY_BOX}`,
      width: 800,
      height: 500,
    })
    const first = (await t.content.locator('p').first().boundingBox())!
    await dragBox(page, 0, first.x + 60, first.y + 4)
    const order = await layout(page)
    expect(order[0]).toBe('box')
    expect(order.filter((x) => x === 'box')).toHaveLength(1)
    await expectValidHtml(page)
  })

  test('caixa preenchida: arrastar para o meio do texto não a põe dentro do parágrafo', async ({
    page,
  }) => {
    const box = `<div class="rich-textbox">${HANDLE}escrito</div>`
    const t = await mount(page, {
      initialContent: `${box}<p>um ${TEXT.repeat(3)}</p><p>dois ${TEXT.repeat(3)}</p>`,
      width: 800,
      height: 500,
    })
    const second = (await t.content.locator('p').nth(1).boundingBox())!
    await dragBox(page, 0, second.x + 200, second.y + second.height * 0.75)
    const order = await layout(page)
    expect(order.indexOf('box')).toBeGreaterThan(0)
    await expect(t.content.locator('p .rich-textbox')).toHaveCount(0)
    expect(await t.content.locator('.rich-textbox').textContent()).toBe('⠿escrito')
    await expectValidHtml(page)
  })

  test('várias caixas: cada uma recebe o próprio texto e a linha depois da última', async ({
    page,
  }) => {
    const t = await mount(page, { width: 800, height: 500 })
    await t.content.click()
    await t.btn('Insert text box').click()
    await page.keyboard.type('A')
    // Cursor na última linha e outra caixa
    await t.content.locator('p').last().click()
    await t.btn('Insert text box').click()
    await page.keyboard.type('B')
    expect(await html(page)).toBe(
      `${LINE}<div class="rich-textbox">${HANDLE}A</div>${LINE}<div class="rich-textbox">${HANDLE}B</div>${LINE}`,
    )
    await expectValidHtml(page)
  })

  test('selecionar texto dentro da caixa com o mouse não arrasta a caixa', async ({ page }) => {
    const box = `<div class="rich-textbox">${HANDLE}texto para selecionar</div>`
    const t = await mount(page, {
      initialContent: `<p>antes</p>${box}<p>depois</p>`,
      width: 800,
      height: 400,
    })
    const tb = t.content.locator('.rich-textbox')
    const before = (await tb.boundingBox())!
    const text = await page.evaluate(() => {
      const node = document.querySelector('#host .rich-textbox')!.lastChild as Text
      const r = document.createRange()
      r.setStart(node, 0)
      r.setEnd(node, node.length)
      const b = r.getBoundingClientRect()
      return { x0: b.left + 2, x1: b.right - 2, y: b.top + b.height / 2 }
    })
    await page.mouse.move(text.x0, text.y)
    await page.mouse.down()
    await page.mouse.move(text.x1, text.y, { steps: 10 })
    await page.mouse.up()
    const after = (await tb.boundingBox())!
    expect(Math.abs(after.x - before.x)).toBeLessThan(1)
    expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    expect(await tb.evaluate((el: HTMLElement) => el.style.transform)).toBe('')
    expect(await page.evaluate(() => getSelection()!.toString())).toContain('selecionar')
    expect(await layout(page)).toEqual(['P:antes', 'box', 'P:depois'])
  })

  test('salvar e reabrir depois de mover: a mesma estrutura', async ({ page }) => {
    const t = await mount(page, {
      initialContent: `<p>um ${TEXT}</p><p>dois ${TEXT}</p>${EMPTY_BOX}`,
      width: 800,
      height: 500,
    })
    const first = (await t.content.locator('p').first().boundingBox())!
    await dragBox(page, 0, first.x + 60, first.y + 4)
    const saved = await html(page)
    await page.evaluate((h) => window.__ref.current!.setHTML(h), saved)
    expect(await html(page)).toBe(saved)
    await expectValidHtml(page)
  })
})
