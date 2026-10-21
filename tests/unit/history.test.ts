import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEditorHistory } from '../../src/core/history'

describe('histórico de desfazer/refazer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('agrupa a digitação em um único passo', () => {
    const h = createEditorHistory()
    h.reset('a')
    let current = 'ab'
    h.schedule(() => current)
    vi.advanceTimersByTime(100)
    current = 'abc'
    h.schedule(() => current)
    vi.advanceTimersByTime(500)
    expect(h.undo(() => current)).toBe('a')
    expect(h.redo(() => 'a')).toBe('abc')
  })

  it('undo grava o estado pendente antes de voltar', () => {
    const h = createEditorHistory()
    h.reset('a')
    h.schedule(() => 'ab') // ainda não gravado (dentro do agrupamento)
    expect(h.undo(() => 'ab')).toBe('a')
    expect(h.redo(() => 'a')).toBe('ab')
  })

  it('ignora estados repetidos e devolve null nos limites', () => {
    const h = createEditorHistory()
    h.reset('a')
    h.schedule(() => 'a')
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'a')).toBeNull()
    expect(h.redo(() => 'a')).toBeNull()
  })

  it('nova alteração depois de desfazer descarta o refazer', () => {
    const h = createEditorHistory()
    h.reset('a')
    h.schedule(() => 'b')
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'b')).toBe('a')
    vi.advanceTimersByTime(1) // fim da restauração
    h.schedule(() => 'c')
    vi.advanceTimersByTime(500)
    expect(h.redo(() => 'c')).toBeNull()
    expect(h.undo(() => 'c')).toBe('a')
  })

  it('mutações causadas pela própria restauração não viram passo novo', () => {
    const h = createEditorHistory()
    h.reset('a')
    h.schedule(() => 'b')
    vi.advanceTimersByTime(500)
    h.undo(() => 'b')
    h.schedule(() => 'a') // eco da restauração no mesmo ciclo
    vi.advanceTimersByTime(500)
    expect(h.redo(() => 'a')).toBe('b')
  })

  it('respeita o limite de passos', () => {
    const h = createEditorHistory(3)
    h.reset('0')
    for (const v of ['1', '2', '3', '4']) {
      h.schedule(() => v)
      vi.advanceTimersByTime(500)
    }
    expect(h.undo(() => '4')).toBe('3')
    expect(h.undo(() => '3')).toBe('2')
    expect(h.undo(() => '2')).toBeNull()
  })
})

describe('histórico com imagens embutidas (guardadas uma vez)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const img = (seed: string, kb = 50) =>
    `<img src="data:image/png;base64,${seed.repeat((kb * 1024) / seed.length)}">`
  const A = img('AAAA')
  const B = img('BBBB')

  // Grava os estados em passos separados, como a digitação agrupada faria
  function record(h: ReturnType<typeof createEditorHistory>, states: string[]) {
    h.reset(states[0])
    for (const s of states.slice(1)) {
      h.schedule(() => s)
      vi.advanceTimersByTime(500)
    }
  }

  it('desfazer/refazer devolve o HTML idêntico, na ordem e quantidade de passos', () => {
    const states = [
      '<p>a</p>',
      `<p>a</p>${A}`, // inserida
      `<p>ab</p>${A}`, // texto ao lado
      `<p>ab</p>${B}`, // trocada
      '<p>ab</p>', // removida
      `<p>ab</p>${A}${A}`, // a mesma imagem duas vezes
    ]
    const h = createEditorHistory()
    record(h, states)
    expect(h.stats().entries).toBe(states.length)
    let current = states[states.length - 1]
    for (let i = states.length - 2; i >= 0; i--) {
      current = h.undo(() => current)!
      expect(current).toBe(states[i])
    }
    expect(h.undo(() => current)).toBeNull()
    for (let i = 1; i < states.length; i++) {
      current = h.redo(() => current)!
      expect(current).toBe(states[i])
    }
    expect(h.redo(() => current)).toBeNull()
  })

  it('cada imagem é guardada uma vez, por mais passos que a usem', () => {
    const h = createEditorHistory()
    record(h, [A, `<p>1</p>${A}`, `<p>12</p>${A}`, `<p>123</p>${A}${A}`])
    expect(h.stats()).toMatchObject({ entries: 4, blobs: 1 })
    expect(h.stats().blobChars).toBe(A.length - '<img src="">'.length)
  })

  it('nova edição depois de desfazer descarta o refazer e libera a imagem dele', () => {
    const h = createEditorHistory()
    record(h, ['<p>a</p>', `<p>a</p>${B}`])
    expect(h.stats().blobs).toBe(1)
    expect(h.undo(() => `<p>a</p>${B}`)).toBe('<p>a</p>')
    vi.advanceTimersByTime(1)
    h.schedule(() => '<p>ab</p>')
    vi.advanceTimersByTime(500)
    expect(h.redo(() => '<p>ab</p>')).toBeNull()
    expect(h.stats()).toMatchObject({ entries: 2, blobs: 0 })
  })

  it('passos que saem pelo limite liberam as imagens', () => {
    const h = createEditorHistory(3)
    record(h, [A, '<p>1</p>', '<p>2</p>', '<p>3</p>'])
    expect(h.stats()).toMatchObject({ entries: 3, blobs: 0 })
  })

  it('reiniciar libera as imagens do histórico anterior', () => {
    const h = createEditorHistory()
    record(h, [A, B])
    expect(h.stats().blobs).toBe(2)
    h.reset('<p>novo</p>')
    expect(h.stats()).toMatchObject({ entries: 1, blobs: 0, blobChars: 0 })
  })

  it('estado repetido não cria imagem órfã', () => {
    const h = createEditorHistory()
    record(h, [A])
    h.schedule(() => A)
    vi.advanceTimersByTime(500)
    expect(h.stats()).toMatchObject({ entries: 1, blobs: 1 })
  })

  it('imagens pequenas ficam no próprio passo; papel e texto com números intactos', () => {
    const small = '<img src="data:image/png;base64,iVBORw0KGgo=">'
    const paper = `<div class="ve-paper" data-paper="#fff" style="background-color:#fff;"><p>1 2 3</p>${A}${small}</div>`
    const h = createEditorHistory()
    record(h, ['<p>0</p>', paper, '<p>x</p>'])
    expect(h.stats().blobs).toBe(1)
    expect(h.undo(() => '<p>x</p>')).toBe(paper)
  })
})

