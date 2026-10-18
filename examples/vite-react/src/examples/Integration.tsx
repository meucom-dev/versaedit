import { useRef, useState } from 'react'
import { VersaEdit, type VersaEditConfirm, type VersaEditError } from 'versaedit'

// Simulated upload: a real app sends the file to its storage (S3, Supabase
// Storage…) and returns the public URL. Here the URL points to the file itself.
async function uploadImage(file: File, fail: boolean): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  if (fail) throw new Error('Simulated network error')
  return URL.createObjectURL(file)
}

// Your own UI instead of the browser's alert() and confirm()
export function Integration() {
  const [error, setError] = useState<VersaEditError | null>(null)
  const [question, setQuestion] = useState<VersaEditConfirm | null>(null)
  const answer = useRef<(yes: boolean) => void>(() => {})
  const [failUpload, setFailUpload] = useState(false)
  const [savedChars, setSavedChars] = useState<number | null>(null)

  // onConfirm may return a Promise: the editor waits for the user's answer
  const confirmWithDialog = (request: VersaEditConfirm) =>
    new Promise<boolean>((resolve) => {
      answer.current = (yes) => {
        setQuestion(null)
        resolve(yes)
      }
      setQuestion(request)
    })

  return (
    <>
      <label className="option">
        <input
          type="checkbox"
          checked={failUpload}
          onChange={(e) => setFailUpload(e.target.checked)}
        />
        Simulate image upload failure
      </label>
      <VersaEdit
        initialContent="<p>Insert an image, or open an .html file, from the toolbar.</p>"
        width="100%"
        height={300}
        onImageUpload={(file) => uploadImage(file, failUpload)}
        onError={setError}
        onConfirm={confirmWithDialog}
        onSave={(html) => setSavedChars(html.length)}
      />
      {error && (
        <div role="alert" className={`notice notice--${error.level}`} data-code={error.code}>
          {error.message} <small>({error.code})</small>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {question && (
        <div role="dialog" aria-modal="true" aria-label="Confirm" className="dialog">
          <p>{question.message}</p>
          <button type="button" onClick={() => answer.current(true)}>
            Replace
          </button>
          <button type="button" onClick={() => answer.current(false)}>
            Keep current text
          </button>
        </div>
      )}
      {savedChars !== null && (
        <p data-testid="saved">Saved through onSave: {savedChars} characters</p>
      )}
    </>
  )
}
