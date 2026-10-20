// ─── COLAGEM DE BLOCOS (parágrafos, títulos, listas, tabelas…) ─────────
// Colar blocos com range.insertNode no meio de um parágrafo gerava HTML inválido
// (<p>ola <p>um</p>…</p>). Aqui a colagem com blocos é feita em duas etapas:
//
//   1. planBlockPaste: lê o conteúdo colado e o ponto de inserção e decide o que
//      vai para cada lugar (não mexe no editor);
//   2. applyBlockPaste: aplica o plano ao DOM e devolve a posição do cursor.
//
// Regra (a mesma em todos os navegadores):
// - Num bloco de texto (parágrafo, título, item, citação, div de linha), o bloco é
//   dividido no cursor. O texto solto e um parágrafo simples no começo do que foi
//   colado juntam-se à metade da esquerda; no fim, à metade da direita (como no
//   Word). Os demais blocos (títulos, listas, tabelas, linhas, código…) entram
//   inteiros entre as metades. Metades vazias saem. Num item de lista, os
//   parágrafos do meio viram itens e os outros blocos entram num item novo.
// - Num contêiner (célula de tabela, caixa de texto, a própria área de edição),
//   os blocos entram no cursor, sem dividir nada (conteúdo de fluxo válido).
// - Num bloco de código (pre), entra só o texto.
// - Sem blocos no conteúdo colado, não há plano: a colagem continua como antes.

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'TABLE',
  'HR',
  'FIGURE',
])
const CONTENT_ELEMENTS = 'img, hr, table, iframe, video, audio, object, embed, canvas, svg'

const isBlock = (node: Node): node is HTMLElement =>
  node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName)

const hasBlockChild = (el: Element) => Array.from(el.children).some(isBlock)

// Parágrafo sem atributos e sem blocos dentro: as pontas da colagem podem se juntar
// às metades do bloco de destino
const isPlainParagraph = (node: Node): node is HTMLElement =>
  node instanceof HTMLElement &&
  (node.tagName === 'P' || node.tagName === 'DIV') &&
  node.attributes.length === 0 &&
  !hasBlockChild(node)

const isEmptyBlock = (el: Element) => !el.textContent?.trim() && !el.querySelector(CONTENT_ELEMENTS)

export type PastePlan =
  | {
      kind: 'split'
      /** Bloco de texto que será dividido no cursor */
      block: HTMLElement
      /** Vai para o fim da metade da esquerda */
      leading: Node[]
      /** Entram entre as metades */
      blocks: Node[]
      /** Vai para o começo da metade da direita */
      trailing: Node[]
    }
  | { kind: 'container'; nodes: Node[] }
  | { kind: 'text'; text: string }

type Context = { kind: 'split'; block: HTMLElement } | { kind: 'container' } | { kind: 'text' }

// Onde o cursor está: bloco de texto, contêiner ou bloco de código
function contextOf(range: Range, editor: HTMLElement): Context {
  let el: Element | null =
    range.startContainer.nodeType === 3
      ? range.startContainer.parentElement
      : (range.startContainer as Element)
  for (; el && el !== editor; el = el.parentElement) {
    const tag = el.tagName
    if (tag === 'PRE') return { kind: 'text' }
    if (tag === 'TD' || tag === 'TH' || tag === 'CAPTION') return { kind: 'container' }
    if (/^(P|H[1-6]|LI)$/.test(tag)) return { kind: 'split', block: el as HTMLElement }
    if (tag === 'BLOCKQUOTE' || tag === 'DIV') {
      if (el.classList.contains('rich-textbox') || hasBlockChild(el)) return { kind: 'container' }
      return { kind: 'split', block: el as HTMLElement }
    }
  }
  return { kind: 'container' }
}

// Texto dos nós, com uma quebra de linha entre blocos
function plainText(nodes: Node[]): string {
  return nodes
    .map((node) => node.textContent ?? '')
    .filter((text, i) => text || !isBlock(nodes[i]))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
}

