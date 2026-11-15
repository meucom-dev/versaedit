// Painel "Propriedades" do playground: muda props do editor ao vivo, carrega
// conteúdos de exemplo, registra os eventos e mostra o JSX equivalente.
// Recolhido por padrão; sem mudanças, o editor recebe as props de sempre.
import { Fragment, useId } from 'react'
import {
  DEFAULT_FRAME_HANDLES,
  DEFAULT_OBJECT_MARGIN,
  TOOLBAR_GROUPS,
  type FrameHandle,
  type ObjectMargin,
  type ResizableOptions,
  type ToolbarGroup,
  type VersaEditLocale,
  type VersaEditProps,
} from '../src'

export interface Settings {
  toolbar: ToolbarGroup[]
  width: number | string
  height: number
  accentColor: string
  frameWidth: number
  frameColor: string
  frameRadius: number
  /** Margem dos objetos, por lado (prop objectMargin) */
  objectMargin: Required<ObjectMargin>
  pasteImages: boolean
  allowExternalMedia: boolean
  truncateOnOverflow: boolean
  singleLineBreaks: boolean
  layoutMirror: boolean
  useOnError: boolean
  /** Colagem do Word: espaçamento e listas (prop pasteSpacing) */
  pasteSpacing: 'remove' | 'preserve'
  /** Redimensionamento da área (prop resizable e campos de tamanho) */
  resizable: boolean
  sizeControls: boolean
  handles: FrameHandle[]
  /** Limites; null: padrão do editor */
  minWidth: number | null
  maxWidth: number | null
  minHeight: number | null
  maxHeight: number | null
}

const ALL_HANDLES: FrameHandle[] = ['e', 's', 'se', 'w', 'n', 'nw', 'ne', 'sw']
const LIMITS = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const
const MARGIN_SIDES = ['text', 'outer', 'top', 'bottom'] as const
// Opções de Dimensões (largura em px ou '100%'; altura em px)
const WIDTHS = ['800', '900', '640', '100%']
const HEIGHTS = [300, 400, 500, 600, 700, 800, 900]

// Grupos que o painel controla (o ditado fica fora da barra no playground)
const GROUPS = TOOLBAR_GROUPS.filter((g) => g !== 'dictation')

export const DEFAULT_SETTINGS: Settings = {
  toolbar: [...GROUPS],
  width: 800,
  height: 500,
  accentColor: '#2563eb',
  frameWidth: 1,
  frameColor: '#d0d7de',
  frameRadius: 8,
  objectMargin: { ...DEFAULT_OBJECT_MARGIN },
  pasteImages: true,
  allowExternalMedia: false,
  truncateOnOverflow: false,
  singleLineBreaks: false,
  layoutMirror: false,
  useOnError: false,
  // Colagem do Word mantendo o espaçamento (a biblioteca usa 'remove' por padrão)
  pasteSpacing: 'preserve',
  resizable: false,
  sizeControls: false,
  handles: [...DEFAULT_FRAME_HANDLES],
  minWidth: null,
  maxWidth: null,
  minHeight: null,
  maxHeight: null,
}

const BOOLEANS = [
  'pasteImages',
  'allowExternalMedia',
  'truncateOnOverflow',
  'singleLineBreaks',
  'layoutMirror',
] as const

