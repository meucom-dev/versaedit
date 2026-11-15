// Listas do Word na colagem (pasteSpacing: 'preserve') — Lote B (15/11/2026). As
// amostras tests/fixtures/word/word-lists.htm e word-mixed.htm foram geradas pelo
// próprio Microsoft Word (texto sintético); word-lists.reference.json traz o
// marcador e o nível de cada parágrafo, como o Word os mostra.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeRichPaste } from '../../src/core/paste'
import { sanitizeHtml } from '../../src/core/sanitize'
import { parseWordListLevels } from '../../src/core/word-lists'

const read = (name: string) =>
  readFileSync(resolve(process.cwd(), 'tests/fixtures/word', name), 'utf8')
const LISTS = read('word-lists.htm')
const MIXED = read('word-mixed.htm')
const REFERENCE = JSON.parse(read('word-lists.reference.json')) as {
  paragraphs: { text: string; listType: number; level: number; marker: string }[]
}
const FAMILIES = [{ label: 'Aptos', value: 'Aptos, sans-serif' }]
const preserve = (html: string) =>
  sanitizeRichPaste(html, FAMILIES, {
    images: true,
    spacing: 'preserve',
    measureLineHeight: () => 1.2,
  })
const body = (html: string) => new DOMParser().parseFromString(html, 'text/html').body

/** Itens das listas em ordem: texto próprio (sem as sublistas) e nível */
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

describe('definição das listas do documento (@list)', () => {
  it('formato de cada nível: marcador, algarismos, letras e romanos', () => {
    const levels = parseWordListLevels(LISTS)
    const lists = new Set([...levels.entries()].map(([k, v]) => `${k}=${v}`))
    // Marcadores (níveis 1 e 2), numeração simples, letras, romanos, vários níveis
    for (const expected of ['bullet', 'decimal', 'alpha-lower', 'roman-lower']) {
      expect(
        [...lists].some((x) => x.endsWith(`=${expected}`)),
        expected,
      ).toBe(true)
    }
  })
})

describe("listas do Word com pasteSpacing: 'preserve'", () => {
  const out = preserve(LISTS)
  const root = body(out)
  // Contêiner das listas (o corpo do Word vem numa div, div.WordSection1)
  const section = root.querySelector('ul, ol')!.parentElement!

  it('mesmos itens, na mesma ordem e no mesmo nível que no Word', () => {
    const expected = REFERENCE.paragraphs
      .filter((p) => p.listType !== 0)
      .map((p) => ({ text: p.text, level: p.level }))
    expect(items(root)).toEqual(expected)
  })

  it('tipo de cada lista: marcadores, números, letras e romanos', () => {
    const lists = Array.from(section.children).filter(
      (el) => el.tagName === 'UL' || el.tagName === 'OL',
    )
    expect(lists.map((l) => l.tagName)).toEqual(['UL', 'OL', 'OL', 'OL', 'OL', 'OL', 'OL'])
    // Subnível dos marcadores: lista aninhada no segundo item
    expect(lists[0].children[1].querySelector('ul')?.children).toHaveLength(2)
    // Letras e romanos: type (significado) e list-style-type (aparência)
    expect(lists[4].getAttribute('type')).toBe('a')
    expect((lists[4] as HTMLElement).style.listStyleType).toBe('lower-alpha')
    expect(lists[5].getAttribute('type')).toBe('i')
    expect((lists[5] as HTMLElement).style.listStyleType).toBe('lower-roman')
    // Vários níveis: 1. / 1.1. 1.2. / 2.
    expect(lists[6].children).toHaveLength(2)
    expect(lists[6].children[0].querySelector('ol')?.children).toHaveLength(2)
  })

  it('continuidade e reinício da numeração', () => {
    const ols = Array.from(section.children).filter((el) => el.tagName === 'OL')
    // 1–3, interrupção, 4–5 (continua), 1–2 (reinicia)
    expect(ols[0].getAttribute('start')).toBeNull()
    expect(ols[1].getAttribute('start')).toBe('4')
    expect(ols[2].getAttribute('start')).toBeNull()
  })

  it('só o marcador do Word sai: o texto e a formatação do item ficam', () => {
    expect(out).not.toContain('·')
    expect(out).not.toContain('')
    expect(out).not.toMatch(/mso-|<o:p|supportLists/)
    const second = root.querySelectorAll('li')[1]
    expect(second.textContent!.replace(/\s+/g, ' ').trim()).toMatch(/^Segundo marcador com negrito/)
    // O trecho em negrito da amostra do Word, inteiro
    expect(second.querySelector('b')?.textContent).toBe('r com negrito')
    // Parágrafos comuns que começam com "•" ou "1." não são listas e não mudam
    const ps = Array.from(section.querySelectorAll(':scope > p')).map((p) => p.textContent)
    expect(ps).toContain('• texto que comeca com um marcador digitado')
    expect(ps).toContain('1. texto que comeca com numero digitado')
  })

  it('espaçamento contextual nos itens; o recuo do Word não vira margem do item', () => {
    const lis = Array.from(root.querySelectorAll('li')) as HTMLElement[]
    expect(lis.every((li) => !li.style.marginLeft && !li.style.textIndent)).toBe(true)
    // Primeira lista: CxSpFirst/Middle sem espaço depois; CxSpLast com 8pt
    const firstList = root.querySelector('ul')!
    const own = Array.from(firstList.children) as HTMLElement[]
    expect(own[0].style.marginBottom).toBe('0pt')
    expect(own.at(-1)!.style.marginBottom).toBe('8pt')
  })

  it('salvar e reabrir (sanitizeHtml) não muda nada: estrutura, start, type e marcadores', () => {
    expect(sanitizeHtml(out)).toBe(out)
  })
})

