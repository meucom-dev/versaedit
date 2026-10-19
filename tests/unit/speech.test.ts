import { describe, expect, it, vi } from 'vitest'
import {
  applyVoiceCommands,
  createDictation,
  formatDictatedText,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from '../../src/core/speech'

describe('comandos de voz', () => {
  it.each([
    ['olá vírgula tudo bem ponto final', 'olá, tudo bem.'],
    ['isso é sério ponto de interrogação', 'isso é sério?'],
    ['que bom ponto de exclamação', 'que bom!'],
    ['lista dois pontos itens', 'lista: itens'],
    ['um ponto e vírgula dois', 'um; dois'],
    ['primeira nova linha segunda', 'primeira\nsegunda'],
    ['fim novo parágrafo começo', 'fim\n\ncomeço'],
    ['Vírgula no começo', ', no começo'],
    ['palavra virgulação não é comando', 'palavra virgulação não é comando'],
  ])('pt-BR: %s', (input, expected) => {
    expect(applyVoiceCommands(input, 'pt-BR')).toBe(expected)
  })

  it.each([
    ['hello comma world period', 'hello, world.'],
    ['really question mark', 'really?'],
    ['first new line second', 'first\nsecond'],
    ['a full stop', 'a.'],
    ['periodic table', 'periodic table'],
  ])('en: %s', (input, expected) => {
    expect(applyVoiceCommands(input, 'en')).toBe(expected)
  })

  it.each([
    ['hola coma qué tal punto final', 'hola, qué tal.'],
    ['es en serio signo de interrogación', 'es en serio?'],
    ['qué bien signo de exclamación', 'qué bien!'],
    ['lista dos puntos elementos', 'lista: elementos'],
    ['uno punto y coma dos', 'uno; dos'],
    ['y así puntos suspensivos', 'y así…'],
    ['primera nueva línea segunda', 'primera\nsegunda'],
    ['fin nuevo párrafo comienzo', 'fin\n\ncomienzo'],
    ['Coma al principio', ', al principio'],
    [
      'la comadre y el punto de vista no son comandos',
      'la comadre y el punto de vista no son comandos',
    ],
  ])('es: %s', (input, expected) => {
    expect(applyVoiceCommands(input, 'es')).toBe(expected)
  })
})

describe('formatação do trecho ditado', () => {
  it('início do bloco: maiúscula, sem espaço antes', () => {
    expect(formatDictatedText('olá mundo', '')).toBe('Olá mundo')
  })
  it('meio da frase: espaço antes, sem maiúscula', () => {
    expect(formatDictatedText('mundo', 'olá')).toBe(' mundo')
  })
  it('depois de ponto: espaço e maiúscula', () => {
    expect(formatDictatedText('outra frase', 'Fim.')).toBe(' Outra frase')
  })
  it('texto anterior já termina com espaço (inclusive não quebrável)', () => {
    expect(formatDictatedText('x', 'a ')).toBe('x')
    expect(formatDictatedText('x', 'a' + String.fromCharCode(0xa0))).toBe('x')
  })
  it('pontuação não ganha espaço antes', () => {
    expect(formatDictatedText(', depois', 'antes')).toBe(', depois')
  })
  it('maiúscula depois de fim de frase e de quebra dentro do trecho', () => {
    expect(formatDictatedText('um. dois\ntrês', '')).toBe('Um. Dois\nTrês')
  })
  it('espaços repetidos viram um; trecho vazio vira nada', () => {
    expect(formatDictatedText('  a   b  ', 'x.')).toBe(' A b ')
    expect(formatDictatedText('   ', 'x')).toBe('')
  })
})

// Reconhecimento falso para testar o ciclo do ditado
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  starts = 0
  constructor() {
    FakeRecognition.instances.push(this)
  }
  start() {
    this.starts++
  }
  stop() {
    this.onend?.()
  }
  abort() {}
  emit(results: [string, boolean][]) {
    const list = results.map(([transcript, isFinal]) =>
      Object.assign([{ transcript }], { isFinal }),
    )
    this.onresult?.({ resultIndex: 0, results: list })
  }
}

function setup() {
  FakeRecognition.instances = []
  const calls = {
    interim: [] as string[],
    final: [] as string[],
    errors: [] as string[],
    states: [] as boolean[],
  }
  const dictation = createDictation({
    recognition: FakeRecognition,
    lang: 'pt-BR',
    onInterim: (t) => calls.interim.push(t),
    onFinal: (t) => calls.final.push(t),
    onError: (kind, detail) => calls.errors.push(`${kind}:${detail}`),
    onStateChange: (a) => calls.states.push(a),
  })
  return { dictation, calls, rec: () => FakeRecognition.instances[0] }
}

describe('ciclo do ditado', () => {
  it('configura o reconhecimento e separa provisório de confirmado', () => {
    const { dictation, calls, rec } = setup()
    dictation.start()
    expect(dictation.active).toBe(true)
    expect(rec()).toMatchObject({ lang: 'pt-BR', continuous: true, interimResults: true })
    rec().emit([
      ['olá ', true],
      ['tudo', false],
    ])
    expect(calls.final).toEqual(['olá '])
    expect(calls.interim.at(-1)).toBe('tudo')
  })

  it('reinicia sozinho depois do silêncio enquanto estiver ligado', () => {
    const { dictation, rec } = setup()
    dictation.start()
    rec().onend?.()
    expect(rec().starts).toBe(2)
  })

  it('stop desliga sem reiniciar', () => {
    const { dictation, calls, rec } = setup()
    dictation.start()
    dictation.stop()
    expect(dictation.active).toBe(false)
    expect(rec().starts).toBe(1)
    expect(calls.states).toEqual([true, false])
  })

  it('permissão negada vira erro "denied" e desliga', () => {
    const { dictation, calls, rec } = setup()
    dictation.start()
    rec().onerror?.({ error: 'not-allowed' })
    expect(calls.errors).toEqual(['denied:not-allowed'])
    expect(dictation.active).toBe(false)
  })

  it('silêncio (no-speech) não é erro', () => {
    const { dictation, calls, rec } = setup()
    dictation.start()
    rec().onerror?.({ error: 'no-speech' })
    expect(calls.errors).toEqual([])
    expect(dictation.active).toBe(true)
  })

  it('falha ao iniciar vira erro "other"', () => {
    const onError = vi.fn()
    const broken = class extends FakeRecognition {
      start(): void {
        throw new Error('boom')
      }
    }
    const d = createDictation({
      recognition: broken,
      lang: 'en-US',
      onInterim: () => {},
      onFinal: () => {},
      onError,
      onStateChange: () => {},
    })
    d.start()
    expect(onError).toHaveBeenCalledWith('other', 'boom')
    expect(d.active).toBe(false)
  })
})
