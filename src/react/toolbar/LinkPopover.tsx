import { useEffect, useRef, useState } from 'react'
import type { LinkDraft, VersaEditCore } from '../../core/editor'
import type { VersaEditLabels } from '../../core/i18n'

// Formulário de link (no lugar do prompt() do navegador): endereço e texto.
// Enter aplica, Esc ou clique fora cancela.
export function LinkPopover({
  core,
  labels: L,
  draft,
  onClose,
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  draft: LinkDraft
  onClose: () => void
}) {
  const [url, setUrl] = useState(draft.url || 'https://')
  const [text, setText] = useState(draft.text)
  const [invalid, setInvalid] = useState(false)
  const boxRef = useRef<HTMLFormElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  const cancel = () => {
    core()?.cancelLink()
    onClose()
  }

  useEffect(() => {
    urlRef.current?.select()
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // Fora do formulário e do botão de link (o botão fecha por conta própria)
      const area = boxRef.current?.parentElement ?? boxRef.current
      if (area && !area.contains(e.target as Node)) {
        core()?.cancelLink()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [core, onClose])

  return (
    <form
      ref={boxRef}
      className="ve-link-popover"
      role="dialog"
      aria-label={L.insertLink}
      onSubmit={(e) => {
        e.preventDefault()
        if (core()?.applyLink(url, text)) onClose()
        else setInvalid(true)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          cancel()
        }
      }}
    >
      <label>
        {L.linkUrlPrompt}
        <input
          ref={urlRef}
          type="text"
          inputMode="url"
          value={url}
          aria-invalid={invalid}
          onChange={(e) => {
            setUrl(e.target.value)
            setInvalid(false)
          }}
        />
      </label>
      {invalid && (
        <div className="ve-link-error" role="alert">
          {L.linkInvalid}
        </div>
      )}
      <label>
        {L.linkTextPrompt}
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="ve-link-actions">
        <button type="button" onClick={cancel}>
          {L.linkCancel}
        </button>
        <button type="submit">{L.linkApply}</button>
      </div>
    </form>
  )
}
