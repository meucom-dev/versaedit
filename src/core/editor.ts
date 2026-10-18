// ============================================================
// VersaEditCore — núcleo do editor, sem dependência de framework.
// Recebe o elemento contenteditable e cuida de: carregar e serializar o
// conteúdo, histórico, seleção, formatação, colagem, imagens e caixas de
// texto, arquivo .html e limite de altura. A interface (barra de ferramentas,
// menus) fica com quem usa o núcleo e conversa com ele pelos callbacks.
// ============================================================
import {
  exec,
  HR_HTML,
  imageHtml,
  insertHtml,
  linkHtml,
  normalizeLinkUrl,
  TAB_HTML,
  textboxHtml,
  unwrapListsFromParagraphs,
} from './commands'
import { DEFAULT_FONT_FAMILIES, DEFAULT_FONT_SIZES, type FontFamilyOption } from './defaults'
import {
  buildHtmlPage,
  downloadHtml,
  htmlFileName,
  isHtmlFile,
  MAX_OPEN_FILE_BYTES,
  pickFile,
  serializeEditorContent,
  snapshotEditor,
  splitPaper,
} from './file'
import { closestFontSizeOption, matchFontFamily } from './fonts'
import { createEditorHistory } from './history'
import { resolveLabels, type VersaEditLabels, type VersaEditLocale } from './i18n'
import {
  editorContentExceedsHeight,
  measureEditorContentHeight,
  truncateEditableToFit,
} from './measure'
import {
  createPointerTracker,
  dropElementAtPoint,
  getManualOffset,
  moveElementInFlow,
  nudgeElement,
  resizeHandlePosition,
  setFloatSide,
  setImagePosition,
  toolbarPosition,
  type PointerListener,
  type TbBorderStyle,
} from './objects'
import { suspendMedia, suspendMediaInHtml } from './media'
import { applyPendingStyleToFragment, buildPasteHtml } from './paste'
import { applyVoiceCommands, formatDictatedText } from './speech'
import { isSafeUrl, safeCssColor, sanitizeHtml } from './sanitize'
import {
  isRangeWithinEditor,
  setPreviewWrapperStyle,
  type PendingTypingStyle,
  type SelectionPreview,
  type SelectionType,
} from './selection'

export type { SelectionType, TbBorderStyle }

export interface Point {
  top: number
  left: number
}

/** Objeto selecionado (imagem ou caixa de texto) e onde ficam seu menu e sua alça */
export interface ObjectState {
  type: 'image' | 'textbox'
  toolbar: Point
  handle: Point | null
}

/** Estilo na posição do cursor, para os indicadores da barra */
export interface SelectionStyle {
  fontFamily?: string
  /** Opção do menu de tamanhos (em pontos) */
  fontSize?: string
  textColor?: string
  paperColor?: string
}

export interface TextboxBorder {
  color: string
  width: string
  style: TbBorderStyle
}

export interface CoreOptions {
  truncateOnOverflow: boolean
  singleLineBreaks: boolean
  fontFamilies: FontFamilyOption[]
  fontSizes: number[]
  locale: VersaEditLocale
  labels: VersaEditLabels
  /** Cor da borda das caixas de texto sem cor definida */
  accentColor: string
  /** Colagem: mantém imagens (endereço validado). Ver a prop pasteImages */
  pasteImages: boolean
  /** Deixa áudio e vídeo externos carregarem dentro do editor. Ver a prop */
  allowExternalMedia: boolean
}

export interface CoreCallbacks {
  onChange?: (html: string) => void
  onOverflowChange?: (isOverflowing: boolean) => void
  /** Salvar: recebe o HTML no lugar de baixar o arquivo */
  onSave?: (html: string) => void
  onSelectionStyle?: (style: SelectionStyle) => void
  onObjectChange?: (state: ObjectState | null) => void
  onTextboxSelect?: (border: TextboxBorder) => void
  /**
   * Envio de imagem: recebe o arquivo escolhido e devolve a URL publicada.
   * Sem ele, a imagem é gravada no conteúdo em base64.
   */
  onImageUpload?: (file: File) => Promise<string>
  /** Pedido de link pelo teclado (Ctrl+K): a interface abre o formulário de link */
  onLinkRequest?: () => void
}

/** Dados para o formulário de link */
export interface LinkDraft {
  /** Texto selecionado (ou o texto do link existente) */
  text: string
  /** Endereço do link existente sob o cursor, se houver */
  url: string
}

const DEFAULT_OPTIONS: CoreOptions = {
  truncateOnOverflow: false,
  singleLineBreaks: false,
  fontFamilies: DEFAULT_FONT_FAMILIES,
  fontSizes: DEFAULT_FONT_SIZES,
  locale: 'en',
  labels: resolveLabels('en'),
  accentColor: '#2563eb',
  pasteImages: true,
  allowExternalMedia: false,
}

const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')

export class VersaEditCore {
  readonly el: HTMLDivElement
  private opts: CoreOptions
  private cb: CoreCallbacks

  // Conteúdo
  private paper = ''
  // Último HTML enviado pelo onChange — identifica quando o conteúdo recebido é
  // apenas o eco do próprio editor (modo controlado)
  private lastEmitted: string | null = null
  // Último conteúdo conhecido (emitido ou carregado): onChange só dispara quando
  // o HTML for diferente dele
  private lastKnown: string | null = null
  private readonly history = createEditorHistory()
  private observer: MutationObserver | null = null

  // Seleção de texto
  private savedRange: Range | null = null
  private pendingStyle: PendingTypingStyle = {}
  private preview: SelectionPreview | null = null

