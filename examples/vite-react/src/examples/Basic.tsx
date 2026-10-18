import { useRef, useState } from 'react'
import { VersaEdit, type VersaEditHandle } from 'versaedit'

const INITIAL =
  '<h2>Hello, VersaEdit</h2><p>Type here. <b>Bold</b>, <i>italic</i> and a text box:</p>' +
  '<div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>A text box</div>'

// Controlled value (onChange) and reading the HTML through the ref
export function Basic() {
  const editor = useRef<VersaEditHandle>(null)
  const [html, setHtml] = useState(INITIAL)
  const [saved, setSaved] = useState('')

  return (
    <>
      <VersaEdit ref={editor} initialContent={html} onChange={setHtml} width="100%" height={320} />
      <div className="actions">
        <button type="button" onClick={() => setSaved(editor.current?.getHTML() ?? '')}>
          Save draft
        </button>
        <button type="button" onClick={() => editor.current?.clear()}>
          Clear
        </button>
        <span data-testid="length">{html.length} characters</span>
      </div>
      {/* Content produced by the editor. In a real site, sanitize it on the server
          before storing or displaying it (see the integration guide). */}
      <section
        className="preview versaedit-content"
        data-testid="preview"
        dangerouslySetInnerHTML={{ __html: saved }}
      />
    </>
  )
}
