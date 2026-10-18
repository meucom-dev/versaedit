import React, {
  forwardRef,
  useCallback,
  useEffect,
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
import { VersaEditCore, type LinkDraft, type ObjectState } from '../core/editor'
import { resolveLabels, type VersaEditLabels, type VersaEditLocale } from '../core/i18n'
import {
  browserSpeechRecognition,
  SPEECH_LANG,
  type SpeechRecognitionConstructor,
} from '../core/speech'
import { injectStyles } from '../core/styles'
import { ObjectToolbar } from './floating/ObjectToolbar'
import { ResizeHandle } from './floating/ResizeHandle'
import { Toolbar, type ToolbarState } from './toolbar/Toolbar'

const GOOGLE_FONTS_LINK_ID = 'versaedit-google-fonts'

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
  /** Classe extra na área de edição (para estilos do site que vai exibir o conteúdo) */
  contentClassName?: string
  contentStyle?: React.CSSProperties
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
   * Deixa áudio e vídeo externos do conteúdo carregarem dentro do editor
   * (padrão: false). Desligado, a mídia não é baixada nem toca enquanto se
   * edita, e o HTML entregue (onChange, getHTML, arquivo) continua idêntico ao
   * recebido. A colagem nunca traz áudio ou vídeo.
   */
  allowExternalMedia?: boolean
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
  /** Idioma do ditado (padrão: o do `locale`, ex.: 'pt-BR', 'en-US') */
  speechLang?: string
  /** Outro mecanismo de reconhecimento com a interface do SpeechRecognition */
  speechRecognition?: SpeechRecognitionConstructor
  /** Idioma da interface (padrão: 'en') */
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
  /** Núcleo do editor, para usos avançados */
  readonly core: VersaEditCore | null
}

// ─── COMPONENTE ───────────────────────────────────────────────────
// Camada fina sobre o VersaEditCore: desenha a barra, os menus flutuantes e a
// área de edição; toda a lógica de edição fica no núcleo (src/core).
const VersaEdit = forwardRef<VersaEditHandle, VersaEditProps>(function VersaEdit(
  {
    initialContent = '',
    onChange,
    onOverflowChange,
    onFocus,
    onBlur,
    contentClassName = '',
    contentStyle,
    placeholder,
    singleLineBreaks = false,
    pasteImages = true,
    allowExternalMedia = false,
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
    colorPalette = DEFAULT_COLOR_PALETTE,
    highlightColors = DEFAULT_HIGHLIGHT_COLORS,
    loadGoogleFonts,
    showFileButtons = true,
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
  const frameOpts: FrameOptions =
    frame === false ? { width: 0, color: 'transparent', radius: 0 } : { ...DEFAULT_FRAME, ...frame }
  const fontSizeOptions = fontSizes.length ? fontSizes : DEFAULT_FONT_SIZES

  const editorRef = useRef<HTMLDivElement>(null)
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
  const latest = useRef({ onChange, onOverflowChange, onSave, onImageUpload, onFocus, onBlur })
  useLayoutEffect(() => {
    latest.current = { onChange, onOverflowChange, onSave, onImageUpload, onFocus, onBlur }
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
      get core() {
        return coreRef.current
      },
    }),
    [],
  )

  // Núcleo: criado com o elemento editável e destruído ao desmontar
  useLayoutEffect(() => {
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
  useLayoutEffect(() => {
    coreRef.current?.setOptions({
      truncateOnOverflow,
      singleLineBreaks,
      pasteImages,
      allowExternalMedia,
      fontFamilies,
      fontSizes: fontSizeOptions,
      locale,
      labels: L,
      accentColor,
    })
  })

  // Conteúdo vindo de fora
  useEffect(() => {
    coreRef.current?.load(initialContent)
  }, [initialContent, truncateOnOverflow])

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

  // Ditado: só com mecanismo de reconhecimento disponível
  const [browserRecognition] = useState(browserSpeechRecognition)
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
      <Toolbar
        core={getCore}
        labels={L}
        width={toolbarWidth}
        editorWidth={width}
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
      />

      {/* ═══ ÁREA DE EDIÇÃO — largura, altura e moldura configuráveis ═══ */}
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
            width: width - frameOpts.width * 2,
            height: height - frameOpts.width * 2,
            borderRadius: Math.max(0, frameOpts.radius - frameOpts.width),
            fontFamily,
            ...contentStyle,
          }}
        />

        {object && <ObjectToolbar object={object} core={getCore} labels={L} />}
        {object?.handle && (
          <ResizeHandle position={object.handle} title={L.resizeFree} core={getCore} />
        )}
      </div>
    </div>
  )
})

export default VersaEdit
