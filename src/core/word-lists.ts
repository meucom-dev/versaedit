// ─── LISTAS DO WORD NA COLAGEM ───────────────────────────────────
// O Word não exporta listas como <ul>/<ol>: cada item é um parágrafo com
// style="mso-list:l0 level1 lfo1" (lista l0, nível 1, instância lfo1), e o
// marcador ("·", "1.", "a)") vem desenhado num <span style="mso-list:Ignore">.
// Itens que vieram de uma página da web continuam como <ul>/<li> com o mesmo
// mso-list, misturados aos parágrafos da mesma lista. Com pasteSpacing:
// 'preserve', este módulo reconstrói listas HTML de verdade:
// - itens seguidos da mesma lista (mesmo l e lfo) formam uma lista; o nível vira
//   aninhamento (sublista dentro do item anterior);
// - <ul>/<ol> do Word seguidos de parágrafos da mesma lista recebem esses itens;
// - o tipo vem da definição da lista no documento (@list l0:level1 {
//   mso-level-number-format }) ou, sem ela, do marcador;
// - a numeração continuada depois de um parágrafo comum (o Word mantém o mesmo
//   lfo) vira <ol start="4">; um reinício (outra instância) volta a 1;
// - só o span do marcador (mso-list:Ignore) sai; o texto do item fica inteiro,
//   inclusive um "•" ou "1." digitado, e parágrafos sem mso-list não mudam.
import type { WordSpacing } from './word-styles'

const MSO_LIST = /mso-list\s*:\s*(l\d+)\s+level(\d+)\s+(lfo\d+)/i
const MARKER = /mso-list\s*:\s*ignore/i
const PARAGRAPHS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

type Format = 'bullet' | 'decimal' | 'alpha-lower' | 'alpha-upper' | 'roman-lower' | 'roman-upper'

/** Tipo de numeração de ol e o list-style-type correspondente */
const OL_TYPES: Partial<Record<Format, [string, string]>> = {
  'alpha-lower': ['a', 'lower-alpha'],
  'alpha-upper': ['A', 'upper-alpha'],
  'roman-lower': ['i', 'lower-roman'],
  'roman-upper': ['I', 'upper-roman'],
}

/** Texto das folhas de estilo do documento colado (lido, nunca aplicado) */
const styleText = (html: string) =>
  Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi), (m) => m[1]).join(' ')

/** Formato de cada nível das listas do documento: "l0:1" → bullet, decimal… */
export function parseWordListLevels(html: string): Map<string, Format> {
  const css = styleText(html)
  const levels = new Map<string, Format>()
  for (const match of css.matchAll(/@list\s+(l\d+):level(\d+)\s*\{([^{}]*)\}/gi)) {
    const format = /mso-level-number-format\s*:\s*([\w-]+)/i.exec(match[3])?.[1].toLowerCase()
    const known: Format[] = ['bullet', 'alpha-lower', 'alpha-upper', 'roman-lower', 'roman-upper']
    // Sem mso-level-number-format, o Word usa algarismos (1, 2, 3)
    levels.set(
      `${match[1].toLowerCase()}:${match[2]}`,
      known.includes(format as Format) ? (format as Format) : 'decimal',
    )
  }
  return levels
}

/**
 * Onde o texto de cada nível começa (pt, a partir da margem): margin-left da
 * definição do nível ou, sem ele, a parada de tabulação da lista (é como o Word
 * descreve as listas que vieram de uma página da web)
 */
export function parseWordListIndents(html: string): Map<string, number> {
  const css = styleText(html)
  const indents = new Map<string, number>()
  for (const match of css.matchAll(/@list\s+(l\d+):level(\d+)\s*\{([^{}]*)\}/gi)) {
    const margin = /(?:^|;)\s*margin-left\s*:\s*([\d.]+)pt/i.exec(match[3])?.[1]
    const tab = /mso-level-tab-stop\s*:\s*([\d.]+)pt/i.exec(match[3])?.[1]
    const value = Number(margin ?? tab)
    if (Number.isFinite(value) && value > 0)
      indents.set(`${match[1].toLowerCase()}:${match[2]}`, value)
  }
  return indents
}

interface Item {
  el: Element
  list: string
  level: number
  instance: string
  marker: string
}

