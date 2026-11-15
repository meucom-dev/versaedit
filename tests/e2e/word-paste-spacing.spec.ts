// Colagem do Word com espaçamento (pasteSpacing) — Lote A (15/11/2026). Colagem da
// amostra gerada pelo Microsoft Word (tests/fixtures/word, texto sintético), altura
// real das linhas obtida no navegador, salvar e reabrir, histórico, Limpar
// formatação, conteúdo publicado e o comportamento padrão (sem mudança).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { mount, selectAcross } from './helpers'

test.use({ viewport: { width: 1300, height: 1000 } })

// No Firefox, o evento de colar criado pelo teste chega sem os dados da área de
// transferência (clipboardData vazio): a colagem não é coberta por testes
// automáticos no Firefox (README, compatibilidade). Os testes sem colagem rodam.
const skipSyntheticPaste = (browserName: string) =>
  test.skip(browserName === 'firefox', 'colagem sintética sem dados no Firefox')

const WORD = readFileSync(resolve(process.cwd(), 'tests/fixtures/word/word-spacing.htm'), 'utf8')
const REFERENCE = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/word/word-spacing.reference.json'), 'utf8'),
) as { paragraphs: { index: number; y: number; lines: number }[] }

/** Cola o HTML no fim do editor, como a área de transferência entrega */
async function paste(page: Page, html: string) {
  await page.locator('#host .ve-content').evaluate((el, h) => {
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
    const dt = new DataTransfer()
    dt.setData('text/html', h)
    dt.setData('text/plain', 'texto')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, html)
}

const html = (page: Page) => page.evaluate(() => window.__ref.current!.getHTML())

/** Estilos calculados dos parágrafos do editor (ou de outro contêiner) */
const blocks = (page: Page, root = '#host .ve-content') =>
  page.evaluate((sel) => {
    const els = [...document.querySelector(sel)!.querySelectorAll<HTMLElement>('p, h2')]
    return els.map((el) => {
      const cs = getComputedStyle(el)
      const range = document.createRange()
      range.selectNodeContents(el)
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size
      return {
        tag: el.tagName,
        empty: !el.textContent!.trim(),
        top: el.getBoundingClientRect().top,
        height: el.getBoundingClientRect().height,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        marginLeft: cs.marginLeft,
        textIndent: cs.textIndent,
        lineHeight: cs.lineHeight,
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        lines,
      }
    })
  }, root)

test.describe("pasteSpacing: 'remove' (padrão) — sem mudança", () => {
  test('colagem do Word como antes: sem espaçamento do documento, sem linhas em branco', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    await mount(page, { initialContent: '', width: 900, height: 900 })
    await paste(page, WORD)
    const out = await html(page)
    expect(out).not.toMatch(/margin|text-indent|line-height: \d+pt/)
    const b = await blocks(page)
    expect(b.some((x) => x.empty)).toBe(false)
  })
})

