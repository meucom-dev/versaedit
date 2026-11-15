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

// ─── UM GESTO POR VEZ ────────────────────────────────────────────
// Arrastar ou redimensionar um objeto (imagem, caixa) e redimensionar a moldura
// não acontecem ao mesmo tempo na mesma área de edição (dois dedos, mouse e toque):
// quem começa reserva a área (o elemento da área de edição) até terminar, e o outro
// gesto é ignorado nesse intervalo. Só memória: nada vai para o DOM.
export type GestureOwner = 'object' | 'frame'
const gestures = new WeakMap<Element, GestureOwner>()
export function claimGesture(area: Element, owner: GestureOwner): boolean {
  const current = gestures.get(area)
  if (current && current !== owner) return false
  gestures.set(area, owner)
  return true
}
export function releaseGesture(area: Element, owner: GestureOwner): void {
  if (gestures.get(area) === owner) gestures.delete(area)
}
export const gestureOwner = (area: Element): GestureOwner | undefined => gestures.get(area)

// ─── REPOSICIONAMENTO POR ARRASTO ───────────────────────────────
// Limpa os deslocamentos manuais: o espaçamento volta à margem do CSS (--ve-object-*)
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
// sempre contorna o elemento com a margem definida no CSS (--ve-object-*)
export function setFloatSide(el: HTMLElement, side: 'left' | 'right') {
  if (el.tagName === 'IMG') {
    el.classList.remove('pos-left', 'pos-right', 'pos-center')
    el.classList.add(side === 'left' ? 'pos-left' : 'pos-right')
  } else {
    setTextboxPosition(el, side)
  }
}

// Posição da caixa de texto, como a da imagem: à esquerda ou à direita ela flutua e o
// texto a contorna; ao centro fica sozinha na linha, centralizada (tb-center)
export function setTextboxPosition(el: HTMLElement, side: 'left' | 'right' | 'center') {
  el.classList.remove('tb-float-left', 'tb-float-right', 'tb-center')
  el.classList.add(
    side === 'left' ? 'tb-float-left' : side === 'right' ? 'tb-float-right' : 'tb-center',
  )
}

// Objeto centralizado (margens laterais automáticas)
export const isCentered = (el: HTMLElement) =>
  el.classList.contains('pos-center') || el.classList.contains('tb-center')

// Largura útil da área de edição (sem o padding)
export function innerWidth(editor: HTMLElement): number {
  const pad = window.getComputedStyle(editor)
  return editor.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight)
}

// Margens laterais que o objeto ocupa fora da própria caixa (o centralizado não tem:
// as margens automáticas encolhem até zero)
export function sideMargins(el: HTMLElement): number {
  if (isCentered(el)) return 0
  const cs = window.getComputedStyle(el)
  return (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0)
}

// Maior largura (borda incluída) com que o objeto cabe na área com as margens dele
export const maxObjectWidth = (el: HTMLElement, editor: HTMLElement) =>
  Math.max(60, innerWidth(editor) - sideMargins(el))

// O objeto nunca passa da área de edição: com a largura pedida (25–100%) mais as
// margens laterais além da área, o limite vira 100% menos as margens. Sem excesso,
// nada muda no HTML
export function fitInEditor(el: HTMLElement, editor: HTMLElement) {
  // Limite posto antes (outro alinhamento, outras margens): volta à largura pedida
  if (el.style.maxWidth.startsWith('calc(100% -')) el.style.maxWidth = el.style.width
  const margins = sideMargins(el)
  const outer = el.getBoundingClientRect().width + margins
  if (outer > innerWidth(editor) + 0.5) el.style.maxWidth = `calc(100% - ${Math.round(margins)}px)`
}

// Depois de soltar: a flutuação leva o elemento até a borda; uma margem lateral
// o devolve ao ponto onde foi solto, e o texto o contorna pelo lado livre (o
// CSS só contorna de um lado). A margem nunca fica menor que a do CSS (--ve-object-*)
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

