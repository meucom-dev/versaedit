// Listas do Word na colagem (pasteSpacing: 'preserve') — Lote B (15/11/2026).
// Colagem da amostra gerada pelo Microsoft Word (tests/fixtures/word, texto
// sintético): os marcadores que o navegador desenha são os do Word (números,
// letras, romanos, continuação), no editor e no conteúdo publicado com e sem
// Layout Mirror; desfazer/refazer e reabrir mantêm a estrutura.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

test.use({ viewport: { width: 1300, height: 1400 } })

const read = (name: string) =>
  readFileSync(resolve(process.cwd(), 'tests/fixtures/word', name), 'utf8')
const LISTS = read('word-lists.htm')
const REFERENCE = JSON.parse(read('word-lists.reference.json')) as {
  paragraphs: { text: string; listType: number; level: number; marker: string }[]
}

// No Firefox, o evento de colar criado pelo teste chega sem os dados (ver
// word-paste-spacing.spec.ts)
const skipSyntheticPaste = (browserName: string) =>
  test.skip(browserName === 'firefox', 'colagem sintética sem dados no Firefox')

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
    dt.setData('text/plain', 'x')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, html)
}

/**
 * Marcador que o navegador desenha em cada item (pelo contador da lista e pelo
 * list-style-type calculado), com o nível; o mesmo formato do ListString do Word
 */
const markers = (page: Page, root: string) =>
  page.evaluate((sel) => {
    const alpha = (n: number) => String.fromCharCode(96 + n)
    const roman = (n: number) =>
      ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'][n] ?? String(n)
    return [...document.querySelector(sel)!.querySelectorAll('li')].map((li) => {
      const list = li.parentElement as HTMLOListElement
      const type = getComputedStyle(list).listStyleType
      const index = [...list.children].indexOf(li)
      const n = (list.tagName === 'OL' ? list.start || 1 : 1) + index
      const marker =
        type === 'lower-alpha'
          ? alpha(n)
          : type === 'lower-roman'
            ? roman(n)
            : type === 'decimal'
              ? String(n)
              : type
      let level = 0
      for (
        let el: Element | null = li;
        el && el !== document.querySelector(sel);
        el = el.parentElement
      ) {
        if (el.tagName === 'UL' || el.tagName === 'OL') level++
      }
      return { marker, level }
    })
  }, root)

/** O que o Word mostra (sem pontuação: o HTML desenha "4." e o Word "4.") */
const wordMarkers = () =>
  REFERENCE.paragraphs
    .filter((p) => p.listType !== 0)
    .map((p) => {
      // Numerados terminam em "." ou ")" ("4.", "1.2.", "a)", "ii."); o resto ("",
      // "o") é marcador gráfico, que o navegador desenha como disc/circle
      const numbered = /[.)]$/.test(p.marker)
      const marker = numbered ? p.marker.replace(/[.)]$/, '').split('.').at(-1)! : 'bullet'
      return { marker, level: p.level }
    })