/** Formato pelo marcador, quando o documento não define o nível */
function formatFromMarker(marker: string): Format {
  if (/^\d+(?:[.)]\d+)*[.)]?$/.test(marker)) return 'decimal'
  if (/^[ivxlcdm]+[.)]$/.test(marker)) return 'roman-lower'
  if (/^[IVXLCDM]+[.)]$/.test(marker)) return 'roman-upper'
  if (/^[a-z][.)]$/.test(marker)) return 'alpha-lower'
  if (/^[A-Z][.)]$/.test(marker)) return 'alpha-upper'
  return 'bullet'
}

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }

/** Número do item pelo marcador ("4." → 4, "c)" → 3, "iv." → 4, "1.2." → 2) */
function markerNumber(marker: string, format: Format): number | null {
  const text = marker.replace(/[.)\s]+$/, '')
  if (format === 'decimal') {
    const last = /(\d+)$/.exec(text)?.[1]
    return last ? Number(last) : null
  }
  if (format === 'alpha-lower' || format === 'alpha-upper') {
    if (!/^[a-z]+$/i.test(text)) return null
    return [...text.toLowerCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 96, 0)
  }
  if (format === 'roman-lower' || format === 'roman-upper') {
    const digits = [...text.toLowerCase()].map((ch) => ROMAN[ch])
    if (!digits.length || digits.some((d) => !d)) return null
    return digits.reduce((sum, d, i) => sum + (d < (digits[i + 1] ?? 0) ? -d : d), 0)
  }
  return null
}

/** Tira o span do marcador e o que ficou vazio em volta dele; devolve o marcador */
function takeMarker(paragraph: Element): string {
  let marker = ''
  for (const span of Array.from(paragraph.querySelectorAll('[style]'))) {
    if (!MARKER.test(span.getAttribute('style') ?? '') || !span.isConnected) continue
    marker ||= (span.textContent ?? '').replace(/\s+/g, '')
    let node: Element = span
    let parent = node.parentElement
    node.remove()
    // Os spans de fonte que só envolviam o marcador ficam vazios: saem também
    while (parent && parent !== paragraph && !(parent.textContent ?? '').trim()) {
      node = parent
      parent = node.parentElement
      if (!node.querySelector('img,br')) node.remove()
      else break
    }
  }
  // Restos dos comentários condicionais do Word (<![if !supportLists]>)
  for (const child of Array.from(paragraph.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) child.remove()
  }
  return marker
}

function itemOf(el: Element): Item | null {
  const match = MSO_LIST.exec(el.getAttribute('style') ?? '')
  if (!match) return null
  return {
    el,
    list: match[1].toLowerCase(),
    level: Number(match[2]),
    instance: match[3].toLowerCase(),
    marker: '',
  }
}

/** Lista HTML do Word (ul/ol cujos itens têm mso-list): a lista e a instância */
function wordListOf(el: Element): Item | null {
  if (el.tagName !== 'UL' && el.tagName !== 'OL') return null
  const first = Array.from(el.children).find((child) => child.tagName === 'LI')
  const item = first ? itemOf(first) : null
  return item ? { ...item, el } : null
}

/**
 * Reconstrói as listas do Word dentro de `root`. `spacing` (do Lote A) passa dos
 * parágrafos para os itens, sem o recuo à esquerda e o da primeira linha, que no
 * Word desenham a lista (no HTML, quem recua é a própria lista)
 */
