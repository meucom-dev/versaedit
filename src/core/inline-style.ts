// ============================================================
// ESTILO DE TEXTO NA SELEÇÃO (tamanho, família da fonte, cor)
// ============================================================
// Aplica uma propriedade só ao texto selecionado, bloco por bloco. Só nós de
// texto são divididos (nas pontas da seleção); elementos nunca são partidos nem
// tirados do bloco: cada trecho ganha um span dentro do próprio bloco (parágrafo,
// título, item de lista, célula, caixa de texto). Antes, extractContents() partia
// os blocos das pontas e punha itens de lista e parágrafos dentro de um span
// (HTML inválido: marcadores e parágrafos vazios, itens divididos).

export type InlineStyleProperty = 'fontSize' | 'fontFamily' | 'color'

const CSS_NAME: Record<InlineStyleProperty, string> = {
  fontSize: 'font-size',
  fontFamily: 'font-family',
  color: 'color',
}

// Elementos que delimitam um trecho: o span nunca os envolve nem sai deles
const BOUNDARY_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'UL',
  'OL',
  'DL',
  'DT',
  'DD',
  'BLOCKQUOTE',
  'PRE',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TD',
  'TH',
  'CAPTION',
  'COLGROUP',
  'COL',
  'DIV',
  'SECTION',
  'ARTICLE',
  'ASIDE',
  'HEADER',
  'FOOTER',
  'NAV',
  'MAIN',
  'FIGURE',
  'FIGCAPTION',
  'ADDRESS',
  'DETAILS',
  'SUMMARY',
  'HR',
])
// Contêineres em que texto só de espaços é a formatação do HTML, não conteúdo
const STRUCTURE_TAGS = new Set(['UL', 'OL', 'DL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR'])
// Texto que não é do conteúdo editável
const SKIP_INSIDE = 'script, style, svg, textarea, select, option, noscript, template'

export interface InlineStyleResult {
  /** Primeiro e último nó de texto estilizados (para refazer a seleção) */
  first: Text
  last: Text
  /** Desfaz exatamente o que foi feito (só com `reversible`) */
  revert: () => void
}

const isBoundary = (el: Element, root: Element): boolean =>
  el === root ||
  BOUNDARY_TAGS.has(el.tagName) ||
  el.hasAttribute('contenteditable') ||
  el.classList.contains('rich-textbox')

// Texto editável do conteúdo: fora de objetos não editáveis (alças, incorporados);
// dentro de uma ilha editável (legenda) vale
function isEditableText(node: Text, root: Element): boolean {
  const parent = node.parentElement
  if (!parent || parent.closest(SKIP_INSIDE)) return false
  const island = parent.closest('[contenteditable]')
  if (island && island !== root && root.contains(island)) {
    return island.getAttribute('contenteditable') !== 'false'
  }
  return true
}

// Espaços entre blocos (quebras de linha do HTML entre itens, linhas, parágrafos)
const isFormattingWhitespace = (node: Text, root: Element): boolean =>
  !node.data.trim() &&
  (node.parentNode === root || STRUCTURE_TAGS.has((node.parentNode as Element)?.tagName))

// Span só de estilo (sem classe, id, data-…): pode receber a propriedade direto
const isPlainSpan = (node: Node): node is HTMLSpanElement =>
  node.nodeType === 1 &&
  (node as Element).tagName === 'SPAN' &&
  Array.from((node as Element).attributes).every((attr) => attr.name === 'style')

interface TextPiece {
  node: Text
  start: number
  end: number
}

// Trechos de texto da seleção, em ordem de documento
function collectPieces(root: HTMLElement, range: Range): TextPiece[] {
  const pieces: TextPiece[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!range.intersectsNode(node)) continue
    const start = node === range.startContainer ? range.startOffset : 0
    const end = node === range.endContainer ? range.endOffset : node.length
    if (end <= start) continue
    if (!isEditableText(node, root) || isFormattingWhitespace(node, root)) continue
    pieces.push({ node, start, end })
  }
  return pieces
}

/**
 * Aplica `property: value` ao texto selecionado em `range`, sem mudar a
 * estrutura de blocos. Devolve null se a seleção não tiver texto editável.
 * Com `reversible`, não normaliza (spans vizinhos ficam separados) e `revert()`
 * devolve o HTML exato de antes: é o caminho da pré-visualização.
 */
