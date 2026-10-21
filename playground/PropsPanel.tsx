// Painel "Propriedades" do playground: muda props do editor ao vivo, carrega
// conteúdos de exemplo, registra os eventos e mostra o JSX equivalente.
// Recolhido por padrão; sem mudanças, o editor recebe as props de sempre.
import { useState, type CSSProperties } from 'react'
import {
  TOOLBAR_GROUPS,
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
  showFileButtons: boolean
  pasteImages: boolean
  allowExternalMedia: boolean
  truncateOnOverflow: boolean
  singleLineBreaks: boolean
  useOnError: boolean
}

// Grupos que o painel controla (o ditado fica fora da barra no playground)
const GROUPS = TOOLBAR_GROUPS.filter((g) => g !== 'dictation')

export const DEFAULT_SETTINGS: Settings = {
  toolbar: [...GROUPS],
  width: 900,
  height: 420,
  accentColor: '#2563eb',
  frameWidth: 1,
  frameColor: '#d0d7de',
  frameRadius: 8,
  showFileButtons: true,
  pasteImages: true,
  allowExternalMedia: false,
  truncateOnOverflow: false,
  singleLineBreaks: false,
  useOnError: false,
}

const BOOLEANS = [
  'showFileButtons',
  'pasteImages',
  'allowExternalMedia',
  'truncateOnOverflow',
  'singleLineBreaks',
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
  for (const key of BOOLEANS) if (s[key] !== d[key]) props[key] = s[key]
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
    title: 'Properties',
    toolbar: 'Toolbar groups',
    size: 'Size',
    width: 'Width',
    height: 'Height',
    look: 'Appearance',
    accent: 'Accent color',
    frame: 'Frame (width, color, radius)',
    frameWidth: 'Frame width',
    frameColor: 'Frame color',
    frameRadius: 'Frame radius',
    behavior: 'Behavior',
    useOnError: 'onError (log instead of alert)',
    content: 'Sample content',
    load: 'Load',
    events: 'Events',
    jsx: 'Equivalent JSX',
    reset: 'Reset',
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
    title: 'Propriedades',
    toolbar: 'Grupos da barra',
    size: 'Tamanho',
    width: 'Largura',
    height: 'Altura',
    look: 'Aparência',
    accent: 'Cor de destaque',
    frame: 'Moldura (largura, cor, raio)',
    frameWidth: 'Largura da moldura',
    frameColor: 'Cor da moldura',
    frameRadius: 'Raio da moldura',
    behavior: 'Comportamento',
    useOnError: 'onError (registro em vez de alert)',
    content: 'Conteúdo de exemplo',
    load: 'Carregar',
    events: 'Eventos',
    jsx: 'JSX equivalente',
    reset: 'Restaurar',
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
    title: 'Propiedades',
    toolbar: 'Grupos de la barra',
    size: 'Tamaño',
    width: 'Ancho',
    height: 'Alto',
    look: 'Apariencia',
    accent: 'Color de énfasis',
    frame: 'Marco (ancho, color, radio)',
    frameWidth: 'Ancho del marco',
    frameColor: 'Color del marco',
    frameRadius: 'Radio del marco',
    behavior: 'Comportamiento',
    useOnError: 'onError (registro en lugar de alert)',
    content: 'Contenido de ejemplo',
    load: 'Cargar',
    events: 'Eventos',
    jsx: 'JSX equivalente',
    reset: 'Restablecer',
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

// Campo numérico com rascunho: o que se digita fica só no campo até ser confirmado
// (Enter ou sair do campo); Esc volta ao valor confirmado. Na confirmação, o valor
// vai para o limite mais próximo, e um campo vazio ou inválido volta ao anterior.
// As setas (teclado ou do próprio campo) geram valores válidos e aplicam na hora.
function NumberField({
  value,
  min,
  max,
  step,
  onCommit,
  style,
}: {
  value: number
  min: number
  max: number
  step: number
  onCommit: (value: number) => void
  style?: CSSProperties
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    const typed = Math.round(Number(text))
    setDraft(null)
    if (text.trim() === '' || !Number.isFinite(typed)) return
    const next = Math.min(max, Math.max(min, typed))
    if (next !== value) onCommit(next)
  }
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      aria-invalid={draft !== null && !(Number(draft) >= min && Number(draft) <= max)}
      onChange={(e) => {
        // Digitar, apagar ou colar: rascunho. Passo das setas (sem inputType no
        // Chromium e no WebKit; insertReplacementText no Firefox): confirma
        const type = (e.nativeEvent as InputEvent).inputType
        const editing = !!type && type !== 'insertReplacementText'
        if (editing) setDraft(e.target.value)
        else commit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && draft !== null) commit(draft)
        if (e.key === 'Escape' && draft !== null) {
          e.preventDefault()
          setDraft(null)
        }
      }}
      onBlur={() => draft !== null && commit(draft)}
      style={style}
    />
  )
}

const fieldset = { border: '1px solid #ddd', borderRadius: 6, margin: '8px 0', padding: 8 } as const
const row = { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'center' } as const

interface PanelProps {
  locale: VersaEditLocale
  settings: Settings
  onSettings: (s: Settings) => void
  onLoadSample: (html: string) => void
  events: string[]
}

export function PropsPanel({ locale, settings: s, onSettings, onLoadSample, events }: PanelProps) {
  const T = PANEL_TEXT[locale]
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onSettings({ ...s, [key]: value })
  const toggleGroup = (g: ToolbarGroup, on: boolean) =>
    set(
      'toolbar',
      GROUPS.filter((x) => (x === g ? on : s.toolbar.includes(x))),
    )

  return (
    <details style={{ margin: '12px 0' }} data-testid="props-panel">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{T.title}</summary>

      <fieldset style={fieldset}>
        <legend>{T.toolbar}</legend>
        <div style={row}>
          {GROUPS.map((g) => (
            <label key={g}>
              <input
                type="checkbox"
                checked={s.toolbar.includes(g)}
                onChange={(e) => toggleGroup(g, e.target.checked)}
              />{' '}
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={fieldset}>
        <legend>{T.size}</legend>
        <div style={row}>
          <label>
            {T.width}{' '}
            <select
              value={String(s.width)}
              onChange={(e) =>
                set('width', e.target.value.endsWith('%') ? e.target.value : Number(e.target.value))
              }
            >
              <option value="900">900</option>
              <option value="640">640</option>
              <option value="100%">100%</option>
            </select>
          </label>
          <label>
            {T.height}{' '}
            <NumberField
              min={150}
              max={900}
              step={10}
              value={s.height}
              onCommit={(height) => set('height', height)}
              style={{ width: 70 }}
            />
          </label>
        </div>
      </fieldset>

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
      </fieldset>

      <fieldset style={fieldset}>
        <legend>{T.behavior}</legend>
        <div style={row}>
          {BOOLEANS.map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={s[key]}
                onChange={(e) => set(key, e.target.checked)}
              />{' '}
              {key}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={s.useOnError}
              onChange={(e) => set('useOnError', e.target.checked)}
            />{' '}
            {T.useOnError}
          </label>
        </div>
      </fieldset>

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
      <button type="button" onClick={() => onSettings(DEFAULT_SETTINGS)}>
        {T.reset}
      </button>
    </details>
  )
}
