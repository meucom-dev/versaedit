// ─── IMAGENS E CAIXAS DE TEXTO: posição, arrasto, redimensionamento ─
import { getCaretRangeFromPoint } from './selection'

export type TbBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'

// Ouvintes de movimento e soltura do documento durante um arrasto ou
// redimensionamento. Pointer Events: funcionam com mouse, toque e caneta;
// só o ponteiro que começou o gesto é acompanhado.
export type PointerListener = (e: PointerEvent) => void
export function createPointerTracker() {
  let active: { move: PointerListener; up: PointerListener } | null = null
  const stop = () => {
    if (!active) return
    document.removeEventListener('pointermove', active.move)
    document.removeEventListener('pointerup', active.up)
    document.removeEventListener('pointercancel', active.up)
    active = null
  }
  return {
    start(pointerId: number, move: PointerListener, up: PointerListener) {
      stop()
      const onMove: PointerListener = (e) => {
        if (e.pointerId === pointerId) move(e)
      }
      const onUp: PointerListener = (e) => {
        if (e.pointerId === pointerId) up(e)
      }
      active = { move: onMove, up: onUp }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
    },
    stop,
  }
}

// ─── REPOSICIONAMENTO POR ARRASTO ───────────────────────────────
// Limpa os deslocamentos manuais: o espaçamento volta aos 40px do CSS
export function clearManualOffsets(el: HTMLElement) {
  el.style.transform = ''
  el.style.marginTop = ''
  el.style.marginLeft = ''
  el.style.marginRight = ''
}

// Deslocamento manual atual (translate aplicado pelo arrasto ou pelas setas)
export function getManualOffset(el: HTMLElement): { x: number; y: number } {
  // O Firefox grava translate(1px, 0px) como translate(1px): o y é opcional
  const m = /translate\(\s*([-\d.]+)px(?:\s*,\s*([-\d.]+)px)?\s*\)/.exec(el.style.transform || '')
  return { x: m ? parseFloat(m[1]) : 0, y: m?.[2] ? parseFloat(m[2]) : 0 }
}

// Deslocamento fino livre (setas + Ctrl): move o elemento alguns pixels,
// por cima do texto, sem alterar o fluxo do conteúdo
export function nudgeElement(el: HTMLElement, dx: number, dy: number) {
  const { x, y } = getManualOffset(el)
  el.style.transform = `translate(${x + dx}px, ${y + dy}px)`
}

// Faz o elemento flutuar para o lado em que foi solto — assim o texto
// sempre contorna o elemento com a margem de 40px definida no CSS
export function setFloatSide(el: HTMLElement, side: 'left' | 'right') {
  if (el.tagName === 'IMG') {
    el.classList.remove('pos-left', 'pos-right', 'pos-center')
    el.classList.add(side === 'left' ? 'pos-left' : 'pos-right')
  } else {
    el.classList.remove('tb-float-left', 'tb-float-right')
    el.classList.add(side === 'left' ? 'tb-float-left' : 'tb-float-right')
  }
}

// Depois de soltar: a flutuação leva o elemento até a borda; uma margem lateral
// o devolve ao ponto onde foi solto, e o texto o contorna pelo lado livre (o
// CSS só contorna de um lado). A margem nunca fica menor que a do CSS (40px)
// nem empurra o elemento para fora da área.
export function keepDropPosition(el: HTMLElement, editor: HTMLElement, dropped: DOMRect) {
  const style = window.getComputedStyle(el)
  const floatLeft = style.float === 'left'
  if (!floatLeft && style.float !== 'right') return
  const rect = el.getBoundingClientRect()
  const pad = window.getComputedStyle(editor)
  const inner = editor.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight)
  const base = parseFloat(floatLeft ? style.marginLeft : style.marginRight) || 0
  const room = inner - rect.width - base * 2
  const shift = floatLeft ? dropped.left - rect.left : rect.right - dropped.right
  const extra = Math.min(Math.max(0, shift), Math.max(0, room))
  // Poucos pixels da borda: fica na borda, sem estilo a mais no HTML
  if (extra < 8) return
  el.style[floatLeft ? 'marginLeft' : 'marginRight'] = `${Math.round(base + extra)}px`
}

