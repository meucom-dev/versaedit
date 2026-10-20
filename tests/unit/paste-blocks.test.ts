// Colagem de blocos sem navegador (cobre também o Firefox, que não aceita colagem
// sintética nos testes de navegador): plano separado da aplicação ao DOM
import { afterEach, describe, expect, it } from 'vitest'
import { applyBlockPaste, planBlockPaste } from '../../src/core/paste-blocks'

let editor: HTMLDivElement
afterEach(() => editor?.remove())

// Monta o editor, põe o cursor em `offset` do texto `at`, cola `html` e "digita" X
// no cursor devolvido; devolve o HTML final (ou null se não houve plano)
function paste(content: string, at: string, offset: number, html: string): string | null {
  editor = document.createElement('div')
  editor.innerHTML = content
  document.body.appendChild(editor)
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let node: Text | null = null
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (text.data.includes(at)) {
      node = text
      break
    }
  }
  const range = document.createRange()
  range.setStart(node!, node!.data.indexOf(at) + offset)
  range.collapse(true)
  const template = document.createElement('template')
  template.innerHTML = html
  const before = editor.innerHTML
  const plan = planBlockPaste(template.content, range, editor)
  // O plano não mexe no editor
  expect(editor.innerHTML).toBe(before)
  if (!plan) return null
  const caret = applyBlockPaste(plan, range)
  caret.insertNode(document.createTextNode('X'))
  editor.normalize()
  return editor.innerHTML
}

describe('colar blocos no meio de um parágrafo', () => {
  it.each([
    ['dois parágrafos', '<p>um</p><p>dois</p>', '<p>ola um</p><p>doisXmundo</p>'],
    ['título e parágrafo', '<h2>T</h2><p>corpo</p>', '<p>ola </p><h2>T</h2><p>corpoXmundo</p>'],
    ['parágrafo e título', '<p>um</p><h2>T</h2>', '<p>ola um</p><h2>TX</h2><p>mundo</p>'],
    [
      'lista',
      '<ul><li>a</li><li>b</li></ul>',
      '<p>ola </p><ul><li>a</li><li>bX</li></ul><p>mundo</p>',
    ],
    [
      'tabela',
      '<table><tbody><tr><td>c</td></tr></tbody></table>',
      '<p>ola </p><table><tbody><tr><td>cX</td></tr></tbody></table><p>mundo</p>',
    ],
    ['parágrafo e texto solto', '<p>um</p>solto', '<p>ola um</p><p>soltoXmundo</p>'],
    [
      'texto solto entre blocos vira parágrafo',
      '<h2>A</h2>meio<h2>B</h2>',
      '<p>ola </p><h2>A</h2><p>meio</p><h2>BX</h2><p>mundo</p>',
    ],
    ['linha horizontal', '<p>um</p><hr><p>dois</p>', '<p>ola um</p><hr><p>doisXmundo</p>'],
    [
      'parágrafo com atributos não se junta',
      '<p class="c">um</p>',
      '<p>ola </p><p class="c">umX</p><p>mundo</p>',
    ],
    [
      'itens soltos entram numa lista',
      '<li>a</li><li>b</li>',
      '<p>ola </p><ul><li>a</li><li>bX</li></ul><p>mundo</p>',
    ],
  ])('%s', (_name, html, expected) => {
    expect(paste('<p>ola mundo</p>', 'ola mundo', 4, html)).toBe(expected)
  })
})

describe('início e fim do bloco, e contextos', () => {
  it('no início: sem parágrafo vazio antes', () => {
    expect(paste('<p>mundo</p>', 'mundo', 0, '<h2>T</h2><p>corpo</p>')).toBe(
      '<h2>T</h2><p>corpoXmundo</p>',
    )
  })
  it('no fim: sem parágrafo vazio depois', () => {
    expect(paste('<p>ola</p>', 'ola', 3, '<p>um</p><h2>T</h2>')).toBe('<p>olaum</p><h2>TX</h2>')
  })
  it('cursor dentro do negrito: o negrito é dividido junto', () => {
    expect(paste('<p>a<b>bcde</b>f</p>', 'bcde', 2, '<h2>T</h2>')).toBe(
      '<p>a<b>bc</b></p><h2>TX</h2><p><b>de</b>f</p>',
    )
  })
  it('título: dividido, as pontas entram nele', () => {
    expect(paste('<h2>ola mundo</h2>', 'ola mundo', 4, '<p>um</p><p>dois</p>')).toBe(
      '<h2>ola um</h2><h2>doisXmundo</h2>',
    )
  })
  it('atributos do bloco dividido vão para as duas metades, sem repetir id', () => {
    expect(
      paste(
        '<p id="a" style="color: red;">ola mundo</p>',
        'ola mundo',
        4,
        '<p>um</p><h2>T</h2><p>dois</p>',
      ),
    ).toBe(
      '<p id="a" style="color: red;">ola um</p><h2>T</h2><p style="color: red;">doisXmundo</p>',
    )
  })
  it('item de lista: parágrafos do meio viram itens, outros blocos entram num item', () => {
    expect(
      paste(
        '<ul><li>ola mundo</li></ul>',
        'ola mundo',
        4,
        '<p>um</p><p>meio</p><h3>T</h3><p>dois</p>',
      ),
    ).toBe('<ul><li>ola um</li><li>meio</li><li><h3>T</h3></li><li>doisXmundo</li></ul>')
  })
  it('célula de tabela: os blocos entram na célula, sem dividir', () => {
    expect(
      paste(
        '<table><tbody><tr><td>ola mundo</td></tr></tbody></table>',
        'ola mundo',
        4,
        '<h2>T</h2><p>corpo</p>',
      ),
    ).toBe('<table><tbody><tr><td>ola <h2>T</h2><p>corpoX</p>mundo</td></tr></tbody></table>')
  })
  it('caixa de texto: contêiner, sem dividir', () => {
    expect(
      paste(
        '<div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>ola mundo</div>',
        'ola mundo',
        4,
        '<p>um</p>',
      ),
    ).toBe(
      '<div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>ola <p>umX</p>mundo</div>',
    )
  })
  it('bloco de código: entra só o texto', () => {
    expect(paste('<pre>ola mundo</pre>', 'ola mundo', 4, '<h2>T</h2><p>corpo</p>')).toBe(
      '<pre>ola T\ncorpoXmundo</pre>',
    )
  })
  it('citação com texto direto: dividida como um parágrafo', () => {
    expect(paste('<blockquote>ola mundo</blockquote>', 'ola mundo', 4, '<h2>T</h2>')).toBe(
      '<blockquote>ola </blockquote><h2>TX</h2><blockquote>mundo</blockquote>',
    )
  })
  it('um parágrafo simples sozinho entra no cursor, sem dividir', () => {
    expect(paste('<p>ola mundo</p>', 'ola mundo', 4, '<p><b>um</b> </p>')).toBe(
      '<p>ola <b>um</b> Xmundo</p>',
    )
  })
  it('sem blocos não há plano (a colagem continua como antes)', () => {
    expect(paste('<p>ola mundo</p>', 'ola mundo', 4, '<b>forte</b> texto')).toBeNull()
  })
})
