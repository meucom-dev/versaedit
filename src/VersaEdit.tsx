import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createEditorHistory } from './editorHistory'
import { isSafeUrl, purifyHtml } from './sanitize'
import { injectStyles } from './styles'
import { format, resolveLabels, type VersaEditLabels, type VersaEditLocale } from './i18n'
import {
  DEFAULT_ACCENT,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_FONT,
  DEFAULT_FONT_FAMILIES,
  DEFAULT_FONT_SIZES,
  DEFAULT_FRAME,
  DEFAULT_HEIGHT,
  DEFAULT_HIGHLIGHT_COLORS,
  DEFAULT_WIDTH,
  googleFontsUrl,
  type FontFamilyOption,
  type FrameOptions,
} from './defaults'
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconBorderColor,
  IconBulletList,
  IconClearFormat,
  IconHr,
  IconImage,
  IconIndent,
  IconItalic,
  IconLink,
  IconOpen,
  IconOutdent,
  IconPaper,
  IconRedo,
  IconSave,
  IconTextColor,
  IconTextbox,
  IconTrash,
  IconUnderline,
  IconUndo,
  IconUnlink,
} from './icons'

// ─── HELPER COMPONENTS (outside render) ───────────────────────────
const ToolbarSep = () => <div className="ve-sep" role="separator" />

const ToolbarBtn = ({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) => (
  <button
    type="button"
    className="ve-btn"
    title={title}
    aria-label={title}
    // Mantém o foco e o cursor no editor ao usar a barra de ferramentas
    onMouseDown={(e) => e.preventDefault()}
    onClick={(e) => {
      e.preventDefault()
      onClick()
    }}
  >
    {children}
  </button>
)

// ─── FONTES ───────────────────────────────────────────────────────
const GOOGLE_FONTS_LINK_ID = 'versaedit-google-fonts'

function cssFontSizeToPoints(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*(pt|px)?$/i)
  if (!match) return null
  const rawSize = Number(match[1])
  const points = match[2]?.toLowerCase() === 'pt' ? rawSize : rawSize * 0.75
  return Number.isFinite(points) && points >= 6 && points <= 72 ? points : null
}

function closestFontSizeOption(points: number, sizes: number[]): string {
  return String(
    sizes.reduce(
      (closest, size) => (Math.abs(size - points) < Math.abs(closest - points) ? size : closest),
      sizes[0],
    ),
  )
}

function clipboardFontSizePoints(html: string): number | null {
  if (!html) return null
  const clipboardDoc = new DOMParser().parseFromString(html, 'text/html')
  const styledElement = clipboardDoc.body.querySelector<HTMLElement>('[style*="font-size"]')
  const inlineSize = styledElement?.style.fontSize
  if (inlineSize) return cssFontSizeToPoints(inlineSize)

  const sizeInMarkup = html.match(/font-size\s*:\s*([\d.]+\s*(?:pt|px))/i)?.[1]
  if (sizeInMarkup) return cssFontSizeToPoints(sizeInMarkup)

  const legacySize = Number(clipboardDoc.body.querySelector('font[size]')?.getAttribute('size'))
  const legacyPoints: Record<number, number> = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 }
  return legacyPoints[legacySize] ?? null
}

