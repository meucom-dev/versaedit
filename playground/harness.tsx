// Página usada pelos testes de navegador (tests/e2e): monta um VersaEdit com as
// props pedidas e guarda o que ele emite em window.__out.
import { createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  VersaEdit,
  VersaEditDictation,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionLike,
  type VersaEditHandle,
  type VersaEditProps,
} from '../src'

export interface HarnessOptions {
  /** onImageUpload: 'ok' devolve https://cdn.example.com/<nome>; 'fail' rejeita */
  upload?: 'ok' | 'fail'
  /** Liga o onSave (o botão Salvar entrega o HTML em vez de baixar) */
  onSave?: boolean
  /** Liga o onOverflowChange */
  overflow?: boolean
  /**
   * Ditado: 'fake' usa o reconhecimento falso (window.__speech). Sem isso, a página
   * simula navegador sem suporte, para os testes darem o mesmo resultado em qualquer lugar.
   */
  speech?: 'fake' | 'none'
  /** Microfone fora da barra (VersaEditDictation), acima do editor */
  dictationOutside?: boolean
}

/** Controle do reconhecimento de voz falso usado nos testes */
export interface FakeSpeech {
  starts: number
  stops: number
  lang: string
  /** Simula resultados: [texto, confirmado] */
  say(results: [string, boolean][]): void
  fail(error: string): void
  /** Simula o fim do reconhecimento por silêncio */
  end(): void
}

export interface HarnessOutput {
  html: string | null
  overflow: boolean | null
  saved: string | null
  changes: number
}

declare global {
  interface Window {
    __mount: (props: Partial<VersaEditProps>, options?: HarnessOptions) => Promise<void>
    __out: HarnessOutput
    __ref: { current: VersaEditHandle | null }
    __speech: FakeSpeech
  }
}

function createFakeSpeech(): { control: FakeSpeech; ctor: SpeechRecognitionConstructor } {
  let current: SpeechRecognitionLike | null = null
  const control: FakeSpeech = {
    starts: 0,
    stops: 0,
    lang: '',
    say(results) {
      const list = results.map(([transcript, isFinal]) =>
        Object.assign([{ transcript }], { isFinal }),
      )
      current?.onresult?.({ resultIndex: 0, results: list })
    },
    fail(error) {
      current?.onerror?.({ error })
    },
    end() {
      current?.onend?.()
    },
  }
  class FakeRecognition implements SpeechRecognitionLike {
    lang = ''
    continuous = false
    interimResults = false
    onresult: SpeechRecognitionLike['onresult'] = null
    onerror: SpeechRecognitionLike['onerror'] = null
    onend: SpeechRecognitionLike['onend'] = null
    start() {
      // O controle do teste fala com a instância que está ouvindo
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      current = this
      control.starts++
      control.lang = this.lang
    }
    stop() {
      control.stops++
      this.onend?.()
    }
    abort() {}
  }
  return { control, ctor: FakeRecognition }
}

let root: Root | null = null

window.__mount = async (props, options = {}) => {
  root?.unmount()
  const out: HarnessOutput = { html: null, overflow: null, saved: null, changes: 0 }
  window.__out = out
  const ref = createRef<VersaEditHandle>()
  window.__ref = ref
  let speechRecognition: SpeechRecognitionConstructor | undefined
  if (options.speech === 'fake') {
    const fake = createFakeSpeech()
    window.__speech = fake.control
    speechRecognition = fake.ctor
  } else {
    // Sem pedido de ditado falso: sem reconhecimento (igual em qualquer navegador)
    const w = window as unknown as Record<string, unknown>
    delete w.SpeechRecognition
    delete w.webkitSpeechRecognition
  }
  root = createRoot(document.getElementById('host')!)
  root.render(
    <>
      {options.dictationOutside && (
        <div id="outside">
          <VersaEditDictation
            editor={ref}
            locale={props.locale}
            speechRecognition={speechRecognition}
          />
        </div>
      )}
      <VersaEdit
        ref={ref}
        speechRecognition={speechRecognition}
        width={900}
        height={420}
        {...props}
        onChange={(html) => {
          out.html = html
          out.changes++
        }}
        onOverflowChange={
          options.overflow !== false ? (value) => (out.overflow = value) : undefined
        }
        onSave={options.onSave ? (html) => (out.saved = html) : undefined}
        onImageUpload={
          options.upload === 'ok'
            ? (file) => Promise.resolve(`https://cdn.example.com/${file.name}`)
            : options.upload === 'fail'
              ? () => Promise.reject(new Error('upload failed'))
              : undefined
        }
      />
    </>,
  )
  await new Promise((resolve) => setTimeout(resolve, 150))
}