describe('seleção guardada em cada passo (desfazer/refazer)', () => {
  // Agenda uma mudança e deixa o agrupamento fechar
  const change = (
    h: ReturnType<typeof createEditorHistory<string>>,
    html: string,
    after: string,
  ) => {
    h.schedule(
      () => html,
      () => after,
    )
    vi.advanceTimersByTime(500)
  }

  it('desfazer volta à seleção de antes do passo; refazer, à de depois', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.markBefore('antes')
    change(h, 'ab', 'depois')
    expect(h.undo(() => 'ab')).toBe('a')
    expect(h.restoredSelection()).toBe('antes')
    expect(h.redo(() => 'a')).toBe('ab')
    expect(h.restoredSelection()).toBe('depois')
    vi.useRealTimers()
  })

  it('no grupo de digitação: "antes" é o da primeira mudança e "depois" o da última', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('')
    h.markBefore('s0')
    h.schedule(
      () => 'a',
      () => 's1',
    )
    h.markBefore('ignorado (grupo em aberto)')
    h.schedule(
      () => 'ab',
      () => 's2',
    )
    h.schedule(
      () => 'abc',
      () => 's3',
    )
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'abc')).toBe('')
    expect(h.restoredSelection()).toBe('s0')
    expect(h.redo(() => '')).toBe('abc')
    expect(h.restoredSelection()).toBe('s3')
    vi.useRealTimers()
  })

  it('markCurrent (comando pela API): troca o "antes" guardado num clique anterior', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.markBefore('antes do clique')
    h.markCurrent(() => 'no começo do comando')
    change(h, 'ab', 'depois')
    expect(h.undo(() => 'ab')).toBe('a')
    expect(h.restoredSelection()).toBe('no começo do comando')
    vi.useRealTimers()
  })

  it('markCurrent não mexe num grupo aberto, nem lê a seleção nele', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('')
    h.markBefore('s0')
    h.schedule(
      () => 'a',
      () => 's1',
    )
    let reads = 0
    h.markCurrent(() => {
      reads++
      return 'ignorado'
    })
    change(h, 'ab', 's2')
    expect(reads).toBe(0)
    expect(h.undo(() => 'ab')).toBe('')
    expect(h.restoredSelection()).toBe('s0')
    vi.useRealTimers()
  })

  it('vários passos: cada desfazer volta ao "antes" do seu passo', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('')
    h.markBefore('b1')
    change(h, '1', 'a1')
    h.markBefore('b2')
    change(h, '12', 'a2')
    expect(h.undo(() => '12')).toBe('1')
    expect(h.restoredSelection()).toBe('b2')
    expect(h.undo(() => '1')).toBe('')
    expect(h.restoredSelection()).toBe('b1')
    expect(h.redo(() => '')).toBe('1')
    expect(h.restoredSelection()).toBe('a1')
    expect(h.redo(() => '1')).toBe('12')
    expect(h.restoredSelection()).toBe('a2')
    vi.useRealTimers()
  })

  it('desfazer grava o grupo pendente com as suas seleções', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.markBefore('antes')
    h.schedule(
      () => 'ab',
      () => 'depois',
    ) // ainda dentro do agrupamento
    expect(h.undo(() => 'ab')).toBe('a')
    expect(h.restoredSelection()).toBe('antes')
    vi.useRealTimers()
  })

  it('sem seleção registrada (uso antigo da API), nada a restaurar', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.schedule(() => 'ab')
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'ab')).toBe('a')
    expect(h.restoredSelection()).toBeUndefined()
    vi.useRealTimers()
  })

  it('grupo aberto sem seleção de antes: a primeira interação dentro dele a fornece', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.schedule(
      () => 'a ',
      () => 'x',
    ) // mudança sem interação (por exemplo, assíncrona)
    h.markBefore('primeira interação')
    h.markBefore('segunda (ignorada)')
    h.schedule(
      () => 'a b',
      () => 'depois',
    )
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'a b')).toBe('a')
    expect(h.restoredSelection()).toBe('primeira interação')
    vi.useRealTimers()
  })

  it('seleção passada como função só é lida quando vai ser guardada', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    let reads = 0
    const read = () => {
      reads++
      return 'antes'
    }
    h.markBefore(read) // grupo fechado: lida
    expect(reads).toBe(1)
    h.schedule(
      () => 'ab',
      () => 'depois',
    )
    for (let i = 0; i < 10; i++) h.markBefore(read) // grupo aberto (já tem "antes"): ignorada
    expect(reads).toBe(1)
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'ab')).toBe('a')
    expect(h.restoredSelection()).toBe('antes')
    vi.useRealTimers()
  })

  it('reset esquece as seleções', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.markBefore('antes')
    change(h, 'ab', 'depois')
    h.undo(() => 'ab')
    h.reset('x')
    expect(h.restoredSelection()).toBeUndefined()
    vi.useRealTimers()
  })
})