function clipboardFontFamily(html: string, fontFamilies: FontFamilyOption[]): string | null {
  if (!html) return null
  const clipboardDoc = new DOMParser().parseFromString(html, 'text/html')
  const styledElement = clipboardDoc.body.querySelector<HTMLElement>('[style*="font-family"]')
  const families = Array.from(html.matchAll(/font-family\s*:\s*([^;{}]+)/gi)).map((match) =>
    match[1].split(',')[0].replace(/['"]/g, '').trim().toLowerCase(),
  )
  if (styledElement?.style.fontFamily) {
    families.unshift(
      styledElement.style.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase(),
    )
  }

  for (const family of families) {
    const matchingFont = fontFamilies.find(
      (font) => font.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase() === family,
    )
    if (matchingFont) return matchingFont.value
  }
  return null
}

function sanitizeRichPaste(html: string, fontFamilies: FontFamilyOption[]): string {
  const pasted = new DOMParser().parseFromString(purifyHtml(html), 'text/html')
  // Word costuma definir Aptos em regras CSS de classes Mso*, não inline.
  // Lemos a família antes de remover a folha de estilos do clipboard.
  const inheritedClipboardFamily = clipboardFontFamily(html, fontFamilies)
  pasted.body
    .querySelectorAll('script,style,meta,link,iframe,object,embed')
    .forEach((node) => node.remove())

  const allowedTags = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'DIV',
    'DEL',
    'EM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'I',
    'LI',
    'OL',
    'P',
    'S',
    'SPAN',
    'STRONG',
    'SUB',
    'SUP',
    'U',
    'UL',
  ])
  const elements = Array.from(pasted.body.querySelectorAll('*'))
  for (const element of elements) {
    if (!element.isConnected) continue
    if (element.tagName === 'FONT') {
      const span = pasted.createElement('span')
      const fontSize = cssFontSizeToPoints(element.getAttribute('size') ?? '')
      const face = element.getAttribute('face')
      const color = element.getAttribute('color')
      if (fontSize) span.style.fontSize = `${fontSize}pt`
      if (face) span.style.fontFamily = face
      if (color && CSS.supports('color', color)) span.style.color = color
      while (element.firstChild) span.appendChild(element.firstChild)
      element.replaceWith(span)
      continue
    }
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    const style = element instanceof HTMLElement ? element.style : null
    const fontSize = style ? cssFontSizeToPoints(style.fontSize) : null
    const fontFamily = style?.fontFamily
      ? style.fontFamily.replace(/[^a-zA-Z0-9 ,"'_-]/g, '').trim()
      : (inheritedClipboardFamily ?? '')
    const color = style?.color
    const backgroundColor = style?.backgroundColor
    const fontWeight = style?.fontWeight
    const fontStyle = style?.fontStyle
    const textDecoration = style?.textDecoration
    const textAlign = style?.textAlign
    const lineHeight = Number.parseFloat(style?.lineHeight ?? '')

    for (const attribute of Array.from(element.attributes)) {
      if (element.tagName === 'A' && attribute.name === 'href') continue
      element.removeAttribute(attribute.name)
    }

    if (style) {
      style.cssText = ''
      if (fontSize !== null) style.fontSize = `${fontSize}pt`
      if (fontFamily) style.fontFamily = fontFamily
      if (color && CSS.supports('color', color)) style.color = color
      // Preserve marca-texto de spans, mas não fundos de containers copiados.
      if (
        element.tagName === 'SPAN' &&
        backgroundColor &&
        CSS.supports('background-color', backgroundColor)
      ) {
        style.backgroundColor = backgroundColor
      }
      if (fontWeight && /^(bold|bolder|[1-9]00)$/.test(fontWeight)) style.fontWeight = fontWeight
      if (fontStyle === 'italic' || fontStyle === 'oblique') style.fontStyle = fontStyle
      if (textDecoration && /underline|line-through/.test(textDecoration)) {
        style.textDecoration = textDecoration
      }
      if (textAlign && ['left', 'center', 'right', 'justify'].includes(textAlign)) {
        style.textAlign = textAlign
      }
      if (Number.isFinite(lineHeight) && lineHeight >= 0.8 && lineHeight <= 3) {
        style.lineHeight = String(lineHeight)
      }
    }

    if (element.tagName === 'A') {
      const href = (element as HTMLAnchorElement).getAttribute('href') ?? ''
      if (!/^(https?:|mailto:|#)/i.test(href)) element.removeAttribute('href')
    }
  }

  pasted.body.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li').forEach((block) => {
    if (!(block.textContent ?? '').trim()) block.remove()
  })
  return pasted.body.innerHTML
}

type TbBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'
const TB_BORDER_STYLES: { label: keyof VersaEditLabels; value: TbBorderStyle }[] = [
  { label: 'lineSolid', value: 'solid' },
  { label: 'lineDashed', value: 'dashed' },
  { label: 'lineDotted', value: 'dotted' },
  { label: 'lineDouble', value: 'double' },
]
const TB_BORDER_WIDTHS = ['1', '2', '3', '4', '6', '8']
const RESIZE_STEPS = [25, 50, 75, 100]

const HEADING_BLOCKS: { label: keyof VersaEditLabels; tag: string }[] = [
  { label: 'paragraph', tag: 'p' },
  { label: 'heading2', tag: 'h2' },
  { label: 'heading3', tag: 'h3' },
  { label: 'heading4', tag: 'h4' },
  { label: 'quote', tag: 'blockquote' },
]

// ─── POSITION HELPERS ─────────────────────────────────────────────
// Ponto de inserção do conteúdo sob o mouse (Blink/WebKit e Firefox)
function getCaretRangeFromPoint(x: number, y: number): Range | null {
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

// ─── PROPS ────────────────────────────────────────────────────────
export interface VersaEditProps {
  /** HTML inicial. Mudanças vindas de fora recarregam o editor; o eco do próprio onChange não. */
  initialContent?: string
  onChange?: (html: string) => void
  /** Avisa quando o conteúdo passa (ou deixa de passar) da altura do editor */
  onOverflowChange?: (isOverflowing: boolean) => void
  /** Classe extra na área de edição (para estilos do site que vai exibir o conteúdo) */
  contentClassName?: string
  contentStyle?: React.CSSProperties
  /** Texto exibido com o editor vazio (padrão: o do idioma) */
  placeholder?: string
  /** Colagem: junta linhas em branco seguidas em uma só */
  singleLineBreaks?: boolean
  /** Corta o conteúdo que passar da altura do editor */
  truncateOnOverflow?: boolean
  /** Largura total do bloco em px, moldura incluída */
  width?: number
  /** Altura total do bloco em px, moldura incluída */
  height?: number
  /** Largura da barra de ferramentas (padrão: a do bloco), centralizada sobre ele */
  toolbarWidth?: number
  /** Moldura da área de edição; false remove */
  frame?: Partial<FrameOptions> | false
  /** Cor de destaque: seleção, caixas de texto, alças */
  accentColor?: string
  /** Fonte do texto */
  fontFamily?: string
  /** Fonte dos títulos (padrão: a mesma do texto) */
  headingFontFamily?: string
  /** Fontes do menu */
  fontFamilies?: FontFamilyOption[]
  /** Tamanhos do menu, em pontos */
  fontSizes?: number[]
  /** Cores do texto e do papel */
  colorPalette?: string[]
  /** Cores do marca-texto ('transparent' = sem cor) */
  highlightColors?: string[]
  /** Famílias a carregar do Google Fonts (ex.: ['Inter', 'Fraunces:opsz,wght@9..144,400;9..144,700']) */
  loadGoogleFonts?: string[]
  /** Mostra os botões Salvar/Abrir arquivo (padrão: true) */
  showFileButtons?: boolean
  /** Botão Salvar: recebe o HTML no lugar de baixar o arquivo .html */
  onSave?: (html: string) => void
  /** Idioma da interface (padrão: 'en') */
  locale?: VersaEditLocale
  /** Troca qualquer texto da interface */
  labels?: Partial<VersaEditLabels>
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}

// Aceita apenas valores de cor válidos (evita injeção de CSS pela cor do papel)
function safeCssColor(value: string): string {
  const color = value.trim()
  return color && /^[#a-z0-9(),.%\s]+$/i.test(color) && CSS.supports('color', color) ? color : ''
}

// Classes criadas pelo próprio editor — as únicas preservadas ao carregar conteúdo
const EDITOR_CLASSES = new Set([
  'pos-left',
  'pos-right',
  'pos-center',
  'rich-textbox',
  'tb-float-left',
  'tb-float-right',
  'textbox-handle',
])

// Propriedades de layout preservadas apenas em imagens, caixas de texto e linhas
// separadoras (posição, tamanho, deslocamento e borda definidos no editor).
// Textos comuns continuam sem margens/espaçamentos — inclusive os vindos da landing.
const LAYOUT_PROPERTIES = [
  'width',
  'max-width',
  'height',
  'transform',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-radius',
  'border-top',
  'border-style',
  'border-width',
  'border-color',
  'clear',
]

function isLayoutElement(el: Element): boolean {
  return el.tagName === 'IMG' || el.tagName === 'HR' || el.classList.contains('rich-textbox')
}

// Remove estilos inline, classes de layout e atributos de cor dos elementos HTML
function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(purifyHtml(html), 'text/html')
  doc.body.querySelectorAll('*').forEach((el) => {
    const inlineStyle = el instanceof HTMLElement ? el.style : null
    const keepLayout = isLayoutElement(el)
    const layout =
      keepLayout && inlineStyle
        ? LAYOUT_PROPERTIES.map((property) => [property, inlineStyle.getPropertyValue(property)])
        : []
    const editorClasses = Array.from(el.classList).filter((name) => EDITOR_CLASSES.has(name))
    const fontSizePt = inlineStyle ? cssFontSizeToPoints(inlineStyle.fontSize) : null
    const fontFamily = inlineStyle?.fontFamily
      ? inlineStyle.fontFamily.replace(/[^a-zA-Z0-9 ,"'_-]/g, '').trim()
      : ''
    const color = inlineStyle?.color || el.getAttribute('color') || ''
    const backgroundColor = inlineStyle?.backgroundColor || el.getAttribute('bgcolor') || ''
    const fontWeight = inlineStyle?.fontWeight || ''
    const fontStyle = inlineStyle?.fontStyle || ''
    const textDecoration = inlineStyle?.textDecoration || ''
    const textAlign = inlineStyle?.textAlign || ''
    const lineHeight = Number.parseFloat(inlineStyle?.lineHeight ?? '')
    el.removeAttribute('style')
    el.removeAttribute('class')
    el.removeAttribute('data-paper')
    el.removeAttribute('color')
    el.removeAttribute('bgcolor')
    el.removeAttribute('face')
    el.removeAttribute('size')
    if (el instanceof HTMLElement) {
      if (fontSizePt !== null) el.style.fontSize = `${fontSizePt}pt`
      if (fontFamily) el.style.fontFamily = fontFamily
      if (color && CSS.supports('color', color)) el.style.color = color
      if (
        el.tagName === 'SPAN' &&
        backgroundColor &&
        CSS.supports('background-color', backgroundColor)
      ) {
        el.style.backgroundColor = backgroundColor
      }
      if (/^(bold|bolder|[1-9]00)$/.test(fontWeight)) el.style.fontWeight = fontWeight
      if (fontStyle === 'italic' || fontStyle === 'oblique') el.style.fontStyle = fontStyle
      if (textDecoration && /underline|line-through/.test(textDecoration)) {
        el.style.textDecoration = textDecoration
      }
      if (['left', 'center', 'right', 'justify'].includes(textAlign)) {
        el.style.textAlign = textAlign
      }
      if (Number.isFinite(lineHeight) && lineHeight >= 0.8 && lineHeight <= 3) {
        el.style.lineHeight = String(lineHeight)
      }
      for (const [property, value] of layout) {
        if (value) el.style.setProperty(property, value)
      }
    }
    if (editorClasses.length) el.classList.add(...editorClasses)
    // Remove tags <font> antigas, mantendo o conteúdo
    if (el.tagName === 'FONT') {
      const parent = el.parentNode
      while (el.firstChild) parent?.insertBefore(el.firstChild, el)
      parent?.removeChild(el)
    }
  })
  return doc.body.innerHTML
}

// Arquivos .html salvos/abertos pelo botão de arquivo
const FILE_GENERATOR = 'VersaEdit'
const MAX_OPEN_FILE_BYTES = 20 * 1024 * 1024

// Separa a cor do papel (fundo do editor) do HTML salvo. Lê também o nome
// antigo (amesa-paper), usado pelo conteúdo gravado antes do VersaEdit.
const PAPER_MARK = /^<div class="(?:ve|amesa)-paper" data-paper="([^"]+)"[^>]*>([\s\S]*)<\/div>$/
const paperWrap = (paper: string, inner: string) =>
  `<div class="ve-paper" data-paper="${paper}" style="background-color:${paper};">${inner}</div>`
function splitPaper(html: string): { paper: string; inner: string } {
  const m = PAPER_MARK.exec(html)
  return m ? { paper: safeCssColor(m[1]), inner: m[2] } : { paper: '', inner: html }
}

const isNodeWithinEditor = (editor: HTMLElement, node: Node): boolean =>
  node === editor || editor.contains(node)

const isRangeWithinEditor = (editor: HTMLElement, range: Range): boolean =>
  isNodeWithinEditor(editor, range.commonAncestorContainer)

// Ouvintes de mousemove/mouseup do documento durante um arrasto ou redimensionamento
type MouseListener = (e: MouseEvent) => void
function createPointerTracker() {
  let active: { move: MouseListener; up: MouseListener } | null = null
  const stop = () => {
    if (!active) return
    document.removeEventListener('mousemove', active.move)
    document.removeEventListener('mouseup', active.up)
    active = null
  }
  return {
    start(move: MouseListener, up: MouseListener) {
      stop()
      active = { move, up }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    },
    stop,
  }
}

// Aplica a fonte ou a cor de pré-visualização ao trecho selecionado
function setPreviewWrapperStyle(
  wrapper: HTMLSpanElement,
  property: 'fontFamily' | 'color',
  value: string,
) {
  wrapper.style.fontFamily = ''
  wrapper.style.color = ''
  if (property === 'fontFamily') wrapper.style.fontFamily = value
  else wrapper.style.color = value
}

// Conteúdo a salvar: envolve o HTML com a cor do papel, quando definida
function serializeEditorContent(el: HTMLElement, paper: string): string {
  return paper ? paperWrap(paper, el.innerHTML) : el.innerHTML
}

// HTML do editor para o histórico: sem classes de seleção e com a cor do papel
function snapshotEditor(el: HTMLElement, paper: string): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.selected, .dragging').forEach((node) => {
    node.classList.remove('selected', 'dragging')
  })
  return paper ? paperWrap(paper, clone.innerHTML) : clone.innerHTML
}

