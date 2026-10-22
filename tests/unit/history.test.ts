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

  it('external (o navegador já desfez): volta um passo sem criar passo novo', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.markBefore('b1')
    change(h, 'ab', 'a1')
    expect(h.external(-1, 'atual')).toBe('a')
    expect(h.restoredSelection()).toBe('b1')
    // O refazer continua disponível: nada foi gravado no lugar dele
    expect(h.redo(() => 'a')).toBe('ab')
    // Sem passo para onde ir: o estado atual, com a seleção atual
    expect(h.external(1, 'atual')).toBe('ab')
    expect(h.restoredSelection()).toBe('atual')
    expect(h.undo(() => 'ab')).toBe('a')
    vi.useRealTimers()
  })

  it('external com um passo aberto: a edição aberta sai; refazer nativo não faz nada', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('a')
    h.markBefore('antes da digitação')
    h.schedule(
      () => 'ab',
      () => 'depois',
    )
    expect(h.external(1)).toBe(null)
    expect(h.external(-1)).toBe('a')
    expect(h.restoredSelection()).toBe('antes da digitação')
    vi.advanceTimersByTime(500)
    // O grupo descartado não volta a ser gravado
    expect(h.undo(() => 'a')).toBe(null)
    vi.useRealTimers()
  })

  it('composição: pausas longas não fecham o passo; o texto final depois do fim entra nele', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('um')
    h.markBefore('antes da composição')
    h.compose(true, () => 'umnih')
    for (const html of ['umn', 'umni', 'umnih']) {
      h.schedule(
        () => html,
        () => 'durante',
      )
      vi.advanceTimersByTime(2000)
    }
    // Pedido de fechar no meio da composição: adiado
    h.close(() => 'umnih')
    h.compose(false, () => 'umにほ')
    // Texto final que chega depois do compositionend (Safari)
    h.schedule(
      () => 'umにほ',
      () => 'depois',
    )
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'umにほ')).toBe('um')
    expect(h.restoredSelection()).toBe('antes da composição')
    expect(h.redo(() => 'um')).toBe('umにほ')
    vi.useRealTimers()
  })

  it('composição cancelada (volta ao texto de antes): nenhum passo novo', () => {
    vi.useFakeTimers()
    const h = createEditorHistory<string>()
    h.reset('um')
    h.markBefore('b')
    h.compose(true, () => 'um')
    h.schedule(() => 'umk')
    h.schedule(() => 'um')
    h.compose(false, () => 'um')
    vi.advanceTimersByTime(500)
    expect(h.undo(() => 'um')).toBe(null)
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

// Lógica temporal determinística: relógio e temporizadores controlados pelo teste.
// `tick` avança os dois juntos (página livre); `stall` avança só o relógio (página
// travada: o temporizador vence mas não dispara); depois `vi.advanceTimersByTime(0)`
// dispara o que venceu (atrasado).
describe('agrupamento resistente a travamentos da página', () => {
  let now = 0
  let stalled = 0
  // Página livre: relógio e temporizadores andam juntos, de 1 em 1 ms
  const tick = (ms: number) => {
    for (let i = 0; i < ms; i++) {
      now += 1
      vi.advanceTimersByTime(1)
    }
  }
  // Página travada: o relógio anda, mas nenhum temporizador dispara
  const stall = (ms: number) => {
    now += ms
    stalled += ms
  }
  // Fim do travamento: os temporizadores que venceram disparam agora (atrasados)
  const fireOverdue = () => {
    vi.advanceTimersByTime(stalled)
    stalled = 0
  }
  // Uma tecla: o instante (timeStamp) e a mudança do DOM que ela causa
  const key = (
    h: ReturnType<typeof createEditorHistory<string>>,
    html: string,
    at: number | null,
  ) => {
    h.typing(at)
    h.schedule(() => html)
  }
  beforeEach(() => {
    vi.useFakeTimers()
    now = 1000
    stalled = 0
  })
  afterEach(() => vi.useRealTimers())
  const make = () => {
    const h = createEditorHistory<string>(100, () => now)
    h.reset('um')
    return h
  }

  it('temporizador atrasado e teclas que esperavam na fila: um passo só', () => {
    const h = make()
    key(h, 'um a', now)
    tick(50)
    key(h, 'um ab', now)
    stall(900) // página travada; teclas chegam e esperam
    fireOverdue() // o temporizador dispara atrasado e grava 'um ab'
    // As teclas da fila são tratadas logo em seguida (timeStamp não confiável: null)
    key(h, 'um abc', null)
    tick(10)
    key(h, 'um abcd', null)
    tick(500)
    expect(h.undo(() => 'um abcd')).toBe('um')
  })

  it('temporizador no horário, mas a tecla chegou antes (timeStamp a menos de 400 ms): um passo', () => {
    const h = make()
    const typed = now
    key(h, 'um a', typed)
    tick(400) // grava 'um a'
    key(h, 'um ab', typed + 300) // chegou 300 ms depois da anterior
    tick(500)
    expect(h.undo(() => 'um ab')).toBe('um')
  })

  it('pausa real de mais de 400 ms: dois passos', () => {
    const h = make()
    key(h, 'um a', now)
    tick(600)
    key(h, 'um ab', now)
    tick(500)
    expect(h.undo(() => 'um ab')).toBe('um a')
    expect(h.undo(() => 'um a')).toBe('um')
  })

  it('pausa real depois de um travamento (tecla fora da fila): dois passos', () => {
    const h = make()
    key(h, 'um a', now)
    stall(900)
    fireOverdue()
    tick(300) // a tecla seguinte vem bem depois do fim do travamento
    key(h, 'um ab', null)
    tick(500)
    expect(h.undo(() => 'um ab')).toBe('um a')
  })

  it('uma fronteira explícita (comando, clique, setas) impede reabrir o passo', () => {
    const h = make()
    key(h, 'um a', now)
    stall(900)
    fireOverdue()
    h.close(() => 'um a')
    key(h, 'um ab', null)
    tick(500)
    expect(h.undo(() => 'um ab')).toBe('um a')
  })

  it('a hora das teclas nunca divide um passo aberto', () => {
    const h = make()
    key(h, 'um a', now)
    stall(900) // o temporizador ainda não disparou
    key(h, 'um ab', now) // a mais de 400 ms da anterior, com o passo aberto
    tick(500)
    expect(h.undo(() => 'um ab')).toBe('um')
  })

  it('comando da API com um passo parado (temporizador atrasado): o passo é gravado antes', () => {
    const h = make()
    h.markBefore('antes')
    key(h, 'um a', now)
    stall(900)
    h.markCurrent(
      () => 'no comando',
      () => 'um a',
    )
    h.schedule(
      () => 'UM A',
      () => 'depois',
    )
    tick(500)
    expect(h.undo(() => 'UM A')).toBe('um a')
    expect(h.restoredSelection()).toBe('no comando')
    expect(h.undo(() => 'um a')).toBe('um')
  })

  it('composição: nada reabre nem divide durante ela', () => {
    const h = make()
    key(h, 'um a', now)
    tick(500)
    h.compose(true, () => 'um a')
    key(h, 'um ak', now)
    stall(900)
    key(h, 'um aka', null)
    h.compose(false, () => 'um aか')
    h.schedule(() => 'um aか')
    tick(500)
    expect(h.undo(() => 'um aか')).toBe('um a')
  })

  it('estado igual ao anterior não marca nada para reabrir (um passo legítimo não se mistura)', () => {
    const h = make()
    key(h, 'um a', now)
    tick(500) // passo 'um a'
    h.close(() => 'um a')
    h.schedule(() => 'um a') // mudança que volta ao mesmo estado
    stall(900)
    fireOverdue() // nada novo gravado
    key(h, 'um ab', null)
    tick(500)
    expect(h.undo(() => 'um ab')).toBe('um a')
    expect(h.undo(() => 'um a')).toBe('um')
  })
})