export function reconstructWordLists(
  root: Element,
  levels: Map<string, Format>,
  spacing: Map<Element, WordSpacing>,
  indents: Map<string, number> = new Map(),
): void {
  const doc = root.ownerDocument
  const formatOf = (item: Item) =>
    levels.get(`${item.list}:${item.level}`) ?? formatFromMarker(item.marker)

  // Recuo e margens da lista como no Word (estilo do próprio ol/ul, sem regra global):
  // o texto do nível começa em `start` (pt); a lista não tem espaço próprio em cima e
  // embaixo (no Word, o espaço é dos itens, e o navegador daria 1em de cada lado)
  const placeList = (list: Element, start: number | undefined, parentStart: number) => {
    const style = (list as HTMLElement).style
    style.marginTop = '0pt'
    style.marginBottom = '0pt'
    if (start !== undefined)
      style.paddingLeft = `${Math.max(0, Number((start - parentStart).toFixed(2)))}pt`
  }
  const startOf = (item: Item, level: number) =>
    (level === item.level ? spacing.get(item.el)?.marginLeft : undefined) ??
    indents.get(`${item.list}:${level}`)

  const newList = (format: Format) => {
    const ordered = format !== 'bullet'
    const list = doc.createElement(ordered ? 'ol' : 'ul')
    const type = OL_TYPES[format]
    if (type) {
      // type: o significado; list-style-type: a aparência, que resiste ao
      // Layout Mirror (all: revert desfaz o efeito do atributo, não do style)
      list.setAttribute('type', type[0])
      list.setAttribute('style', `list-style-type: ${type[1]}`)
    }
    return list
  }

  const toItem = (item: Item): Element => {
    const li = doc.createElement('li')
    // style do parágrafo (alinhamento, fonte…) segue para o item; o tratamento de
    // sempre da colagem filtra o que pode ficar
    const style = item.el.getAttribute('style')
    if (style) li.setAttribute('style', style)
    while (item.el.firstChild) li.appendChild(item.el.firstChild)
    const s = spacing.get(item.el)
    if (s) {
      const rest = { ...s }
      delete rest.marginLeft
      delete rest.textIndent
      spacing.set(li, rest)
      spacing.delete(item.el)
    }
    return li
  }

  // Grupos de irmãos seguidos que pertencem à mesma lista
  const parents = new Set<Element>([root, ...Array.from(root.querySelectorAll('*'))])
  for (const parent of parents) {
    if (!parent.isConnected && parent !== root) continue
    let run: Item[] = []
    const flush = () => {
      if (run.length) buildRun(run)
      run = []
    }
    for (const child of Array.from(parent.children)) {
      const paragraph = PARAGRAPHS.has(child.tagName) ? itemOf(child) : null
      const list = paragraph ? null : wordListOf(child)
      const item = paragraph ?? list
      if (!item) {
        flush()
        continue
      }
      const current = run[0]
      if (current && (current.list !== item.list || current.instance !== item.instance)) flush()
      if (paragraph) paragraph.marker = takeMarker(child)
      run.push(item)
    }
    flush()
  }

  function buildRun(run: Item[]) {
    const first = run[0]
    // Uma lista HTML do Word no começo do grupo é a raiz; senão, uma lista nova
    let rootList: Element
    if (PARAGRAPHS.has(first.el.tagName)) {
      rootList = newList(formatOf({ ...first, level: 1 }))
      first.el.before(rootList)
    } else {
      rootList = first.el
    }
    // Lista HTML do Word como raiz: já tem itens (e a própria numeração)
    const rootStart = startOf(first, 1)
    placeList(rootList, rootStart, 0)
    const stack: { level: number; list: Element; numbered: boolean; start: number }[] = [
      { level: 1, list: rootList, numbered: rootList === first.el, start: rootStart ?? 0 },
    ]
    for (const item of run) {
      if (item.el === rootList) continue
      if (!PARAGRAPHS.has(item.el.tagName)) {
        // Outra lista HTML da mesma lista do Word: os itens dela entram aqui
        stack.length = 1
        for (const li of Array.from(item.el.children)) rootList.appendChild(li)
        item.el.remove()
        continue
      }
      while (stack.length > 1 && stack[stack.length - 1].level > item.level) stack.pop()
      let top = stack[stack.length - 1]
      while (item.level > top.level) {
        const level = top.level + 1
        const sub = newList(formatOf({ ...item, level }))
        const host = top.list.lastElementChild ?? top.list.appendChild(doc.createElement('li'))
        host.appendChild(sub)
        const start = startOf(item, level)
        placeList(sub, start, top.start)
        top = { level, list: sub, numbered: false, start: start ?? top.start }
        stack.push(top)
      }
      const format = formatOf(item)
      // Primeiro item de uma lista numerada: o número de partida vem do marcador
      if (!top.numbered && top.list.tagName === 'OL') {
        const start = markerNumber(item.marker, format)
        if (start && start > 1 && start < 10000) top.list.setAttribute('start', String(start))
      }
      top.numbered = true
      top.list.appendChild(toItem(item))
      item.el.remove()
    }
  }
}