function measureEditorContentHeight(editor: HTMLElement): number {
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

function editorContentExceedsHeight(editor: HTMLElement): boolean {
  return measureEditorContentHeight(editor) > editor.clientHeight + 1
}

// Remove apenas o conteúdo final que ultrapassa a altura física do editor.
// A busca binária corta um prefixo do último nó de texto e preserva formatação.
function truncateEditableToFit(editor: HTMLElement): boolean {
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

type SelectionType = 'image' | 'textbox' | null
type PendingTypingStyle = { fontSize?: string; color?: string; fontFamily?: string }
type SelectionPreview = {
  wrapper: HTMLSpanElement
  originalNodes: Node[]
  property: 'fontFamily' | 'color'
}

// ─── COMPONENT ────────────────────────────────────────────────────
const VersaEdit: React.FC<VersaEditProps> = ({
  initialContent = '',
  onChange,
  onOverflowChange,
  contentClassName = '',
  contentStyle,
  placeholder,
  singleLineBreaks = false,
  truncateOnOverflow = false,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  toolbarWidth = width,
  frame,
  accentColor = DEFAULT_ACCENT,
  fontFamily = DEFAULT_FONT,
  headingFontFamily,
  fontFamilies = DEFAULT_FONT_FAMILIES,
  fontSizes = DEFAULT_FONT_SIZES,
  colorPalette: colorPalette_ = DEFAULT_COLOR_PALETTE,
  highlightColors = DEFAULT_HIGHLIGHT_COLORS,
  loadGoogleFonts,
  showFileButtons = true,
  onSave,
  locale = 'en',
  labels,
}) => {
  const L = useMemo(() => resolveLabels(locale, labels), [locale, labels])
  const frameOpts: FrameOptions =
    frame === false ? { width: 0, color: 'transparent', radius: 0 } : { ...DEFAULT_FRAME, ...frame }
  const fontSizeOptions = fontSizes.length ? fontSizes : DEFAULT_FONT_SIZES
  // Valores atuais para os ouvintes registrados uma única vez
  const fontFamiliesRef = useRef(fontFamilies)
  const fontSizesRef = useRef(fontSizeOptions)
  const onSaveRef = useRef(onSave)
  const editorRef = useRef<HTMLDivElement>(null)
  // Callbacks sempre atualizados: a tela pode recriar onChange a cada renderização
  // sem que o editor recarregue o conteúdo nem chame uma versão antiga da função
  const onChangeRef = useRef(onChange)
  const onOverflowChangeRef = useRef(onOverflowChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
    onOverflowChangeRef.current = onOverflowChange
    onSaveRef.current = onSave
    fontFamiliesRef.current = fontFamilies
    fontSizesRef.current = fontSizeOptions
  })
  // Último HTML enviado pelo onChange — identifica quando initialContent é
  // apenas o eco do próprio editor (modo controlado, ex.: texto do banner)
  const lastEmittedRef = useRef<string | null>(null)
  const selectedImgRef = useRef<HTMLImageElement | null>(null)
  const selectedTextboxRef = useRef<HTMLDivElement | null>(null)
  const [selectionType, setSelectionType] = useState<SelectionType>(null)
  const [imgToolbarVisible, setImgToolbarVisible] = useState(false)
  const [imgToolbarPos, setImgToolbarPos] = useState({ top: 0, left: 0 })
  const [tbToolbarVisible, setTbToolbarVisible] = useState(false)
  const [tbToolbarPos, setTbToolbarPos] = useState({ top: 0, left: 0 })
  const imgToolbarRef = useRef<HTMLDivElement>(null)
  const tbToolbarRef = useRef<HTMLDivElement>(null)

  // Color state
  const [textColor, setTextColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#FFFF00')
  // Paleta aberta ('text' | 'bg') e seleção guardada para aplicar a cor
  const [colorPalette, setColorPalette] = useState<'text' | 'bg' | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const pendingTypingStyleRef = useRef<PendingTypingStyle>({})
  const selectionPreviewRef = useRef<SelectionPreview | null>(null)
  const [fontMenuOpen, setFontMenuOpen] = useState(false)
  const fontMenuRef = useRef<HTMLDivElement>(null)
  const colorPanelRef = useRef<HTMLDivElement>(null)
  // Cor do papel (fundo do editor, independente do texto), salva com o conteúdo
  const paperRef = useRef('')
  const serializeEditor = (): string =>
    editorRef.current ? serializeEditorContent(editorRef.current, paperRef.current) : ''

  // Cor do papel: colore a superfície do editor, sem afetar o texto
  const applyPaper = (color: string) => {
    const paper = safeCssColor(color)
    paperRef.current = paper
    if (editorRef.current) editorRef.current.style.backgroundColor = paper
    triggerChange()
  }

  // Borda da caixa de texto (menu do editor)
  const [tbBorderColor, setTbBorderColor] = useState(accentColor)
  const [tbBorderWidth, setTbBorderWidth] = useState('1')
  const [tbBorderStyle, setTbBorderStyle] = useState<TbBorderStyle>('dashed')
  const tbBorderColorInputRef = useRef<HTMLInputElement>(null)
  const isTextboxSelected = selectionType === 'textbox'

  // Font state
  const [currentFont, setCurrentFont] = useState(fontFamily)
  const [currentFontSize, setCurrentFontSize] = useState('12')
  // Paleta de cores do texto tarjado (marca-texto)
  const [highlightPalette, setHighlightPalette] = useState<boolean | null>(null)

  // Drag state
  const isDragging = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const dragType = useRef<'image' | 'textbox' | null>(null)

  // Free resize state (alça de redimensionamento livre)
  const isResizing = useRef(false)
  const resizeElRef = useRef<HTMLElement | null>(null)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const [resizeHandlePos, setResizeHandlePos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    injectStyles()
  }, [])

  // Google Fonts: só quando pedido pela prop (desligado por padrão)
  const googleFontsKey = loadGoogleFonts?.join('|') ?? ''
  useEffect(() => {
    if (!googleFontsKey) return
    const href = googleFontsUrl(googleFontsKey.split('|'))
    let link = document.getElementById(GOOGLE_FONTS_LINK_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = GOOGLE_FONTS_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  }, [googleFontsKey])

  // Histórico próprio de desfazer/refazer (mantido fora do estado do React)
  const [history] = useState(() => createEditorHistory())
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || initialContent === undefined) return

    if (initialContent === lastEmittedRef.current) {
      // Eco do próprio editor (onChange → tela → initialContent): o DOM já está
      // atualizado — nada a recarregar (preserva cursor, seleção e histórico)
      onOverflowChangeRef.current?.(editorContentExceedsHeight(editor))
      return
    }

    // Mudança EXTERNA (carregamento do banco ou troca de item): sanitiza
    // (remove estilos inline da landing e código inseguro) e reinicia o histórico
    lastEmittedRef.current = null
    const { paper, inner } = splitPaper(initialContent)
    const cleanInner = sanitizeHtml(inner)
    paperRef.current = paper
    editor.style.backgroundColor = paper
    if (cleanInner !== editor.innerHTML) {
      editor.innerHTML = cleanInner
    }
    const wasTruncated = truncateOnOverflow && truncateEditableToFit(editor)
    history.reset(snapshotEditor(editor, paper))
    onOverflowChangeRef.current?.(editorContentExceedsHeight(editor))
    if (wasTruncated && onChangeRef.current) {
      const html = serializeEditorContent(editor, paper)
      lastEmittedRef.current = html
      onChangeRef.current(html)
    }
  }, [initialContent, history, truncateOnOverflow])

  // Registra no histórico toda alteração do editor (texto, formatação, imagens,
  // caixas e cor do papel), agrupando a digitação
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const observer = new MutationObserver(() => {
      if (selectionPreviewRef.current) return
      history.schedule(() => snapshotEditor(el, paperRef.current))
    })
    observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true })
    return () => {
      observer.disconnect()
      history.dispose()
    }
  }, [history])

  // Atualiza os seletores de fonte e tamanho conforme a seleção do usuário
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      if (selectionPreviewRef.current) return
      const editor = editorRef.current
      if (!editor) return
      const range = sel.getRangeAt(0)
      if (!isRangeWithinEditor(editor, range)) return
      savedRangeRef.current = range.cloneRange()
      if (!range.collapsed) pendingTypingStyleRef.current = {}
      // Usa o nó de início da seleção (funciona tanto com seleção quanto com cursor)
      const node = range.startContainer
      const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement)
      if (!el) return
      const computed = window.getComputedStyle(el)
      // CSS pixels → pontos tipográficos (mesma unidade e escala do Word).
      const sizePx = parseFloat(computed.fontSize)
      if (Number.isFinite(sizePx)) {
        setCurrentFontSize(closestFontSizeOption((sizePx * 72) / 96, fontSizesRef.current))
      }
      // Cor do texto selecionado → atualiza o círculo de cor do texto
      const rgb = computed.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (rgb) {
        const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')
        setTextColor(`#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`.toUpperCase())
      }
      // Família da fonte — pega a primeira família resolvida
      const family = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
      const firstFamily = (value: string) =>
        value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
      const families = fontFamiliesRef.current
      const match =
        families.find((font) => firstFamily(font.value) === family) ||
        families.find((font) => font.value.toLowerCase().includes(family)) ||
        families.find((font) => family.includes(firstFamily(font.value)))
      if (match) setCurrentFont(match.value)
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  // ─── HELPERS ─────────────────────────────────────────────────────
  const triggerChange = () => {
    const editor = editorRef.current
    if (!editor) return
    onOverflowChangeRef.current?.(editorContentExceedsHeight(editor))
    if (onChangeRef.current) {
      const html = serializeEditor()
      lastEmittedRef.current = html
      onChangeRef.current(html)
    }
  }

  // As buscas ficam restritas a este editor: outros editores da mesma tela
  // mantêm suas próprias seleções
  const deselectImage = () => {
    editorRef.current?.querySelectorAll('img.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    selectedImgRef.current = null
    setSelectionType(null)
    setImgToolbarVisible(false)
    setResizeHandlePos(null)
  }

  const deselectTextbox = () => {
    editorRef.current?.querySelectorAll('.rich-textbox.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    selectedTextboxRef.current = null
    setSelectionType(null)
    setTbToolbarVisible(false)
    setResizeHandlePos(null)
  }

  const updateToolbarPosition = (img: HTMLImageElement) => {
    const rect = img.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setImgToolbarPos({
        top: rect.top - editorRect.top - 40,
        left: rect.left - editorRect.left,
      })
    }
  }

  const updateTextboxToolbarPosition = (el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setTbToolbarPos({
        top: rect.top - editorRect.top - 40,
        left: rect.left - editorRect.left,
      })
    }
  }

  // Posiciona a alça de redimensionamento no canto inferior direito do elemento
  const updateResizeHandlePosition = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setResizeHandlePos({
        top: rect.bottom - editorRect.top - 7,
        left: rect.right - editorRect.left - 7,
      })
    }
  }

  // ─── REPOSICIONAMENTO POR ARRASTO ───────────────────────────────
  // Limpa os deslocamentos manuais: o espaçamento volta aos 40px do CSS
  const clearManualOffsets = (el: HTMLElement) => {
    el.style.transform = ''
    el.style.marginTop = ''
    el.style.marginLeft = ''
    el.style.marginRight = ''
  }

  // Deslocamento manual atual (translate aplicado pelo arrasto ou pelas setas)
  const getManualOffset = (el: HTMLElement): { x: number; y: number } => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || '')
    return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 }
  }

  // Deslocamento fino livre (setas + Ctrl): move o elemento alguns pixels,
  // por cima do texto, sem alterar o fluxo do conteúdo
  const nudgeElement = (el: HTMLElement, dx: number, dy: number) => {
    const { x, y } = getManualOffset(el)
    el.style.transform = `translate(${x + dx}px, ${y + dy}px)`
  }

  // Faz o elemento flutuar para o lado em que foi solto — assim o texto
  // sempre contorna o elemento com a margem de 40px definida no CSS
  const setFloatSide = (el: HTMLElement, side: 'left' | 'right') => {
    if (el.tagName === 'IMG') {
      el.classList.remove('pos-left', 'pos-right', 'pos-center')
      el.classList.add(side === 'left' ? 'pos-left' : 'pos-right')
    } else {
      el.classList.remove('tb-float-left', 'tb-float-right')
      el.classList.add(side === 'left' ? 'tb-float-left' : 'tb-float-right')
    }
  }

  // Move o elemento um bloco acima/abaixo no fluxo do conteúdo
  const moveElementInFlow = (el: HTMLElement, dir: -1 | 1) => {
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
  const dropElementAtPoint = (el: HTMLElement, x: number, y: number): boolean => {
    const editor = editorRef.current
    if (!editor) return false

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
        x >= editorRect.left &&
        x <= editorRect.right &&
        y >= editorRect.top &&
        y <= editorRect.bottom

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
  const setImagePosition = (
    img: HTMLImageElement,
    posClass: 'pos-left' | 'pos-right' | 'pos-center',
  ) => {
    img.classList.remove('pos-left', 'pos-right', 'pos-center')
    img.classList.add(posClass)
  }

  // ─── COMMANDS ────────────────────────────────────────────────────
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    triggerChange()
  }

  const getCurrentEditorRange = (editor: HTMLElement): Range | null => {
    const selection = window.getSelection()
    const currentRange = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (currentRange && isRangeWithinEditor(editor, currentRange)) return currentRange.cloneRange()
    const savedRange = savedRangeRef.current
    return savedRange && isRangeWithinEditor(editor, savedRange) ? savedRange.cloneRange() : null
  }

  const restoreEditorRange = (editor: HTMLElement, range: Range) => {
    editor.focus()
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
  }

  const restoreSelectionPreview = () => {
    const preview = selectionPreviewRef.current
    if (!preview) return
    const parent = preview.wrapper.parentNode
    if (!parent) {
      selectionPreviewRef.current = null
      return
    }

    const firstNode = preview.originalNodes[0]
    const lastNode = preview.originalNodes[preview.originalNodes.length - 1]
    preview.originalNodes.forEach((node) => parent.insertBefore(node, preview.wrapper))
    parent.removeChild(preview.wrapper)
    selectionPreviewRef.current = null

    if (firstNode && lastNode) {
      const range = document.createRange()
      range.setStartBefore(firstNode)
      range.setEndAfter(lastNode)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRangeRef.current = range.cloneRange()
    }
  }

  const previewSelectionStyle = (property: 'fontFamily' | 'color', value: string): boolean => {
    const editor = editorRef.current
    if (!editor) return false

    let preview = selectionPreviewRef.current
    if (preview && preview.property !== property) {
      restoreSelectionPreview()
      preview = null
    }

    if (!preview) {
      const range = getCurrentEditorRange(editor)
      if (!range || range.collapsed) return false
      restoreEditorRange(editor, range)
      const originalFragment = range.extractContents()
      const originalNodes = Array.from(originalFragment.childNodes)
      if (!originalNodes.length) return false

      const wrapper = document.createElement('span')
      wrapper.dataset.editorSelectionPreview = 'true'
      wrapper.append(...originalNodes.map((node) => node.cloneNode(true)))
      range.insertNode(wrapper)
      preview = { wrapper, originalNodes, property }
      selectionPreviewRef.current = preview
    }

    preview.wrapper.replaceChildren(...preview.originalNodes.map((node) => node.cloneNode(true)))
    const cssProperty = property === 'fontFamily' ? 'font-family' : 'color'
    preview.wrapper.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
      element.style.removeProperty(cssProperty)
      if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
    })
    setPreviewWrapperStyle(preview.wrapper, property, value)

    const range = document.createRange()
    range.selectNodeContents(preview.wrapper)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
    return true
  }

  const commitSelectionPreview = (property: 'fontFamily' | 'color', value: string): boolean => {
    if (!previewSelectionStyle(property, value)) return false
    const preview = selectionPreviewRef.current
    if (!preview) return false
    preview.wrapper.removeAttribute('data-editor-selection-preview')
    selectionPreviewRef.current = null
    pendingTypingStyleRef.current = {}
    const range = document.createRange()
    range.selectNodeContents(preview.wrapper)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
    triggerChange()
    return true
  }

  const applyFontFamily = (font: string) => {
    setCurrentFont(font)
    const editor = editorRef.current
    if (!editor) return
    const range = getCurrentEditorRange(editor)
    if (!range || range.collapsed) {
      pendingTypingStyleRef.current = { ...pendingTypingStyleRef.current, fontFamily: font }
      if (range) restoreEditorRange(editor, range)
      else editor.focus()
      return
    }

    restoreEditorRange(editor, range)
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('fontName', false, font)
    const updatedSelection = window.getSelection()
    if (updatedSelection?.rangeCount) {
      savedRangeRef.current = updatedSelection.getRangeAt(0).cloneRange()
    }
    triggerChange()
  }

  const chooseFontFamily = (font: string) => {
    setCurrentFont(font)
    if (!commitSelectionPreview('fontFamily', font)) applyFontFamily(font)
    setFontMenuOpen(false)
  }

  // Tamanho em pontos: aplica à seleção de texto no editor ou, sem seleção,
  // ao conteúdo inteiro da caixa de texto selecionada
  const applyFontSizePt = (pt: string) => {
    const editor = editorRef.current
    const range = editor ? getCurrentEditorRange(editor) : null
    if (editor && range?.collapsed) {
      pendingTypingStyleRef.current = { ...pendingTypingStyleRef.current, fontSize: `${pt}pt` }
      restoreEditorRange(editor, range)
      return
    }

    const selection = window.getSelection()
    if (editor && range && !range.collapsed) {
      restoreEditorRange(editor, range)
      const span = document.createElement('span')
      span.style.fontSize = `${pt}pt`
      const contents = range.extractContents()
      contents.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
        element.style.removeProperty('font-size')
        if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
      })
      span.appendChild(contents)
      range.insertNode(span)
      const next = document.createRange()
      next.selectNodeContents(span)
      selection?.removeAllRanges()
      selection?.addRange(next)
      savedRangeRef.current = next.cloneRange()
    } else if (selectedTextboxRef.current) {
      selectedTextboxRef.current.style.fontSize = `${pt}pt`
    }
    triggerChange()
  }

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pt = e.target.value
    setCurrentFontSize(pt)
    applyFontSizePt(pt)
  }

  const handleHeadingChange = (tag: string) => {
    execCommand('formatBlock', tag)
  }

  const handleInsertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const src = typeof ev.target?.result === 'string' ? ev.target.result : ''
        if (!isSafeUrl('src', src)) return
        const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(L.imageAlt)}" class="pos-left" draggable="false" style="max-width:50%;height:auto;border-radius:4px;" />`
        editorRef.current?.focus()
        document.execCommand('insertHTML', false, img)
        triggerChange()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Guarda a seleção de texto antes de o foco sair do editor (clique na paleta)
  const saveSelection = () => {
    const sel = window.getSelection()
    const editor = editorRef.current
    if (sel && sel.rangeCount > 0 && editor) {
      const range = sel.getRangeAt(0)
      if (isRangeWithinEditor(editor, range)) {
        savedRangeRef.current = range.cloneRange()
        if (!range.collapsed) pendingTypingStyleRef.current = {}
      }
    }
  }

  // Aplica a cor de imediato à seleção guardada e devolve o foco ao editor
  const applyColor = (command: 'foreColor' | 'hiliteColor', color: string) => {
    const editor = editorRef.current
    if (!editor) return
    const range = getCurrentEditorRange(editor)
    if (command === 'foreColor' && range?.collapsed) {
      pendingTypingStyleRef.current = { ...pendingTypingStyleRef.current, color }
      restoreEditorRange(editor, range)
      return
    }

    if (range) restoreEditorRange(editor, range)
    if (command === 'hiliteColor') {
      // Cor de fundo = cor do papel do editor, independente do texto
      applyPaper(color)
    } else {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand(command, false, color)
    }
    // Mantém a seleção atualizada após a mudança no DOM
    const after = window.getSelection()
    if (after && after.rangeCount > 0) savedRangeRef.current = after.getRangeAt(0).cloneRange()
    triggerChange()
  }

  const setColorState = (kind: 'text' | 'bg', color: string) => {
    if (kind === 'text') setTextColor(color)
    else setBgColor(color)
  }

  // Escolha na paleta: aplica de imediato e fecha
  const pickColor = (kind: 'text' | 'bg', color: string) => {
    setColorState(kind, color)
    if (kind === 'text' && commitSelectionPreview('color', color)) {
      setColorPalette(null)
      return
    }
    applyColor(kind === 'text' ? 'foreColor' : 'hiliteColor', color)
    setColorPalette(null)
  }

  // Cor personalizada: aplica ao vivo e mantém a paleta aberta
  const pickCustomColor = (kind: 'text' | 'bg', color: string) => {
    setColorState(kind, color)
    applyColor(kind === 'text' ? 'foreColor' : 'hiliteColor', color)
  }

  // Fecha a paleta ao clicar fora dela
  useEffect(() => {
    if (!colorPalette) return
    const onDown = (e: MouseEvent) => {
      if (colorPanelRef.current && !colorPanelRef.current.contains(e.target as Node)) {
        setColorPalette(null)
        restoreSelectionPreview()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [colorPalette])

  useEffect(() => {
    if (!fontMenuOpen) return
    const onDown = (event: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setFontMenuOpen(false)
        restoreSelectionPreview()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [fontMenuOpen])

  // Ícone abre a paleta; círculo aplica a cor atual à seleção e fecha o seletor
  const renderColorPicker = (kind: 'text' | 'bg') => {
    const color = kind === 'text' ? textColor : bgColor
    const command = kind === 'text' ? 'foreColor' : 'hiliteColor'
    const label = kind === 'text' ? L.textColor : L.paperColor
    const applyLabel = format(L.applyColor, { label, color })
    const keepSelection = (e: React.MouseEvent) => {
      e.preventDefault()
      saveSelection()
    }
    return (
      <div className="ve-color-picker">
        <button
          type="button"
          className="ve-btn"
          title={label}
          aria-label={label}
          aria-haspopup="true"
          aria-expanded={colorPalette === kind}
          onMouseDown={keepSelection}
          onClick={() => setColorPalette(colorPalette === kind ? null : kind)}
        >
          {kind === 'text' ? <IconTextColor /> : <IconPaper />}
        </button>
        <button
          type="button"
          className="ve-btn"
          title={applyLabel}
          aria-label={applyLabel}
          onMouseDown={keepSelection}
          onClick={() => {
            applyColor(command, color)
            setColorPalette(null)
          }}
        >
          <span className="ve-color-indicator" style={{ backgroundColor: color }} />
        </button>
        {colorPalette === kind && (
          <div className="ve-palette" onMouseLeave={restoreSelectionPreview}>
            {colorPalette_.map((c) => (
              <button
                key={c}
                type="button"
                className="ve-swatch"
                title={c}
                aria-label={c}
                style={{ backgroundColor: c }}
                onMouseDown={keepSelection}
                onMouseEnter={() => {
                  if (kind === 'text') previewSelectionStyle('color', c)
                }}
                onClick={() => pickColor(kind, c)}
              />
            ))}
            <label
              className="ve-swatch ve-swatch--custom"
              title={L.customColor}
              onMouseDown={saveSelection}
            >
              <input
                type="color"
                aria-label={L.customColor}
                value={color}
                onChange={(e) => pickCustomColor(kind, e.target.value)}
              />
            </label>
          </div>
        )}
      </div>
    )
  }

  // ─── BORDA DA CAIXA DE TEXTO ────────────────────────────────────
  const applyTbBorderColor = (color: string) => {
    setTbBorderColor(color)
    const tb = selectedTextboxRef.current
    if (!tb) return
    tb.style.borderColor = color
    if (tb.style.borderStyle === 'none') {
      tb.style.borderStyle = tbBorderStyle
      if (parseFloat(tb.style.borderWidth || '0') === 0) {
        tb.style.borderWidth = '1px'
        setTbBorderWidth('1')
      }
    }
    triggerChange()
    updateResizeHandlePosition(tb)
  }

  const applyTbBorderWidth = (w: string) => {
    setTbBorderWidth(w)
    const tb = selectedTextboxRef.current
    if (!tb) return
    if (w === '0') {
      tb.style.borderStyle = 'none'
      tb.style.borderWidth = '0px'
    } else {
      tb.style.borderStyle = tbBorderStyle
      tb.style.borderWidth = `${w}px`
    }
    triggerChange()
    updateResizeHandlePosition(tb)
  }

  // Tipo de linha da borda (sólida, tracejada, pontilhada, dupla)
  const applyTbBorderStyle = (style: TbBorderStyle) => {
    setTbBorderStyle(style)
    const tb = selectedTextboxRef.current
    if (!tb) return
    tb.style.borderStyle = style
    const current = parseFloat(tb.style.borderWidth || '0')
    // Sem espessura, ou espessura insuficiente para a linha dupla, ajusta a borda
    if (current === 0) {
      tb.style.borderWidth = '1px'
      setTbBorderWidth('1')
    } else if (style === 'double' && current < 3) {
      tb.style.borderWidth = '3px'
      setTbBorderWidth('3')
    }
    triggerChange()
    updateResizeHandlePosition(tb)
  }

  // Aceita apenas links http(s), e-mail e âncoras; "www.site.com" vira "https://www.site.com"
  const normalizeLinkUrl = (value: string): string | null => {
    const url = value.trim()
    if (!url) return null
    if (/^(https?:\/\/|mailto:|#)/i.test(url)) return url
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null
    return `https://${url}`
  }

  const handleInsertLink = () => {
    const editor = editorRef.current
    const range = editor ? getCurrentEditorRange(editor) : null
    const typedUrl = prompt(L.linkUrlPrompt, 'https://')
    if (!typedUrl) return
    const url = normalizeLinkUrl(typedUrl)
    if (!url) {
      alert(L.linkInvalid)
      return
    }
    const selectedText = range?.toString() || ''
    const linkText = prompt(L.linkTextPrompt, selectedText || url) || url
    const html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`
    if (editor && range) restoreEditorRange(editor, range)
    else editor?.focus()
    document.execCommand('insertHTML', false, html)
    triggerChange()
  }

  const handleRemoveLink = () => {
    execCommand('unlink')
  }

  const handleInsertHR = () => {
    editorRef.current?.focus()
    document.execCommand(
      'insertHTML',
      false,
      '<hr style="border:none;border-top:1px solid #ccc;margin:12px 0;clear:both;" />',
    )
    triggerChange()
  }

  const handleInsertTextBox = () => {
    const html = `<div class="rich-textbox" contenteditable="true"><span class="textbox-handle" contenteditable="false" title="${escapeHtml(L.textboxHandle)}">⠿</span>${escapeHtml(L.textboxDefault)}</div>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    triggerChange()
  }

  // Zera a área de edição: apaga todo o conteúdo e volta o papel ao padrão
  // ─── ARQUIVO (.html) ─────────────────────────────────────────────
  // Salvar: baixa o conteúdo (texto, imagens, layout e cor do papel) como
  // uma página .html, que também pode ser aberta direto no navegador
  const handleSaveToFile = () => {
    const editor = editorRef.current
    if (!editor) return
    const html = snapshotEditor(editor, paperRef.current)
    if (onSaveRef.current) {
      onSaveRef.current(html)
      return
    }
    const page = [
      '<!doctype html>',
      `<html lang="${locale}">`,
      '<head>',
      '<meta charset="utf-8">',
      `<meta name="generator" content="${FILE_GENERATOR}">`,
      `<title>${escapeHtml(L.fileTitle)}</title>`,
      '</head>',
      `<body>${html}</body>`,
      '</html>',
    ].join('\n')
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fileName = `${L.fileNamePrefix}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.html`
    const url = URL.createObjectURL(new Blob([page], { type: 'text/html;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Abrir: carrega um arquivo .html no editor, com a mesma limpeza de segurança
  // do carregamento do banco. Pode ser desfeito com Ctrl+Z.
  const loadFileContent = (fileHtml: string) => {
    const editor = editorRef.current
    if (!editor) return
    const body = new DOMParser().parseFromString(fileHtml, 'text/html').body.innerHTML.trim()
    const { paper, inner } = splitPaper(body)
    const cleanInner = sanitizeHtml(inner)
    if (!cleanInner.replace(/<[^>]*>/g, '').trim() && !/<img\b/i.test(cleanInner)) {
      alert(L.fileEmpty)
      return
    }
    deselectImage()
    deselectTextbox()
    paperRef.current = paper
    editor.style.backgroundColor = paper
    editor.innerHTML = cleanInner
    if (truncateOnOverflow && truncateEditableToFit(editor)) {
      alert(L.fileTruncated)
    }
    editor.focus()
    triggerChange()
  }

  const handleOpenFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm,text/html'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
        alert(L.fileWrongType)
        return
      }
      if (file.size > MAX_OPEN_FILE_BYTES) {
        alert(L.fileTooLarge)
        return
      }
      const editor = editorRef.current
      const hasContent = Boolean(editor?.textContent?.trim() || editor?.querySelector('img'))
      if (hasContent && !confirm(L.fileReplaceConfirm)) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') loadFileContent(reader.result)
      }
      reader.onerror = () => alert(L.fileReadError)
      reader.readAsText(file, 'utf-8')
    }
    input.click()
  }

  const handleClearAll = () => {
    deselectImage()
    deselectTextbox()
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
      editorRef.current.style.backgroundColor = ''
    }
    paperRef.current = ''
    // Reseta os indicadores de cor: fundo branco e texto preto (padrão)
    setBgColor('#FFFFFF')
    setTextColor('#000000')
    triggerChange()
  }

  const handleClearFormatting = () => {
    execCommand('removeFormat')
  }

  // ─── TEXT BOX ────────────────────────────────────────────────────
  const selectTextbox = (el: HTMLDivElement) => {
    deselectImage()
    deselectTextbox()
    // Garante a edição de texto na caixa (digitação, não apenas colagem)
    el.setAttribute('contenteditable', 'true')
    // Sincroniza os controles de borda do menu com o estilo atual da caixa
    const wpx = Math.round(parseFloat(el.style.borderWidth || '0'))
    setTbBorderColor(el.style.borderColor || accentColor)
    setTbBorderWidth(Number.isFinite(wpx) ? String(wpx) : '1')
    const styleNow = el.style.borderStyle
    setTbBorderStyle(styleNow && styleNow !== 'none' ? (styleNow as TbBorderStyle) : 'dashed')
    el.classList.add('selected')
    selectedTextboxRef.current = el
    setSelectionType('textbox')
    setTbToolbarVisible(true)
    updateTextboxToolbarPosition(el)
    updateResizeHandlePosition(el)
  }

  const deleteSelectedTextbox = () => {
    if (selectedTextboxRef.current) {
      selectedTextboxRef.current.remove()
      selectedTextboxRef.current = null
      setSelectionType(null)
      setTbToolbarVisible(false)
      triggerChange()
    }
  }

  const resizeSelectedTextbox = (pct: number) => {
    if (!selectedTextboxRef.current) return
    const w = `${pct}%`
    selectedTextboxRef.current.style.maxWidth = w
    selectedTextboxRef.current.style.width = w
    updateResizeHandlePosition(selectedTextboxRef.current)
    triggerChange()
  }

  const alignSelectedTextbox = (align: 'left' | 'center' | 'right') => {
    if (!selectedTextboxRef.current) return
    selectedTextboxRef.current.style.textAlign = align
    triggerChange()
  }

  // ─── IMAGE ───────────────────────────────────────────────────────
  const selectImage = (img: HTMLImageElement) => {
    deselectTextbox()
    deselectImage()
    img.draggable = false
    img.classList.add('selected')
    selectedImgRef.current = img
    setSelectionType('image')
    setImgToolbarVisible(true)
    updateToolbarPosition(img)
    updateResizeHandlePosition(img)
  }

  const deleteSelectedImage = () => {
    if (selectedImgRef.current) {
      selectedImgRef.current.remove()
      selectedImgRef.current = null
      setSelectionType(null)
      setImgToolbarVisible(false)
      triggerChange()
    }
  }

  const resizeSelectedImage = (pct: number) => {
    if (!selectedImgRef.current) return
    const w = `${pct}%`
    selectedImgRef.current.style.width = w
    selectedImgRef.current.style.maxWidth = w
    updateResizeHandlePosition(selectedImgRef.current)
    triggerChange()
  }

  const floatImage = (direction: 'left' | 'right' | 'none') => {
    if (!selectedImgRef.current) return
    const img = selectedImgRef.current
    // Alinhamento explícito: limpa o deslocamento horizontal manual
    img.style.marginLeft = ''
    img.style.marginRight = ''
    const posClass =
      direction === 'left' ? 'pos-left' : direction === 'right' ? 'pos-right' : 'pos-center'
    setImagePosition(img, posClass)
    updateResizeHandlePosition(img)
    triggerChange()
  }

  // ─── RASTREAMENTO DO MOUSE (arrasto e redimensionamento) ────────
  // Os ouvintes ativos ficam registrados para serem removidos também quando
  // o editor sai da tela no meio de um arrasto
  const [pointerTracker] = useState(createPointerTracker)
  useEffect(() => () => pointerTracker.stop(), [pointerTracker])

  const startPointerTracking = (move: MouseListener, up: MouseListener) =>
    pointerTracker.start(move, up)

  const stopPointerTracking = () => pointerTracker.stop()

  // ─── DRAG HANDLERS ──────────────────────────────────────────────
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return
    const el = (
      dragType.current === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    if (!el) return
    // Movimento livre: o elemento acompanha o mouse passando por cima do texto
    const dx = e.clientX - dragStartPos.current.x + dragStartPos.current.ox
    const dy = e.clientY - dragStartPos.current.y + dragStartPos.current.oy
    el.style.transform = `translate(${dx}px, ${dy}px)`
    if (dragType.current === 'image') updateToolbarPosition(el as HTMLImageElement)
    else updateTextboxToolbarPosition(el as HTMLDivElement)
    updateResizeHandlePosition(el)
  }

  const handleGlobalMouseUp = (e: MouseEvent) => {
    const type = dragType.current
    const el = (
      type === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    isDragging.current = false
    dragType.current = null
    stopPointerTracking()
    if (!el) return
    el.classList.remove('dragging')
    // Reposiciona no ponto de queda — o texto passa a contornar o elemento
    // com a margem de 40px do CSS; se o ponto for inválido, restaura a posição
    if (!dropElementAtPoint(el, e.clientX, e.clientY)) {
      el.style.transform = ''
    }
    if (type === 'image') updateToolbarPosition(el as HTMLImageElement)
    else updateTextboxToolbarPosition(el as HTMLDivElement)
    updateResizeHandlePosition(el)
    triggerChange()
  }

  // ─── FREE RESIZE HANDLERS (alça no canto inferior direito) ──────
  const handleResizeMove = (e: MouseEvent) => {
    const el = resizeElRef.current
    if (!isResizing.current || !el) return
    const dx = e.clientX - resizeStart.current.x
    const dy = e.clientY - resizeStart.current.y
    const newW = Math.max(60, resizeStart.current.w + dx)
    const newH = Math.max(40, resizeStart.current.h + dy)
    // Redimensionamento livre: largura e altura seguem o movimento do mouse
    el.style.width = `${newW}px`
    el.style.maxWidth = `${newW}px`
    el.style.height = `${newH}px`
    updateResizeHandlePosition(el)
    if (el.tagName === 'IMG') updateToolbarPosition(el as HTMLImageElement)
    else updateTextboxToolbarPosition(el as HTMLDivElement)
  }

  const handleResizeEnd = () => {
    isResizing.current = false
    resizeElRef.current = null
    stopPointerTracking()
    triggerChange()
  }

  const startFreeResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = (
      selectionType === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    if (!el) return
    isResizing.current = true
    resizeElRef.current = el
    resizeStart.current = { x: e.clientX, y: e.clientY, w: el.offsetWidth, h: el.offsetHeight }
    startPointerTracking(handleResizeMove, handleResizeEnd)
  }

  // ─── MOUSE DOWN ──────────────────────────────────────────────────
  const handleEditorMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement

    if (target.tagName === 'IMG') {
      e.preventDefault()
      selectImage(target as HTMLImageElement)
      isDragging.current = true
      dragType.current = 'image'
      const img = selectedImgRef.current || (target as HTMLImageElement)
      const off = getManualOffset(img)
      dragStartPos.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
      img.classList.add('dragging')
      startPointerTracking(handleGlobalMouseMove, handleGlobalMouseUp)
      return
    }

    if (target.classList.contains('textbox-handle')) {
      e.preventDefault()
      const tb = target.closest('.rich-textbox') as HTMLDivElement
      if (tb) {
        selectTextbox(tb)
        isDragging.current = true
        dragType.current = 'textbox'
        const off = getManualOffset(tb)
        dragStartPos.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
        tb.classList.add('dragging')
        startPointerTracking(handleGlobalMouseMove, handleGlobalMouseUp)
      }
      return
    }

    const tbParent = target.closest('.rich-textbox') as HTMLDivElement | null
    if (tbParent && tbParent.classList.contains('rich-textbox')) {
      if (target.classList.contains('textbox-handle')) return
      selectTextbox(tbParent)
      return
    }

    if (!imgToolbarRef.current?.contains(target) && !tbToolbarRef.current?.contains(target)) {
      deselectImage()
      deselectTextbox()
    }
  }

  // ─── DESFAZER / REFAZER (histórico próprio — ver editorHistory.ts) ───
  // Cobre todas as ações do editor (imagens, caixas, cor do papel, limpar),
  // e não apenas a digitação como o desfazer nativo do navegador.
  const applyHistory = (html: string | null) => {
    if (html === null || !editorRef.current) return
    const { paper, inner } = splitPaper(html)
    paperRef.current = paper
    editorRef.current.style.backgroundColor = paper
    editorRef.current.innerHTML = inner
    deselectImage()
    deselectTextbox()
    triggerChange()
  }

  const currentHtml = (): string =>
    editorRef.current ? snapshotEditor(editorRef.current, paperRef.current) : ''

  const handleUndo = () => {
    applyHistory(history.undo(currentHtml))
    editorRef.current?.focus()
  }

  const handleRedo = () => {
    applyHistory(history.redo(currentHtml))
    editorRef.current?.focus()
  }

  const enforcePhysicalHeightOnInput = () => {
    const editor = editorRef.current
    if (!truncateOnOverflow || !editor) return false
    return truncateEditableToFit(editor)
  }

  const applyPendingStyleToFragment = (
    fragment: DocumentFragment,
    style: PendingTypingStyle,
  ): HTMLSpanElement | null => {
    fragment.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
      if (style.fontSize) element.style.removeProperty('font-size')
      if (style.color) element.style.removeProperty('color')
      if (style.fontFamily) element.style.removeProperty('font-family')
      if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
    })

    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text
      if (textNode.textContent) textNodes.push(textNode)
    }

    let lastStyledSpan: HTMLSpanElement | null = null
    textNodes.forEach((textNode) => {
      const span = document.createElement('span')
      if (style.fontSize) span.style.fontSize = style.fontSize
      if (style.color) span.style.color = style.color
      if (style.fontFamily) span.style.fontFamily = style.fontFamily
      textNode.parentNode?.replaceChild(span, textNode)
      span.appendChild(textNode)
      lastStyledSpan = span
    })
    return lastStyledSpan
  }

  const handleEditorBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (selectionPreviewRef.current) restoreSelectionPreview()
    const inputEvent = e.nativeEvent as InputEvent
    if (
      !['insertText', 'insertCompositionText'].includes(inputEvent.inputType) ||
      inputEvent.data === null
    ) {
      return
    }

    const style = pendingTypingStyleRef.current
    if (!style.fontSize && !style.color && !style.fontFamily) return
    const editor = editorRef.current
    if (!editor) return
    const range = getCurrentEditorRange(editor)
    if (!range?.collapsed) return

    e.preventDefault()
    restoreEditorRange(editor, range)
    const span = document.createElement('span')
    if (style.fontSize) span.style.fontSize = style.fontSize
    if (style.color) span.style.color = style.color
    if (style.fontFamily) span.style.fontFamily = style.fontFamily
    const textNode = document.createTextNode(inputEvent.data)
    span.appendChild(textNode)
    range.insertNode(span)

    const caret = document.createRange()
    caret.setStart(textNode, textNode.length)
    caret.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(caret)
    savedRangeRef.current = caret.cloneRange()
    pendingTypingStyleRef.current = {}
    enforcePhysicalHeightOnInput()
    triggerChange()
  }

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (selectionPreviewRef.current) restoreSelectionPreview()
    const editor = editorRef.current
    if (!editor) return

    const clipboardHtml = e.clipboardData.getData('text/html')
    const clipboardText = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
    const pastedText = singleLineBreaks ? clipboardText.replace(/\n{2,}/g, '\n') : clipboardText
    const richHtml = sanitizeRichPaste(clipboardHtml, fontFamilies)
    const hasRichText = Boolean(richHtml.replace(/<[^>]*>/g, '').trim())
    const pastedFontSizePt = clipboardFontSizePoints(clipboardHtml)
    const pastedFontFamily = clipboardFontFamily(clipboardHtml, fontFamilies)
    const safeHtml = pastedText
      .split('\n')
      .map((line) =>
        line.replace(
          /[&<>"']/g,
          (char) =>
            ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            })[char]!,
        ),
      )
      .join('<br>')
    const pastedStyles = [
      pastedFontSizePt ? `font-size:${pastedFontSizePt}pt` : '',
      pastedFontFamily ? `font-family:${pastedFontFamily}` : '',
    ].filter(Boolean)
    const formattedPlainText = pastedStyles.length
      ? `<span style="${pastedStyles.join(';')}">${safeHtml}</span>`
      : safeHtml
    const htmlToInsert = hasRichText ? richHtml : formattedPlainText

    // Deixa colagens que não sejam texto (como imagem copiada) seguirem o
    // comportamento nativo do navegador.
    if (!htmlToInsert && !clipboardText) return
    e.preventDefault()

    const selection = window.getSelection()
    let range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    if (!range || !isRangeWithinEditor(editor, range)) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }

    range.deleteContents()
    const template = document.createElement('template')
    template.innerHTML = htmlToInsert
    const fragment = template.content
    const pendingStyle = pendingTypingStyleRef.current
    const hasPendingStyle = Boolean(
      pendingStyle.fontSize || pendingStyle.color || pendingStyle.fontFamily,
    )
    const lastStyledSpan = hasPendingStyle
      ? applyPendingStyleToFragment(fragment, pendingStyle)
      : null
    const lastInsertedNode = fragment.lastChild
    range.insertNode(fragment)
    if (lastStyledSpan?.lastChild) {
      range.setStart(lastStyledSpan.lastChild, lastStyledSpan.lastChild.textContent?.length ?? 0)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRangeRef.current = range.cloneRange()
      pendingTypingStyleRef.current = {}
    } else if (lastInsertedNode) {
      range.setStartAfter(lastInsertedNode)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRangeRef.current = range.cloneRange()
    }
    editor.focus()
    if (pastedFontSizePt && !pendingStyle.fontSize) {
      setCurrentFontSize(closestFontSizeOption(pastedFontSizePt, fontSizeOptions))
    }
    if (pastedFontFamily && !pendingStyle.fontFamily) setCurrentFont(pastedFontFamily)
    enforcePhysicalHeightOnInput()
    triggerChange()
  }

  // ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Antes do Enter nativo (parágrafo Word), impeça a nova linha se ela
    // ultrapassaria a caixa física; não apague texto e mostre o aviso.
    if (truncateOnOverflow && e.key === 'Enter' && editorRef.current) {
      const editor = editorRef.current
      const selection = window.getSelection()
      const caretNode = selection?.anchorNode
      const caretElement = caretNode instanceof HTMLElement ? caretNode : caretNode?.parentElement
      const computed = window.getComputedStyle(caretElement ?? editor)
      const lineHeight =
        computed.lineHeight === 'normal'
          ? parseFloat(computed.fontSize) * 1.6
          : parseFloat(computed.lineHeight)
      if (
        editorContentExceedsHeight(editor) ||
        measureEditorContentHeight(editor) + lineHeight > editor.clientHeight + 1
      ) {
        e.preventDefault()
        onOverflowChange?.(true)
        return
      }
    }
    // Tab: insere espaços dentro do editor
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
      enforcePhysicalHeightOnInput()
      triggerChange()
      return
    }
    // Desfazer / refazer próprios: Ctrl+Z, Ctrl+Y e Ctrl+Shift+Z
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const tecla = e.key.toLowerCase()
      if (tecla === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
        e.preventDefault()
        handleRedo()
        return
      }
    }
    // Apaga a imagem selecionada (Delete/Backspace)
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImgRef.current) {
      e.preventDefault()
      deleteSelectedImage()
      return
    }
    const alvoMov = (
      selectionType === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    const setas = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    // Setas + Ctrl: deslocamento fino livre (1px; 10px com Shift) —
    // a imagem ou caixa de texto move por cima do texto
    if (e.ctrlKey && !e.altKey && alvoMov && setas.includes(e.key)) {
      e.preventDefault()
      const passo = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0
      const dy = e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0
      nudgeElement(alvoMov, dx, dy)
      if (selectionType === 'image') updateToolbarPosition(alvoMov as HTMLImageElement)
      else updateTextboxToolbarPosition(alvoMov as HTMLDivElement)
      updateResizeHandlePosition(alvoMov)
      triggerChange()
      return
    }
    // Setas + Alt: move no fluxo do conteúdo (↑/↓) ou flutua para os lados (←/→)
    if (e.altKey && alvoMov && setas.includes(e.key)) {
      e.preventDefault()
      if (e.key === 'ArrowUp') moveElementInFlow(alvoMov, -1)
      else if (e.key === 'ArrowDown') moveElementInFlow(alvoMov, 1)
      else setFloatSide(alvoMov, e.key === 'ArrowLeft' ? 'left' : 'right')
      if (selectionType === 'image') updateToolbarPosition(alvoMov as HTMLImageElement)
      else updateTextboxToolbarPosition(alvoMov as HTMLDivElement)
      updateResizeHandlePosition(alvoMov)
      triggerChange()
    }
  }

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      selectImage(target as HTMLImageElement)
    } else if (target.classList.contains('textbox-handle')) {
      // handled by mousedown
    } else if (target.closest('.rich-textbox')) {
      const tb = target.closest('.rich-textbox') as HTMLDivElement
      selectTextbox(tb)
    } else if (
      !imgToolbarRef.current?.contains(target) &&
      !tbToolbarRef.current?.contains(target)
    ) {
      deselectImage()
      deselectTextbox()
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────
  const rootStyle = {
    '--ve-accent': accentColor,
    ...(headingFontFamily ? { '--ve-heading-font': headingFontFamily } : {}),
  } as React.CSSProperties
  const innerW = width - frameOpts.width * 2
  const innerH = height - frameOpts.width * 2
  const textboxClass = isTextboxSelected ? undefined : 've-disabled'

  return (
    <div className="ve-root" style={rootStyle}>
      {/* ═══ FORMATTING TOOLBAR ═══ */}
      <div
        className="ve-toolbar"
        role="toolbar"
        aria-label={L.toolbar}
        style={{
          // Barra centralizada sobre o bloco de edição (pode ser mais larga que ele)
          width: toolbarWidth,
          marginLeft: -(toolbarWidth - width) / 2,
        }}
      >
        {showFileButtons && (
          <>
            <ToolbarBtn onClick={handleSaveToFile} title={L.saveFile}>
              <IconSave />
            </ToolbarBtn>
            <ToolbarBtn onClick={handleOpenFile} title={L.openFile}>
              <IconOpen />
            </ToolbarBtn>
            <ToolbarSep />
          </>
        )}
        <ToolbarBtn onClick={handleUndo} title={L.undo}>
          <IconUndo />
        </ToolbarBtn>
        <ToolbarBtn onClick={handleRedo} title={L.redo}>
          <IconRedo />
        </ToolbarBtn>
        <ToolbarSep />
        <div className="ve-font-picker" ref={fontMenuRef}>
          <button
            type="button"
            className="ve-select ve-font-button"
            title={L.fontFamily}
            aria-label={L.fontFamily}
            aria-haspopup="listbox"
            aria-expanded={fontMenuOpen}
            onMouseDown={(e) => {
              e.preventDefault()
              saveSelection()
            }}
            onClick={() => {
              if (fontMenuOpen) {
                setFontMenuOpen(false)
                restoreSelectionPreview()
              } else {
                setFontMenuOpen(true)
              }
            }}
          >
            <span>
              {fontFamilies.find((font) => font.value === currentFont)?.label ?? L.fontFallback}
            </span>
            <span aria-hidden="true">▾</span>
          </button>
          {fontMenuOpen && (
            <div
              className="ve-font-options"
              role="listbox"
              aria-label={L.fontFamily}
              onMouseLeave={restoreSelectionPreview}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFontMenuOpen(false)
                  restoreSelectionPreview()
                }
              }}
            >
              {fontFamilies.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  className="ve-font-option"
                  role="option"
                  aria-selected={currentFont === font.value}
                  style={{ fontFamily: font.value }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    saveSelection()
                  }}
                  onMouseEnter={() => previewSelectionStyle('fontFamily', font.value)}
                  onClick={() => chooseFontFamily(font.value)}
                >
                  {font.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          className="ve-select"
          value={currentFontSize}
          onMouseDown={saveSelection}
          onChange={handleFontSizeChange}
          title={L.fontSize}
          aria-label={L.fontSize}
        >
          {fontSizeOptions.map((pt) => (
            <option key={pt} value={String(pt)}>
              {pt} pt
            </option>
          ))}
        </select>
        <ToolbarSep />
        {HEADING_BLOCKS.map((h) => (
          <ToolbarBtn key={h.tag} onClick={() => handleHeadingChange(h.tag)} title={L[h.label]}>
            {h.tag === 'p' ? '¶' : h.tag === 'blockquote' ? '❝' : h.tag.toUpperCase()}
          </ToolbarBtn>
        ))}
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('bold')} title={L.bold}>
          <IconBold />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('italic')} title={L.italic}>
          <IconItalic />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('underline')} title={L.underline}>
          <IconUnderline />
        </ToolbarBtn>
        <div className="ve-highlight-wrap">
          <ToolbarBtn
            onClick={() => setHighlightPalette(highlightPalette ? null : true)}
            title={L.highlight}
          >
            <span className="ve-highlight-sample">S</span>
          </ToolbarBtn>
          {highlightPalette && (
            <div className="ve-highlight-palette">
              {highlightColors.map((c) => {
                const title = c === 'transparent' ? L.highlightNone : c
                return (
                  <button
                    key={c}
                    type="button"
                    className="ve-highlight-swatch"
                    style={{ background: c === 'transparent' ? '#fff' : c }}
                    // Mantém a seleção do texto ao clicar na cor
                    onMouseDown={(e) => {
                      e.preventDefault()
                      saveSelection()
                    }}
                    onClick={() => {
                      const editor = editorRef.current
                      const range = editor ? getCurrentEditorRange(editor) : null
                      if (editor && range && !range.collapsed) {
                        restoreEditorRange(editor, range)
                        document.execCommand('styleWithCSS', false, 'true')
                        document.execCommand('hiliteColor', false, c)
                        triggerChange()
                      }
                      setHighlightPalette(null)
                      editor?.focus()
                    }}
                    title={title}
                    aria-label={title}
                  >
                    {c === 'transparent' && '✕'}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <ToolbarBtn
          onClick={() => {
            // Remove a cor de fundo do texto selecionado
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
              document.execCommand('hiliteColor', false, 'transparent')
              triggerChange()
            }
            editorRef.current?.focus()
          }}
          title={L.removeHighlight}
        >
          <span className="ve-highlight-remove">S</span>
        </ToolbarBtn>
        <ToolbarSep />
        <div ref={colorPanelRef} className="ve-inline">
          {renderColorPicker('text')}
          {renderColorPicker('bg')}
        </div>
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('justifyLeft')} title={L.alignLeft}>
          <IconAlignLeft />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('justifyCenter')} title={L.alignCenter}>
          <IconAlignCenter />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('justifyRight')} title={L.alignRight}>
          <IconAlignRight />
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('insertUnorderedList')} title={L.bulletList}>
          <IconBulletList />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('insertOrderedList')} title={L.numberedList}>
          <span style={{ fontWeight: 600 }}>1.</span>
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('indent')} title={L.indent}>
          <IconIndent />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('outdent')} title={L.outdent}>
          <IconOutdent />
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={handleInsertLink} title={L.insertLink}>
          <IconLink />
        </ToolbarBtn>
        <ToolbarBtn onClick={handleRemoveLink} title={L.removeLink}>
          <IconUnlink />
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={handleInsertHR} title={L.insertHr}>
          <IconHr />
        </ToolbarBtn>
        <ToolbarBtn onClick={handleInsertImage} title={L.insertImage}>
          <IconImage />
        </ToolbarBtn>
        {/* Todas as funções de caixa de texto reunidas em um único grupo */}
        <div className="ve-group" role="group" aria-label={L.textboxTools} title={L.textboxTools}>
          <ToolbarBtn onClick={handleInsertTextBox} title={L.insertTextbox}>
            <IconTextbox />
          </ToolbarBtn>
          <div className={`ve-color-picker ${textboxClass ?? ''}`.trim()}>
            <ToolbarBtn
              onClick={() => isTextboxSelected && tbBorderColorInputRef.current?.click()}
              title={L.textboxBorderColor}
            >
              <IconBorderColor />
              <span className="ve-color-indicator" style={{ backgroundColor: tbBorderColor }} />
            </ToolbarBtn>
            <input
              ref={tbBorderColorInputRef}
              type="color"
              tabIndex={-1}
              aria-label={L.textboxBorderColor}
              value={tbBorderColor}
              onChange={(e) => applyTbBorderColor(e.target.value)}
            />
          </div>
          <select
            className="ve-select"
            value={tbBorderWidth}
            onChange={(e) => applyTbBorderWidth(e.target.value)}
            title={L.textboxBorderWidth}
            aria-label={L.textboxBorderWidth}
            disabled={!isTextboxSelected}
          >
            <option value="0">{L.borderNone}</option>
            {TB_BORDER_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {format(L.borderPx, { n: w })}
              </option>
            ))}
          </select>
          <select
            className="ve-select"
            value={tbBorderStyle}
            onChange={(e) => applyTbBorderStyle(e.target.value as TbBorderStyle)}
            title={L.textboxBorderStyle}
            aria-label={L.textboxBorderStyle}
            disabled={!isTextboxSelected}
          >
            {TB_BORDER_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {L[s.label]}
              </option>
            ))}
          </select>
          <ToolbarBtn onClick={deleteSelectedTextbox} title={L.deleteTextbox}>
            <IconTrash />
          </ToolbarBtn>
        </div>
        <ToolbarSep />
        <ToolbarBtn onClick={handleClearAll} title={L.clearAll}>
          <IconTrash /> {L.clearAllButton}
        </ToolbarBtn>
        <ToolbarBtn onClick={handleClearFormatting} title={L.clearFormatting}>
          <IconClearFormat />
        </ToolbarBtn>
      </div>

      {/* ═══ CONTENT EDITOR — largura, altura e moldura configuráveis ═══ */}
      <div
        className="ve-frame"
        style={{
          width,
          border: frameOpts.width ? `${frameOpts.width}px solid ${frameOpts.color}` : 'none',
          borderRadius: frameOpts.radius,
        }}
      >
        <div
          ref={editorRef}
          contentEditable
          draggable={false}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          className={`ve-content ${contentClassName}`.trim()}
          data-placeholder={placeholder ?? L.placeholder}
          style={{
            width: innerW,
            height: innerH,
            borderRadius: Math.max(0, frameOpts.radius - frameOpts.width),
            fontFamily,
            ...contentStyle,
          }}
          onMouseDown={handleEditorMouseDown}
          onDragStart={(e) => e.preventDefault()}
          onKeyDown={handleKeyDown}
          onBeforeInput={handleEditorBeforeInput}
          onPaste={handleEditorPaste}
          onClick={handleEditorClick}
          onBlur={() => {
            if (selectionPreviewRef.current) restoreSelectionPreview()
            triggerChange()
          }}
          onInput={() => {
            enforcePhysicalHeightOnInput()
            triggerChange()
          }}
        />

        {/* ═══ IMAGE TOOLBAR ═══ */}
        {imgToolbarVisible && selectionType === 'image' && (
          <div
            ref={imgToolbarRef}
            className="ve-float-toolbar"
            // Não rouba o foco do editor ao usar os botões flutuantes
            onMouseDown={(e) => e.preventDefault()}
            style={{ top: imgToolbarPos.top, left: imgToolbarPos.left }}
          >
            {RESIZE_STEPS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => resizeSelectedImage(pct)}
                title={`${pct}%`}
              >
                {pct}%
              </button>
            ))}
            <div className="ve-float-sep" />
            <button type="button" onClick={() => floatImage('left')} title={L.alignLeft}>
              ⬅ {L.left}
            </button>
            <button type="button" onClick={() => floatImage('right')} title={L.alignRight}>
              {L.right} ➡
            </button>
            <button type="button" onClick={() => floatImage('none')} title={L.alignCenter}>
              ⬛ {L.center}
            </button>
            <div className="ve-float-sep" />
            <button
              type="button"
              className="ve-danger"
              onClick={deleteSelectedImage}
              title={L.deleteImage}
            >
              <IconTrash /> {L.deleteButton}
            </button>
          </div>
        )}

        {/* ═══ TEXT BOX TOOLBAR ═══ */}
        {tbToolbarVisible && selectionType === 'textbox' && (
          <div
            ref={tbToolbarRef}
            className="ve-float-toolbar"
            // Não rouba o foco do editor ao usar os botões flutuantes
            onMouseDown={(e) => e.preventDefault()}
            style={{ top: tbToolbarPos.top, left: tbToolbarPos.left }}
          >
            {RESIZE_STEPS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => resizeSelectedTextbox(pct)}
                title={`${pct}%`}
              >
                {pct}%
              </button>
            ))}
            <div className="ve-float-sep" />
            <button type="button" onClick={() => alignSelectedTextbox('left')} title={L.alignLeft}>
              ⬅ {L.left}
            </button>
            <button
              type="button"
              onClick={() => alignSelectedTextbox('center')}
              title={L.alignCenter}
            >
              ☰ {L.center}
            </button>
            <button
              type="button"
              onClick={() => alignSelectedTextbox('right')}
              title={L.alignRight}
            >
              {L.right} ➡
            </button>
            <div className="ve-float-sep" />
            <button
              type="button"
              className="ve-danger"
              onClick={deleteSelectedTextbox}
              title={L.deleteTextbox}
            >
              <IconTrash /> {L.deleteButton}
            </button>
          </div>
        )}

        {/* ═══ FREE RESIZE HANDLE ═══ */}
        {selectionType && resizeHandlePos && (
          <div
            className="ve-resize-handle"
            title={L.resizeFree}
            style={{ top: resizeHandlePos.top, left: resizeHandlePos.left }}
            onMouseDown={startFreeResize}
          />
        )}
      </div>
    </div>
  )
}

export default VersaEdit
