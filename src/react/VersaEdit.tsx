import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
} from '../core/defaults'
import {
  VersaEditCore,
  type LinkDraft,
  type ObjectState,
  type VersaEditConfirm,
  type VersaEditError,
} from '../core/editor'
import { resolveLabels, type VersaEditLabels, type VersaEditLocale } from '../core/i18n'
import { SPEECH_LANG, type SpeechRecognitionConstructor } from '../core/speech'
import {
  DEFAULT_FRAME_HANDLES,
  createFrameResizer,
  type FrameHandle,
  type FrameLimits,
  type FrameResizePhase,
  type FrameResizer,
  type FrameSize,
} from '../core/frame-resize'
import { injectStyles } from '../core/styles'
import { ObjectToolbar } from './floating/ObjectToolbar'
import { ResizeHandle } from './floating/ResizeHandle'
import { SizeControls } from './SizeControls'
import { CloseMenusSignal } from './toolbar/usePopup'
import { useBrowserSpeechRecognition } from './useBrowserSpeechRecognition'
import { Toolbar, TOOLBAR_GROUPS, type ToolbarGroup, type ToolbarState } from './toolbar/Toolbar'

const GOOGLE_FONTS_LINK_ID = 'versaedit-google-fonts'

// No servidor (SSR) o useLayoutEffect não roda e o React 18 avisa; lá usa-se
// useEffect (que também não roda). No navegador, nada muda.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Texto anunciado quando cada tipo de objeto é selecionado (novos tipos entram aqui)
const OBJECT_SELECTED: Record<ObjectState['type'], 'imageSelected' | 'textboxSelected'> = {
  image: 'imageSelected',
  textbox: 'textboxSelected',
}

