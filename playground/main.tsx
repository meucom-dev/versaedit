import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { VersaEdit, VersaEditDictation, type VersaEditHandle, type VersaEditLocale } from '../src'

// Textos do próprio playground (o editor tem os seus em src/core/i18n)
const TEXT = {
  en: {
    locale: 'Language',
    sample: '<p>Hello, <b>VersaEdit</b>! Edit this text.</p>',
    second: '<p>Second editor with <i>onSave</i>.</p>',
    useOnSave: 'Show editor with onSave',
    hideOnSave: 'Hide editor with onSave',
  },
  'pt-BR': {
    locale: 'Idioma',
    sample: '<p>Olá, <b>VersaEdit</b>! Edite este texto.</p>',
    second: '<p>Segundo editor com <i>onSave</i>.</p>',
    useOnSave: 'Mostrar editor com onSave',
    hideOnSave: 'Esconder editor com onSave',
  },
} satisfies Record<VersaEditLocale, Record<string, string>>

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
      <h2 style={{ fontSize: 16, marginTop: 24 }}>HTML</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 12, fontSize: 12 }}>
        {html}
      </pre>
      {saved !== null && (
        <>
          <h2 style={{ fontSize: 16 }}>onSave</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#eef6ee', padding: 12, fontSize: 12 }}>
            {saved}
          </pre>
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
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