// Linha vazia editável (onde o cursor pode ficar antes/depois de uma caixa)
export function emptyLine(): HTMLParagraphElement {
  const p = document.createElement('p')
  p.appendChild(document.createElement('br'))
  return p
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
  // O ponto de queda é procurado no texto como ele estava na tela durante o arrasto:
  // um espaço reservado do mesmo tamanho (e mesma flutuação e margens) fica no lugar
  // do objeto. Sem ele, o texto abaixo subia antes da procura e o objeto arrastado
  // para baixo caía mais adiante do que o ponto solto.
  const oldParent = el.parentElement
  const holder = placeholderFor(el)
  el.replaceWith(holder)
  try {
    const moved = dropAtPoint(editor, el, holder, x, y)
    if (moved) {
      // O parágrafo que só tinha o objeto (ex.: <p><img></p>) não fica para trás
      // vazio e sem altura; um <p><br></p> (linha em branco do usuário) fica
      if (
        oldParent &&
        oldParent !== editor &&
        oldParent.tagName === 'P' &&
        oldParent !== el.parentElement &&
        oldParent.isConnected &&
        [...oldParent.childNodes].every(
          (n) => n === holder || (n.nodeType === Node.TEXT_NODE && !n.textContent!.trim()),
        )
      ) {
        holder.remove()
        oldParent.remove()
      }
    }
    return moved
  } finally {
    if (el.isConnected) holder.remove()
    else holder.replaceWith(el)
  }
}

// Espaço vazio com a geometria do objeto, invisível ao clique e ao cursor
function placeholderFor(el: HTMLElement): HTMLElement {
  const cs = window.getComputedStyle(el)
  const holder = document.createElement(cs.display === 'block' ? 'div' : 'span')
  const s = holder.style
  s.display = cs.display === 'inline' ? 'inline-block' : cs.display
  s.float = cs.float
  s.clear = cs.clear
  s.boxSizing = 'border-box'
  s.width = `${el.offsetWidth}px`
  s.height = `${el.offsetHeight}px`
  s.margin = cs.margin
  s.verticalAlign = cs.verticalAlign
  s.pointerEvents = 'none'
  s.userSelect = 'none'
  holder.setAttribute('contenteditable', 'false')
  holder.setAttribute('aria-hidden', 'true')
  return holder
}

function dropAtPoint(
  editor: HTMLElement,
  el: HTMLElement,
  holder: HTMLElement,
  x: number,
  y: number,
): boolean {
  const range = getCaretRangeFromPoint(x, y)
  const pointTarget = document.elementFromPoint(x, y)
  let fallbackBefore: Node | null = null
  let useFallback = false

  const editorRect = editor.getBoundingClientRect()
  const pointIsInsideEditor =
    x >= editorRect.left && x <= editorRect.right && y >= editorRect.top && y <= editorRect.bottom

  if (
    pointIsInsideEditor &&
    (!range || !editor.contains(range.startContainer) || holder.contains(range.startContainer))
  ) {
    useFallback = true
    let targetBlock: Element | null =
      pointTarget && editor.contains(pointTarget) ? pointTarget : null

    while (targetBlock?.parentElement && targetBlock.parentElement !== editor) {
      targetBlock = targetBlock.parentElement
    }

    if (!targetBlock || targetBlock === editor || targetBlock === holder) {
      const blocks = Array.from(editor.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child !== holder,
      )
      targetBlock =
        blocks.find((block) => y <= block.getBoundingClientRect().bottom) ??
        (blocks.length ? blocks[blocks.length - 1] : null)
    }

    if (targetBlock && targetBlock !== editor && targetBlock !== holder) {
      const rect = targetBlock.getBoundingClientRect()
      fallbackBefore = y < rect.top + rect.height / 2 ? targetBlock : targetBlock.nextSibling
    }
  }

  if (useFallback) {
    editor.insertBefore(el, fallbackBefore)
  } else {
    if (!range || !editor.contains(range.startContainer)) return false
    const container = range.startContainer
    if (container === holder || holder.contains(container)) return false
    // Caixa de texto (bloco): entra entre os blocos — antes ou depois do bloco sob o
    // ponto —, nunca dentro de um parágrafo. Uma <div> dentro de <p> é HTML
    // inválido: ao reabrir o arquivo o navegador partia o parágrafo em dois.
    if (el.classList.contains('rich-textbox')) {
      let block: Node = container
      while (block.parentNode && block.parentNode !== editor) block = block.parentNode
      if (block.parentNode === editor && block !== holder) {
        const rect =
          block instanceof Element
            ? block.getBoundingClientRect()
            : (block.parentElement ?? editor).getBoundingClientRect()
        editor.insertBefore(el, y < rect.top + rect.height / 2 ? block : block.nextSibling)
        clearManualOffsets(el)
        const editorBox = editor.getBoundingClientRect()
        setFloatSide(el, x < editorBox.left + editorBox.width / 2 ? 'left' : 'right')
        return true
      }
    }

    if (container.nodeType === Node.TEXT_NODE && container.parentNode) {
      const textNode = container as Text
      const after = textNode.splitText(range.startOffset)
      container.parentNode.insertBefore(el, after)
    } else if (container.nodeType === Node.ELEMENT_NODE) {
      const parent = container as HTMLElement
      // Solto sobre o próprio lugar: fica onde estava (no lugar do espaço reservado)
      const refNode = parent.childNodes[range.startOffset] ?? null
      parent.insertBefore(el, refNode)
    } else {
      return false
    }
  }

  clearManualOffsets(el)
  setFloatSide(el, x < editorRect.left + editorRect.width / 2 ? 'left' : 'right')
  return true
}

