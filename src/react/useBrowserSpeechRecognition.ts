import { useSyncExternalStore } from 'react'
import { browserSpeechRecognition, type SpeechRecognitionConstructor } from '../core/speech'

const noSubscription = () => () => {}
const onServer = () => null

/**
 * Reconhecimento de voz do navegador. No servidor e na hidratação vale "sem
 * reconhecimento" (o HTML tem de ser igual ao do servidor); logo depois o
 * React renderiza de novo com o do navegador. Sem SSR, já vem no 1º render.
 */
export function useBrowserSpeechRecognition(): SpeechRecognitionConstructor | null {
  return useSyncExternalStore(noSubscription, browserSpeechRecognition, onServer)
}
