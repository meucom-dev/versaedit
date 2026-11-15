// Fidelidade da colagem do Word (pasteSpacing: 'preserve') — Lote A (15/11/2026).
// Compara a posição de cada parágrafo no editor com a medida pelo próprio Word na
// amostra (tests/fixtures/word/word-spacing.reference.json): mesma largura útil
// (451,3pt = 601,7px), mesma fonte (Aptos) e tamanho (12pt). Só roda onde a fonte
// Aptos está instalada (Windows com Office); no CI, fica de fora.
//
// Não é um teste de igualdade: o Word e o navegador usam métricas diferentes da
// mesma fonte para a linha simples (Aptos: 1,219 no Word, 1,125 no navegador), e
// essa diferença se acumula a cada linha de entrelinha múltipla. O teste mostra a
// diferença real, linha por linha, e verifica que ela vem só dessa causa.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { mount } from './helpers'

const WORD = readFileSync(resolve(process.cwd(), 'tests/fixtures/word/word-spacing.htm'), 'utf8')
const REF = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/word/word-spacing.reference.json'), 'utf8'),
) as { usableWidthPt: number; paragraphs: { index: number; y: number; lines: number }[] }

test.use({ viewport: { width: 1300, height: 1400 } })

test('posição de cada parágrafo: editor × Word, mesma largura, fonte e tamanho', async ({
  page,
  browserName,
}) => {
  // No Firefox, o evento de colar criado pelo teste chega sem os dados (ver
  // word-paste-spacing.spec.ts)
  test.skip(browserName === 'firefox', 'colagem sintética sem dados no Firefox')
  await page.goto('/harness.html')
  const aptos = await page.evaluate(async () => {
    await document.fonts.load('12pt Aptos')
    return document.fonts.check('12pt Aptos')
  })
  test.skip(!aptos, 'fonte Aptos não instalada (só roda localmente, com o Office)')
  const inner = (REF.usableWidthPt * 4) / 3
  const aptosFont = 'Aptos, sans-serif'
  await mount(page, {
    initialContent: '',
    width: inner + 32 + 2,
    height: 1300,
    pasteSpacing: 'preserve',
    fontFamily: aptosFont,
    fontFamilies: [{ label: 'Aptos', value: aptosFont }],
  })
  await page.locator('#host .ve-content').evaluate((el, h) => {
    el.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', h)
    dt.setData('text/plain', 'x')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, WORD)
  const tops = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('#host .ve-content p, #host .ve-content h2')].map(
      (el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        return {
          // Topo da primeira linha (como o Word mede a posição do parágrafo)
          top: range.getClientRects()[0]?.top ?? el.getBoundingClientRect().top,
          lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size || 1,
        }
      },
    ),
  )
  expect(tops).toHaveLength(REF.paragraphs.length)
  const pt = (px: number) => (px * 3) / 4
  const rows = REF.paragraphs.map((ref, i) => ({
    paragraph: ref.index,
    word: ref.y - REF.paragraphs[0].y,
    editor: Number(pt(tops[i].top - tops[0].top).toFixed(2)),
    wordLines: ref.lines,
    editorLines: tops[i].lines,
  }))
  console.log(`FIDELIDADE (${browserName}): posição a partir do 1º parágrafo, em pt`)
  for (const r of rows) {
    const diff = r.editor - r.word
    console.log(
      `  ${String(r.paragraph).padStart(2)}  Word ${r.word.toFixed(2).padStart(7)}  editor ${r.editor
        .toFixed(2)
        .padStart(
          7,
        )}  diferença ${diff.toFixed(2).padStart(6)} (${((diff / Math.max(1, r.word)) * 100).toFixed(1)}%)  linhas ${r.wordLines}/${r.editorLines}`,
    )
  }
  // Mesma largura útil: as quebras de linha são as mesmas em quase todos os parágrafos
  const sameLines = rows.filter((r) => r.wordLines === r.editorLines).length
  expect(sameLines).toBeGreaterThanOrEqual(rows.length - 2)
  // A diferença acumulada fica dentro do que a linha simples explica: no máximo a
  // diferença de métrica (1,219 × 1,125 → −7,7%) sobre a altura de texto até ali
  const last = rows.at(-1)!
  expect(Math.abs(last.editor - last.word) / last.word).toBeLessThan(0.08)
})