// ─── COLUNA DE TEXTO LEGÍVEL ENTRE OBJETOS ───────────────────────
// Dois objetos flutuantes na mesma faixa (imagem ou caixa, de lados opostos ou do
// mesmo lado) deixam para o texto só o que sobra da largura. Abaixo de uma coluna
// mínima o texto ficava espremido, com palavras partidas sílaba a sílaba; nesse
// caso o objeto seguinte desce para baixo do anterior.
// A coluna depende da largura do contêiner (o editor agora, o site depois, o
// celular), então o HTML não grava a decisão (um clear fixo), e sim a largura
// abaixo da qual o objeto desce: data-ve-stack="<px>" (múltiplos de STACK_STEP).
// O CSS do editor e o publicado aplicam o clear por consulta de contêiner, na
// largura real de cada lugar; "always" quando nenhuma largura dá coluna legível.
// A coluna mínima acompanha o tamanho da fonte do texto ao lado (em), não um
// valor fixo em px. Refeito a cada mudança de posição ou tamanho; o clear que o
// usuário tenha no style nunca é tocado.
export const MIN_TEXT_COLUMN_EM = 7.5
export const STACK_STEP = 40
export const STACK_MIN = 200
export const STACK_MAX = 2400
const STACK_ATTR = 'data-ve-stack'
const STACK_CONTAINER = 'versaedit'
const FLOATING =
  'img.pos-left, img.pos-right, .rich-textbox.tb-float-left, .rich-textbox.tb-float-right'

// Comprimento de CSS como função da largura W do contêiner (px, %, calc(100% - Npx))
function lengthAt(value: string, fallback: (w: number) => number): (w: number) => number {
  const v = value.trim()
  let m = /^(-?[\d.]+)px$/.exec(v)
  if (m) {
    const px = parseFloat(m[1])
    return () => px
  }
  m = /^(-?[\d.]+)%$/.exec(v)
  if (m) {
    const pct = parseFloat(m[1]) / 100
    return (w) => w * pct
  }
  m = /^calc\(\s*100%\s*-\s*([\d.]+)px\s*\)$/.exec(v)
  if (m) {
    const px = parseFloat(m[1])
    return (w) => w - px
  }
  return fallback
}

