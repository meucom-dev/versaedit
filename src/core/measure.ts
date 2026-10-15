// ─── ALTURA, LIMITE E CORTE ───────────────────────────────────────

// Altura natural do conteúdo (com o respiro interno). Mede o próprio editor,
// sem clonar o conteúdo (imagens grandes em base64 deixavam a medição lenta).
export function measureEditorContentHeight(editor: HTMLElement): number {
  // Conteúdo maior que a área: o próprio scrollHeight já é a altura natural
  if (editor.scrollHeight > editor.clientHeight + 1) return editor.scrollHeight
  const style = window.getComputedStyle(editor)
  const paddingTop = parseFloat(style.paddingTop) || 0
  const paddingBottom = parseFloat(style.paddingBottom) || 0
  if (!editor.firstChild) return paddingTop + paddingBottom
  // Conteúdo menor que a área: fundo do conteúdo em relação ao topo do editor
  const range = document.createRange()
  range.selectNodeContents(editor)
  const contentRect = range.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  if (!contentRect.height && !contentRect.width) return paddingTop + paddingBottom
  return contentRect.bottom - editorRect.top - editor.clientTop + editor.scrollTop + paddingBottom
}

// O conteúdo passa da altura do editor? (o editor esconde o que transborda)
export function editorContentExceedsHeight(editor: HTMLElement): boolean {
  return editor.scrollHeight > editor.clientHeight + 1
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