  // Imagem ou caixa de texto selecionada
  private selectedImg: HTMLImageElement | null = null
  private selectedTextbox: HTMLDivElement | null = null
  private objType: SelectionType = null
  private toolbarPos: Point = { top: 0, left: 0 }
  private handlePos: Point | null = null

  // Arrasto e redimensionamento livre
  private isDragging = false
  private dragStart = { x: 0, y: 0, ox: 0, oy: 0 }
  private dragType: 'image' | 'textbox' | null = null
  private isResizing = false
  private resizeEl: HTMLElement | null = null
  private resizeStart = { x: 0, y: 0, w: 0, h: 0 }
  private readonly pointer = createPointerTracker()

  // Seleção guardada enquanto o formulário de link está aberto
  private linkRange: Range | null = null

  constructor(
    el: HTMLDivElement,
    options: Partial<CoreOptions> = {},
    callbacks: CoreCallbacks = {},
  ) {
    this.el = el
    this.opts = { ...DEFAULT_OPTIONS, ...options }
    this.cb = callbacks
    // Registra no histórico toda alteração do editor (texto, formatação, imagens,
    // caixas e cor do papel), agrupando a digitação
    this.observer = new MutationObserver(() => {
      if (this.preview) return
      this.history.schedule(() => snapshotEditor(this.el, this.paper))
    })
    this.observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })
    document.addEventListener('selectionchange', this.handleSelectionChange)
    for (const [type, listener] of this.listeners) el.addEventListener(type, listener)
  }

  // Eventos nativos da área de edição (o núcleo não depende de framework)
  private readonly listeners: [string, EventListener][] = [
    ['pointerdown', (e) => this.handlePointerDown(e as PointerEvent)],
    ['mousedown', (e) => this.handleMouseDown(e as MouseEvent)],
    ['click', (e) => this.handleClick(e as MouseEvent)],
    ['keydown', (e) => this.handleKeyDown(e as KeyboardEvent)],
    ['beforeinput', (e) => this.handleBeforeInput(e as InputEvent)],
    ['paste', (e) => this.handlePaste(e as ClipboardEvent)],
    ['input', () => this.handleInput()],
    ['focusout', () => this.handleBlur()],
    ['dragstart', (e) => e.preventDefault()],
  ]

  /** Remove ouvintes e temporizadores (ao desmontar o editor) */
  destroy(): void {
    this.observer?.disconnect()
    this.observer = null
    this.history.dispose()
    this.pointer.stop()
    document.removeEventListener('selectionchange', this.handleSelectionChange)
    for (const [type, listener] of this.listeners) this.el.removeEventListener(type, listener)
  }

  setOptions(options: Partial<CoreOptions>): void {
    this.opts = { ...this.opts, ...options }
  }

  setCallbacks(callbacks: CoreCallbacks): void {
    this.cb = callbacks
  }

  get selectionType(): SelectionType {
    return this.objType
  }

  // ─── CONTEÚDO ────────────────────────────────────────────────────
  /** HTML atual (com a cor do papel, quando definida) */
  getHTML(): string {
    return serializeEditorContent(this.el, this.paper)
  }

  /**
   * Carrega conteúdo vindo de fora. O eco do próprio onChange é ignorado
   * (preserva cursor, seleção e histórico).
   */
  load(html: string): void {
    const editor = this.el
    if (html === this.lastEmitted) {
      this.cb.onOverflowChange?.(editorContentExceedsHeight(editor))
      return
    }

    // Mudança EXTERNA (carregamento do banco ou troca de item): sanitiza
    // (remove estilos inline estranhos e código inseguro) e reinicia o histórico
    this.lastEmitted = null
    const { paper, inner } = splitPaper(html)
    const cleanInner = this.prepareMedia(sanitizeHtml(inner))
    this.paper = paper
    editor.style.backgroundColor = paper
    if (cleanInner !== editor.innerHTML) {
      editor.innerHTML = cleanInner
    }
    this.suspendExternalMedia()
    const wasTruncated = this.opts.truncateOnOverflow && truncateEditableToFit(editor)
    this.lastKnown = serializeEditorContent(editor, paper)
    this.history.reset(snapshotEditor(editor, paper))
    this.cb.onOverflowChange?.(editorContentExceedsHeight(editor))
    if (wasTruncated && this.cb.onChange) {
      const out = serializeEditorContent(editor, paper)
      this.lastEmitted = out
      // Corte na carga: o conteúdo mudou em relação ao recebido e precisa ser avisado
      this.cb.onChange(out)
    }
  }

  // Áudio e vídeo externos não carregam no editor (o HTML entregue continua
  // igual). prepareMedia age no HTML antes de ele entrar na página; o
  // suspendExternalMedia é a segunda verificação, já no editor.
  private prepareMedia(html: string): string {
    return this.opts.allowExternalMedia ? html : suspendMediaInHtml(html)
  }

  private suspendExternalMedia(): void {
    if (!this.opts.allowExternalMedia) suspendMedia(this.el)
  }

  /** Troca o conteúdo (como um carregamento externo: reinicia o histórico) */
  setHTML = (html: string): void => {
    this.lastEmitted = null
    this.load(html)
  }

  /**
   * Avisa a mudança: atualiza o estado de altura e chama onChange — só quando o
   * HTML for diferente do último conhecido (perder o foco, por exemplo, não
   * gera aviso se nada mudou).
   */
  emitChange = (): void => {
    if (this.cb.onOverflowChange) this.cb.onOverflowChange(editorContentExceedsHeight(this.el))
    if (this.cb.onChange) {
      const html = this.getHTML()
      if (html === this.lastKnown) return
      this.lastKnown = html
      this.lastEmitted = html
      this.cb.onChange(html)
    }
  }

  focus(): void {
    this.el.focus()
  }

  // Cor do papel: colore a superfície do editor, sem afetar o texto
  setPaper = (color: string): void => {
    const paper = safeCssColor(color)
    this.paper = paper
    this.el.style.backgroundColor = paper
    this.emitChange()
  }

  // ─── OBJETO SELECIONADO (estado para a interface) ───────────────
  private emitObject(): void {
    this.cb.onObjectChange?.(
      this.objType
        ? { type: this.objType, toolbar: this.toolbarPos, handle: this.handlePos }
        : null,
    )
  }

  private setObjType(type: SelectionType): void {
    this.objType = type
    if (!type) this.handlePos = null
    this.emitObject()
  }

  private updateToolbarPosition(el: HTMLElement): void {
    this.toolbarPos = toolbarPosition(el, this.el)
    this.emitObject()
  }

  private updateResizeHandlePosition(el: HTMLElement): void {
    this.handlePos = resizeHandlePosition(el, this.el)
    this.emitObject()
  }

  // As buscas ficam restritas a este editor: outros editores da mesma tela
  // mantêm suas próprias seleções
  deselectImage = (): void => {
    this.el.querySelectorAll('img.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    this.selectedImg = null
    this.setObjType(null)
  }

  deselectTextbox = (): void => {
    this.el.querySelectorAll('.rich-textbox.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    this.selectedTextbox = null
    this.setObjType(null)
  }

  // ─── SELEÇÃO DE TEXTO ────────────────────────────────────────────
  // Atualiza os indicadores de fonte, tamanho e cor conforme a seleção
  private handleSelectionChange = (): void => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    if (this.preview) return
    const editor = this.el
    const range = sel.getRangeAt(0)
    if (!isRangeWithinEditor(editor, range)) return
    this.savedRange = range.cloneRange()
    if (!range.collapsed) this.pendingStyle = {}
    // Usa o nó de início da seleção (funciona tanto com seleção quanto com cursor)
    const node = range.startContainer
    const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement)
    if (!el) return
    const computed = window.getComputedStyle(el)
    const style: SelectionStyle = {}
    // CSS pixels → pontos tipográficos (mesma unidade e escala do Word)
    const sizePx = parseFloat(computed.fontSize)
    if (Number.isFinite(sizePx)) {
      style.fontSize = closestFontSizeOption((sizePx * 72) / 96, this.opts.fontSizes)
    }
    const rgb = computed.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (rgb) style.textColor = `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`.toUpperCase()
    const match = matchFontFamily(computed.fontFamily, this.opts.fontFamilies)
    if (match) style.fontFamily = match.value
    this.cb.onSelectionStyle?.(style)
  }

  private getCurrentRange(): Range | null {
    const editor = this.el
    const selection = window.getSelection()
    const currentRange = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (currentRange && isRangeWithinEditor(editor, currentRange)) return currentRange.cloneRange()
    const savedRange = this.savedRange
    return savedRange && isRangeWithinEditor(editor, savedRange) ? savedRange.cloneRange() : null
  }

  private restoreRange(range: Range): void {
    this.el.focus()
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    this.savedRange = range.cloneRange()
  }

  /** Guarda a seleção de texto antes de o foco sair do editor (clique na barra) */
  saveSelection = (): void => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (isRangeWithinEditor(this.el, range)) {
        this.savedRange = range.cloneRange()
        if (!range.collapsed) this.pendingStyle = {}
      }
    }
  }

  /** Desfaz a pré-visualização de fonte/cor e devolve a seleção original */
  restorePreview = (): void => {
    const preview = this.preview
    if (!preview) return
    const parent = preview.wrapper.parentNode
    if (!parent) {
      this.preview = null
      return
    }

    const firstNode = preview.originalNodes[0]
    const lastNode = preview.originalNodes[preview.originalNodes.length - 1]
    preview.originalNodes.forEach((node) => parent.insertBefore(node, preview.wrapper))
    parent.removeChild(preview.wrapper)
    this.preview = null

    if (firstNode && lastNode) {
      const range = document.createRange()
      range.setStartBefore(firstNode)
      range.setEndAfter(lastNode)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      this.savedRange = range.cloneRange()
    }
  }

  /** Mostra a fonte ou a cor no trecho selecionado, sem gravar */
  previewStyle = (property: 'fontFamily' | 'color', value: string): boolean => {
    let preview = this.preview
    if (preview && preview.property !== property) {
      this.restorePreview()
      preview = null
    }

    if (!preview) {
      const range = this.getCurrentRange()
      if (!range || range.collapsed) return false
      this.restoreRange(range)
      const originalFragment = range.extractContents()
      const originalNodes = Array.from(originalFragment.childNodes)
      if (!originalNodes.length) return false

      const wrapper = document.createElement('span')
      wrapper.dataset.editorSelectionPreview = 'true'
      wrapper.append(...originalNodes.map((node) => node.cloneNode(true)))
      range.insertNode(wrapper)
      preview = { wrapper, originalNodes, property }
      this.preview = preview
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
    this.savedRange = range.cloneRange()
    return true
  }

  /** Grava a pré-visualização; false se não havia trecho selecionado */
  commitPreview = (property: 'fontFamily' | 'color', value: string): boolean => {
    if (!this.previewStyle(property, value)) return false
    const preview = this.preview
    if (!preview) return false
    preview.wrapper.removeAttribute('data-editor-selection-preview')
    this.preview = null
    this.pendingStyle = {}
    const range = document.createRange()
    range.selectNodeContents(preview.wrapper)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    this.savedRange = range.cloneRange()
    this.emitChange()
    return true
  }

  // ─── FORMATAÇÃO ──────────────────────────────────────────────────
  execCommand = (command: string, value?: string): void => {
    exec(command, value)
    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
      unwrapListsFromParagraphs(this.el)
    }
    this.el.focus()
    this.emitChange()
  }

  // Inserções (imagem, linha, caixa de texto) entram depois do trecho
  // selecionado, sem apagá-lo
  private collapseSelectionToEnd(): void {
    const selection = window.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    if (!isRangeWithinEditor(this.el, range)) return
    selection.collapseToEnd()
  }

  formatBlock = (tag: string): void => {
    this.execCommand('formatBlock', tag)
  }

  applyFontFamily = (font: string): void => {
    const editor = this.el
    const range = this.getCurrentRange()
    if (!range || range.collapsed) {
      this.pendingStyle = { ...this.pendingStyle, fontFamily: font }
      if (range) this.restoreRange(range)
      else editor.focus()
      return
    }

    this.restoreRange(range)
    exec('styleWithCSS', 'true')
    exec('fontName', font)
    const updatedSelection = window.getSelection()
    if (updatedSelection?.rangeCount) {
      this.savedRange = updatedSelection.getRangeAt(0).cloneRange()
    }
    this.emitChange()
  }

  /** Fonte escolhida no menu: grava a pré-visualização ou aplica direto */
  chooseFontFamily = (font: string): void => {
    if (!this.commitPreview('fontFamily', font)) this.applyFontFamily(font)
  }

  // Tamanho em pontos: aplica à seleção de texto no editor ou, sem seleção,
  // ao conteúdo inteiro da caixa de texto selecionada
  applyFontSizePt = (pt: string): void => {
    const range = this.getCurrentRange()
    if (range?.collapsed) {
      this.pendingStyle = { ...this.pendingStyle, fontSize: `${pt}pt` }
      this.restoreRange(range)
      return
    }

    const selection = window.getSelection()
    if (range && !range.collapsed) {
      this.restoreRange(range)
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
      this.savedRange = next.cloneRange()
    } else if (this.selectedTextbox) {
      this.selectedTextbox.style.fontSize = `${pt}pt`
    }
    this.emitChange()
  }

  // Aplica a cor de imediato à seleção guardada e devolve o foco ao editor.
  // 'hiliteColor' aqui é a cor do papel (fundo do editor), independente do texto.
  applyColor = (command: 'foreColor' | 'hiliteColor', color: string): void => {
    const range = this.getCurrentRange()
    if (command === 'foreColor' && range?.collapsed) {
      this.pendingStyle = { ...this.pendingStyle, color }
      this.restoreRange(range)
      return
    }

    if (range) this.restoreRange(range)
    if (command === 'hiliteColor') {
      this.setPaper(color)
    } else {
      exec('styleWithCSS', 'true')
      exec(command, color)
    }
    // Mantém a seleção atualizada após a mudança no DOM
    const after = window.getSelection()
    if (after && after.rangeCount > 0) this.savedRange = after.getRangeAt(0).cloneRange()
    this.emitChange()
  }

  /** Cor escolhida na paleta do texto: grava a pré-visualização ou aplica */
  pickTextColor = (color: string): void => {
    if (this.commitPreview('color', color)) return
    this.applyColor('foreColor', color)
  }

  // Marca-texto: cor de fundo do trecho selecionado
  applyHighlight = (color: string): void => {
    const range = this.getCurrentRange()
    if (range && !range.collapsed) {
      this.restoreRange(range)
      exec('styleWithCSS', 'true')
      exec('hiliteColor', color)
      this.emitChange()
    }
    this.el.focus()
  }

  // Remove a cor de fundo do texto selecionado
  removeHighlight = (): void => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      exec('hiliteColor', 'transparent')
      this.emitChange()
    }
    this.el.focus()
  }

  clearFormatting = (): void => {
    this.execCommand('removeFormat')
  }

  // ─── INSERÇÕES ───────────────────────────────────────────────────
  insertImage = (): void => {
    pickFile('image/*', (file) => {
      const insert = (src: string) => {
        if (!isSafeUrl('src', src)) return
        this.el.focus()
        this.collapseSelectionToEnd()
        insertHtml(imageHtml(src, this.opts.labels.imageAlt))
        this.emitChange()
      }
      // Com onImageUpload, a imagem é enviada e entra pela URL devolvida
      if (this.cb.onImageUpload) {
        this.cb.onImageUpload(file).then(insert, () => alert(this.opts.labels.imageUploadError))
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => insert(typeof ev.target?.result === 'string' ? ev.target.result : '')
      reader.readAsDataURL(file)
    })
  }

  // ─── DITADO ──────────────────────────────────────────────────────
  /**
   * Insere um trecho ditado no cursor (ou no lugar da seleção): troca os
   * comandos de voz pela pontuação, separa do texto anterior com espaço e põe
   * maiúscula no início de frase.
   */
  insertDictation = (spoken: string): void => {
    const editor = this.el
    let range = this.getCurrentRange()
    if (!range) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    this.restoreRange(range)

    // Texto do bloco atual até o cursor, para decidir espaço e maiúscula
    let block: Node = range.startContainer
    while (block.parentNode && block.parentNode !== editor && block !== editor) {
      block = block.parentNode
    }
    const before = document.createRange()
    before.setStart(block, 0)
    before.setEnd(range.startContainer, range.startOffset)
    const text = formatDictatedText(applyVoiceCommands(spoken, this.opts.locale), before.toString())
    if (!text) return

    for (const piece of text.split(/(\n\n|\n)/)) {
      if (piece === '\n\n') exec('insertParagraph')
      else if (piece === '\n') exec('insertLineBreak')
      else if (piece) exec('insertText', piece)
    }
    const after = window.getSelection()
    if (after?.rangeCount) this.savedRange = after.getRangeAt(0).cloneRange()
    this.enforceHeight()
    this.emitChange()
  }

  // ─── LINK (formulário da interface, sem prompt()) ──────────────
  /** Guarda a seleção e devolve o texto e o endereço para o formulário de link */
  beginLink = (): LinkDraft => {
    const range = this.getCurrentRange()
    this.linkRange = range
    const node = range?.commonAncestorContainer ?? null
    const element = node && (node.nodeType === 3 ? node.parentElement : (node as Element))
    const anchor = element?.closest('a')
    if (range && anchor && this.el.contains(anchor)) {
      // Cursor ou seleção dentro de um link: o formulário edita o link inteiro
      range.selectNode(anchor)
      return { text: anchor.textContent ?? '', url: anchor.getAttribute('href') ?? '' }
    }
    return { text: range?.toString() ?? '', url: '' }
  }

  /** Insere (ou troca) o link na seleção guardada; false se o endereço for inválido */
  applyLink = (typedUrl: string, text: string): boolean => {
    const url = normalizeLinkUrl(typedUrl)
    if (!url) return false
    const range = this.linkRange
    this.linkRange = null
    if (range) this.restoreRange(range)
    else this.el.focus()
    insertHtml(linkHtml(url, text.trim() || url))
    this.emitChange()
    return true
  }

  /** Fecha o formulário de link sem mudar nada e devolve a seleção */
  cancelLink = (): void => {
    const range = this.linkRange
    this.linkRange = null
    if (range) this.restoreRange(range)
    else this.el.focus()
  }

  removeLink = (): void => {
    this.execCommand('unlink')
  }

  insertHorizontalRule = (): void => {
    this.el.focus()
    this.collapseSelectionToEnd()
    insertHtml(HR_HTML)
    this.emitChange()
  }

  // Caixa de texto: entra como bloco depois do parágrafo do cursor. Inserida
  // direto no DOM porque o insertHTML do navegador desmonta o bloco quando o
  // cursor está no meio de um parágrafo.
  insertTextbox = (): void => {
    const L = this.opts.labels
    const editor = this.el
    editor.focus()
    const range = this.getCurrentRange()
    const template = document.createElement('template')
    template.innerHTML = textboxHtml(L.textboxHandle, L.textboxDefault)
    const box = template.content.firstElementChild as HTMLElement
    if (range && range.endContainer === editor) {
      editor.insertBefore(box, editor.childNodes[range.endOffset] ?? null)
    } else if (range) {
      let block: Node = range.endContainer
      while (block.parentNode && block.parentNode !== editor) block = block.parentNode
      if (block.parentNode === editor) (block as ChildNode).after(box)
      else editor.appendChild(box)
    } else {
      editor.appendChild(box)
    }
    // Cursor no fim do texto da caixa
    const caret = document.createRange()
    caret.selectNodeContents(box)
    caret.collapse(false)
    this.restoreRange(caret)
    this.emitChange()
  }

  // Zera a área de edição: apaga todo o conteúdo e volta o papel ao padrão
  clearAll = (): void => {
    this.deselectImage()
    this.deselectTextbox()
    this.el.innerHTML = ''
    this.el.style.backgroundColor = ''
    this.paper = ''
    // Indicadores de cor voltam ao padrão: fundo branco e texto preto
    this.cb.onSelectionStyle?.({ paperColor: '#FFFFFF', textColor: '#000000' })
    this.emitChange()
  }

  // ─── ARQUIVO (.html) ─────────────────────────────────────────────
  // Salvar: entrega o HTML ao onSave ou baixa uma página .html (texto,
  // imagens, layout e cor do papel), que também abre direto no navegador
  saveToFile = (): void => {
    const html = snapshotEditor(this.el, this.paper)
    if (this.cb.onSave) {
      this.cb.onSave(html)
      return
    }
    const L = this.opts.labels
    downloadHtml(buildHtmlPage(html, this.opts.locale, L.fileTitle), htmlFileName(L.fileNamePrefix))
  }

  // Abrir: carrega um arquivo .html no editor, com a mesma limpeza de segurança
  // do carregamento. Pode ser desfeito com Ctrl+Z.
  loadFileContent = (fileHtml: string): void => {
    const L = this.opts.labels
    const editor = this.el
    const body = new DOMParser().parseFromString(fileHtml, 'text/html').body.innerHTML.trim()
    const { paper, inner } = splitPaper(body)
    const cleanInner = sanitizeHtml(inner)
    if (!cleanInner.replace(/<[^>]*>/g, '').trim() && !/<img\b/i.test(cleanInner)) {
      alert(L.fileEmpty)
      return
    }
    this.deselectImage()
    this.deselectTextbox()
    this.paper = paper
    editor.style.backgroundColor = paper
    editor.innerHTML = this.prepareMedia(cleanInner)
    this.suspendExternalMedia()
    if (this.opts.truncateOnOverflow && truncateEditableToFit(editor)) {
      alert(L.fileTruncated)
    }
    editor.focus()
    this.emitChange()
  }

  openFile = (): void => {
    const L = this.opts.labels
    pickFile('.html,.htm,text/html', (file) => {
      if (!isHtmlFile(file)) {
        alert(L.fileWrongType)
        return
      }
      if (file.size > MAX_OPEN_FILE_BYTES) {
        alert(L.fileTooLarge)
        return
      }
      const editor = this.el
      const hasContent = Boolean(editor.textContent?.trim() || editor.querySelector('img'))
      if (hasContent && !confirm(L.fileReplaceConfirm)) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') this.loadFileContent(reader.result)
      }
      reader.onerror = () => alert(L.fileReadError)
      reader.readAsText(file, 'utf-8')
    })
  }

  // ─── CAIXA DE TEXTO ──────────────────────────────────────────────
  private selectTextbox(el: HTMLDivElement): void {
    this.deselectImage()
    this.deselectTextbox()
    // Garante a edição de texto na caixa (digitação, não apenas colagem)
    el.setAttribute('contenteditable', 'true')
    // Sincroniza os controles de borda do menu com o estilo atual da caixa
    const wpx = Math.round(parseFloat(el.style.borderWidth || '0'))
    const styleNow = el.style.borderStyle
    this.cb.onTextboxSelect?.({
      color: el.style.borderColor || this.opts.accentColor,
      width: Number.isFinite(wpx) ? String(wpx) : '1',
      style: styleNow && styleNow !== 'none' ? (styleNow as TbBorderStyle) : 'dashed',
    })
    el.classList.add('selected')
    this.selectedTextbox = el
    this.setObjType('textbox')
    this.updateToolbarPosition(el)
    this.updateResizeHandlePosition(el)
  }

  deleteSelectedTextbox = (): void => {
    if (this.selectedTextbox) {
      this.selectedTextbox.remove()
      this.selectedTextbox = null
      this.setObjType(null)
      this.emitChange()
    }
  }

  resizeSelectedTextbox = (pct: number): void => {
    if (!this.selectedTextbox) return
    const w = `${pct}%`
    this.selectedTextbox.style.maxWidth = w
    this.selectedTextbox.style.width = w
    this.updateResizeHandlePosition(this.selectedTextbox)
    this.emitChange()
  }

  alignSelectedTextbox = (align: 'left' | 'center' | 'right'): void => {
    if (!this.selectedTextbox) return
    this.selectedTextbox.style.textAlign = align
    this.emitChange()
  }

  /** Cor da borda; liga a borda (no estilo atual do menu) se ela estiver desligada */
  setTextboxBorderColor = (color: string, currentStyle: TbBorderStyle): { width?: string } => {
    const tb = this.selectedTextbox
    if (!tb) return {}
    let result: { width?: string } = {}
    tb.style.borderColor = color
    if (tb.style.borderStyle === 'none') {
      tb.style.borderStyle = currentStyle
      if (parseFloat(tb.style.borderWidth || '0') === 0) {
        tb.style.borderWidth = '1px'
        result = { width: '1' }
      }
    }
    this.emitChange()
    this.updateResizeHandlePosition(tb)
    return result
  }

  setTextboxBorderWidth = (w: string, currentStyle: TbBorderStyle): void => {
    const tb = this.selectedTextbox
    if (!tb) return
    if (w === '0') {
      tb.style.borderStyle = 'none'
      tb.style.borderWidth = '0px'
    } else {
      tb.style.borderStyle = currentStyle
      tb.style.borderWidth = `${w}px`
    }
    this.emitChange()
    this.updateResizeHandlePosition(tb)
  }

  // Tipo de linha da borda (sólida, tracejada, pontilhada, dupla)
  setTextboxBorderStyle = (style: TbBorderStyle): { width?: string } => {
    const tb = this.selectedTextbox
    if (!tb) return {}
    let result: { width?: string } = {}
    tb.style.borderStyle = style
    const current = parseFloat(tb.style.borderWidth || '0')
    // Sem espessura, ou espessura insuficiente para a linha dupla, ajusta a borda
    if (current === 0) {
      tb.style.borderWidth = '1px'
      result = { width: '1' }
    } else if (style === 'double' && current < 3) {
      tb.style.borderWidth = '3px'
      result = { width: '3' }
    }
    this.emitChange()
    this.updateResizeHandlePosition(tb)
    return result
  }

  // ─── IMAGEM ──────────────────────────────────────────────────────
  private selectImage(img: HTMLImageElement): void {
    this.deselectTextbox()
    this.deselectImage()
    img.draggable = false
    img.classList.add('selected')
    this.selectedImg = img
    this.setObjType('image')
    this.updateToolbarPosition(img)
    this.updateResizeHandlePosition(img)
  }

  deleteSelectedImage = (): void => {
    if (this.selectedImg) {
      this.selectedImg.remove()
      this.selectedImg = null
      this.setObjType(null)
      this.emitChange()
    }
  }

  resizeSelectedImage = (pct: number): void => {
    if (!this.selectedImg) return
    const w = `${pct}%`
    this.selectedImg.style.width = w
    this.selectedImg.style.maxWidth = w
    this.updateResizeHandlePosition(this.selectedImg)
    this.emitChange()
  }

  floatImage = (direction: 'left' | 'right' | 'none'): void => {
    if (!this.selectedImg) return
    const img = this.selectedImg
    // Alinhamento explícito: limpa o deslocamento horizontal manual
    img.style.marginLeft = ''
    img.style.marginRight = ''
    const posClass =
      direction === 'left' ? 'pos-left' : direction === 'right' ? 'pos-right' : 'pos-center'
    setImagePosition(img, posClass)
    this.updateResizeHandlePosition(img)
    this.emitChange()
  }

  private updateObjectToolbar(el: HTMLElement): void {
    this.updateToolbarPosition(el)
  }

  // ─── ARRASTO ─────────────────────────────────────────────────────
  private handleDragMove: PointerListener = (e) => {
    if (!this.isDragging) return
    const el = (
      this.dragType === 'image' ? this.selectedImg : this.selectedTextbox
    ) as HTMLElement | null
    if (!el) return
    // Movimento livre: o elemento acompanha o mouse passando por cima do texto
    const dx = e.clientX - this.dragStart.x + this.dragStart.ox
    const dy = e.clientY - this.dragStart.y + this.dragStart.oy
    el.style.transform = `translate(${dx}px, ${dy}px)`
    this.updateObjectToolbar(el)
    this.updateResizeHandlePosition(el)
  }

  private handleDragEnd: PointerListener = (e) => {
    const type = this.dragType
    const el = (type === 'image' ? this.selectedImg : this.selectedTextbox) as HTMLElement | null
    this.isDragging = false
    this.dragType = null
    this.pointer.stop()
    if (!el) return
    el.classList.remove('dragging')
    // Reposiciona no ponto de queda — o texto passa a contornar o elemento
    // com a margem de 40px do CSS; se o ponto for inválido, restaura a posição
    if (!dropElementAtPoint(this.el, el, e.clientX, e.clientY)) {
      el.style.transform = ''
    }
    this.updateObjectToolbar(el)
    this.updateResizeHandlePosition(el)
    this.emitChange()
  }

  // ─── REDIMENSIONAMENTO LIVRE (alça no canto inferior direito) ───
  private handleResizeMove: PointerListener = (e) => {
    const el = this.resizeEl
    if (!this.isResizing || !el) return
    const dx = e.clientX - this.resizeStart.x
    const dy = e.clientY - this.resizeStart.y
    const newW = Math.max(60, this.resizeStart.w + dx)
    const newH = Math.max(40, this.resizeStart.h + dy)
    // Redimensionamento livre: largura e altura seguem o movimento do mouse
    el.style.width = `${newW}px`
    el.style.maxWidth = `${newW}px`
    el.style.height = `${newH}px`
    this.updateResizeHandlePosition(el)
    this.updateObjectToolbar(el)
  }

  private handleResizeEnd: PointerListener = () => {
    this.isResizing = false
    this.resizeEl = null
    this.pointer.stop()
    this.emitChange()
  }

  /** Início do redimensionamento livre pela alça (pointerdown na alça) */
  startResize = (clientX: number, clientY: number, pointerId = 1): void => {
    const el = (
      this.objType === 'image' ? this.selectedImg : this.selectedTextbox
    ) as HTMLElement | null
    if (!el) return
    this.isResizing = true
    this.resizeEl = el
    this.resizeStart = { x: clientX, y: clientY, w: el.offsetWidth, h: el.offsetHeight }
    this.pointer.start(pointerId, this.handleResizeMove, this.handleResizeEnd)
  }

  // ─── EVENTOS DA ÁREA DE EDIÇÃO ───────────────────────────────────
  // pointerdown (mouse, toque ou caneta): seleciona imagem ou caixa de texto e
  // começa o arrasto; fora delas, desmarca
  private handlePointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement

    if (target.tagName === 'IMG') {
      this.focusWithoutSelecting()
      this.selectImage(target as HTMLImageElement)
      this.isDragging = true
      this.dragType = 'image'
      const img = this.selectedImg || (target as HTMLImageElement)
      const off = getManualOffset(img)
      this.dragStart = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
      img.classList.add('dragging')
      this.pointer.start(e.pointerId, this.handleDragMove, this.handleDragEnd)
      return
    }

    if (target.classList.contains('textbox-handle')) {
      const tb = target.closest('.rich-textbox') as HTMLDivElement
      if (tb) {
        this.focusWithoutSelecting()
        this.selectTextbox(tb)
        this.isDragging = true
        this.dragType = 'textbox'
        const off = getManualOffset(tb)
        this.dragStart = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
        tb.classList.add('dragging')
        this.pointer.start(e.pointerId, this.handleDragMove, this.handleDragEnd)
      }
      return
    }

    const tbParent = target.closest('.rich-textbox') as HTMLDivElement | null
    if (tbParent) {
      this.selectTextbox(tbParent)
      return
    }

    this.deselectImage()
    this.deselectTextbox()
  }

  // O mousedown sobre imagem e alça é cancelado (abaixo) para não selecionar
  // texto, o que também impedia o foco: sem ele, Delete, setas e Ctrl+Z não
  // chegavam ao editor quando a pessoa clicava direto na imagem.
  private focusWithoutSelecting(): void {
    if (document.activeElement === this.el || this.el.contains(document.activeElement)) return
    this.el.focus({ preventScroll: true })
  }

  // mousedown sobre imagem ou alça: impede a seleção de texto nativa do navegador
  private handleMouseDown = (e: MouseEvent): void => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' || target.classList.contains('textbox-handle')) {
      e.preventDefault()
    }
  }

  private handleClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      this.selectImage(target as HTMLImageElement)
    } else if (target.classList.contains('textbox-handle')) {
      // tratado no pointerdown
    } else if (target.closest('.rich-textbox')) {
      const tb = target.closest('.rich-textbox') as HTMLDivElement
      this.selectTextbox(tb)
    } else {
      this.deselectImage()
      this.deselectTextbox()
    }
  }

  private handleBlur = (): void => {
    if (this.preview) this.restorePreview()
    this.emitChange()
  }

  private handleInput = (): void => {
    this.enforceHeight()
    this.emitChange()
  }

  private enforceHeight(): boolean {
    if (!this.opts.truncateOnOverflow) return false
    return truncateEditableToFit(this.el)
  }

  // Digitação com estilo pendente (fonte, tamanho ou cor escolhidos sem seleção).
  // Só 'insertText': a composição de IME (insertCompositionText) não pode ser
  // cancelada, e o texto sairia duplicado.
  private handleBeforeInput = (inputEvent: InputEvent): void => {
    if (this.preview) this.restorePreview()
    if (inputEvent.inputType !== 'insertText' || inputEvent.data === null) {
      return
    }

    const style = this.pendingStyle
    if (!style.fontSize && !style.color && !style.fontFamily) return
    const range = this.getCurrentRange()
    if (!range?.collapsed) return

    inputEvent.preventDefault()
    this.restoreRange(range)
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
    this.savedRange = caret.cloneRange()
    this.pendingStyle = {}
    this.enforceHeight()
    this.emitChange()
  }

  private handlePaste = (e: ClipboardEvent): void => {
    if (this.preview) this.restorePreview()
    const editor = this.el
    const data = e.clipboardData
    if (!data) return

    const clipboardHtml = data.getData('text/html')
    const clipboardText = data.getData('text/plain').replace(/\r\n?/g, '\n')
    const pasted = buildPasteHtml(
      clipboardHtml,
      clipboardText,
      this.opts.singleLineBreaks,
      this.opts.fontFamilies,
      { images: this.opts.pasteImages },
    )

    // Deixa colagens que não sejam texto (como imagem copiada) seguirem o
    // comportamento nativo do navegador.
    if (!pasted.html && !clipboardText) return
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
    template.innerHTML = pasted.html
    const fragment = template.content
    const pendingStyle = this.pendingStyle
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
      this.savedRange = range.cloneRange()
      this.pendingStyle = {}
    } else if (lastInsertedNode) {
      range.setStartAfter(lastInsertedNode)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
      this.savedRange = range.cloneRange()
    }
    editor.focus()
    if (pasted.fontSizePt && !pendingStyle.fontSize) {
      this.cb.onSelectionStyle?.({
        fontSize: closestFontSizeOption(pasted.fontSizePt, this.opts.fontSizes),
      })
    }
    if (pasted.fontFamily && !pendingStyle.fontFamily) {
      this.cb.onSelectionStyle?.({ fontFamily: pasted.fontFamily })
    }
    this.enforceHeight()
    this.emitChange()
  }

  // ─── TECLADO ─────────────────────────────────────────────────────
  private handleKeyDown = (e: KeyboardEvent): void => {
    const editor = this.el
    // Antes do Enter nativo (parágrafo Word), impede a nova linha se ela
    // ultrapassaria a caixa física; não apaga texto e mostra o aviso.
    if (this.opts.truncateOnOverflow && e.key === 'Enter') {
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
        this.cb.onOverflowChange?.(true)
        return
      }
    }
    // Tab: insere espaços dentro do editor
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      insertHtml(TAB_HTML)
      this.enforceHeight()
      this.emitChange()
      return
    }
    // Desfazer / refazer próprios: Ctrl+Z, Ctrl+Y e Ctrl+Shift+Z; Ctrl+K: link
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase()
      if (key === 'k' && this.cb.onLinkRequest) {
        e.preventDefault()
        this.cb.onLinkRequest()
        return
      }
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        this.undo()
        return
      }
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        this.redo()
        return
      }
    }
    // Apaga a imagem selecionada (Delete/Backspace)
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedImg) {
      e.preventDefault()
      this.deleteSelectedImage()
      return
    }
    const target = (
      this.objType === 'image' ? this.selectedImg : this.selectedTextbox
    ) as HTMLElement | null
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    // Setas + Ctrl: deslocamento fino livre (1px; 10px com Shift) —
    // a imagem ou caixa de texto move por cima do texto
    if (e.ctrlKey && !e.altKey && target && arrows.includes(e.key)) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      nudgeElement(target, dx, dy)
      this.updateObjectToolbar(target)
      this.updateResizeHandlePosition(target)
      this.emitChange()
      return
    }
    // Setas + Alt: move no fluxo do conteúdo (↑/↓) ou flutua para os lados (←/→)
    if (e.altKey && target && arrows.includes(e.key)) {
      e.preventDefault()
      if (e.key === 'ArrowUp') moveElementInFlow(target, -1)
      else if (e.key === 'ArrowDown') moveElementInFlow(target, 1)
      else setFloatSide(target, e.key === 'ArrowLeft' ? 'left' : 'right')
      this.updateObjectToolbar(target)
      this.updateResizeHandlePosition(target)
      this.emitChange()
    }
  }

  // ─── DESFAZER / REFAZER (histórico próprio — ver history.ts) ───
  // Cobre todas as ações do editor (imagens, caixas, cor do papel, limpar),
  // e não apenas a digitação como o desfazer nativo do navegador.
  private applyHistory(html: string | null): void {
    if (html === null) return
    const { paper, inner } = splitPaper(html)
    this.paper = paper
    this.el.style.backgroundColor = paper
    this.el.innerHTML = this.prepareMedia(inner)
    this.suspendExternalMedia()
    this.deselectImage()
    this.deselectTextbox()
    this.emitChange()
  }

  private currentSnapshot = (): string => snapshotEditor(this.el, this.paper)

  undo = (): void => {
    this.applyHistory(this.history.undo(this.currentSnapshot))
    this.el.focus()
  }

  redo = (): void => {
    this.applyHistory(this.history.redo(this.currentSnapshot))
    this.el.focus()
  }
}