test.describe("pasteSpacing: 'preserve'", () => {
  test('espaço antes e depois, recuos, entrelinhas e linhas em branco do Word', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    await mount(page, { initialContent: '', width: 900, height: 1200, pasteSpacing: 'preserve' })
    await paste(page, WORD)
    const b = await blocks(page)
    expect(b).toHaveLength(17)
    // px calculados (1pt = 4/3 px), com a precisão de cada navegador
    const px = (v: string) => parseFloat(v)
    expect(px(b[0].marginBottom)).toBeCloseTo(32, 1) // 24pt
    expect(b[1].empty).toBe(true)
    expect(px(b[2].textIndent)).toBeCloseTo(47.2, 1) // 35,4pt
    expect(px(b[4].marginLeft)).toBeCloseTo(48, 1) // 36pt
    expect(px(b[5].marginTop)).toBeCloseTo(16, 1)
    expect(px(b[5].marginBottom)).toBeCloseTo(8, 1)
    expect(px(b[5].lineHeight)).toBeCloseTo(24, 1)
    expect(px(b[6].lineHeight)).toBeCloseTo(26.667, 1) // pelo menos 20pt
    expect(b[9].empty).toBe(true)
    expect(b[10].tag).toBe('H2')
    expect(px(b[10].marginTop)).toBeCloseTo(10.667, 1)
    expect(px(b[10].marginBottom)).toBeCloseTo(5.333, 1)
    expect(px(b[13].marginTop)).toBe(0)
    expect(px(b[13].marginBottom)).toBe(0)
    expect(px(b[14].marginBottom)).toBeCloseTo(10.667, 1)
  })

  test('altura real da linha: o múltiplo do Word sobre a linha simples do navegador para a fonte', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    await mount(page, { initialContent: '', width: 900, height: 1200, pasteSpacing: 'preserve' })
    await paste(page, WORD)
    const b = await blocks(page)
    // Linha simples do navegador para a fonte calculada do parágrafo (medida aqui
    // do mesmo jeito que o editor mede na colagem)
    const single = await page.evaluate((family) => {
      const p = document.createElement('div')
      p.style.cssText =
        'position:absolute;visibility:hidden;white-space:pre;line-height:normal;font-size:100px'
      p.style.fontFamily = family
      p.textContent = 'X\nX\nX\nX'
      document.body.appendChild(p)
      const ratio = p.getBoundingClientRect().height / 400
      p.remove()
      return ratio
    }, b[2].fontFamily)
    const fontPx = parseFloat(b[2].fontSize)
    // Parágrafo 3: 115% do Word. Altura obtida por linha = altura do bloco / linhas
    const pitch = b[2].height / b[2].lines
    expect(parseFloat(b[2].lineHeight)).toBeCloseTo(1.15 * single * fontPx, 0)
    expect(pitch).toBeCloseTo(parseFloat(b[2].lineHeight), 0)
    // Exata 18pt = 24px por linha, qualquer que seja a fonte
    expect(b[5].height / b[5].lines).toBeCloseTo(24, 0)
    // 1,5 e duplo: proporcionais à mesma linha simples
    expect(parseFloat(b[7].lineHeight)).toBeCloseTo(1.5 * single * fontPx, 0)
    expect(parseFloat(b[8].lineHeight)).toBeCloseTo(2 * single * fontPx, 0)
    // Referência: a linha do Word (pt → px) para o mesmo parágrafo. Não é igual:
    // o Word usa a linha simples dele para a fonte (outras métricas)
    const ref = REFERENCE.paragraphs
    const wordPitch = ((ref[3].y - ref[2].y - 8) / ref[2].lines) * (4 / 3)
    console.log(
      `ENTRELINHA 115%: navegador ${pitch.toFixed(2)} px/linha (fonte ${b[2].fontFamily}, linha simples ${single.toFixed(3)}), Word ${wordPitch.toFixed(2)} px/linha (Aptos)`,
    )
  })

  test('salvar e reabrir (com o padrão de colagem): o espaçamento fica', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    await mount(page, { initialContent: '', width: 900, height: 1200, pasteSpacing: 'preserve' })
    await paste(page, WORD)
    const saved = await html(page)
    const before = await blocks(page)
    // Reaberto num editor com pasteSpacing 'remove' (padrão): nada se perde
    await mount(page, { initialContent: saved, width: 900, height: 1200 })
    expect(await html(page)).toBe(saved)
    const after = await blocks(page)
    expect(after.map(({ top, ...rest }) => (void top, rest))).toEqual(
      before.map(({ top, ...rest }) => (void top, rest)),
    )
  })

  test('histórico: desfazer tira a colagem inteira; refazer devolve com o espaçamento', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    const t = await mount(page, {
      initialContent: '<p>antes</p>',
      width: 900,
      height: 1200,
      pasteSpacing: 'preserve',
    })
    await paste(page, WORD)
    const pasted = await html(page)
    expect(pasted).toContain('margin-bottom: 24pt')
    await t.content.focus()
    await page.keyboard.press('Control+z')
    expect(await html(page)).toBe('<p>antes</p>')
    await page.keyboard.press('Control+y')
    expect(await html(page)).toBe(pasted)
  })

  test('Limpar formatação tira o espaçamento dos blocos selecionados (o recuo do editor fica)', async ({
    page,
  }) => {
    const t = await mount(page, {
      initialContent:
        '<p style="margin-bottom: 8pt; line-height: 1.38; text-indent: 35.4pt;">primeiro</p><p style="margin-top: 12pt; line-height: 18pt;">segundo</p><p style="margin-bottom: 8pt;">fora</p>',
      width: 900,
      height: 600,
    })
    await selectAcross(page, 'primeiro', 'segundo')
    await t.btn('Clear formatting').click()
    const out = await html(page)
    expect(out).toContain('<p>primeiro</p><p>segundo</p>')
    expect(out).toContain('<p style="margin-bottom: 8pt;">fora</p>')
  })

  test('publicado (versaedit-content e Layout Mirror): o mesmo espaçamento do editor', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    await mount(page, { initialContent: '', width: 900, height: 1200, pasteSpacing: 'preserve' })
    await paste(page, WORD)
    const saved = await html(page)
    const editor = await blocks(page)
    for (const mirror of [false, true]) {
      await page.evaluate(([h, m]) => window.__showPublished(h, { mirror: m }), [
        saved,
        mirror,
      ] as const)
      const pub = await blocks(page, '#published')
      for (const i of [0, 2, 4, 5, 6, 10, 13, 14]) {
        expect(pub[i], `bloco ${i} mirror=${mirror}`).toMatchObject({
          marginTop: editor[i].marginTop,
          marginBottom: editor[i].marginBottom,
          marginLeft: editor[i].marginLeft,
          textIndent: editor[i].textIndent,
          lineHeight: editor[i].lineHeight,
        })
      }
    }
  })
})
