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
