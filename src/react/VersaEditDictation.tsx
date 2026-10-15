import { useEffect, useMemo, useState, type RefObject } from 'react'
import { resolveLabels, type VersaEditLabels, type VersaEditLocale } from '../core/i18n'
import {
  browserSpeechRecognition,
  SPEECH_LANG,
  type SpeechRecognitionConstructor,
} from '../core/speech'
import { injectStyles } from '../core/styles'
import { DictationButton } from './toolbar/DictationButton'
import type { VersaEditHandle } from './VersaEdit'

export interface VersaEditDictationProps {
  /** Ref do VersaEdit que recebe o texto ditado */
  editor: RefObject<VersaEditHandle | null>
  /** Idioma dos textos do botão (padrão: 'en') */
  locale?: VersaEditLocale
  labels?: Partial<VersaEditLabels>
  /** Idioma do ditado (padrão: o do `locale`) */
  speechLang?: string
  /** Outro mecanismo de reconhecimento com a interface do SpeechRecognition */
  speechRecognition?: SpeechRecognitionConstructor
  /** Mostra "Ditar"/"Parar" ao lado do ícone (padrão: true) */
  showText?: boolean
}

/**
 * Botão de ditado fora da barra de ferramentas, para colocar onde for mais
 * visível na página. Use com `showDictation={false}` no VersaEdit para não
 * repetir o microfone na barra. Não aparece sem reconhecimento de voz.
 */
export function VersaEditDictation({
  editor,
  locale = 'en',
  labels,
  speechLang,
  speechRecognition,
  showText = true,
}: VersaEditDictationProps) {
  const L = useMemo(() => resolveLabels(locale, labels), [locale, labels])
  const [browserRecognition] = useState(browserSpeechRecognition)
  const recognition = speechRecognition ?? browserRecognition
  // Leitura do núcleo do editor no momento do uso (a ref é preenchida depois)
  const [core] = useState(() => () => editor.current?.core ?? null)

  useEffect(() => {
    injectStyles()
  }, [])

  if (!recognition) return null
  return (
    <DictationButton
      core={core}
      labels={L}
      lang={speechLang ?? SPEECH_LANG[locale] ?? 'en-US'}
      recognition={recognition}
      showText={showText}
    />
  )
}
