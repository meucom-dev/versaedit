// ─── ALTURA, LIMITE E CORTE ───────────────────────────────────────

export function measureEditorContentHeight(editor: HTMLElement): number {
  const measure = editor.cloneNode(true) as HTMLElement
  measure.style.setProperty('position', 'fixed', 'important')
  measure.style.setProperty('left', '-100000px', 'important')
  measure.style.setProperty('top', '0', 'important')
  measure.style.setProperty('visibility', 'hidden', 'important')
  measure.style.setProperty('height', 'auto', 'important')
  measure.style.setProperty('min-height', '0', 'important')
  measure.style.setProperty('max-height', 'none', 'important')
  measure.style.setProperty('overflow', 'visible', 'important')
  measure.style.setProperty('width', `${editor.clientWidth}px`, 'important')
  document.body.appendChild(measure)
  const naturalHeight = Math.max(measure.scrollHeight, measure.getBoundingClientRect().height)
  document.body.removeChild(measure)
  return naturalHeight
}

export function editorContentExceedsHeight(editor: HTMLElement): boolean {
  return measureEditorContentHeight(editor) > editor.clientHeight + 1
}

// Remove apenas o conteúdo final que ultrapassa a altura física do editor.
// A busca binária corta um prefixo do último nó de texto e preserva formatação.
export function truncateEditableToFit(editor: HTMLElement): boolean {
  let changed = false
  let guard = 0

  while (editorContentExceedsHeight(editor) && guard < 2000) {
    guard += 1
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    const nodes: Node[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode)

    const lastText = [...nodes]
      .reverse()
      .find(
        (node): node is Text =>
          node.nodeType === Node.TEXT_NODE && (node.textContent?.length ?? 0) > 0,
      )
    if (lastText) {
      const characters = Array.from(lastText.data)
      let low = 0
      let high = characters.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        lastText.data = characters.slice(0, middle).join('')
        if (!editorContentExceedsHeight(editor)) low = middle
        else high = middle - 1
      }
      lastText.data = characters.slice(0, low).join('')
      changed = true
      if (low === 0 && editorContentExceedsHeight(editor)) lastText.remove()
      continue
    }

    const lastBreak = [...nodes]
      .reverse()
      .find((node): node is HTMLBRElement => node instanceof HTMLBRElement)
    if (lastBreak) {
      lastBreak.remove()
      changed = true
      continue
    }

    const lastChild = editor.lastElementChild
    if (!lastChild) break
    lastChild.remove()
    changed = true
  }

  if (changed) {
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  return changed
}
