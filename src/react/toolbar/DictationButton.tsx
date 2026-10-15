import { useEffect, useRef, useState } from 'react'
import type { VersaEditCore } from '../../core/editor'
import { format, type VersaEditLabels } from '../../core/i18n'
import {
  createDictation,
  type Dictation,
  type DictationError,
  type SpeechRecognitionConstructor,
} from '../../core/speech'
import { IconMic } from '../icons'

// Botão de ditado: liga/desliga o microfone. O texto provisório aparece num
// balão; o trecho confirmado entra no cursor do editor.
export function DictationButton({
  core,
  labels: L,
  lang,
  recognition,
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  lang: string
  recognition: SpeechRecognitionConstructor
}) {
  const [active, setActive] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const dictationRef = useRef<Dictation | null>(null)
  const labelsRef = useRef(L)
  useEffect(() => {
    labelsRef.current = L
  })

  // Um ditado por idioma/mecanismo; desligado ao trocar ou desmontar
  useEffect(() => {
    const errorText = (kind: DictationError, detail: string) => {
      const T = labelsRef.current
      if (kind === 'denied') return T.dictationDenied
      if (kind === 'no-microphone') return T.dictationNoMicrophone
      if (kind === 'network') return T.dictationNetwork
      return format(T.dictationError, { error: detail })
    }
    const dictation = createDictation({
      recognition,
      lang,
      onInterim: setInterim,
      onFinal: (text) => core()?.insertDictation(text),
      onError: (kind, detail) => setError(errorText(kind, detail)),
      onStateChange: setActive,
    })
    dictationRef.current = dictation
    return () => {
      dictation.stop()
      dictationRef.current = null
    }
  }, [core, lang, recognition])

  const toggle = () => {
    const dictation = dictationRef.current
    if (!dictation) return
    if (dictation.active) {
      dictation.stop()
    } else {
      setError('')
      dictation.start()
    }
  }

  const title = active ? L.dictateStop : L.dictate
  const bubble = error || (active ? interim || L.dictationListening : '')

  return (
    <div className="ve-dictation">
      <button
        type="button"
        className={`ve-btn ${active ? 've-recording' : ''}`.trim()}
        title={title}
        aria-label={title}
        aria-pressed={active}
        // Mantém o cursor no editor: o texto ditado entra onde ele estava
        onMouseDown={(e) => {
          e.preventDefault()
          core()?.saveSelection()
        }}
        onClick={toggle}
      >
        <IconMic />
      </button>
      {bubble && (
        <div
          className={`ve-dictation-bubble ${error ? 've-dictation-error' : ''}`.trim()}
          role={error ? 'alert' : 'status'}
          aria-live="polite"
        >
          {bubble}
        </div>
      )}
    </div>
  )
}