// Props do editor que diferem do padrão do playground (só essas são passadas)
// Fontes do playground: Montserrat no texto, Playfair Display nos títulos, um
// menu de 15 fontes e as famílias correspondentes carregadas do Google Fonts
export const PLAYGROUND_FONTS = {
  // O valor é o mesmo da opção "Montserrat" do menu: assim o menu já abre com o
  // nome da fonte (ele só reconhece valores idênticos aos das opções)
  fontFamily: "'Montserrat', Arial, sans-serif",
  headingFontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
  fontFamilies: [
    { label: 'Aptos', value: 'Aptos, "Segoe UI", Arial, sans-serif' },
    { label: 'Aptos Display', value: '"Aptos Display", Aptos, "Segoe UI", Arial, sans-serif' },
    { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
    { label: 'Fraunces', value: 'Fraunces, Georgia, "Times New Roman", serif' },
    { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
    { label: 'Inter', value: 'Inter, Arial, sans-serif' },
    { label: 'Montserrat', value: "'Montserrat', Arial, sans-serif" },
    { label: 'Open Sans', value: "'Open Sans', Arial, sans-serif" },
    { label: 'Playfair Display', value: "'Playfair Display', Georgia, 'Times New Roman', serif" },
    { label: 'Poppins', value: 'Poppins, Arial, sans-serif' },
    { label: 'Roboto', value: 'Roboto, Arial, sans-serif' },
    { label: 'sans-serif', value: 'sans-serif' },
    { label: 'Segoe UI', value: '"Segoe UI", Arial, sans-serif' },
    { label: 'serif', value: 'serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  ],
  loadGoogleFonts: [
    'Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700',
    'Inter:wght@300;400;500;600;700',
    'Montserrat:wght@300;400;500;600;700',
    'Open Sans:wght@300;400;500;600;700',
    'Playfair Display:wght@400;500;600;700',
    'Poppins:wght@300;400;500;600;700',
    'Roboto:wght@300;400;500;600;700',
  ],
} satisfies Partial<VersaEditProps>

export function settingsToProps(s: Settings): Partial<VersaEditProps> {
  const d = DEFAULT_SETTINGS
  const props: Partial<VersaEditProps> = { width: s.width, height: s.height, ...PLAYGROUND_FONTS }
  if (s.toolbar.length !== GROUPS.length) props.toolbar = s.toolbar
  if (s.accentColor !== d.accentColor) props.accentColor = s.accentColor
  if (
    s.frameWidth !== d.frameWidth ||
    s.frameColor !== d.frameColor ||
    s.frameRadius !== d.frameRadius
  )
    props.frame = { width: s.frameWidth, color: s.frameColor, radius: s.frameRadius }
  // Só os lados diferentes do padrão da biblioteca
  const margin: ObjectMargin = {}
  for (const side of MARGIN_SIDES)
    if (s.objectMargin[side] !== DEFAULT_OBJECT_MARGIN[side]) margin[side] = s.objectMargin[side]
  if (Object.keys(margin).length) props.objectMargin = margin
  for (const key of BOOLEANS) if (s[key] !== d[key]) props[key] = s[key]
  // Comparado com o padrão da biblioteca ('remove'), não com o do playground
  if (s.pasteSpacing !== 'remove') props.pasteSpacing = s.pasteSpacing
  if (s.resizable) {
    const options: ResizableOptions = {}
    const defaultHandles =
      s.handles.length === DEFAULT_FRAME_HANDLES.length &&
      DEFAULT_FRAME_HANDLES.every((h) => s.handles.includes(h))
    if (!defaultHandles) options.handles = ALL_HANDLES.filter((h) => s.handles.includes(h))
    for (const key of LIMITS) if (s[key] !== null) options[key] = s[key]
    props.resizable = Object.keys(options).length ? options : true
    if (s.sizeControls) props.sizeControls = true
  }
  return props
}

// Valor em JavaScript: { width: 3, color: "#d0d7de" }, ["format","link"]
// (JSON é JavaScript válido mesmo com aspas dentro dos valores, como nos nomes
// de fonte; só as chaves perdem as aspas)
const jsLiteral = (value: unknown) => JSON.stringify(value).replace(/"(\w+)":/g, '$1: ')

// JSX equivalente à configuração atual, para copiar
export function settingsToJsx(s: Settings, locale: VersaEditLocale): string {
  const lines = ['<VersaEdit', '  ref={editorRef}']
  if (locale !== 'en') lines.push(`  locale="${locale}"`)
  for (const [key, value] of Object.entries(settingsToProps(s))) {
    if (typeof value === 'string' && !value.includes('"')) lines.push(`  ${key}="${value}"`)
    else lines.push(`  ${key}={${jsLiteral(value)}}`)
  }
  if (s.useOnError) lines.push('  onError={(error) => console.warn(error.code, error.message)}')
  if (s.resizable) lines.push('  onResize={(size, phase) => console.log(phase, size)}')
  lines.push('  onChange={setHtml}', '/>')
  return lines.join('\n')
}

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgaPj/HwAEhQJ/UhG2BwAAAABJRU5ErkJggg=='

// Textos dos conteúdos de exemplo. A estrutura HTML, os estilos e a imagem são
// os mesmos nos três idiomas; só o texto muda
const SAMPLE_TEXT = {
  en: {
    heading: 'Heading',
    bold: 'Bold',
    italic: 'italic',
    underline: 'underline',
    color: 'color',
    and: 'and a',
    link: 'link',
    first: 'First',
    second: 'Second',
    quote: 'A quote.',
    item: 'Item',
    qty: 'Qty',
    bread: 'Bread',
    milk: 'Milk',
    imageIntro: 'An image floated to the right:',
    imageAlt: 'Blue square',
    imageNext: 'Text next to it.',
    before: 'Before.',
    textbox: 'A text box',
    after: 'After.',
    paragraph: 'Paragraph',
  },
  'pt-BR': {
    heading: 'Título',
    bold: 'Negrito',
    italic: 'itálico',
    underline: 'sublinhado',
    color: 'cor',
    and: 'e um',
    link: 'link',
    first: 'Primeiro',
    second: 'Segundo',
    quote: 'Uma citação.',
    item: 'Item',
    qty: 'Qtd.',
    bread: 'Pão',
    milk: 'Leite',
    imageIntro: 'Uma imagem flutuando à direita:',
    imageAlt: 'Quadrado azul',
    imageNext: 'Texto ao lado dela.',
    before: 'Antes.',
    textbox: 'Uma caixa de texto',
    after: 'Depois.',
    paragraph: 'Parágrafo',
  },
  es: {
    heading: 'Título',
    bold: 'Negrita',
    italic: 'cursiva',
    underline: 'subrayado',
    color: 'color',
    and: 'y un',
    link: 'enlace',
    first: 'Primero',
    second: 'Segundo',
    quote: 'Una cita.',
    item: 'Artículo',
    qty: 'Cant.',
    bread: 'Pan',
    milk: 'Leche',
    imageIntro: 'Una imagen flotando a la derecha:',
    imageAlt: 'Cuadrado azul',
    imageNext: 'Texto junto a ella.',
    before: 'Antes.',
    textbox: 'Un cuadro de texto',
    after: 'Después.',
    paragraph: 'Párrafo',
  },
} satisfies Record<VersaEditLocale, Record<string, string>>

// Conteúdos de exemplo no idioma escolhido (sem endereços externos)
export function samplesFor(locale: VersaEditLocale): { id: string; html: string }[] {
  const t = SAMPLE_TEXT[locale]
  return [
    { id: 'empty', html: '' },
    {
      id: 'formatted',
      html:
        `<h2>${t.heading}</h2><p><b>${t.bold}</b>, <i>${t.italic}</i>, <u>${t.underline}</u>, ` +
        `<span style="color: rgb(190, 18, 60);">${t.color}</span> ${t.and} <a href="https://example.com">${t.link}</a>.</p>` +
        `<ul><li>${t.first}</li><li>${t.second}</li></ul><blockquote>${t.quote}</blockquote>`,
    },
    {
      id: 'table',
      html:
        `<table><thead><tr><th>${t.item}</th><th>${t.qty}</th></tr></thead>` +
        `<tbody><tr><td>${t.bread}</td><td>2</td></tr><tr><td>${t.milk}</td><td>1</td></tr></tbody></table><p></p>`,
    },
    {
      id: 'image',
      html: `<p>${t.imageIntro}</p><img src="${PIXEL}" class="pos-right" style="width: 120px" alt="${t.imageAlt}"><p>${t.imageNext}</p>`,
    },
    {
      id: 'textbox',
      html: `<p>${t.before}</p><div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>${t.textbox}</div><p>${t.after}</p>`,
    },
    {
      id: 'long',
      html: Array.from({ length: 40 }, (_, i) => `<p>${t.paragraph} ${i + 1}.</p>`).join(''),
    },
  ]
}

export const PANEL_TEXT = {
  en: {
    title: 'Playground tools',
    diagnostics: 'Diagnostics',
    toolbar: 'Menu functions',
    size: 'Dimensions',
    width: 'Width',
    height: 'Height',
    look: 'Appearance',
    accent: 'Accent color',
    frame: 'Frame (width, color, radius)',
    frameWidth: 'Frame width',
    frameColor: 'Frame color',
    frameRadius: 'Frame radius',
    objectMargin: 'Object margin (images and text boxes)',
    marginNames: {
      text: 'Text side',
      outer: 'Outer side',
      top: 'Top',
      bottom: 'Bottom',
    },
    behavior: 'Behavior',
    useOnError: 'onError (log instead of alert)',
    resize: 'Resizing',
    handles: 'Handles',
    limits: 'Limits',
    limitsHint: 'Empty field: the editor default (shown in gray).',
    limitDefaults: { minWidth: '160', maxWidth: 'container', minHeight: '80', maxHeight: 'none' },
    content: 'Sample content',
    load: 'Load',
    events: 'Events',
    jsx: 'Equivalent JSX',
    reset: 'Reset',
    groups: {
      file: 'File',
      history: 'Undo and redo',
      font: 'Font',
      block: 'Paragraph style',
      format: 'Formatting',
      highlight: 'Highlighter',
      color: 'Colors',
      align: 'Alignment',
      list: 'Lists',
      indent: 'Indentation',
      link: 'Link',
      insert: 'Insert',
      textbox: 'Text box',
      clear: 'Clear (editing area and formatting)',
    },
    options: {
      pasteImages: 'Paste images',
      allowExternalMedia: 'External audio and video',
      truncateOnOverflow: 'Cut content beyond the height',
      singleLineBreaks: 'Collapse blank lines when pasting',
      layoutMirror: 'Layout Mirror',
      pasteSpacing: 'Word spacing when pasting',
      spacingRemove: 'Remove',
      spacingPreserve: 'Keep',
      resizable: 'Resizable area',
      sizeControls: 'Size fields',
    },
    handleNames: {
      e: 'Right',
      s: 'Bottom',
      se: 'Bottom right',
      w: 'Left',
      n: 'Top',
      nw: 'Top left',
      ne: 'Top right',
      sw: 'Bottom left',
    },
    limitNames: {
      minWidth: 'Min. width',
      maxWidth: 'Max. width',
      minHeight: 'Min. height',
      maxHeight: 'Max. height',
    },
    samples: {
      empty: 'Empty',
      formatted: 'Formatted text',
      table: 'Table',
      image: 'Image',
      textbox: 'Text box',
      long: 'Long content',
    },
  },
  'pt-BR': {
    title: 'Ferramentas do playground',
    diagnostics: 'Diagnóstico',
    toolbar: 'Funções do Menu',
    size: 'Dimensões',
    width: 'Largura',
    height: 'Altura',
    look: 'Aparência',
    accent: 'Cor de destaque',
    frame: 'Moldura (largura, cor, raio)',
    frameWidth: 'Largura da moldura',
    frameColor: 'Cor da moldura',
    frameRadius: 'Raio da moldura',
    objectMargin: 'Margem dos objetos (imagens e caixas de texto)',
    marginNames: {
      text: 'Lado do texto',
      outer: 'Lado de fora',
      top: 'Em cima',
      bottom: 'Embaixo',
    },
    behavior: 'Comportamento',
    useOnError: 'onError (registro em vez de alert)',
    resize: 'Redimensionamento',
    handles: 'Alças',
    limits: 'Limites',
    limitsHint: 'Campo vazio: o padrão do editor (em cinza).',
    limitDefaults: {
      minWidth: '160',
      maxWidth: 'contêiner',
      minHeight: '80',
      maxHeight: 'sem limite',
    },
    content: 'Conteúdo de exemplo',
    load: 'Carregar',
    events: 'Eventos',
    jsx: 'JSX equivalente',
    reset: 'Restaurar',
    groups: {
      file: 'Arquivo',
      history: 'Desfazer e refazer',
      font: 'Fonte',
      block: 'Estilo do parágrafo',
      format: 'Formatação',
      highlight: 'Marca-texto',
      color: 'Cores',
      align: 'Alinhamento',
      list: 'Listas',
      indent: 'Recuo',
      link: 'Link',
      insert: 'Inserir',
      textbox: 'Caixa de texto',
      clear: 'Limpar (área de edição e formatação)',
    },
    options: {
      pasteImages: 'Colar imagens',
      allowExternalMedia: 'Áudio e vídeo externos',
      truncateOnOverflow: 'Cortar o que passar da altura',
      singleLineBreaks: 'Juntar linhas em branco ao colar',
      layoutMirror: 'Espelho de layout (Layout Mirror)',
      pasteSpacing: 'Espaçamento do Word ao colar',
      spacingRemove: 'Remover',
      spacingPreserve: 'Manter',
      resizable: 'Área redimensionável',
      sizeControls: 'Campos de tamanho',
    },
    handleNames: {
      e: 'Direita',
      s: 'Inferior',
      se: 'Inferior direito',
      w: 'Esquerda',
      n: 'Superior',
      nw: 'Superior esquerdo',
      ne: 'Superior direito',
      sw: 'Inferior esquerdo',
    },
    limitNames: {
      minWidth: 'Largura mín.',
      maxWidth: 'Largura máx.',
      minHeight: 'Altura mín.',
      maxHeight: 'Altura máx.',
    },
    samples: {
      empty: 'Vazio',
      formatted: 'Texto formatado',
      table: 'Tabela',
      image: 'Imagem',
      textbox: 'Caixa de texto',
      long: 'Conteúdo longo',
    },
  },
  es: {
    title: 'Herramientas del playground',
    diagnostics: 'Diagnóstico',
    toolbar: 'Funciones del menú',
    size: 'Dimensiones',
    width: 'Ancho',
    height: 'Alto',
    look: 'Apariencia',
    accent: 'Color de énfasis',
    frame: 'Marco (ancho, color, radio)',
    frameWidth: 'Ancho del marco',
    frameColor: 'Color del marco',
    frameRadius: 'Radio del marco',
    objectMargin: 'Margen de los objetos (imágenes y cuadros de texto)',
    marginNames: {
      text: 'Lado del texto',
      outer: 'Lado exterior',
      top: 'Arriba',
      bottom: 'Abajo',
    },
    behavior: 'Comportamiento',
    useOnError: 'onError (registro en lugar de alert)',
    resize: 'Redimensionamiento',
    handles: 'Controladores',
    limits: 'Límites',
    limitsHint: 'Campo vacío: el valor predeterminado del editor (en gris).',
    limitDefaults: {
      minWidth: '160',
      maxWidth: 'contenedor',
      minHeight: '80',
      maxHeight: 'sin límite',
    },
    content: 'Contenido de ejemplo',
    load: 'Cargar',
    events: 'Eventos',
    jsx: 'JSX equivalente',
    reset: 'Restablecer',
    groups: {
      file: 'Archivo',
      history: 'Deshacer y rehacer',
      font: 'Fuente',
      block: 'Estilo de párrafo',
      format: 'Formato',
      highlight: 'Resaltador',
      color: 'Colores',
      align: 'Alineación',
      list: 'Listas',
      indent: 'Sangría',
      link: 'Enlace',
      insert: 'Insertar',
      textbox: 'Cuadro de texto',
      clear: 'Limpiar (área de edición y formato)',
    },
    options: {
      pasteImages: 'Pegar imágenes',
      allowExternalMedia: 'Audio y video externos',
      truncateOnOverflow: 'Cortar lo que supere la altura',
      singleLineBreaks: 'Unir líneas en blanco al pegar',
      layoutMirror: 'Espejo de diseño (Layout Mirror)',
      pasteSpacing: 'Espaciado de Word al pegar',
      spacingRemove: 'Quitar',
      spacingPreserve: 'Conservar',
      resizable: 'Área redimensionable',
      sizeControls: 'Campos de tamaño',
    },
    handleNames: {
      e: 'Derecha',
      s: 'Inferior',
      se: 'Inferior derecha',
      w: 'Izquierda',
      n: 'Superior',
      nw: 'Superior izquierda',
      ne: 'Superior derecha',
      sw: 'Inferior izquierda',
    },
    limitNames: {
      minWidth: 'Ancho mín.',
      maxWidth: 'Ancho máx.',
      minHeight: 'Alto mín.',
      maxHeight: 'Alto máx.',
    },
    samples: {
      empty: 'Vacío',
      formatted: 'Texto con formato',
      table: 'Tabla',
      image: 'Imagen',
      textbox: 'Cuadro de texto',
      long: 'Contenido largo',
    },
  },
} as const satisfies Record<VersaEditLocale, unknown>

const fieldset = { border: '1px solid #ddd', borderRadius: 6, margin: '8px 0', padding: 8 } as const
const row = { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'center' } as const
const column = { display: 'flex', flexDirection: 'column', gap: 4 } as const
// Rótulo | campo | unidade, alinhados em colunas
const grid = {
  display: 'grid',
  gridTemplateColumns: 'max-content max-content max-content',
  gap: '4px 8px',
  alignItems: 'center',
} as const
const subtitle = { margin: '6px 0 2px' } as const

// Conteúdo da engrenagem do editor (prop settingsPanel): as configurações gerais
// do VersaEdit. Cada controle existe só aqui; o JSX equivalente (em Ver HTML)
// acompanha na hora, porque lê as mesmas configurações.
export function SettingsControls({
  locale,
  settings: s,
  onSettings,
}: {
  locale: VersaEditLocale
  settings: Settings
  onSettings: (s: Settings) => void
}) {
  const T = PANEL_TEXT[locale]
  const id = useId()
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onSettings({ ...s, [key]: value })
  const toggleGroup = (g: ToolbarGroup, on: boolean) =>
    set(
      'toolbar',
      GROUPS.filter((x) => (x === g ? on : s.toolbar.includes(x))),
    )

  return (
    <div data-testid="settings-panel">
      <fieldset style={fieldset}>
        <legend>{T.look}</legend>
        <div style={row}>
          <label>
            {T.accent}{' '}
            <input
              type="color"
              value={s.accentColor}
              onChange={(e) => set('accentColor', e.target.value)}
            />
          </label>
          <span>
            {T.frame}{' '}
            <input
              type="number"
              min={0}
              max={20}
              aria-label={T.frameWidth}
              value={s.frameWidth}
              onChange={(e) => set('frameWidth', Number(e.target.value))}
              style={{ width: 50 }}
            />{' '}
            <input
              type="color"
              aria-label={T.frameColor}
              value={s.frameColor}
              onChange={(e) => set('frameColor', e.target.value)}
            />{' '}
            <input
              type="number"
              min={0}
              max={40}
              aria-label={T.frameRadius}
              value={s.frameRadius}
              onChange={(e) => set('frameRadius', Number(e.target.value))}
              style={{ width: 50 }}
            />
          </span>
        </div>
        <div style={subtitle}>{T.objectMargin}:</div>
        <div style={grid} data-testid="object-margin">
          {MARGIN_SIDES.map((side) => (
            <Fragment key={side}>
              <label htmlFor={`${id}-margin-${side}`} title={`objectMargin.${side}`}>
                {T.marginNames[side]}
              </label>
              <input
                id={`${id}-margin-${side}`}
                type="number"
                min={0}
                max={200}
                step={1}
                value={s.objectMargin[side]}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (e.target.value === '' || !Number.isFinite(value)) return
                  set('objectMargin', {
                    ...s.objectMargin,
                    [side]: Math.min(200, Math.max(0, Math.round(value))),
                  })
                }}
                style={{ width: 70 }}
              />
              <span>px</span>
            </Fragment>
          ))}
        </div>
      </fieldset>

      <fieldset style={fieldset}>
        <legend>{T.toolbar}</legend>
        {/* Uma coluna, na ordem dos botões da barra (TOOLBAR_GROUPS) */}
        <div data-testid="toolbar-groups" style={column}>
          {GROUPS.map((g) => (
            <label key={g} title={g}>
              <input
                type="checkbox"
                checked={s.toolbar.includes(g)}
                onChange={(e) => toggleGroup(g, e.target.checked)}
              />{' '}
              {T.groups[g as keyof typeof T.groups]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={fieldset}>
        <legend>{T.behavior}</legend>
        <div style={row}>
          {BOOLEANS.map((key) => (
            <label key={key} title={key}>
              <input
                type="checkbox"
                checked={s[key]}
                onChange={(e) => set(key, e.target.checked)}
              />{' '}
              {T.options[key]}
            </label>
          ))}
          <label title="pasteSpacing">
            {T.options.pasteSpacing}{' '}
            <select
              value={s.pasteSpacing}
              onChange={(e) => set('pasteSpacing', e.target.value as Settings['pasteSpacing'])}
            >
              <option value="remove">{T.options.spacingRemove}</option>
              <option value="preserve">{T.options.spacingPreserve}</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset style={fieldset} data-testid="resize-settings">
        <legend>{T.resize}</legend>
        <div style={subtitle}>{T.size}:</div>
        <div style={grid}>
          <label htmlFor={`${id}-width`}>{T.width}</label>
          <select
            id={`${id}-width`}
            value={String(s.width)}
            onChange={(e) =>
              set('width', e.target.value.endsWith('%') ? e.target.value : Number(e.target.value))
            }
          >
            {WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w.endsWith('%') ? w : `${w} px`}
              </option>
            ))}
          </select>
          <span />
          <label htmlFor={`${id}-height`}>{T.height}</label>
          <select
            id={`${id}-height`}
            value={s.height}
            onChange={(e) => set('height', Number(e.target.value))}
          >
            {HEIGHTS.map((h) => (
              <option key={h} value={h}>
                {h} px
              </option>
            ))}
          </select>
          <span />
        </div>
        {/* Um respiro entre Dimensões (vale sempre) e o que depende da caixa */}
        <div style={{ ...row, marginTop: 10 }}>
          <label title="resizable">
            <input
              type="checkbox"
              checked={s.resizable}
              onChange={(e) => set('resizable', e.target.checked)}
            />{' '}
            {T.options.resizable}
          </label>
          <label title="sizeControls">
            <input
              type="checkbox"
              checked={s.sizeControls}
              disabled={!s.resizable}
              onChange={(e) => set('sizeControls', e.target.checked)}
            />{' '}
            {T.options.sizeControls}
          </label>
        </div>
        <div style={subtitle}>{T.handles}:</div>
        <div style={column}>
          {ALL_HANDLES.map((h) => (
            <label key={h} title={`'${h}'`}>
              <input
                type="checkbox"
                checked={s.handles.includes(h)}
                disabled={!s.resizable}
                onChange={(e) =>
                  set(
                    'handles',
                    ALL_HANDLES.filter((x) => (x === h ? e.target.checked : s.handles.includes(x))),
                  )
                }
              />{' '}
              {T.handleNames[h]}
            </label>
          ))}
        </div>
        <div style={subtitle}>{T.limits}:</div>
        <div style={grid}>
          {LIMITS.map((key) => (
            <Fragment key={key}>
              <label htmlFor={`${id}-${key}`} title={key}>
                {T.limitNames[key]}
              </label>
              <input
                id={`${id}-${key}`}
                type="number"
                min={0}
                step={10}
                disabled={!s.resizable}
                placeholder={T.limitDefaults[key]}
                value={s[key] ?? ''}
                onChange={(e) =>
                  set(key, e.target.value === '' ? null : Math.max(0, Number(e.target.value)))
                }
                style={{ width: 90 }}
              />
              <span>px</span>
            </Fragment>
          ))}
        </div>
        <small style={{ color: '#666' }}>{T.limitsHint}</small>
      </fieldset>

      <button type="button" onClick={() => onSettings(DEFAULT_SETTINGS)}>
        {T.reset}
      </button>
    </div>
  )
}

interface PanelProps {
  locale: VersaEditLocale
  settings: Settings
  onSettings: (s: Settings) => void
  onLoadSample: (html: string) => void
  events: string[]
}

// Ferramentas do playground (em Ver HTML): conteúdo de exemplo, diagnóstico de
// erros, registro de eventos e JSX equivalente às configurações da engrenagem
export function PropsPanel({ locale, settings: s, onSettings, onLoadSample, events }: PanelProps) {
  const T = PANEL_TEXT[locale]

  return (
    <details style={{ margin: '12px 0' }} data-testid="props-panel">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{T.title}</summary>

      <fieldset style={fieldset}>
        <legend>{T.content}</legend>
        <div style={row}>
          {samplesFor(locale).map((sample) => (
            <button key={sample.id} type="button" onClick={() => onLoadSample(sample.html)}>
              {T.load}: {T.samples[sample.id as keyof typeof T.samples]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset style={fieldset}>
        <legend>{T.diagnostics}</legend>
        <label>
          <input
            type="checkbox"
            checked={s.useOnError}
            onChange={(e) => onSettings({ ...s, useOnError: e.target.checked })}
          />{' '}
          {T.useOnError}
        </label>
      </fieldset>

      <div
        className="pg-two-col"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
      >
        <div>
          <h2 style={{ fontSize: 14 }}>{T.events}</h2>
          <pre
            data-testid="events"
            style={{
              fontSize: 12,
              background: '#f4f4f4',
              padding: 8,
              minHeight: 80,
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {events.join('\n')}
          </pre>
        </div>
        <div>
          <h2 style={{ fontSize: 14 }}>{T.jsx}</h2>
          <pre
            data-testid="jsx"
            style={{
              fontSize: 12,
              background: '#f4f4f4',
              padding: 8,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {settingsToJsx(s, locale)}
          </pre>
        </div>
      </div>
    </details>
  )
}