test.describe("listas do Word com pasteSpacing: 'preserve'", () => {
  test('os marcadores desenhados são os do Word, no editor e publicados (com e sem espelho)', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    await mount(page, { initialContent: '', width: 900, height: 1300, pasteSpacing: 'preserve' })
    await paste(page, LISTS)
    const expected = wordMarkers()
    const normalize = (list: { marker: string; level: number }[]) =>
      list.map((m) => ({
        marker: ['disc', 'circle', 'square'].includes(m.marker) ? 'bullet' : m.marker,
        level: m.level,
      }))
    expect(normalize(await markers(page, '#host .ve-content'))).toEqual(expected)
    const saved = await page.evaluate(() => window.__ref.current!.getHTML())
    for (const mirror of [false, true]) {
      await page.evaluate(([h, m]) => window.__showPublished(h, { mirror: m }), [
        saved,
        mirror,
      ] as const)
      expect(normalize(await markers(page, '#published')), `mirror=${mirror}`).toEqual(expected)
    }
  })

  test('desfazer tira a colagem; refazer devolve as listas; reabrir mantém', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    const t = await mount(page, {
      initialContent: '<p>antes</p>',
      width: 900,
      height: 1300,
      pasteSpacing: 'preserve',
    })
    await paste(page, LISTS)
    const pasted = await page.evaluate(() => window.__ref.current!.getHTML())
    expect(pasted).toMatch(/<ol [^>]*start="4"/)
    await t.content.focus()
    await page.keyboard.press('Control+z')
    expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe('<p>antes</p>')
    await page.keyboard.press('Control+y')
    expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(pasted)
    // Reaberto com o padrão de colagem: mesma estrutura
    await mount(page, { initialContent: pasted, width: 900, height: 1300 })
    expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(pasted)
  })

  test("'remove' (padrão): as listas do Word ficam como antes (parágrafos)", async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    await mount(page, { initialContent: '', width: 900, height: 1300 })
    await paste(page, LISTS)
    const out = await page.evaluate(() => window.__ref.current!.getHTML())
    expect(out).not.toMatch(/<ol|<ul|<li/)
  })

  test('as listas reconstruídas continuam editáveis com os botões de lista', async ({
    page,
    browserName,
  }) => {
    skipSyntheticPaste(browserName)
    const t = await mount(page, {
      initialContent: '',
      width: 900,
      height: 1300,
      pasteSpacing: 'preserve',
    })
    await paste(page, LISTS)
    // Cursor no fim do primeiro item numerado e Enter: novo item na mesma lista
    await page.locator('#host .ve-content ol li').first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('novo item')
    const first = page.locator('#host .ve-content ol').first()
    await expect(first.locator(':scope > li')).toHaveCount(4)
    await expect(first.locator(':scope > li').nth(1)).toHaveText('novo item')
    void t
  })
})

// Lote C (15/11/2026): ciclo completo com o HTML real da área de transferência do Word
test('ciclo completo: colar, editar, desfazer, refazer, salvar, reabrir e publicar', async ({
  page,
  browserName,
}) => {
  skipSyntheticPaste(browserName)
  const CLIP = readFileSync(
    resolve(process.cwd(), 'tests/fixtures/word/clipboard/lists.html'),
    'utf8',
  )
  const t = await mount(page, {
    initialContent: '<p>antes</p>',
    width: 900,
    height: 1300,
    pasteSpacing: 'preserve',
  })
  const html = () => page.evaluate(() => window.__ref.current!.getHTML())
  await paste(page, CLIP)
  const pasted = await html()
  // Editar: texto no fim do primeiro item numerado
  await page.locator('#host .ve-content ol li').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' editado')
  const edited = await html()
  expect(edited).toContain('Numero um editado')
  // Desfazer a edição, depois a colagem; refazer as duas
  await page.keyboard.press('Control+z')
  expect(await html()).toBe(pasted)
  await page.keyboard.press('Control+z')
  expect(await html()).toBe('<p>antes</p>')
  await page.keyboard.press('Control+y')
  await page.keyboard.press('Control+y')
  expect(await html()).toBe(edited)
  // Salvar e reabrir (padrão de colagem): o mesmo HTML
  await mount(page, { initialContent: edited, width: 900, height: 1300 })
  expect(await html()).toBe(edited)
  // Publicar: recuo, margens e marcadores das listas iguais aos do editor
  const box = (root: string) =>
    page.evaluate(
      (sel) =>
        [...document.querySelector(sel)!.querySelectorAll<HTMLElement>('ul, ol')].map((l) => {
          const cs = getComputedStyle(l)
          return [
            cs.paddingLeft,
            cs.marginTop,
            cs.marginBottom,
            cs.listStyleType,
            (l as HTMLOListElement).start ?? 1,
          ]
        }),
      root,
    )
  const editor = await box('#host .ve-content')
  for (const mirror of [false, true]) {
    await page.evaluate(([h, m]) => window.__showPublished(h, { mirror: m }), [
      edited,
      mirror,
    ] as const)
    expect(await box('#published'), `mirror=${mirror}`).toEqual(editor)
  }
  void t
})
