import { describe, expect, it } from 'vitest'
import { withCallBoundary } from '../../src/core/boundary'

class Sample {
  calls: string[] = []
  value = 1
  inner = (): number => {
    this.calls.push('inner')
    return this.value
  }
  outer = (): number => {
    this.calls.push('outer')
    return this.inner() + 1
  }
  method(): number {
    this.calls.push('method')
    return this.inner()
  }
  get doubled(): number {
    this.calls.push('getter')
    return this.inner() * 2
  }
  reenter = (callback: () => void): void => {
    this.calls.push('reenter')
    callback()
  }
  fail = (): never => {
    throw new Error('falhou')
  }
}

function setup(enter = () => {}) {
  const target = new Sample()
  const log: string[] = []
  const api = withCallBoundary(target, {
    enter: () => {
      log.push('enter')
      enter()
    },
    exit: () => log.push('exit'),
  })
  return { target, api, log }
}

describe('fronteira da API', () => {
  it('enter e exit só na chamada de fora, não nas internas', () => {
    const { api, log, target } = setup()
    expect(api.outer()).toBe(2)
    expect(log).toEqual(['enter', 'exit'])
    expect(target.calls).toEqual(['outer', 'inner'])
    expect(api.method()).toBe(1)
    expect(log).toEqual(['enter', 'exit', 'enter', 'exit'])
  })
  it('chamada do app dentro de um callback do núcleo não abre outra fronteira', () => {
    const { api, log } = setup()
    api.reenter(() => api.inner())
    expect(log).toEqual(['enter', 'exit'])
  })
  it('propriedades e getters não passam pela fronteira', () => {
    const { api, log } = setup()
    expect(api.value).toBe(1)
    expect(api.doubled).toBe(2)
    expect(log).toEqual([])
  })
  it('o mesmo método devolve sempre a mesma função (pode virar ouvinte e ser removido)', () => {
    const { api } = setup()
    expect(api.outer).toBe(api.outer)
  })
  it('erro na fronteira não impede o comando; erro no comando ainda fecha a fronteira', () => {
    const { api, log } = setup(() => {
      throw new Error('fronteira')
    })
    expect(api.outer()).toBe(2)
    expect(() => api.fail()).toThrow('falhou')
    expect(log).toEqual(['enter', 'exit', 'enter', 'exit'])
    expect(api.outer()).toBe(2)
  })
  it('métodos novos entram sem lista: qualquer função do núcleo', () => {
    const { api, log, target } = setup()
    ;(target as unknown as Record<string, () => string>).future = () => 'novo'
    expect((api as unknown as Record<string, () => string>).future()).toBe('novo')
    expect(log).toEqual(['enter', 'exit'])
  })
})