export interface VersaEditProps {
  /** HTML inicial. Mudanças vindas de fora recarregam o editor; o eco do próprio onChange não. */
  initialContent?: string
  onChange?: (html: string) => void
  /** Avisa quando o conteúdo passa (ou deixa de passar) da altura do editor */
  onOverflowChange?: (isOverflowing: boolean) => void
  /** O foco entrou no editor */
  onFocus?: () => void
  /** O foco saiu do editor (os botões da barra não tiram o foco) */
  onBlur?: () => void
  /**
   * Erros e avisos (arquivo inválido, conteúdo cortado, falha no envio de
   * imagem…). Sem ele, o editor mostra alert() do navegador.
   */
  onError?: (error: VersaEditError) => void
  /**
   * Confirmações (ex.: substituir o conteúdo ao abrir arquivo): devolva true/false
   * ou uma promessa (para usar a janela da aplicação). Sem ele, confirm().
   */
  onConfirm?: (request: VersaEditConfirm) => boolean | Promise<boolean>
  /** Classe extra na área de edição (para estilos do site que vai exibir o conteúdo) */
  contentClassName?: string
  contentStyle?: React.CSSProperties
  /**
   * Layout Mirror (padrão: false): isola o texto da área de edição do CSS da página
   * (classe ve-mirror). Publique o HTML em
   * `<div class="versaedit-content ve-mirror">` com 'versaedit/versaedit-content.css'
   * e ele terá a mesma aparência da edição. O HTML entregue não muda.
   */
  layoutMirror?: boolean
  /** Texto exibido com o editor vazio (padrão: o do idioma) */
  placeholder?: string
  /** Colagem: junta linhas em branco seguidas em uma só */
  singleLineBreaks?: boolean
  /**
   * Colagem: mantém as imagens do conteúdo colado (padrão: true). As imagens
   * continuam apontando para o site de origem: o navegador de quem edita e,
   * depois, o de quem lê o conteúdo publicado buscam a imagem lá (o site de
   * origem fica sabendo do acesso e pode tirar ou trocar a imagem). Com false,
   * as imagens coladas são descartadas. Só endereços http(s), relativos ou
   * imagens embutidas raster (png, jpeg, gif, webp, bmp) são aceitos.
   */
  pasteImages?: boolean
  /**
   * Espaçamento ao colar de documentos do Microsoft Word: 'remove' (padrão, o
   * texto segue o espaçamento do site) ou 'preserve' (espaço antes e depois dos
   * parágrafos, recuos, entrelinha e linhas em branco do documento, gravados no
   * HTML). Só vale para a colagem: o espaçamento de um documento salvo é sempre
   * mantido ao reabri-lo.
   */
  pasteSpacing?: 'remove' | 'preserve'
  /**
   * A área de edição rola quando o conteúdo passa da altura (padrão: true).
   * Com false, o que passa fica escondido, como num bloco de altura fixa
   * (veja onOverflowChange e truncateOnOverflow).
   */
  scrollable?: boolean
  /**
   * Deixa áudio e vídeo externos do conteúdo carregarem dentro do editor
   * (padrão: false). Desligado, a mídia não é baixada nem toca enquanto se
   * edita, e o HTML entregue (onChange, getHTML, arquivo) continua idêntico ao
   * recebido. A colagem nunca traz áudio ou vídeo.
   */
  allowExternalMedia?: boolean
  /** Corta o conteúdo que passar da altura do editor */
  truncateOnOverflow?: boolean
  /**
   * Largura total do bloco, moldura incluída: número em px (padrão 640) ou
   * medida CSS, como '100%' (o editor acompanha a largura do container)
   */
  width?: number | string
  /** Altura total do bloco em px, moldura incluída */
  height?: number
  /**
   * Alças para redimensionar a área de edição (padrão: false): à direita, embaixo
   * e no canto entre elas, com mouse, toque ou as setas (Shift: 1px). Com um
   * objeto, escolhe as alças (`handles`, entre 'e', 's', 'se', 'w', 'n', 'nw',
   * 'ne', 'sw') e os limites em px (moldura incluída): minWidth (160), maxWidth (o
   * espaço disponível; nunca passa dele), minHeight (80), maxHeight (sem limite).
   * Muda só a área visível: o HTML, o histórico e a seleção não
   * mudam, e o limite de conteúdo (truncateOnOverflow, onOverflowChange) continua
   * sendo o de `width` e `height`. Se `width` ou `height` mudarem, o novo valor
   * prevalece.
   */
  resizable?: boolean | ResizableOptions
  /**
   * Campos de largura e altura (px) abaixo da área de edição, ligados ao
   * redimensionamento (só com `resizable`). Enter ou sair do campo aplica; Esc
   * desfaz o que foi digitado.
   */
  sizeControls?: boolean
  /**
   * Tamanho visível mudado pela pessoa (moldura incluída, px). Arraste das alças:
   * 'start', 'move' (um por quadro em que o tamanho mudou) e 'end'. Setas nas alças,
   * campos de tamanho e o ajuste quando o contêiner encolhe: só 'end', e só quando o
   * tamanho mudou. setSize e mudanças de width/height não chamam.
   */
  onResize?: (size: FrameSize, phase: FrameResizePhase) => void
  /**
   * Largura da barra de ferramentas (padrão: a do bloco). Com números, a barra
   * fica centralizada sobre o bloco; com medida CSS, alinhada à esquerda.
   */
  toolbarWidth?: number | string
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
  /**
   * Grupos de ferramentas da barra (padrão: todos), na ordem fixa da barra:
   * 'dictation', 'file', 'history', 'font', 'block', 'format', 'highlight',
   * 'color', 'align', 'list', 'indent', 'link', 'insert', 'textbox', 'clear'.
   * Sem 'format', Ctrl+B/I/U não formatam; sem 'link', Ctrl+K não abre o link.
   * Desfazer/refazer pelo teclado funcionam sempre.
   */
  toolbar?: readonly ToolbarGroup[]
  /** Mostra os botões Salvar/Abrir arquivo (padrão: true) */
  showFileButtons?: boolean
  /** Botão Salvar: recebe o HTML no lugar de baixar o arquivo .html */
  onSave?: (html: string) => void
  /**
   * Envio de imagem: recebe o arquivo e devolve a URL publicada (ex.: storage).
   * Sem ele, a imagem é gravada no conteúdo em base64.
   */
  onImageUpload?: (file: File) => Promise<string>
  /**
   * Botão de ditado (fala para texto) pelo microfone. Padrão: true; aparece só
   * nos navegadores com reconhecimento de voz (Chrome, Edge, Safari), que
   * processam o áudio nos servidores do fabricante.
   */
  showDictation?: boolean
  /** Idioma do ditado (padrão: o do `locale`: 'en-US', 'pt-BR' ou 'es-ES') */
  speechLang?: string
  /** Outro mecanismo de reconhecimento com a interface do SpeechRecognition */
  speechRecognition?: SpeechRecognitionConstructor
  /**
   * Injeta o CSS do editor no <head> (padrão: true). Com false, importe
   * 'versaedit/versaedit.css' — necessário em sites com CSP que bloqueia
   * estilos injetados por script.
   */
  injectStyles?: boolean
  /** Idioma da interface: 'en' (padrão), 'pt-BR' ou 'es' */
  locale?: VersaEditLocale
  /** Troca qualquer texto da interface */
  labels?: Partial<VersaEditLabels>
}