describe('listas mistas (ul/li do Word + parágrafos mso-list da mesma lista)', () => {
  it('itens seguidos da mesma lista entram na mesma lista HTML', () => {
    // Sem o parágrafo recuado entre eles: os 4 itens numa lista só
    const joined = MIXED.replace(/<p style='margin-left:36.0pt'>Paragrafo recuado[\s\S]*?<\/p>/, '')
    const root = body(preserve(joined))
    const uls = root.querySelectorAll('ul')
    expect(uls).toHaveLength(1)
    expect(items(root).map((i) => i.text)).toEqual([
      'Primeiro item web: texto do primeiro item.',
      'Segundo item web: texto do segundo item.',
      'Item continuado no Word.',
      'Outro item continuado no Word.',
    ])
  })

  it('um parágrafo comum entre as partes separa as listas e mantém o recuo dele', () => {
    const root = body(preserve(MIXED))
    const blocks = Array.from(root.querySelectorAll('ul, p')).map((el) =>
      el.tagName === 'UL'
        ? `UL(${el.children.length})`
        : (el as HTMLElement).style.marginLeft || 'p',
    )
    expect(blocks).toEqual(['p', 'UL(2)', '36pt', 'UL(2)', 'p'])
  })
})

describe("pasteSpacing: 'remove' (padrão): listas do Word como antes", () => {
  it('nenhuma lista reconstruída, saída idêntica a não passar a opção', () => {
    const before = sanitizeRichPaste(LISTS, FAMILIES, { images: true })
    const remove = sanitizeRichPaste(LISTS, FAMILIES, { images: true, spacing: 'remove' })
    expect(remove).toBe(before)
    expect(remove).not.toMatch(/<ol|start=|list-style-type/)
  })
})

describe('marcador: só o span do Word sai', () => {
  it('um "·" do próprio texto do item fica', () => {
    const html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>@list l0:level1 {mso-level-number-format:bullet;}</style></head><body>' +
      "<p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt \"Times New Roman\"'>&nbsp; </span></span></span><![endif]>· ponto do texto</p></body></html>"
    const li = body(preserve(html)).querySelector('li')!
    expect(li.textContent).toBe('· ponto do texto')
  })
})
