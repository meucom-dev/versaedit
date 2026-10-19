// ─── DITADO (fala → texto) ────────────────────────────────────────
// Usa a Web Speech API do navegador (SpeechRecognition): Chrome, Edge e Safari.
// Atenção: nesses navegadores o áudio é processado nos servidores do fabricante
// (Google, Microsoft, Apple). Outro mecanismo pode ser passado pela opção
// `recognition` (mesma interface).
import type { VersaEditLocale } from './i18n'

// Tipos mínimos da Web Speech API (não fazem parte do lib.dom do TypeScript)
export interface SpeechRecognitionAlternativeLike {
  transcript: string
}
export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}
export interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResultLike }
}
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

/** Reconhecimento de voz do navegador, ou null se ele não tiver */
export function browserSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Idioma do reconhecimento para cada idioma da interface */
export const SPEECH_LANG: Record<VersaEditLocale, string> = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es-ES',
}

export type DictationError = 'denied' | 'no-microphone' | 'network' | 'other'

export interface DictationOptions {
  recognition: SpeechRecognitionConstructor
  lang: string
  /** Texto ainda provisório (muda enquanto a pessoa fala) */
  onInterim: (text: string) => void
  /** Trecho confirmado, pronto para entrar no conteúdo */
  onFinal: (text: string) => void
  onError: (error: DictationError, detail: string) => void
  /** Ditado ligado ou desligado */
  onStateChange: (active: boolean) => void
}

export interface Dictation {
  start(): void
  stop(): void
  readonly active: boolean
}

// Liga e desliga o ditado. O navegador encerra o reconhecimento depois de um
// silêncio; enquanto a pessoa não desliga, ele é reiniciado.
export function createDictation(options: DictationOptions): Dictation {
  let recognizer: SpeechRecognitionLike | null = null
  let active = false

  const setActive = (value: boolean) => {
    if (active === value) return
    active = value
    options.onStateChange(value)
  }

  const begin = () => {
    const r = new options.recognition()
    r.lang = options.lang
    r.continuous = true
    r.interimResults = true
    r.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          if (transcript.trim()) options.onFinal(transcript)
        } else {
          interim += transcript
        }
      }
      options.onInterim(interim)
    }
    r.onerror = (event) => {
      // Silêncio e cancelamento não são erros para quem dita
      if (event.error === 'no-speech' || event.error === 'aborted') return
      const kind: DictationError =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'denied'
          : event.error === 'audio-capture'
            ? 'no-microphone'
            : event.error === 'network'
              ? 'network'
              : 'other'
      options.onError(kind, event.error)
      stop()
    }
    r.onend = () => {
      options.onInterim('')
      if (active && recognizer === r) {
        try {
          r.start()
        } catch {
          stop()
        }
      }
    }
    recognizer = r
    r.start()
  }

  function stop() {
    const r = recognizer
    recognizer = null
    setActive(false)
    options.onInterim('')
    if (r) {
      r.onend = null
      try {
        r.stop()
      } catch {
        // já parado
      }
    }
  }

  return {
    start() {
      if (active) return
      setActive(true)
      try {
        begin()
      } catch (err) {
        options.onError('other', err instanceof Error ? err.message : String(err))
        stop()
      }
    },
    stop,
    get active() {
      return active
    },
  }
}

// ─── COMANDOS DE VOZ ──────────────────────────────────────────────
// Pontuação e quebras ditas por extenso. Mais longos primeiro ("ponto e vírgula"
// antes de "vírgula"). '\n' = nova linha; '\n\n' = novo parágrafo.
const VOICE_COMMANDS: Record<VersaEditLocale, [string, string][]> = {
  'pt-BR': [
    ['ponto de interrogação', '?'],
    ['ponto de exclamação', '!'],
    ['ponto e vírgula', ';'],
    ['ponto final', '.'],
    ['dois pontos', ':'],
    ['reticências', '…'],
    ['vírgula', ','],
    ['novo parágrafo', '\n\n'],
    ['nova linha', '\n'],
  ],
  en: [
    ['question mark', '?'],
    ['exclamation mark', '!'],
    ['exclamation point', '!'],
    ['semicolon', ';'],
    ['full stop', '.'],
    ['period', '.'],
    ['colon', ':'],
    ['ellipsis', '…'],
    ['comma', ','],
    ['new paragraph', '\n\n'],
    ['new line', '\n'],
  ],
  es: [
    ['signo de interrogación', '?'],
    ['signo de exclamación', '!'],
    ['punto y coma', ';'],
    ['punto final', '.'],
    ['dos puntos', ':'],
    ['puntos suspensivos', '…'],
    ['coma', ','],
    ['nuevo párrafo', '\n\n'],
    ['nueva línea', '\n'],
  ],
}

// Espaço não quebrável (o contenteditable usa nos espaços das pontas)
const NBSP = String.fromCharCode(0xa0)

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Troca os comandos falados ("vírgula", "nova linha"…) pelos sinais */
export function applyVoiceCommands(text: string, locale: VersaEditLocale): string {
  let out = text
  for (const [spoken, symbol] of VOICE_COMMANDS[locale] ?? []) {
    const words = spoken.split(' ').map(escapeRegExp).join('\\s+')
    // Palavra inteira (com acentos), engolindo o espaço antes do sinal
    const pattern = new RegExp(`\\s*(?<!\\p{L})${words}(?!\\p{L})[ \\t]*`, 'giu')
    out = out.replace(pattern, (_match, offset: number, whole: string) => {
      if (symbol.startsWith('\n')) return symbol
      const rest = whole.slice(offset + _match.length)
      // Depois de pontuação vem um espaço, salvo no fim ou antes de outra quebra
      return rest && !rest.startsWith('\n') ? `${symbol} ` : symbol
    })
  }
  return out
}

/**
 * Ajusta o trecho ditado ao texto que já está antes do cursor: espaço de
 * separação e maiúscula no início de frase (também depois de . ? ! e quebras).
 */
export function formatDictatedText(text: string, textBefore: string): string {
  let out = text.replace(/[ \t]+/g, ' ').replace(/^ /, '')
  if (!out) return ''
  const before = textBefore.replaceAll(NBSP, ' ')
  const startsSentence = !before.trim() || /[.?!…]\s*$/.test(before) || /\n\s*$/.test(before)
  const capitalize = (s: string) =>
    s.replace(/^(\s*)(\p{Ll})/u, (_m, sp, ch) => sp + ch.toUpperCase())
  if (startsSentence) out = capitalize(out)
  // Maiúscula depois de fim de frase ou quebra dentro do próprio trecho
  out = out.replace(/([.?!…]\s+|\n)(\p{Ll})/gu, (_m, sep, ch) => sep + ch.toUpperCase())
  const needsSpace = before.length > 0 && !/\s$/.test(before) && !/^[\n,.;:?!…)\]]/.test(out)
  return needsSpace ? ` ${out}` : out
}
