import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { VersaEdit, type VersaEditLocale } from '../src'

const INITIAL = '<p>Hello, <b>VersaEdit</b>! Edit this text.</p>'

function App() {
  const [html, setHtml] = useState(INITIAL)
  const [locale, setLocale] = useState<VersaEditLocale>('en')
  const [accent, setAccent] = useState('#2563eb')
  const [showFiles, setShowFiles] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)

  return (
    <div
      style={{ maxWidth: 1000, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui' }}
    >
      <h1 style={{ fontSize: 20 }}>VersaEdit — playground</h1>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <label>
          Locale{' '}
          <select value={locale} onChange={(e) => setLocale(e.target.value as VersaEditLocale)}>
            <option value="en">en</option>
            <option value="pt-BR">pt-BR</option>
          </select>
        </label>
        <label>
          Accent <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={showFiles}
            onChange={(e) => setShowFiles(e.target.checked)}
          />{' '}
          File buttons
        </label>
      </div>
      <VersaEdit
        initialContent={INITIAL}
        onChange={setHtml}
        locale={locale}
        accentColor={accent}
        showFileButtons={showFiles}
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
          {saved === null ? 'Use onSave' : 'Use file download'}
        </button>
      </p>
      {saved !== null && (
        <VersaEdit
          initialContent="<p>Second editor with <i>onSave</i>.</p>"
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
