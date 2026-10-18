import { Editor } from './Editor'

// HTML as the editor saves it. In a real app it comes from your database and
// must be sanitized on the server before it is stored or displayed.
const PUBLISHED =
  '<p>This post was rendered on the <b>server</b>.</p>' +
  '<div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>A text box</div>'

// Server Component: no 'use client' here
export default function Page() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      <h1>VersaEdit — Next.js (App Router)</h1>
      <Editor initialContent="<p>Edit me. The editor was server-rendered, then hydrated.</p>" />
      <h2>Published content</h2>
      <section
        className="versaedit-content"
        data-testid="published"
        dangerouslySetInnerHTML={{ __html: PUBLISHED }}
      />
    </main>
  )
}
