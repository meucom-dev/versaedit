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
import { CONTENT_CSS, EDITOR_CSS } from '../src/core/styles'

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
  /** CSS do editor: injetado (padrão), importado como folha de estilo, ou nenhum */
  css?: 'inject' | 'import' | 'none'
  /** Liga o onError (sem ele, o editor usa alert) */
  captureErrors?: boolean
  /** Liga o onConfirm com a resposta dada (sem ele, o editor usa confirm) */
  confirm?: 'yes' | 'no' | 'async-yes' | 'async-no'
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
  focus: number
  blur: number
  errors: { code: string; level: string; message: string }[]
  confirms: string[]
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
  const out: HarnessOutput = {
    html: null,
    overflow: null,
    saved: null,
    changes: 0,
    focus: 0,
    blur: 0,
    errors: [],
    confirms: [],
  }
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
  // CSS importado: mesmo texto de dist/versaedit.css, como folha de estilo própria
  if (options.css === 'import' && !document.getElementById('imported-css')) {
    const style = document.createElement('style')
    style.id = 'imported-css'
    style.textContent = EDITOR_CSS
    document.head.appendChild(style)
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
        injectStyles={options.css === undefined || options.css === 'inject'}
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
        onError={
          options.captureErrors
            ? (e) => out.errors.push({ code: e.code, level: e.level, message: e.message })
            : undefined
        }
        onConfirm={
          options.confirm
            ? (request) => {
                out.confirms.push(request.code)
                const yes = options.confirm!.endsWith('yes')
                return options.confirm!.startsWith('async')
                  ? new Promise<boolean>((resolve) => setTimeout(() => resolve(yes), 50))
                  : yes
              }
            : undefined
        }
        onFocus={() => out.focus++}
        onBlur={() => out.blur++}
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
  // Espera o editor ficar pronto (núcleo criado e conteúdo inicial carregado),
  // em vez de um tempo fixo — em navegador lento, 150 ms não bastavam
  const expectsContent = Boolean(props.initialContent)
  const started = performance.now()
  while (performance.now() - started < 5000) {
    const content = document.querySelector('#host .ve-content')
    const ready = ref.current?.core && (!expectsContent || content?.innerHTML)
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  // Uma volta a mais para os efeitos do React terminarem
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}

// Mostra HTML salvo como um site faria, com o CSS de exibição (versaedit-content.css)
declare global {
  interface Window {
    __showContent: (html: string) => void
  }
}
window.__showContent = (html) => {
  root?.unmount()
  root = null
  const style = document.createElement('style')
  style.textContent = CONTENT_CSS
  document.head.appendChild(style)
  document.getElementById('host')!.innerHTML =
    `<div class="versaedit-content" style="width:800px">${html}</div>`
}
