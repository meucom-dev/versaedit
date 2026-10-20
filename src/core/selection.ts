// ─── SELEÇÃO ──────────────────────────────────────────────────────

// Ponto de inserção do conteúdo sob o mouse (Blink/WebKit e Firefox)
export function getCaretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (typeof doc.caretRangeFromPoint === 'function') return doc.caretRangeFromPoint(x, y)
  const pos =
    typeof doc.caretPositionFromPoint === 'function' ? doc.caretPositionFromPoint(x, y) : null
  if (pos) {
    const range = document.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    return range
  }
  return null
}

// Posição como número de caracteres desde o início de `root`: sobrevive a
// operações do navegador que recriam os nós de texto (como o unlink)
export function textOffsetIn(root: Node, node: Node, offset: number): number {
  const range = document.createRange()
  range.selectNodeContents(root)
  range.setEnd(node, offset)
  return range.toString().length
}

// Cursor no caractere `offset` de `root` (no fim, se o texto for menor)
export function rangeAtTextOffset(root: Node, offset: number): Range {
  const range = document.createRange()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let left = offset
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (left <= text.length) {
      range.setStart(text, left)
      range.collapse(true)
      return range
    }
    left -= text.length
  }
  range.selectNodeContents(root)
  range.collapse(false)
  return range
}

// ─── SELEÇÃO QUE SOBREVIVE À TROCA DO HTML (desfazer / refazer) ───
// Cada ponta da seleção vira uma posição linear: os caracteres de texto mais uma
// unidade por elemento sem conteúdo (img, br, hr, iframe…) ou não editável e
// sem ilhas editáveis dentro (contenteditable="false", como a alça da caixa de
// texto e futuros incorporados), em ordem de documento. Num objeto não editável
// com ilhas editáveis (como uma legenda), a posição entra nas ilhas. Não depende dos nós (o HTML relido gera
// nós novos, e nós de texto vizinhos se fundem) nem do texto (texto repetido não
// confunde). O caminho do elemento que contém a ponta desempata as fronteiras
// (fim do negrito × começo do texto seguinte). Não conhece tipos de objeto.

/** Uma ponta da seleção */
export interface SelectionPoint {
  /**
   * Bloco de primeiro nível que contém a ponta (índice entre os elementos-filho
   * do editor, que o HTML relido mantém); -1 quando a ponta está na própria raiz
   * (texto solto ou ponto entre blocos)
   */
  block: number
  /** Posição linear desde o começo do bloco (ou do editor, se block = -1) */
  offset: number
  /** Índices dos elementos, do bloco (ou do editor) até o elemento que contém a ponta */
  path: number[]
  /** A ponta estava dentro de um nó de texto */
  inText: boolean
}

/** Seleção com direção: anchor é onde começou, focus é onde terminou */
export interface SelectionSnapshot {
  anchor: SelectionPoint
  focus: SelectionPoint
}

// Descendente efetivamente editável ("true", vazio ou "plaintext-only"): uma ilha
// editável dentro de um objeto não editável (por exemplo, a legenda de um
// incorporado). Um objeto com ilhas não é uma unidade fechada: a posição entra nele.
const EDITABLE_ISLAND = '[contenteditable]:not([contenteditable="false"])'

const isUnit = (node: Node): boolean =>
  node.nodeType === 1 &&
  (!node.firstChild ||
    ((node as Element).getAttribute('contenteditable') === 'false' &&
      !(node as Element).querySelector(EDITABLE_ISLAND)))

function elementPath(root: Node, node: Node): number[] {
  const path: number[] = []
  let el: Node | null = node.nodeType === 3 ? node.parentNode : node
  while (el && el !== root && el.parentNode) {
    path.unshift(Array.prototype.indexOf.call((el.parentNode as Element).children, el))
    el = el.parentNode
  }
  return path
}

// Posição linear do ponto (container, offset). Um ponto dentro de uma unidade
// (por exemplo, dentro da alça) conta como logo antes dela.
function linearOffset(root: Node, container: Node, offset: number): number {
  let count = 0
  let done = false
  const visit = (node: Node): void => {
    for (let i = 0; i < node.childNodes.length && !done; i++) {
      if (node === container && i === offset) {
        done = true
        return
      }
      const child = node.childNodes[i]
      if (child.nodeType === 3) {
        if (child === container) {
          count += offset
          done = true
          return
        }
        count += (child as Text).length
      } else if (isUnit(child)) {
        if (child !== container && child.contains(container)) {
          done = true
          return
        }
        if (child === container) {
          done = true
          return
        }
        count += 1
      } else {
        visit(child)
      }
    }
    if (node === container) done = true
  }
  visit(root)
  return count
}

