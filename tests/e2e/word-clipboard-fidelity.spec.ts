// Comparação com o Word — Lote C (15/11/2026). Cola o HTML real da área de
// transferência do Word (tests/fixtures/word/clipboard, documentos sintéticos) num
// editor com a mesma largura útil, fonte (Aptos) e tamanho (12pt) do documento, e
// compara cada parágrafo, pelo texto, com o que o Word mediu: posição vertical a
// partir do primeiro parágrafo e, nas listas, onde o texto começa. Só roda onde a
// fonte Aptos está instalada (Windows com Office); no CI, fica de fora.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

test.use({ viewport: { width: 1300, height: 1600 } })

const read = (name: string) =>
  readFileSync(resolve(process.cwd(), 'tests/fixtures/word/clipboard', name), 'utf8')
type Ref = {
  usableWidthPt?: number
  paragraphs: { index: number; y: number; text: string; leftIndent?: number; listType?: number }[]
}

async function pasteInto(page: Page, html: string, usableWidthPt: number) {
  const font = 'Aptos, sans-serif'
  await mount(page, {
    initialContent: '',
    width: (usableWidthPt * 4) / 3 + 32 + 2,
    height: 1500,
    pasteSpacing: 'preserve',
    fontFamily: font,
    fontFamilies: [{ label: 'Aptos', value: font }],
  })
  await page.locator('#host .ve-content').evaluate((el, h) => {
    el.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', h)
    dt.setData('text/plain', 'x')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, html)
  // Por texto: topo da primeira linha e onde o texto começa (pt, a partir da área útil)
  return page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    const cs = getComputedStyle(ed)
    const left = ed.getBoundingClientRect().left + ed.clientLeft + parseFloat(cs.paddingLeft)
    const out: Record<string, { top: number; x: number }> = {}
    for (const el of ed.querySelectorAll<HTMLElement>('p, h2, li, td > p, td')) {
      const own = [...el.childNodes].filter(
        (n) => !(n instanceof HTMLElement && /^(UL|OL|P)$/.test(n.tagName)),
      )
      const text = own
        .map((n) => n.textContent)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
      if (!text || out[text]) continue
      const range = document.createRange()
      range.selectNodeContents(el)
      const first = [...range.getClientRects()].find((r) => r.width > 0)
      if (!first) continue
      out[text] = { top: (first.top * 3) / 4, x: ((first.left - left) * 3) / 4 }
    }
    return out
  })
}

for (const name of ['spacing', 'lists', 'mixed', 'hr-table'] as const) {
  test(`${name}: editor × Word com o HTML da área de transferência`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'firefox', 'colagem sintética sem dados no Firefox')
    await page.goto('/harness.html')
    const aptos = await page.evaluate(async () => {
      await document.fonts.load('12pt Aptos')
      return document.fonts.check('12pt Aptos')
    })
    test.skip(!aptos, 'fonte Aptos não instalada (só roda localmente, com o Office)')
    const ref = JSON.parse(read(`${name}.reference.json`)) as Ref
    const editor = await pasteInto(page, read(`${name}.html`), ref.usableWidthPt ?? 451.3)
    // Só textos únicos (parágrafos com o mesmo texto não se distinguem pelo texto)
    const norm = (t: string) => t.replace(/\s+/g, ' ').trim()
    const counts = new Map<string, number>()
    for (const p of ref.paragraphs) counts.set(norm(p.text), (counts.get(norm(p.text)) ?? 0) + 1)
    const rows = ref.paragraphs
      .filter((p) => p.text && counts.get(norm(p.text)) === 1 && editor[norm(p.text)])
      .map((p) => ({ ...p, ed: editor[norm(p.text)] }))
    const y0 = rows[0].y
    const e0 = rows[0].ed.top
    console.log(
      `COMPARA ${name} (${browserName}): pt a partir do 1º parágrafo; x = início do texto`,
    )
    for (const r of rows) {
      const wordY = r.y - y0
      const edY = r.ed.top - e0
      const x =
        r.leftIndent !== undefined && r.listType
          ? `  x Word ${r.leftIndent} editor ${r.ed.x.toFixed(1)}`
          : ''
      console.log(
        `  ${String(r.index).padStart(2)} ${r.text.slice(0, 26).padEnd(26)} Word ${wordY.toFixed(1).padStart(6)} editor ${edY.toFixed(1).padStart(6)} dif ${(edY - wordY).toFixed(1).padStart(6)}${x}`,
      )
    }
    expect(rows.length).toBeGreaterThan(3)
    // Listas: o texto de cada item começa onde o Word o põe (recuo do ul/ol)
    for (const r of rows.filter((r) => r.listType && r.leftIndent !== undefined)) {
      expect(Math.abs(r.ed.x - r.leftIndent!), r.text).toBeLessThan(0.5)
    }
    // Espaçamento e listas: a posição vertical fica dentro do que a diferença de
    // métrica da linha simples explica (Aptos: cerca de -7,7% por linha). A lista
    // vinda da web, a linha horizontal e a tabela têm diferenças registradas (README)
    if (name === 'spacing' || name === 'lists') {
      for (const r of rows) {
        const wordY = r.y - y0
        expect(Math.abs(r.ed.top - e0 - wordY), r.text).toBeLessThanOrEqual(0.1 * wordY + 2)
      }
    }
  })
}
