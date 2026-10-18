import { useRef } from 'react'
import { VersaEdit, VersaEditDictation, type VersaEditHandle } from 'versaedit'

// Microphone outside the toolbar. It only appears in browsers with speech
// recognition (Chrome, Edge, Safari); the audio is processed by the browser
// vendor's servers.
export function ExternalDictation() {
  const editor = useRef<VersaEditHandle>(null)
  return (
    <>
      <div className="actions">
        <VersaEditDictation editor={editor} />
      </div>
      <VersaEdit
        ref={editor}
        showDictation={false}
        initialContent="<p>Click the microphone and speak.</p>"
        width="100%"
        height={260}
      />
    </>
  )
}
