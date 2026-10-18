// Painel "Propriedades" do playground: muda props do editor ao vivo, carrega
// conteúdos de exemplo, registra os eventos e mostra o JSX equivalente.
// Recolhido por padrão; sem mudanças, o editor recebe as props de sempre.
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
export function settingsToProps(s: Settings): Partial<VersaEditProps> {
  const d = DEFAULT_SETTINGS
  const props: Partial<VersaEditProps> = { width: s.width, height: s.height }
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

// Valor em JavaScript legível: { width: 3, color: '#d0d7de' }, ['format', 'link']
const jsLiteral = (value: unknown) =>
  JSON.stringify(value)
    .replace(/"(\w+)":/g, '$1: ')
    .replaceAll(',', ', ')
    .replaceAll('"', "'")

// JSX equivalente à configuração atual, para copiar
export function settingsToJsx(s: Settings, locale: VersaEditLocale): string {
  const lines = ['<VersaEdit', '  ref={editorRef}']
  if (locale !== 'en') lines.push(`  locale="${locale}"`)
  for (const [key, value] of Object.entries(settingsToProps(s))) {
    if (typeof value === 'string') lines.push(`  ${key}="${value}"`)
    else lines.push(`  ${key}={${jsLiteral(value)}}`)
  }
  if (s.useOnError) lines.push('  onError={(error) => console.warn(error.code, error.message)}')
  lines.push('  onChange={setHtml}', '/>')
  return lines.join('\n')
}

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgaPj/HwAEhQJ/UhG2BwAAAABJRU5ErkJggg=='

// Conteúdos de exemplo (sem endereços externos)
export const SAMPLES: { id: string; html: string }[] = [
  { id: 'empty', html: '' },
  {
    id: 'formatted',
    html:
      '<h2>Heading</h2><p><b>Bold</b>, <i>italic</i>, <u>underline</u>, ' +
      '<span style="color: rgb(190, 18, 60);">color</span> and a <a href="https://example.com">link</a>.</p>' +
      '<ul><li>First</li><li>Second</li></ul><blockquote>A quote.</blockquote>',
  },
  {
    id: 'table',
    html:
      '<table><thead><tr><th>Item</th><th>Qty</th></tr></thead>' +
      '<tbody><tr><td>Bread</td><td>2</td></tr><tr><td>Milk</td><td>1</td></tr></tbody></table><p></p>',
  },
  {
    id: 'image',
    html: `<p>An image floated to the right:</p><img src="${PIXEL}" class="pos-right" style="width: 120px" alt="Blue square"><p>Text next to it.</p>`,
  },
  {
    id: 'textbox',
    html: '<p>Before.</p><div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>A text box</div><p>After.</p>',
  },
  {
    id: 'long',
    html: Array.from({ length: 40 }, (_, i) => `<p>Paragraph ${i + 1}.</p>`).join(''),
  },
]

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
} as const

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
            <input
              type="number"
              min={150}
              max={900}
              step={10}
              value={s.height}
              onChange={(e) => set('height', Number(e.target.value) || DEFAULT_SETTINGS.height)}
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
              aria-label="frame width"
              value={s.frameWidth}
              onChange={(e) => set('frameWidth', Number(e.target.value))}
              style={{ width: 50 }}
            />{' '}
            <input
              type="color"
              aria-label="frame color"
              value={s.frameColor}
              onChange={(e) => set('frameColor', e.target.value)}
            />{' '}
            <input
              type="number"
              min={0}
              max={40}
              aria-label="frame radius"
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
          {SAMPLES.map((sample) => (
            <button key={sample.id} type="button" onClick={() => onLoadSample(sample.html)}>
              {T.load}: {T.samples[sample.id as keyof typeof T.samples]}
            </button>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            style={{ fontSize: 12, background: '#f4f4f4', padding: 8, whiteSpace: 'pre-wrap' }}
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
