// HTML real da área de transferência do Microsoft Word — Lote C (15/11/2026). As
// amostras de tests/fixtures/word/clipboard foram copiadas pelo próprio Word
// (documentos sintéticos), como o navegador as entrega à colagem (a partir de
// StartHTML, sem o cabeçalho do formato da área de transferência). Os
// *.reference.json trazem o que o Word mostra em cada parágrafo.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeRichPaste } from '../../src/core/paste'
import { sanitizeHtml } from '../../src/core/sanitize'

const read = (name: string) =>
  readFileSync(resolve(process.cwd(), 'tests/fixtures/word', name), 'utf8')
const FAMILIES = [{ label: 'Aptos', value: 'Aptos, sans-serif' }]
const preserve = (html: string) =>
  sanitizeRichPaste(html, FAMILIES, {
    images: true,
    spacing: 'preserve',
    measureLineHeight: () => 1.2,
  })
const body = (html: string) => new DOMParser().parseFromString(html, 'text/html').body
type Ref = {
  paragraphs: {
    text: string
    listType: number
    level: number
    marker: string
    leftIndent: number
  }[]
}
const ref = (name: string) => JSON.parse(read(`clipboard/${name}.reference.json`)) as Ref

/** Itens das listas: texto próprio (sem sublistas) e nível */
function items(root: Element) {
  return Array.from(root.querySelectorAll('li')).map((li) => {
    const copy = li.cloneNode(true) as Element
    copy.querySelectorAll('ul, ol').forEach((sub) => sub.remove())
    let level = 0
    for (let el: Element | null = li; el && el !== root; el = el.parentElement) {
      if (el.tagName === 'UL' || el.tagName === 'OL') level++
    }
    return { text: copy.textContent!.replace(/\s+/g, ' ').trim(), level }
  })
}

describe('área de transferência do Word = HTML salvo pelo Word', () => {
  it('espaçamento: o mesmo resultado nos dois formatos', () => {
    const fromClipboard = body(preserve(read('clipboard/spacing.html')))
    const fromFile = body(preserve(read('word-spacing.htm')))
    const styles = (root: Element) =>
      Array.from(root.querySelectorAll('p, h2')).map((p) => [
        p.tagName,
        (p as HTMLElement).style.cssText.replace(/font-family:[^;]*;\s*/g, ''),
        // Espaços do código-fonte (quebras de linha do Word) são um espaço na tela
        p.textContent!.replace(/\s+/g, ' ').trim(),
      ])
    expect(styles(fromClipboard)).toEqual(styles(fromFile))
  })

  it('listas: os itens e os níveis que o Word mostra', () => {
    const root = body(preserve(read('clipboard/lists.html')))
    const expected = ref('lists')
      .paragraphs.filter((p) => p.listType !== 0)
      .map((p) => ({ text: p.text, level: p.level }))
    expect(items(root)).toEqual(expected)
    // Continuidade e tipos, como no HTML salvo
    const ols = Array.from(root.querySelectorAll('ol'))
    expect(ols.map((ol) => ol.getAttribute('start'))).toContain('4')
    expect(ols.some((ol) => ol.getAttribute('type') === 'a')).toBe(true)
    expect(ols.some((ol) => ol.getAttribute('type') === 'i')).toBe(true)
  })

  it('lista mista: ul/li do Word e parágrafos mso-list da mesma lista', () => {
    const root = body(preserve(read('clipboard/mixed.html')))
    const expected = ref('mixed')
      .paragraphs.filter((p) => p.listType !== 0)
      .map((p) => ({ text: p.text, level: p.level }))
    expect(items(root)).toEqual(expected)
  })

  it('linha horizontal e tabela passam como antes', () => {
    const root = body(preserve(read('clipboard/hr-table.html')))
    expect(root.querySelectorAll('hr')).toHaveLength(1)
    expect(root.querySelectorAll('table tr')).toHaveLength(3)
    expect(root.querySelector('td')?.textContent?.trim()).toBe('Coluna A')
  })

  it('reabrir não muda nada', () => {
    for (const name of ['spacing', 'lists', 'mixed', 'hr-table']) {
      const out = preserve(read(`clipboard/${name}.html`))
      expect(sanitizeHtml(out), name).toBe(out)
    }
  })

  it('nada da área de transferência sobra no conteúdo (cabeçalho, propriedades, classes)', () => {
    for (const name of ['spacing', 'lists', 'mixed', 'hr-table']) {
      const out = preserve(read(`clipboard/${name}.html`))
      expect(out, name).not.toMatch(/StartFragment|o:DocumentProperties|Mso|mso-|class=|<o:p/)
    }
  })
})

describe('recuo e margens das listas, como no Word (estilo do próprio ul/ol)', () => {
  it('o texto de cada nível começa onde o Word o põe; a lista não tem espaço próprio', () => {
    const root = body(preserve(read('clipboard/lists.html')))
    const lists = Array.from(root.querySelectorAll('ul, ol')) as HTMLElement[]
    expect(lists.every((l) => l.style.marginTop === '0pt' && l.style.marginBottom === '0pt')).toBe(
      true,
    )
    // Recuo do texto acumulado até cada item = recuo esquerdo do parágrafo no Word
    const textStart = (li: Element) => {
      let pt = 0
      for (let el: Element | null = li.parentElement; el && el !== root; el = el.parentElement) {
        if (el.tagName === 'UL' || el.tagName === 'OL')
          pt += parseFloat((el as HTMLElement).style.paddingLeft)
      }
      return pt
    }
    const expected = ref('lists')
      .paragraphs.filter((p) => p.listType !== 0)
      .map((p) => p.leftIndent)
    expect(Array.from(root.querySelectorAll('li')).map(textStart)).toEqual(expected)
  })

  it('lista vinda da web (ul/li do Word): recuo pela parada de tabulação da lista', () => {
    const root = body(preserve(read('clipboard/mixed.html')))
    const ul = root.querySelector('ul') as HTMLElement
    expect(ul.style.paddingLeft).toBe('36pt')
  })

  it("'remove' (padrão): as listas e o recuo como antes", () => {
    const html = read('clipboard/lists.html')
    const remove = sanitizeRichPaste(html, FAMILIES, { images: true, spacing: 'remove' })
    expect(remove).toBe(sanitizeRichPaste(html, FAMILIES, { images: true }))
    expect(remove).not.toMatch(/<ol|<ul|padding-left/)
  })
})

describe('receita de sanitização no servidor (docs/recipes)', () => {
  it('mantém intacto o que a colagem do Word grava (espaçamento e listas)', async () => {
    const { sanitizeOnServer } = await import('../../docs/recipes/sanitize-on-server')
    for (const name of ['spacing', 'lists', 'mixed', 'hr-table']) {
      const out = preserve(read(`clipboard/${name}.html`))
      // Comparado com o mesmo HTML reinterpretado pelo DOM (a receita só o reinterpreta)
      const body = document.createElement('body')
      body.innerHTML = out
      expect(sanitizeOnServer(out), name).toBe(body.innerHTML)
    }
  })
})
