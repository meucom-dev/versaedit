// Compatibilidade da API do núcleo com a fronteira de chamadas (core/boundary.ts):
// o objeto devolvido por new VersaEditCore() se comporta como a própria instância
import { afterEach, describe, expect, it } from 'vitest'
import { VersaEditCore } from '../../src/core/editor'

const cores: VersaEditCore[] = []
function create(html = '<p>um</p>') {
  const root = document.createElement('div')
  root.className = 've-root'
  const el = document.createElement('div')
  el.contentEditable = 'true'
  root.append(el)
  document.body.append(root)
  const core = new VersaEditCore(el)
  core.setHTML(html)
  cores.push(core)
  return { core, el }
}

afterEach(() => {
  for (const core of cores.splice(0)) core.destroy()
  document.body.innerHTML = ''
})

describe('API do núcleo com a fronteira de chamadas', () => {
  it('instanceof e protótipo continuam os da classe', () => {
    const { core } = create()
    expect(core instanceof VersaEditCore).toBe(true)
    expect(Object.getPrototypeOf(core)).toBe(VersaEditCore.prototype)
  })

  it('identidade estável: o mesmo método é sempre a mesma função', () => {
    const { core } = create()
    expect(core.undo).toBe(core.undo)
    expect(core.getHTML).toBe(core.getHTML)
    expect(core.formatBlock).toBe(core.formatBlock)
  })

  it('métodos extraídos (destructuring) funcionam, inclusive os do protótipo', () => {
    const { core } = create('<p>um</p>')
    const { getHTML, setHTML, undo, redo } = core
    setHTML('<p>dois</p>')
    expect(getHTML()).toBe('<p>dois</p>')
    expect(typeof undo).toBe('function')
    expect(typeof redo).toBe('function')
  })

  it('callbacks guardados pelo app: adicionar e remover como ouvinte', () => {
    const { core } = create('<p>um</p>')
    const button = document.createElement('button')
    document.body.append(button)
    let calls = 0
    const original = core.getHTML
    button.addEventListener('click', original)
    button.addEventListener('click', () => calls++)
    button.click()
    button.removeEventListener('click', core.getHTML)
    button.click()
    expect(calls).toBe(2)
  })

  it('propriedades: leitura, getters e escrita chegam à instância', () => {
    const { core } = create()
    expect(core.selectionType).toBe(null)
    const any = core as unknown as Record<string, unknown>
    any.appData = { id: 1 }
    expect(any.appData).toEqual({ id: 1 })
    expect(Object.keys(core)).toContain('appData')
    expect('getHTML' in core).toBe(true)
  })

  it('dois núcleos independentes: um não vê o conteúdo nem a fronteira do outro', () => {
    const a = create('<p>a</p>')
    const b = create('<p>b</p>')
    a.core.setHTML('<p>a2</p>')
    expect(b.core.getHTML()).toBe('<p>b</p>')
    expect(a.core.getHTML()).toBe('<p>a2</p>')
    expect(a.core.getHTML).not.toBe(b.core.getHTML)
  })

  it('método público adicionado no futuro (no protótipo) passa pela fronteira e vê a instância', () => {
    const proto = VersaEditCore.prototype as unknown as Record<string, unknown>
    proto.futureMethod = function (this: VersaEditCore) {
      return this.getHTML().toUpperCase()
    }
    try {
      const { core } = create('<p>um</p>')
      expect((core as unknown as { futureMethod(): string }).futureMethod()).toBe('<P>UM</P>')
      const { futureMethod } = core as unknown as { futureMethod(): string }
      expect(futureMethod()).toBe('<P>UM</P>')
    } finally {
      delete proto.futureMethod
    }
  })

  it('o nome do método continua legível (depuração e mensagens de erro)', () => {
    const { core } = create()
    expect(core.getHTML.name).toBe('getHTML')
    expect(core.formatBlock.name).toBe('formatBlock')
  })
})
