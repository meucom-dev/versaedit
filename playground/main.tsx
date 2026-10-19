import { StrictMode, useCallback, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { VersaEdit, VersaEditDictation, type VersaEditHandle, type VersaEditLocale } from '../src'
import { DEFAULT_SETTINGS, PropsPanel, settingsToProps } from './PropsPanel'

// Textos do próprio playground (o editor tem os seus em src/core/i18n)
const TEXT = {
  en: {
    locale: 'Language',
    showHtml: 'Show HTML',
    second: '<p>Second editor with <i>onSave</i>.</p>',
    useOnSave: 'Show editor with onSave',
    hideOnSave: 'Hide editor with onSave',
    siteNote:
      'Beta — the API may change before 1.0. Nothing you type leaves your browser: VersaEdit has no server. Dictation, when used, sends audio to your browser vendor (Google, Microsoft or Apple).',
  },
  'pt-BR': {
    locale: 'Idioma',
    showHtml: 'Ver HTML',
    second: '<p>Segundo editor com <i>onSave</i>.</p>',
    useOnSave: 'Mostrar editor com onSave',
    hideOnSave: 'Esconder editor com onSave',
    siteNote:
      'Beta — a API pode mudar antes da 1.0. Nada do que você digita sai do navegador: o VersaEdit não tem servidor. O ditado, quando usado, envia o áudio ao fabricante do navegador (Google, Microsoft ou Apple).',
  },
} satisfies Record<VersaEditLocale, Record<string, string>>

// Só para exibir: imagens embutidas (base64) aparecem abreviadas, com o tamanho
const shortenDataUris = (html: string) =>
  html.replace(
    /(data:[\w/+.-]+;base64,)([A-Za-z0-9+/=]{40,})/g,
    (_m, head: string, data: string) => {
      const kb = Math.max(1, Math.round((data.length * 3) / 4 / 1024))
      return `${head}${data.slice(0, 16)}… (${kb} KB)`
    },
  )

// Caixa de código: quebra linhas longas em qualquer ponto, sem vazar da área
const codeStyle = {
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  padding: 12,
  fontSize: 12,
} as const

function App() {
  const [locale, setLocale] = useState<VersaEditLocale>('en')
  const T = TEXT[locale]
  const [html, setHtml] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const editorRef = useRef<VersaEditHandle>(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  // Registro de eventos do painel "Propriedades" (os 30 mais recentes)
  const [events, setEvents] = useState<string[]>([])
  const log = useCallback((line: string) => {
    const time = new Date().toLocaleTimeString()
    setEvents((list) => [`${time}  ${line}`, ...list].slice(0, 30))
  }, [])
  const onChange = useCallback(
    (value: string) => {
      setHtml(value)
      log(`onChange (${value.length})`)
    },
    [log],
  )

  return (
    <div
      lang={locale}
      style={{ maxWidth: 1000, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui' }}
    >
      <h1 style={{ fontSize: 20 }}>VersaEdit — playground</h1>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <label>
          {T.locale}{' '}
          <select value={locale} onChange={(e) => setLocale(e.target.value as VersaEditLocale)}>
            <option value="en">English</option>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </label>
        {/* Microfone em destaque, fora da barra de ferramentas */}
        <VersaEditDictation editor={editorRef} locale={locale} />
      </div>
      <VersaEdit
        ref={editorRef}
        showDictation={false}
        onChange={onChange}
        onFocus={() => log('onFocus')}
        onBlur={() => log('onBlur')}
        onOverflowChange={(overflow) => log(`onOverflowChange (${overflow})`)}
        onError={settings.useOnError ? (e) => log(`onError ${e.code}: ${e.message}`) : undefined}
        locale={locale}
        {...settingsToProps(settings)}
      />
      {/* Área de desenvolvimento, recolhida: HTML gerado, propriedades e teste do onSave */}
      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{T.showHtml}</summary>
        <pre style={{ ...codeStyle, background: '#f4f4f4' }}>{shortenDataUris(html)}</pre>
        <PropsPanel
          locale={locale}
          settings={settings}
          onSettings={setSettings}
          onLoadSample={(sample) => {
            // setHTML não chama onChange: o HTML exibido é lido de volta
            const editor = editorRef.current
            if (!editor) return
            editor.setHTML(sample)
            setHtml(editor.getHTML())
            log(`setHTML (${sample.length})`)
          }}
          events={events}
        />
        {saved !== null && (
          <>
            <h2 style={{ fontSize: 16 }}>onSave</h2>
            <pre style={{ ...codeStyle, background: '#eef6ee' }}>{shortenDataUris(saved)}</pre>
          </>
        )}
        <p style={{ fontSize: 12, color: '#666' }}>
          <button type="button" onClick={() => setSaved(saved === null ? '' : null)}>
            {saved === null ? T.useOnSave : T.hideOnSave}
          </button>
        </p>
        {saved !== null && (
          <VersaEdit
            initialContent={T.second}
            onSave={setSaved}
            locale={locale}
            width={600}
            height={200}
            frame={{ width: 6, color: '#8fbc8f', radius: 16 }}
          />
        )}
      </details>
      {/* Só no playground público (npm run build:site) */}
      {import.meta.env.MODE === 'site' && (
        <p data-testid="site-note" style={{ marginTop: 24, fontSize: 12, color: '#666' }}>
          {T.siteNote} <a href="https://versaedit.dev">versaedit.dev</a> ·{' '}
          <a href="mailto:support@versaedit.dev">support@versaedit.dev</a>
        </p>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