/** Métodos disponíveis pela ref do componente */
export interface VersaEditHandle {
  /** HTML atual (com a cor do papel, quando definida) */
  getHTML(): string
  /** Troca o conteúdo (reinicia o desfazer) */
  setHTML(html: string): void
  focus(): void
  /** Apaga todo o conteúdo */
  clear(): void
  undo(): void
  redo(): void
  /** Tamanho visível da área (moldura incluída, px); null antes de montar */
  getSize(): FrameSize | null
  /**
   * Muda o tamanho visível (só com `resizable`), dentro dos limites; devolve o
   * aplicado (null sem `resizable`). Não chama onResize nem onChange.
   */
  setSize(size: Partial<FrameSize>): FrameSize | null
  /** Núcleo do editor, para usos avançados */
  readonly core: VersaEditCore | null
}

/** Opções de `resizable`: alças e limites (px, moldura incluída) */
export interface ResizableOptions extends FrameLimits {
  /** Alças mostradas (padrão: ['e', 's', 'se']) */
  handles?: FrameHandle[]
}

// ─── COMPONENTE ───────────────────────────────────────────────────
// Camada fina sobre o VersaEditCore: desenha a barra, os menus flutuantes e a
// área de edição; toda a lógica de edição fica no núcleo (src/core).
const VersaEdit = forwardRef<VersaEditHandle, VersaEditProps>(function VersaEdit(
  {
    initialContent = '',
    onChange,
    onOverflowChange,
    onResize,
    onFocus,
    onBlur,
    onError,
    onConfirm,
    contentClassName = '',
    contentStyle,
    layoutMirror = false,
    placeholder,
    singleLineBreaks = false,
    pasteImages = true,
    pasteSpacing = 'remove',
    scrollable = true,
    allowExternalMedia = false,
    truncateOnOverflow = false,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    resizable = false,
    sizeControls = false,
    toolbarWidth: toolbarWidthProp,
    frame,
    accentColor = DEFAULT_ACCENT,
    fontFamily = DEFAULT_FONT,
    headingFontFamily,
    fontFamilies = DEFAULT_FONT_FAMILIES,
    fontSizes = DEFAULT_FONT_SIZES,
    colorPalette = DEFAULT_COLOR_PALETTE,
    highlightColors = DEFAULT_HIGHLIGHT_COLORS,
    loadGoogleFonts,
    showFileButtons = true,
    toolbar = TOOLBAR_GROUPS,
    injectStyles: shouldInjectStyles = true,
    onSave,
    onImageUpload,
    showDictation = true,
    speechLang,
    speechRecognition,
    locale = 'en',
    labels,
  },
  ref,
) {
  const L = useMemo(() => resolveLabels(locale, labels), [locale, labels])
  const hintId = `${useId()}-keyboard-hint`
  const frameOpts: FrameOptions =
    frame === false ? { width: 0, color: 'transparent', radius: 0 } : { ...DEFAULT_FRAME, ...frame }
  const fontSizeOptions = fontSizes.length ? fontSizes : DEFAULT_FONT_SIZES

  const editorRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<VersaEditCore | null>(null)
  const getCore = useCallback(() => coreRef.current, [])

  // Estado da interface (indicadores da barra e objeto selecionado)
  const [object, setObject] = useState<ObjectState | null>(null)
  const [toolbarState, setToolbarState] = useState<ToolbarState>(() => ({
    currentFont: fontFamily,
    currentFontSize: '12',
    textColor: '#000000',
    bgColor: '#FFFF00',
    textboxBorder: { color: accentColor, width: '1', style: 'dashed' },
  }))
  const patchToolbar = useCallback(
    (patch: Partial<ToolbarState>) => setToolbarState((s) => ({ ...s, ...patch })),
    [],
  )

  // Callbacks da tela sempre atualizados: a tela pode recriar onChange a cada
  // renderização sem que o editor recarregue o conteúdo
  const latest = useRef({
    onChange,
    onOverflowChange,
    onResize,
    onSave,
    onImageUpload,
    onFocus,
    onBlur,
    onError,
    onConfirm,
  })
  useIsomorphicLayoutEffect(() => {
    latest.current = {
      onChange,
      onOverflowChange,
      onResize,
      onSave,
      onImageUpload,
      onFocus,
      onBlur,
      onError,
      onConfirm,
    }
  })

  // Formulário de link: aberto pelo botão ou por Ctrl+K
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null)
  const openLink = useCallback(() => {
    const core = coreRef.current
    if (core) setLinkDraft(core.beginLink())
  }, [])
  const closeLink = useCallback(() => setLinkDraft(null), [])

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => coreRef.current?.getHTML() ?? '',
      setHTML: (html: string) => coreRef.current?.setHTML(html),
      focus: () => coreRef.current?.focus(),
      clear: () => coreRef.current?.clearAll(),
      undo: () => coreRef.current?.undo(),
      redo: () => coreRef.current?.redo(),
      getSize: () => {
        const f = frameRef.current
        return (
          resizerRef.current?.getSize() ??
          (f ? { width: f.offsetWidth, height: f.offsetHeight } : null)
        )
      },
      setSize: (size: Partial<FrameSize>) => resizerRef.current?.setSize(size) ?? null,
      get core() {
        return coreRef.current
      },
    }),
    [],
  )

  // Núcleo: criado com o elemento editável e destruído ao desmontar
  useIsomorphicLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    const core = new VersaEditCore(
      el,
      {},
      {
        get onChange() {
          return latest.current.onChange
        },
        get onOverflowChange() {
          return latest.current.onOverflowChange
        },
        get onSave() {
          return latest.current.onSave
        },
        get onImageUpload() {
          return latest.current.onImageUpload
        },
        onLinkRequest: openLink,
        get onError() {
          return latest.current.onError
        },
        get onConfirm() {
          return latest.current.onConfirm
        },
        onFocus: () => latest.current.onFocus?.(),
        onBlur: () => latest.current.onBlur?.(),
        onObjectChange: setObject,
        onSelectionStyle: (style) =>
          patchToolbar({
            ...(style.fontFamily !== undefined && { currentFont: style.fontFamily }),
            ...(style.fontSize !== undefined && { currentFontSize: style.fontSize }),
            ...(style.textColor !== undefined && { textColor: style.textColor }),
            ...(style.paperColor !== undefined && { bgColor: style.paperColor }),
          }),
        onTextboxSelect: (textboxBorder) => patchToolbar({ textboxBorder }),
      },
    )
    coreRef.current = core
    return () => {
      core.destroy()
      coreRef.current = null
    }
  }, [patchToolbar, openLink])

  // Opções do núcleo acompanham as props
  useIsomorphicLayoutEffect(() => {
    coreRef.current?.setOptions({
      truncateOnOverflow,
      singleLineBreaks,
      pasteImages,
      pasteSpacing,
      allowExternalMedia,
      shortcuts: { link: groups.has('link'), format: groups.has('format') },
      fontFamilies,
      fontSizes: fontSizeOptions,
      locale,
      labels: L,
      accentColor,
    })
  })

  // Tamanho visível × configurado: as alças, os campos e setSize mudam só o
  // visível (userSize); width/height continuam sendo o configurado, e mudá-los
  // descarta o visível. Sem resizable, nada disso existe.
  const canResize = !!resizable
  const resizeOptions: ResizableOptions = typeof resizable === 'object' ? resizable : {}
  const handlesKey = (resizeOptions.handles ?? DEFAULT_FRAME_HANDLES).join('|')
  const limitsKey = JSON.stringify({
    minWidth: resizeOptions.minWidth,
    maxWidth: resizeOptions.maxWidth,
    minHeight: resizeOptions.minHeight,
    maxHeight: resizeOptions.maxHeight,
  })
  const [limits, setLimits] = useState<Required<FrameLimits> | null>(null)
  // Menus da barra fecham ao começar a redimensionar (a barra pode mudar de largura)
  const [closeMenus, setCloseMenus] = useState(0)
  const [userSize, setUserSize] = useState<FrameSize | null>(null)
  const [visibleSize, setVisibleSize] = useState<FrameSize | null>(null)
  const resizerRef = useRef<FrameResizer | null>(null)
  useEffect(() => setUserSize(null), [width, height, canResize])
  const resizeLabels = `${L.frameResizeWidth}|${L.frameResizeHeight}|${L.frameResizeBoth}`
  useEffect(() => {
    const frameEl = frameRef.current
    const content = editorRef.current
    if (!canResize || !frameEl || !content) return
    const [w, h, both] = resizeLabels.split('|')
    const resizer = createFrameResizer({
      frame: frameEl,
      content,
      handles: handlesKey.split('|') as FrameHandle[],
      labels: { e: w, w, s: h, n: h, se: both, sw: both, ne: both, nw: both },
      limits: JSON.parse(limitsKey) as FrameLimits,
      onSizeChange: (size, applied) => {
        setVisibleSize(size)
        if (applied) setUserSize(size)
        coreRef.current?.refreshLayout()
      },
      onLimitsChange: setLimits,
      onResize: (size, phase) => {
        if (phase === 'start') setCloseMenus((n) => n + 1)
        latest.current.onResize?.(size, phase)
      },
    })
    resizerRef.current = resizer
    return () => {
      resizer.destroy()
      resizerRef.current = null
    }
    // Limites mudados depois: setLimits abaixo (sem recriar as alças)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canResize, resizeLabels, handlesKey])
  useEffect(() => {
    resizerRef.current?.setLimits(JSON.parse(limitsKey) as FrameLimits)
  }, [limitsKey])
  // Área visível diferente da configurada e sem rolagem (scrollable=false): a
  // rolagem é ligada, para nada ficar inalcançável; no tamanho configurado, o
  // corte e o aviso medem como antes (overflow-y da classe)
  const forceScroll = canResize && !scrollable && userSize !== null
  useIsomorphicLayoutEffect(() => {
    coreRef.current?.setContentLimit(
      canResize ? { width, height, ...(forceScroll && { overflowY: '' }) } : null,
    )
  })
  // Campos de tamanho: Enter, sair do campo ou setas do campo aplicam; avisa com
  // 'end' só quando o tamanho mudou
  const commitSize = useCallback((size: Partial<FrameSize>) => {
    const resizer = resizerRef.current
    if (!resizer) return
    const before = resizer.getSize()
    const after = resizer.setSize(size)
    if (after.width !== before.width || after.height !== before.height) {
      latest.current.onResize?.(after, 'end')
    }
  }, [])
  const frameWidth = userSize?.width ?? width
  const frameHeight = userSize?.height ?? height
  const toolbarWidth = toolbarWidthProp ?? frameWidth

  // Conteúdo vindo de fora
  useEffect(() => {
    coreRef.current?.load(initialContent)
  }, [initialContent, truncateOnOverflow])

  useEffect(() => {
    if (shouldInjectStyles) injectStyles()
  }, [shouldInjectStyles])

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

  // Grupos ligados (a lista pode ser recriada a cada render: compara pelo conteúdo)
  const toolbarKey = toolbar.join('|')
  const groups = useMemo(
    () => new Set((toolbarKey ? toolbarKey.split('|') : []) as ToolbarGroup[]),
    [toolbarKey],
  )

  // Ditado: só com mecanismo de reconhecimento disponível
  const browserRecognition = useBrowserSpeechRecognition()
  const recognition = speechRecognition ?? browserRecognition
  const dictationLang = speechLang ?? SPEECH_LANG[locale] ?? 'en-US'
  const dictation = useMemo(
    () => (showDictation && recognition ? { recognition, lang: dictationLang } : null),
    [showDictation, recognition, dictationLang],
  )

  const rootStyle = {
    '--ve-accent': accentColor,
    ...(headingFontFamily ? { '--ve-heading-font': headingFontFamily } : {}),
  } as React.CSSProperties

  return (
    <div className="ve-root" style={rootStyle}>
      {groups.size > 0 && (
        <CloseMenusSignal.Provider value={closeMenus}>
          <Toolbar
            core={getCore}
            labels={L}
            width={toolbarWidth}
            editorWidth={frameWidth}
            showFileButtons={showFileButtons}
            fontFamilies={fontFamilies}
            fontSizes={fontSizeOptions}
            colorPalette={colorPalette}
            highlightColors={highlightColors}
            isTextboxSelected={object?.type === 'textbox'}
            state={toolbarState}
            setState={patchToolbar}
            linkDraft={linkDraft}
            openLink={openLink}
            closeLink={closeLink}
            dictation={dictation}
            groups={groups}
          />
        </CloseMenusSignal.Provider>
      )}

      {/* ═══ ÁREA DE EDIÇÃO — largura, altura e moldura configuráveis ═══ */}
      <div
        ref={frameRef}
        className="ve-frame"
        style={{
          width: frameWidth,
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
          aria-describedby={hintId}
          className={`ve-content${scrollable ? ' ve-scroll' : ''}${layoutMirror ? ' ve-mirror' : ''} ${contentClassName}`.trim()}
          data-placeholder={placeholder ?? L.placeholder}
          style={{
            // Número: medida exata em px (como sempre); medida CSS: ocupa a moldura
            width: typeof frameWidth === 'number' ? frameWidth - frameOpts.width * 2 : '100%',
            height: frameHeight - frameOpts.width * 2,
            ...(forceScroll && { overflowY: 'auto' as const }),
            borderRadius: Math.max(0, frameOpts.radius - frameOpts.width),
            fontFamily,
            ...contentStyle,
          }}
        />

        {/* Como sair da área de edição pelo teclado (o Tab insere espaços) */}
        <span id={hintId} className="ve-sr-only">
          {L.keyboardHint}
        </span>
        {/* Anuncia o objeto selecionado (imagem, caixa de texto) para leitores de tela */}
        <span className="ve-sr-only" aria-live="polite">
          {object ? L[OBJECT_SELECTED[object.type]] : ''}
        </span>
        {object && !object.hidden && <ObjectToolbar object={object} core={getCore} labels={L} />}
        {object?.handle && !object.hidden && (
          <ResizeHandle position={object.handle} title={L.resizeFree} core={getCore} />
        )}
      </div>

      {canResize && sizeControls && (
        <SizeControls
          size={visibleSize ?? (typeof width === 'number' ? { width, height } : null)}
          limits={limits}
          labels={L}
          onCommit={commitSize}
        />
      )}
    </div>
  )
})

export default VersaEdit
