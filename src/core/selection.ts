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
