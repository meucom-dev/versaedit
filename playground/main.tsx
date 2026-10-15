import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
// Estilos do CoreUI: necessários até a Fase 3 (tooltips e ícones da barra)
import '@coreui/coreui/dist/css/coreui.min.css'
import { VersaEdit } from '../src'

const INITIAL = '<p>Olá, <b>VersaEdit</b>! Edite este texto.</p>'

function App() {
  const [html, setHtml] = useState(INITIAL)
  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20 }}>VersaEdit — playground</h1>
      <VersaEdit initialContent={INITIAL} onChange={setHtml} />
      <h2 style={{ fontSize: 16, marginTop: 24 }}>HTML</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 12, fontSize: 12 }}>
        {html}
      </pre>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
