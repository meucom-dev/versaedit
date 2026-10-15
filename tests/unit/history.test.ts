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