export function applyInlineStyle(
  root: HTMLElement,
  range: Range,
  property: InlineStyleProperty,
  value: string,
  { reversible = false }: { reversible?: boolean } = {},
): InlineStyleResult | null {
  const pieces = collectPieces(root, range)
  if (!pieces.length) return null
  const log: (() => void)[] = []
  const join = (head: Text, tail: Text) => () => {
    head.appendData(tail.data)
    tail.remove()
  }

  // 1. Divide só os nós de texto das pontas
  const selected: Text[] = []
  for (const piece of pieces) {
    const original = piece.node
    let node = original
    if (piece.end < node.length) log.push(join(original, node.splitText(piece.end)))
    if (piece.start > 0) {
      node = node.splitText(piece.start)
      log.push(join(original, node))
    }
    selected.push(node)
  }

  // 2. Sobe de cada texto até o maior elemento em linha todo selecionado, sem
  //    passar do bloco (negrito inteiro selecionado entra no span com o resto)
  const chosen = new Set<Text>(selected)
  const covered = (el: Element): boolean => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const text = walker.currentNode as Text
      if (text.length && !chosen.has(text)) return false
    }
    return true
  }
  const units: Node[] = []
  for (const text of selected) {
    let unit: Node = text
    for (;;) {
      const parent = unit.parentElement
      if (!parent || isBoundary(parent, root) || !covered(parent)) break
      unit = parent
    }
    if (units[units.length - 1] !== unit) units.push(unit)
  }

  // 3. Agrupa unidades vizinhas no mesmo pai (entre elas, só nós sem texto: br, img)
  const runs: Node[][] = []
  for (const unit of units) {
    const run = runs[runs.length - 1]
    const previous = run?.[run.length - 1]
    if (previous && previous.parentNode === unit.parentNode) {
      const between: Node[] = []
      let node = previous.nextSibling
      while (node && node !== unit) {
        const isBlock = node.nodeType === 1 && isBoundary(node as Element, root)
        if (isBlock || node.textContent?.trim()) break
        between.push(node)
        node = node.nextSibling
      }
      if (node === unit) {
        run.push(...between, unit)
        continue
      }
    }
    runs.push([unit])
  }

  // 4. Um span por grupo (ou o próprio span de estilo, se o grupo for só ele); a
  //    mesma propriedade sai dos elementos de dentro, as outras ficam
  const css = CSS_NAME[property]
  const setStyle = (el: HTMLElement, change: () => void) => {
    const before = el.getAttribute('style')
    change()
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style')
    log.push(() => {
      if (before === null) el.removeAttribute('style')
      else el.setAttribute('style', before)
    })
  }
  const wrappers: HTMLSpanElement[] = []
  for (const run of runs) {
    let wrapper: HTMLSpanElement
    if (run.length === 1 && isPlainSpan(run[0])) {
      wrapper = run[0]
    } else {
      wrapper = document.createElement('span')
      run[0].parentNode!.insertBefore(wrapper, run[0])
      for (const node of run) wrapper.appendChild(node)
      const created = wrapper
      log.push(() => {
        const parent = created.parentNode!
        while (created.firstChild) parent.insertBefore(created.firstChild, created)
        created.remove()
      })
    }
    wrapper.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      if (el.style.getPropertyValue(css)) setStyle(el, () => el.style.removeProperty(css))
    })
    setStyle(wrapper, () => {
      wrapper.style[property] = value
    })
    wrappers.push(wrapper)
  }

  if (!reversible) for (const wrapper of wrappers) tidy(wrapper)
  return {
    first: selected[0],
    last: selected[selected.length - 1],
    revert: reversible ? () => log.reverse().forEach((undo) => undo()) : () => {},
  }
}

// Sem spans acumulados: spans vazios de atributos saem, e spans vizinhos com o
// mesmo estilo viram um só
function tidy(wrapper: HTMLSpanElement): void {
  // Já unido ao vizinho por um grupo anterior
  if (!wrapper.isConnected) return
  wrapper.querySelectorAll('span').forEach((span) => {
    if (span.attributes.length) return
    while (span.firstChild) span.parentNode!.insertBefore(span.firstChild, span)
    span.remove()
  })
  const sameStyle = (node: Node | null): node is HTMLSpanElement =>
    !!node && isPlainSpan(node) && node.style.cssText === wrapper.style.cssText
  const previous = wrapper.previousSibling
  if (sameStyle(previous)) {
    while (wrapper.firstChild) previous.appendChild(wrapper.firstChild)
    wrapper.remove()
    wrapper = previous
  }
  const next = wrapper.nextSibling
  if (sameStyle(next)) {
    while (next.firstChild) wrapper.appendChild(next.firstChild)
    next.remove()
  }
}
