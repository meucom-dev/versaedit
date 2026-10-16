import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { VersaEdit, VersaEditDictation, type VersaEditHandle, type VersaEditLocale } from '../src'

// Textos do próprio playground (o editor tem os seus em src/core/i18n)
const TEXT = {
  en: {
    locale: 'Language',
    showHtml: 'Show HTML',
    sample: '<p>Hello, <b>VersaEdit</b>! Edit this text.</p>',
    second: '<p>Second editor with <i>onSave</i>.</p>',
    useOnSave: 'Show editor with onSave',
    hideOnSave: 'Hide editor with onSave',
  },
  'pt-BR': {
    locale: 'Idioma',
    showHtml: 'Ver HTML',
    sample: '<p>Olá, <b>VersaEdit</b>! Edite este texto.</p>',
    second: '<p>Segundo editor com <i>onSave</i>.</p>',
    useOnSave: 'Mostrar editor com onSave',
    hideOnSave: 'Esconder editor com onSave',
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
  const [content, setContent] = useState(T.sample)
  const [html, setHtml] = useState(T.sample)
  const [saved, setSaved] = useState<string | null>(null)
  const editorRef = useRef<VersaEditHandle>(null)

  const changeLocale = (next: VersaEditLocale) => {
    // Troca o texto de exemplo só se ele ainda não foi editado
    if (html === T.sample) {
      setContent(TEXT[next].sample)
      setHtml(TEXT[next].sample)
    }
    setLocale(next)
  }

  return (
    <div
      lang={locale}
      style={{ maxWidth: 1000, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui' }}
    >
      <h1 style={{ fontSize: 20 }}>VersaEdit — playground</h1>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <label>
          {T.locale}{' '}
          <select value={locale} onChange={(e) => changeLocale(e.target.value as VersaEditLocale)}>
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
        initialContent={content}
        onChange={setHtml}
        locale={locale}
        width={900}
        height={420}
      />
      {/* Área de desenvolvimento: HTML gerado e teste do onSave, recolhidos */}
      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{T.showHtml}</summary>
        <pre style={{ ...codeStyle, background: '#f4f4f4' }}>{shortenDataUris(html)}</pre>
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
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