/** Plano da colagem de `fragment` no ponto `range`; null se não houver blocos */
export function planBlockPaste(
  fragment: DocumentFragment,
  range: Range,
  editor: HTMLElement,
): PastePlan | null {
  const nodes = Array.from(fragment.childNodes)
  if (!nodes.some(isBlock)) return null
  const context = contextOf(range, editor)
  if (context.kind === 'text') return { kind: 'text', text: plainText(nodes) }
  if (context.kind === 'container') return { kind: 'container', nodes }

  // Pontas: texto solto ou um parágrafo simples
  const items = [...nodes]
  const takeInline = (from: 'start' | 'end'): Node[] => {
    const run: Node[] = []
    while (items.length && !isBlock(from === 'start' ? items[0] : items[items.length - 1])) {
      run[from === 'start' ? 'push' : 'unshift']((from === 'start' ? items.shift() : items.pop())!)
    }
    if (run.length) return run
    const edge = from === 'start' ? items[0] : items[items.length - 1]
    if (edge && isPlainParagraph(edge)) {
      if (from === 'start') items.shift()
      else items.pop()
      return Array.from(edge.childNodes)
    }
    return []
  }
  const leading = takeInline('start')
  const trailing = takeInline('end')

  // Meio: texto solto vira parágrafo; num item de lista, parágrafos viram itens
  const inList = context.block.tagName === 'LI'
  const blocks: Node[] = []
  let loose: Node[] = []
  const flushLoose = () => {
    if (!loose.length) return
    const p = document.createElement(inList ? 'li' : 'p')
    p.append(...loose)
    blocks.push(p)
    loose = []
  }
  for (const node of items) {
    if (!isBlock(node)) {
      loose.push(node)
      continue
    }
    flushLoose()
    if (inList && isPlainParagraph(node)) {
      const li = document.createElement('li')
      li.append(...Array.from(node.childNodes))
      blocks.push(li)
    } else if (inList && node.tagName !== 'LI') {
      const li = document.createElement('li')
      li.append(node)
      blocks.push(li)
    } else if (!inList && node.tagName === 'LI') {
      // Item solto fora de uma lista: entra numa lista
      const last = blocks[blocks.length - 1]
      if (last instanceof HTMLElement && last.tagName === 'UL' && last.dataset.pasted) {
        last.append(node)
      } else {
        const ul = document.createElement('ul')
        ul.dataset.pasted = '1'
        ul.append(node)
        blocks.push(ul)
      }
    } else {
      blocks.push(node)
    }
  }
  flushLoose()
  blocks.forEach((b) => b instanceof HTMLElement && delete b.dataset.pasted)
  return { kind: 'split', block: context.block, leading, blocks, trailing }
}

// Divide `block` no ponto `range`: a parte depois do cursor vai para uma cópia
// do bloco (mesma etiqueta e atributos, sem id), logo depois dele
function splitBlock(block: HTMLElement, range: Range): HTMLElement {
  const tail = document.createRange()
  tail.setStart(range.startContainer, range.startOffset)
  tail.setEnd(block, block.childNodes.length)
  const right = block.cloneNode(false) as HTMLElement
  right.removeAttribute('id')
  right.appendChild(tail.extractContents())
  block.after(right)
  return right
}

// Cursor no fim do texto de `node` (ou logo depois dele, se não houver texto)
function caretAtEnd(node: Node): Range {
  const range = document.createRange()
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let last: Text | null = null
  while (walker.nextNode()) last = walker.currentNode as Text
  if (last) range.setStart(last, last.length)
  else range.setStartAfter(node)
  range.collapse(true)
  return range
}

/** Aplica o plano ao DOM no ponto `range` e devolve a posição do cursor */
export function applyBlockPaste(plan: PastePlan, range: Range): Range {
  if (plan.kind === 'text') {
    const text = document.createTextNode(plan.text)
    range.insertNode(text)
    return caretAtEnd(text)
  }
  if (plan.kind === 'container') {
    const fragment = document.createDocumentFragment()
    fragment.append(...plan.nodes)
    const last = plan.nodes[plan.nodes.length - 1]
    range.insertNode(fragment)
    return caretAtEnd(last)
  }

  const { block, leading, blocks, trailing } = plan
  // Só um parágrafo simples: entra no cursor, sem dividir
  if (!blocks.length && !trailing.length) {
    const fragment = document.createDocumentFragment()
    fragment.append(...leading)
    const last = leading[leading.length - 1]
    range.insertNode(fragment)
    const caret = document.createRange()
    caret.setStartAfter(last)
    caret.collapse(true)
    return caret
  }

  const right = splitBlock(block, range)
  block.append(...leading)
  right.prepend(...trailing)
  let anchor: Node = block
  for (const node of blocks) {
    ;(anchor as ChildNode).after(node)
    anchor = node
  }
  // Cursor: depois do que entrou na metade da direita, ou no fim do último bloco
  let caret: Range
  if (trailing.length) {
    caret = document.createRange()
    caret.setStartAfter(trailing[trailing.length - 1])
    caret.collapse(true)
  } else {
    caret = caretAtEnd(blocks[blocks.length - 1])
  }
  if (isEmptyBlock(block)) block.remove()
  if (isEmptyBlock(right)) right.remove()
  return caret
}