// Largura externa (margens incluídas) do objeto num contêiner de largura W: a
// largura pedida (% acompanha W, px fica), limitada por min/max-width
function outerWidthAt(el: HTMLElement): (w: number) => number {
  const cs = window.getComputedStyle(el)
  const measured = el.getBoundingClientRect().width
  const borderBox = el.tagName === 'IMG' || cs.boxSizing === 'border-box'
  const extra = borderBox
    ? 0
    : (parseFloat(cs.paddingLeft) || 0) +
      (parseFloat(cs.paddingRight) || 0) +
      (parseFloat(cs.borderLeftWidth) || 0) +
      (parseFloat(cs.borderRightWidth) || 0)
  const asked = lengthAt(el.style.width, () => measured - extra)
  const max = lengthAt(cs.maxWidth, () => Infinity)
  const min = lengthAt(cs.minWidth, () => 0)
  const margins = (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0)
  return (w) => Math.max(min(w), Math.min(asked(w), max(w))) + extra + margins
}

// Menor largura de contêiner (em STACK_STEP) a partir da qual a coluna entre os dois
// objetos é legível; null quando qualquer largura serve, "always" quando nenhuma.
// gutter: o quanto a largura consultada passa da largura em que os objetos se apoiam
// (a barra de rolagem da área de edição, que o Chromium não desconta da consulta)
function stackBelow(
  a: HTMLElement,
  b: HTMLElement,
  minColumn: number,
  gutter: number,
): string | null {
  const wa = outerWidthAt(a)
  const wb = outerWidthAt(b)
  const narrow = (w: number) => w - wa(w) - wb(w) < minColumn
  if (narrow(STACK_MAX)) return 'always'
  let threshold = 0
  for (let w = STACK_MAX; w > 0; w -= 4) {
    if (narrow(w)) {
      threshold = w + 4 + gutter
      break
    }
  }
  if (threshold <= STACK_MIN - STACK_STEP) return null
  return String(Math.max(STACK_MIN, Math.ceil(threshold / STACK_STEP) * STACK_STEP))
}

const fontPx = (el: Element) => parseFloat(window.getComputedStyle(el).fontSize) || 16

// Maior fonte do texto que corre na faixa [top, bottom] (fora das caixas de texto);
// sem texto na faixa, a fonte da área de edição
function adjacentFontPx(editor: HTMLElement, top: number, bottom: number): number {
  let max = 0
  for (const block of editor.children) {
    const r = block.getBoundingClientRect()
    if (r.bottom <= top || r.top >= bottom || block.classList.contains('rich-textbox')) continue
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const parent = node.parentElement
      if (!parent || !node.data.trim() || parent.closest('.rich-textbox')) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const t = range.getBoundingClientRect()
      if (t.bottom > top && t.top < bottom) max = Math.max(max, fontPx(parent))
    }
  }
  return max || fontPx(editor)
}

// Só os objetos cujo bloco tem a largura da área (o contêiner das consultas): no
// editor e no publicado a largura consultada é a mesma em que o objeto se apoia.
// Objeto dentro de caixa de texto, tabela, lista ou parágrafo recuado fica de fora.
function followsEditorWidth(el: HTMLElement, editor: HTMLElement, inner: number): boolean {
  const parent = el.parentElement
  if (parent === editor) return true
  if (!parent || parent.parentElement !== editor || parent.classList.contains('rich-textbox'))
    return false
  const cs = window.getComputedStyle(parent)
  const content =
    parent.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
  return Math.abs(content - inner) < 1
}

// Largura da barra de rolagem vertical que a área de edição pode ter. O Chromium
// não a desconta da largura consultada pelo contêiner; somada ao limite gravado,
// a coluna nunca fica abaixo do mínimo, com a barra visível ou não. Assim o valor
// gravado não depende da altura da área nem da quantidade de conteúdo (a barra
// aparece e some ao redimensionar a área). Medida a cada vez, num elemento de teste
// com as mesmas classes da área (barras estilizadas pela página, zoom): 0 com
// barras sobrepostas (macOS, celulares) ou numa área que não rola.
function scrollbarGutter(editor: HTMLElement): number {
  const overflow = window.getComputedStyle(editor).overflowY
  const host = editor.parentElement
  if ((overflow !== 'auto' && overflow !== 'scroll') || !host) return 0
  const probe = document.createElement('div')
  probe.className = editor.className
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;width:100px;height:50px;padding:0;border:0;overflow-y:scroll;contain:strict'
  host.appendChild(probe)
  const width = probe.offsetWidth - probe.clientWidth
  probe.remove()
  return Math.max(0, width)
}