// Move o elemento um bloco acima/abaixo no fluxo do conteúdo
export function moveElementInFlow(el: HTMLElement, dir: -1 | 1) {
  const parent = el.parentNode
  if (!parent) return
  if (dir === -1) {
    const ref = el.previousElementSibling ?? (parent as HTMLElement).previousElementSibling
    if (ref && ref.parentNode) ref.parentNode.insertBefore(el, ref)
  } else {
    const ref = el.nextElementSibling ?? (parent as HTMLElement).nextElementSibling
    if (ref && ref.parentNode) ref.parentNode.insertBefore(el, ref.nextSibling)
  }
  clearManualOffsets(el)
}

// Reposiciona o elemento no ponto de queda; se não houver um ponto de texto
// (por exemplo, em um espaço vazio), encaixa no bloco mais próximo.
export function dropElementAtPoint(
  editor: HTMLElement,
  el: HTMLElement,
  x: number,
  y: number,
): boolean {
  // Retira temporariamente o elemento do fluxo para que o hit-test encontre
  // o texto que estava sob a imagem, sem deixar o espaço antigo reservado.
  const previousDisplay = el.style.display
  el.style.visibility = 'hidden'
  el.style.display = 'none'
  let range: Range | null = null
  let pointTarget: Element | null = null
  let fallbackBefore: Node | null = null
  let useFallback = false
  try {
    range = getCaretRangeFromPoint(x, y)
    pointTarget = document.elementFromPoint(x, y)

    const editorRect = editor.getBoundingClientRect()
    const pointIsInsideEditor =
      x >= editorRect.left && x <= editorRect.right && y >= editorRect.top && y <= editorRect.bottom

    if (
      pointIsInsideEditor &&
      (!range || !editor.contains(range.startContainer) || el.contains(range.startContainer))
    ) {
      useFallback = true
      let targetBlock: Element | null =
        pointTarget && editor.contains(pointTarget) ? pointTarget : null

      while (targetBlock?.parentElement && targetBlock.parentElement !== editor) {
        targetBlock = targetBlock.parentElement
      }

      if (!targetBlock || targetBlock === editor || targetBlock === el) {
        const blocks = Array.from(editor.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement && child !== el,
        )
        targetBlock =
          blocks.find((block) => y <= block.getBoundingClientRect().bottom) ??
          (blocks.length ? blocks[blocks.length - 1] : null)
      }

      if (targetBlock && targetBlock !== editor && targetBlock !== el) {
        const rect = targetBlock.getBoundingClientRect()
        fallbackBefore = y < rect.top + rect.height / 2 ? targetBlock : targetBlock.nextSibling
      }
    }
  } finally {
    el.style.display = previousDisplay
    el.style.visibility = ''
  }

  if (useFallback) {
    editor.insertBefore(el, fallbackBefore)
  } else {
    if (!range || !editor.contains(range.startContainer)) return false
    const container = range.startContainer
    if (container === el || el.contains(container)) return false

    if (container.nodeType === Node.TEXT_NODE && container.parentNode) {
      const textNode = container as Text
      const after = textNode.splitText(range.startOffset)
      if (after.previousSibling !== el) container.parentNode.insertBefore(el, after)
    } else if (container.nodeType === Node.ELEMENT_NODE) {
      const parent = container as HTMLElement
      const refNode = parent.childNodes[range.startOffset] ?? null
      if (refNode !== el) parent.insertBefore(el, refNode)
    } else {
      return false
    }
  }

  clearManualOffsets(el)
  const editorRect = editor.getBoundingClientRect()
  setFloatSide(el, x < editorRect.left + editorRect.width / 2 ? 'left' : 'right')
  return true
}

// ─── IMAGE POSITION ──────────────────────────────────────────────
export function setImagePosition(
  img: HTMLImageElement,
  posClass: 'pos-left' | 'pos-right' | 'pos-center',
) {
  img.classList.remove('pos-left', 'pos-right', 'pos-center')
  img.classList.add(posClass)
}

// Posição do menu flutuante: 40px acima do elemento, relativa ao editor
export function toolbarPosition(
  el: HTMLElement,
  editor: HTMLElement,
): { top: number; left: number } {
  const rect = el.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  return { top: rect.top - editorRect.top - 40, left: rect.left - editorRect.left }
}

// Posição da alça de redimensionamento: canto inferior direito do elemento
export function resizeHandlePosition(
  el: HTMLElement,
  editor: HTMLElement,
): { top: number; left: number } {
  const rect = el.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  return { top: rect.bottom - editorRect.top - 7, left: rect.right - editorRect.left - 7 }
}
