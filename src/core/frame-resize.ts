// ─── REDIMENSIONAMENTO DA ÁREA DE EDIÇÃO ─────────────────────────
// Alças na borda da moldura (.ve-frame), fora da área editável: arrastar com o
// mouse, o dedo ou a caneta, ou usar as setas com a alça focada, muda a largura e
// a altura da moldura e da área de edição. Só o estilo dos dois elementos muda:
// o conteúdo, o HTML, o histórico e a seleção ficam como estavam (a alça não toma
// o foco ao ser arrastada). Sem React: a camada React só cria, configura e destrói.
//
// Tamanho visível × configurado: este módulo cuida só do tamanho visível. O limite
// de conteúdo (truncateOnOverflow, onOverflowChange) continua no tamanho que a
// aplicação configurou; ver VersaEditCore.setContentLimit.
import { claimGesture, createPointerTracker, gestureOwner, releaseGesture } from './objects'
import type { PointerListener } from './objects'

/**
 * Alças: lados (e direita, w esquerda, s embaixo, n em cima) e cantos. Padrão:
 * e, s e se. As da esquerda e de cima mudam a largura e a altura como as outras
 * (puxar para fora aumenta); com a moldura alinhada à esquerda no layout, quem se
 * move na tela é o lado oposto.
 */
export type FrameHandle = 'e' | 's' | 'se' | 'w' | 'n' | 'nw' | 'ne' | 'sw'
export const DEFAULT_FRAME_HANDLES: readonly FrameHandle[] = ['e', 's', 'se']
export interface FrameSize {
  /** Largura total em px, moldura incluída */
  width: number
  /** Altura total em px, moldura incluída */
  height: number
}
export type FrameResizePhase = 'start' | 'move' | 'end'

/** Limites do tamanho visível, em px, moldura incluída */
export interface FrameLimits {
  /** Padrão 160 */
  minWidth?: number
  /** Padrão: o espaço disponível ao lado (nunca passa dele) */
  maxWidth?: number
  /** Padrão 80 */
  minHeight?: number
  /** Padrão: sem limite */
  maxHeight?: number
}

export interface FrameResizerOptions {
  /** Moldura (.ve-frame): recebe as alças e a largura total */
  frame: HTMLElement
  /** Área de edição (.ve-content): largura e altura sem a moldura */
  content: HTMLElement
  /** Alças criadas (padrão: direita, embaixo e o canto entre elas; ver FrameHandle) */
  handles?: FrameHandle[]
  /** Nome acessível de cada alça */
  labels?: Partial<Record<FrameHandle, string>>
  /** Passo das setas em px (padrão 10; com Shift, 1) */
  keyboardStep?: number
  limits?: FrameLimits
  /**
   * Mudanças feitas pela pessoa nas alças: arraste ('start', um 'move' por quadro
   * em que o tamanho mudou, 'end' ao soltar), setas (só 'end') e o ajuste ao espaço
   * quando o contêiner encolhe (só 'end'). setSize não chama.
   */
  onResize?: (size: FrameSize, phase: FrameResizePhase) => void
  /**
   * Qualquer mudança do tamanho visível, inclusive por setSize ou pela página
   * (largura em %, contêiner que mudou). `applied`: o tamanho é o aplicado por este
   * módulo (alças ou setSize); false quando vem das props/CSS da aplicação.
   */
  onSizeChange?: (size: FrameSize, applied: boolean) => void
  /** Limites em vigor mudaram (o máximo de largura acompanha o espaço disponível) */
  onLimitsChange?: (limits: Required<FrameLimits>) => void
}

export interface FrameResizer {
  getSize(): FrameSize
  /** Limites em vigor agora (o máximo de largura acompanha o espaço disponível) */
  getLimits(): Required<FrameLimits>
  /** Muda o tamanho visível dentro dos limites; devolve o aplicado. Não chama onResize */
  setSize(size: Partial<FrameSize>): FrameSize
  setLimits(limits: FrameLimits): void
  destroy(): void
}

