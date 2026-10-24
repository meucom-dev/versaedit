import { useRef, useState } from 'react'
import { VersaEdit, type VersaEditHandle } from 'versaedit'
// Editor styles as a file (used with injectStyles={false}; see "Styles")
import 'versaedit/versaedit.css'

const INITIAL_HTML =
  '<h2>Hello, VersaEdit</h2><p>Edit this text and click <strong>Save content</strong>.</p>'

export default function App() {
  const editorRef = useRef<VersaEditHandle>(null)
  // Latest HTML produced by the editor (updated on every change)
  const [html, setHtml] = useState(INITIAL_HTML)
  // HTML captured by the "Save content" button
  const [savedHtml, setSavedHtml] = useState('')

  function handleSave() {
    // getHTML() returns the current content (the same HTML as the onChange state)
    setSavedHtml(editorRef.current?.getHTML() ?? html)
  }

  return (
    <main style={{ maxWidth: 820, margin: '32px auto', padding: '0 16px' }}>
      <h1>VersaEdit Quick Start</h1>
      <VersaEdit
        ref={editorRef}
        initialContent={INITIAL_HTML}
        onChange={setHtml}
        injectStyles={false}
        width="100%"
        height={360}
        locale="en"
      />
      <p>
        <button type="button" onClick={handleSave}>
          Save content
        </button>{' '}
        <small>{html.length} characters of HTML</small>
      </p>
      <h2>Captured HTML</h2>
      {/* Shown as text: React escapes it, nothing is executed */}
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {savedHtml || 'Click "Save content" to capture the HTML.'}
      </pre>
    </main>
  )
}