// Elemento de primeiro nível (filho direto de root) que contém o nó
function topLevelElement(root: Node, node: Node): Element | null {
  let current: Node | null = node
  while (current && current.parentNode !== root) current = current.parentNode
  return current instanceof Element ? current : null
}

// A posição é contada dentro do bloco de primeiro nível da ponta: o custo é o do
// bloco, não o do documento inteiro (que crescia a cada tecla em textos longos)
function snapshotPoint(root: Node, node: Node, offset: number): SelectionPoint {
  const block = node === root ? null : topLevelElement(root, node)
  const scope = block ?? root
  return {
    block: block ? Array.prototype.indexOf.call((root as Element).children, block) : -1,
    offset: linearOffset(scope, node, offset),
    path: elementPath(scope, node),
    inText: node.nodeType === 3,
  }
}

/** Seleção (com direção) como posições lineares dentro de `root` */
export function captureSelection(
  root: Node,
  anchorNode: Node,
  anchorOffset: number,
  focusNode: Node,
  focusOffset: number,
): SelectionSnapshot {
  return {
    anchor: snapshotPoint(root, anchorNode, anchorOffset),
    focus: snapshotPoint(root, focusNode, focusOffset),
  }
}

// Ponto do DOM atual com a posição linear da ponta guardada; entre os candidatos
// (a mesma posição pode ser o fim de um texto e o começo do seguinte), prefere o
// do mesmo elemento e do mesmo tipo (dentro de texto ou entre elementos)
function resolvePoint(root: Node, point: SelectionPoint): [Node, number] {
  const found: { node: Node; offset: number; inText: boolean }[] = []
  let count = 0
  const visit = (node: Node): void => {
    for (let i = 0; i <= node.childNodes.length; i++) {
      if (count === point.offset) found.push({ node, offset: i, inText: false })
      const child = node.childNodes[i]
      if (!child) break
      if (child.nodeType === 3) {
        const length = (child as Text).length
        if (point.offset >= count && point.offset <= count + length) {
          found.push({ node: child, offset: point.offset - count, inText: true })
        }
        count += length
      } else if (isUnit(child)) {
        count += 1
      } else {
        visit(child)
      }
    }
  }
  visit(root)
  const path = point.path.join('/')
  const samePath = (c: (typeof found)[number]) => elementPath(root, c.node).join('/') === path
  const best =
    found.find((c) => samePath(c) && c.inText === point.inText) ??
    found.find(samePath) ??
    found.find((c) => c.inText === point.inText) ??
    found[0]
  return best ? [best.node, best.offset] : [root, root.childNodes.length]
}

/** Aplica a seleção guardada ao conteúdo atual de `root` (mantém a direção) */
export function restoreSelection(root: Node, snapshot: SelectionSnapshot): Range | null {
  const selection = window.getSelection()
  if (!selection) return null
  const resolve = (point: SelectionPoint): [Node, number] => {
    if (point.block < 0) return resolvePoint(root, point)
    const block = (root as Element).children[point.block]
    return block ? resolvePoint(block, point) : [root, root.childNodes.length]
  }
  const [anchorNode, anchorOffset] = resolve(snapshot.anchor)
  const [focusNode, focusOffset] = resolve(snapshot.focus)
  selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset)
  return selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null
}

export const isNodeWithinEditor = (editor: HTMLElement, node: Node): boolean =>
  node === editor || editor.contains(node)

export const isRangeWithinEditor = (editor: HTMLElement, range: Range): boolean =>
  isNodeWithinEditor(editor, range.commonAncestorContainer)

// Aplica a fonte ou a cor de pré-visualização ao trecho selecionado
export function setPreviewWrapperStyle(
  wrapper: HTMLSpanElement,
  property: 'fontFamily' | 'color',
  value: string,
) {
  wrapper.style.fontFamily = ''
  wrapper.style.color = ''
  if (property === 'fontFamily') wrapper.style.fontFamily = value
  else wrapper.style.color = value
}

export type SelectionType = 'image' | 'textbox' | null
export type PendingTypingStyle = { fontSize?: string; color?: string; fontFamily?: string }
export type SelectionPreview = {
  wrapper: HTMLSpanElement
  originalNodes: Node[]
  property: 'fontFamily' | 'color'
}