// Idempotente: o atributo só muda quando o valor muda (pode rodar a cada edição,
// inclusive depois de mudar a fonte do texto ao lado sem mexer no objeto)
export function keepReadableColumns(editor: HTMLElement) {
  const inner = innerWidth(editor)
  // Medida só quando há um par de objetos a avaliar
  let gutter: number | undefined
  const getGutter = () => (gutter ??= scrollbarGutter(editor))
  const all = [...editor.querySelectorAll<HTMLElement>(FLOATING)]
  const floats = all.filter((el) => followsEditorWidth(el, editor, inner))
  const set = (el: HTMLElement, value: string | null) => {
    if (el.getAttribute(STACK_ATTR) === value) return
    if (value === null) el.removeAttribute(STACK_ATTR)
    else el.setAttribute(STACK_ATTR, value)
  }
  editor.querySelectorAll<HTMLElement>(`[${STACK_ATTR}]`).forEach((el) => {
    if (!floats.includes(el)) set(el, null)
  })
  const band = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const cs = window.getComputedStyle(el)
    return {
      top: r.top - (parseFloat(cs.marginTop) || 0),
      bottom: r.bottom + (parseFloat(cs.marginBottom) || 0),
    }
  }
  floats.forEach((el, i) => {
    const b = band(el)
    let value: string | null = null
    for (const prev of floats.slice(0, i)) {
      const a = band(prev)
      // Na mesma faixa, ou logo abaixo do anterior (empurrado por não caber ao lado
      // dele nesta largura, ou descido por este atributo)
      const sameBand = a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
      const pushed = Math.abs(b.top - a.bottom) < 1
      if (!sameBand && !pushed) continue
      const font = adjacentFontPx(editor, Math.min(a.top, b.top), Math.max(a.bottom, b.bottom))
      value = stackBelow(prev, el, MIN_TEXT_COLUMN_EM * font, getGutter())
      if (value) break
    }
    set(el, value)
  })
}

// Regras do clear por largura do contêiner, para o CSS do editor e o publicado
export function stackRules(scope: string): string {
  // Só nos flutuantes, e com a especificidade do clear: none deles (vêm depois)
  const target = (v: string) =>
    `${scope} [${STACK_ATTR}="${v}"]:is(.pos-left, .pos-right, .tb-float-left, .tb-float-right)`
  const lines = [
    // Contêiner com nome: a consulta nunca cai num contêiner da página (navegador
    // sem :has, ou ancestral com container-type), só na área de edição/conteúdo
    `${scope}:has([${STACK_ATTR}]) { container: ${STACK_CONTAINER} / inline-size; }`,
    `${target('always')} { clear: both; }`,
  ]
  for (let w = STACK_MIN; w <= STACK_MAX; w += STACK_STEP) {
    lines.push(
      `@container ${STACK_CONTAINER} (width < ${w}px) { ${target(String(w))} { clear: both; } }`,
    )
  }
  return lines.join('\n')
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

// Canto da alça: o inferior direito; no objeto flutuando à direita, o inferior
// esquerdo — o lado direito dele fica preso à borda, e é o esquerdo que se move
export type HandleCorner = 'right' | 'left'
export const handleCorner = (el: HTMLElement): HandleCorner =>
  window.getComputedStyle(el).float === 'right' ? 'left' : 'right'

// Quanto a largura muda por pixel de movimento da alça, para ela seguir o ponteiro:
// 1 com a alça à direita; -1 com a alça à esquerda (flutuando à direita); 2 no
// centralizado (cresce para os dois lados)
export const resizeFactor = (el: HTMLElement): number =>
  handleCorner(el) === 'left' ? -1 : isCentered(el) ? 2 : 1

// Posição da alça de redimensionamento, no canto que se move
export function resizeHandlePosition(
  el: HTMLElement,
  editor: HTMLElement,
): { top: number; left: number; corner: HandleCorner } {
  const rect = el.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  const corner = handleCorner(el)
  return {
    top: rect.bottom - editorRect.top - 7,
    left: (corner === 'left' ? rect.left : rect.right) - editorRect.left - 7,
    corner,
  }
}