// Menor área útil: a barra de rolagem e algumas palavras por linha
const MIN_WIDTH = 160
const MIN_HEIGHT = 80
// Sentido de cada alça: +1 o lado direito/de baixo, -1 o esquerdo/de cima
const AXES: Record<FrameHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  s: { x: 0, y: 1 },
  n: { x: 0, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
  ne: { x: 1, y: -1 },
  nw: { x: -1, y: -1 },
}

const sameSize = (a: FrameSize | null, b: FrameSize) =>
  !!a && a.width === b.width && a.height === b.height

export function createFrameResizer(options: FrameResizerOptions): FrameResizer {
  const { frame, content, keyboardStep = 10 } = options
  const pointer = createPointerTracker()
  const handles: HTMLElement[] = []
  let limits: FrameLimits = { ...options.limits }
  let raf = 0
  let pending: FrameSize | null = null
  // Largura gravada por este módulo: enquanto a moldura a tiver, o tamanho é o
  // escolhido aqui; se a aplicação trocar a largura, deixa de ser
  let appliedWidth = ''
  let notified: FrameSize | null = null

  const border = () => {
    const cs = window.getComputedStyle(frame)
    return {
      x: (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0),
      y: (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0),
    }
  }
  const getSize = (): FrameSize => ({ width: frame.offsetWidth, height: frame.offsetHeight })
  const isApplied = () => appliedWidth !== '' && frame.style.width === appliedWidth

  // Espaço que a moldura tem no layout (sem rolagem lateral na página)
  const room = () => {
    const parent = frame.parentElement
    if (!parent) return Infinity
    const cs = window.getComputedStyle(parent)
    return (
      parent.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
    )
  }

  const getLimits = (): Required<FrameLimits> => {
    const maxWidth = Math.max(0, Math.min(limits.maxWidth ?? Infinity, room()))
    const maxHeight = limits.maxHeight ?? Infinity
    return {
      minWidth: Math.min(limits.minWidth ?? MIN_WIDTH, maxWidth),
      maxWidth,
      minHeight: Math.min(limits.minHeight ?? MIN_HEIGHT, maxHeight),
      maxHeight,
    }
  }

  const clamp = (size: FrameSize): FrameSize => {
    const l = getLimits()
    return {
      width: Math.round(Math.min(l.maxWidth, Math.max(l.minWidth, size.width))),
      height: Math.round(Math.min(l.maxHeight, Math.max(l.minHeight, size.height))),
    }
  }

  const notify = () => {
    const size = getSize()
    if (sameSize(notified, size)) return
    notified = size
    options.onSizeChange?.(size, isApplied())
  }

  // Só estilo: moldura com a largura total, área com a medida sem a moldura
  const apply = (size: FrameSize) => {
    const b = border()
    frame.style.width = `${size.width}px`
    content.style.width = `${size.width - b.x}px`
    content.style.height = `${size.height - b.y}px`
    appliedWidth = frame.style.width
    placeHandles()
    updateValues()
    notify()
  }

  // Um quadro por vez durante o arraste; 'move' só quando o tamanho mudou
  const schedule = (size: FrameSize) => {
    pending = size
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      if (!pending) return
      const next = pending
      pending = null
      const before = getSize()
      apply(next)
      const now = getSize()
      if (!sameSize(before, now)) options.onResize?.(now, 'move')
    })
  }
  // Ao soltar: o último tamanho pendente é aplicado e avisado como 'move' (todo
  // arraste que mudou o tamanho tem ao menos um 'move' antes do 'end', mesmo se
  // coube inteiro num quadro)
  const flush = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    if (pending) {
      const before = getSize()
      apply(pending)
      const now = getSize()
      if (!sameSize(before, now)) options.onResize?.(now, 'move')
    }
    pending = null
  }

  const startDrag = (handle: FrameHandle, e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return
    // Sem foco nem cursor movidos, e sem a página rolar ou selecionar texto
    e.preventDefault()
    e.stopPropagation()
    // Imagem ou caixa sendo arrastada ou redimensionada: a moldura espera
    if (!claimGesture(content, 'frame')) return
    const el = e.currentTarget as HTMLElement
    const axes = AXES[handle]
    const start = { x: e.clientX, y: e.clientY, ...getSize() }
    el.classList.add('ve-frame-handle-active')
    options.onResize?.(getSize(), 'start')
    const move: PointerListener = (ev) => {
      ev.preventDefault()
      schedule(
        clamp({
          width: start.width + axes.x * (ev.clientX - start.x),
          height: start.height + axes.y * (ev.clientY - start.y),
        }),
      )
    }
    const end: PointerListener = () => {
      pointer.stop()
      releaseGesture(content, 'frame')
      flush()
      el.classList.remove('ve-frame-handle-active')
      options.onResize?.(getSize(), 'end')
    }
    pointer.start(e.pointerId, move, end)
  }

  const keyResize = (handle: FrameHandle, e: KeyboardEvent) => {
    const axes = AXES[handle]
    const step = e.shiftKey ? 1 : keyboardStep
    // A seta move a borda da alça: para fora aumenta, para dentro diminui
    const mx = axes.x ? { ArrowRight: step, ArrowLeft: -step }[e.key] : undefined
    const my = axes.y ? { ArrowDown: step, ArrowUp: -step }[e.key] : undefined
    if (mx === undefined && my === undefined) return
    const dx = mx === undefined ? undefined : mx * axes.x
    const dy = my === undefined ? undefined : my * axes.y
    e.preventDefault()
    e.stopPropagation()
    if (gestureOwner(content) === 'object') return
    const before = getSize()
    apply(clamp({ width: before.width + (dx ?? 0), height: before.height + (dy ?? 0) }))
    if (!sameSize(before, getSize())) options.onResize?.(getSize(), 'end')
  }

  // Valor anunciado pelos leitores de tela (alças de um eixo só)
  function updateValues() {
    const size = getSize()
    const l = getLimits()
    for (const h of handles) {
      const kind = h.dataset.handle as FrameHandle
      const axes = AXES[kind]
      const [now, min, max] =
        axes.x && !axes.y
          ? [size.width, l.minWidth, l.maxWidth]
          : axes.y && !axes.x
            ? [size.height, l.minHeight, l.maxHeight]
            : [null, null, null]
      if (now === null) continue
      h.setAttribute('aria-valuenow', String(now))
      h.setAttribute('aria-valuemin', String(min))
      if (Number.isFinite(max)) h.setAttribute('aria-valuemax', String(max))
      else h.removeAttribute('aria-valuemax')
    }
  }

  // Alças fora da área de edição (não cobrem texto nem a barra de rolagem): as de
  // baixo numa faixa logo abaixo da moldura (espaço reservado pela margem); a da
  // direita do lado de fora, só quando cabe ao lado da moldura sem rolagem lateral
  // na página. Sem espaço (moldura na largura toda), ela some e o canto continua
  // mudando a largura.
  // O mesmo vale para a da esquerda, do lado de fora à esquerda.
  function placeHandles() {
    const parent = frame.parentElement
    if (!parent) return
    const cs = window.getComputedStyle(parent)
    const box = parent.getBoundingClientRect()
    const own = frame.getBoundingClientRect()
    const free = {
      e:
        box.right -
        (parseFloat(cs.borderRightWidth) || 0) -
        (parseFloat(cs.paddingRight) || 0) -
        own.right,
      w:
        own.left -
        box.left -
        (parseFloat(cs.borderLeftWidth) || 0) -
        (parseFloat(cs.paddingLeft) || 0),
    }
    for (const side of ['e', 'w'] as const) {
      const h = handles.find((x) => x.dataset.handle === side)
      if (!h) continue
      h.hidden = false
      h.hidden = free[side] < h.offsetWidth - 0.5
    }
    reportLimits()
  }

  let reported = ''
  function reportLimits() {
    const l = getLimits()
    const key = JSON.stringify(l)
    if (key === reported) return
    reported = key
    options.onLimitsChange?.(l)
  }

  // Contêiner mudou de tamanho: o tamanho escolhido aqui nunca passa do espaço
  // disponível (a moldura encolhe e avisa com 'end'); o resto só acompanha
  const relayout = () => {
    placeHandles()
    if (isApplied() && !gestureOwner(content)) {
      // A largura gravada, não a medida: o max-width: 100% da moldura já a encolhe
      // na tela, mas a área de edição continuaria com a largura antiga
      const current = { width: parseFloat(appliedWidth), height: frame.offsetHeight }
      const fitted = clamp(current)
      if (fitted.width < current.width) {
        apply(fitted)
        options.onResize?.(getSize(), 'end')
        return
      }
    }
    updateValues()
    notify()
  }

  const listeners: Array<[HTMLElement, string, EventListener]> = []
  const kinds = [...new Set(options.handles ?? DEFAULT_FRAME_HANDLES)].filter((k) => k in AXES)
  // Classes na moldura: faixa de cima reservada e lados que abrem espaço aos cantos
  const frameClasses = [
    've-frame-resizable',
    ...(kinds.some((k) => AXES[k].y < 0) ? ['ve-frame-resizable-top'] : []),
    ...kinds.map((k) => `ve-frame-has-${k}`),
  ]
  for (const kind of kinds) {
    const h = document.createElement('div')
    h.className = `ve-frame-handle ve-frame-handle-${kind}`
    h.dataset.handle = kind
    h.tabIndex = 0
    h.setAttribute('role', 'separator')
    const axes = AXES[kind]
    if (!axes.x || !axes.y) h.setAttribute('aria-orientation', axes.x ? 'vertical' : 'horizontal')
    const label = options.labels?.[kind]
    if (label) {
      h.setAttribute('aria-label', label)
      h.title = label
    }
    const down = (e: Event) => startDrag(kind, e as PointerEvent)
    // O mousedown de compatibilidade também não pode mover o foco
    const mouse = (e: Event) => e.preventDefault()
    const key = (e: Event) => keyResize(kind, e as KeyboardEvent)
    listeners.push([h, 'pointerdown', down], [h, 'mousedown', mouse], [h, 'keydown', key])
    h.addEventListener('pointerdown', down)
    h.addEventListener('mousedown', mouse)
    h.addEventListener('keydown', key)
    frame.appendChild(h)
    handles.push(h)
  }

  frame.classList.add(...frameClasses)
  placeHandles()
  updateValues()
  notify()
  // Espaço ao lado muda com a janela, a página ou a largura dada pela aplicação
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => relayout())
  observer?.observe(frame)
  if (frame.parentElement) observer?.observe(frame.parentElement)

  return {
    getSize,
    getLimits,
    setSize(size) {
      const current = getSize()
      const next = clamp({
        width: size.width ?? current.width,
        height: size.height ?? current.height,
      })
      if (!sameSize(current, next) || !isApplied()) apply(next)
      return getSize()
    },
    setLimits(next) {
      limits = { ...next }
      reportLimits()
      // Limites novos mais apertados que o tamanho escolhido: ajusta (sem onResize,
      // a mudança veio da aplicação)
      if (isApplied()) {
        const current = getSize()
        const fitted = clamp(current)
        if (!sameSize(current, fitted)) apply(fitted)
      }
      updateValues()
    },
    destroy() {
      observer?.disconnect()
      releaseGesture(content, 'frame')
      frame.classList.remove(...frameClasses)
      pointer.stop()
      if (raf) cancelAnimationFrame(raf)
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn)
      for (const h of handles) h.remove()
    },
  }
}
