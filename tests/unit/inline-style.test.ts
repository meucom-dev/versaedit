// Motor de estilo de texto entre blocos (src/core/inline-style.ts, beta.3): o
// estilo vai só para o texto selecionado; listas, parágrafos, células e caixas de
// texto mantêm a estrutura. Com `reversible`, revert() devolve o HTML exato.
import { describe, expect, it } from 'vitest'
import { applyInlineStyle } from '../../src/core/inline-style'

function setup(html: string) {
  const root = document.createElement('div')
  root.setAttribute('contenteditable', 'true')
  root.innerHTML = html
  document.body.replaceChildren(root)
  return root
}

const texts = (root: Node) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const out: Text[] = []
  while (walker.nextNode()) out.push(walker.currentNode as Text)
  return out
}

/** Faixa do caractere `from` do texto que contém `a` ao `to` do texto que contém `b` */
function between(root: Node, a: string, from: number, b: string, to: number) {
  const all = texts(root)
  const start = all.find((t) => t.data.includes(a))!
  const end = all.find((t) => t.data.includes(b))!
  const range = document.createRange()
  range.setStart(start, from)
  range.setEnd(end, to < 0 ? end.length + to + 1 : to)
  return range
}

const LIST =
  '<h3>Título</h3><ul><li><strong>Um.</strong> texto um</li><li><strong>Dois.</strong> texto dois</li><li><strong>Três.</strong> texto três</li></ul><p>Depois</p>'

describe('applyInlineStyle', () => {
  it('lista: um span dentro de cada item, sem itens novos nem vazios', () => {
    const root = setup(LIST)
    const result = applyInlineStyle(
      root,
      between(root, 'Um.', 0, 'texto três', -1),
      'fontSize',
      '14pt',
    )
    expect(result).not.toBeNull()
    expect(root.innerHTML).toBe(
      '<h3>Título</h3><ul>' +
        '<li><span style="font-size: 14pt;"><strong>Um.</strong> texto um</span></li>' +
        '<li><span style="font-size: 14pt;"><strong>Dois.</strong> texto dois</span></li>' +
        '<li><span style="font-size: 14pt;"><strong>Três.</strong> texto três</span></li>' +
        '</ul><p>Depois</p>',
    )
    expect(result!.first.data).toBe('Um.')
    expect(result!.last.data).toBe(' texto três')
  })

  it('seleção parcial: só os nós de texto das pontas se dividem; o resto fica igual', () => {
    const root = setup(LIST)
    applyInlineStyle(root, between(root, 'Um.', 1, 'texto três', 6), 'color', 'red')
    expect(root.innerHTML).toBe(
      '<h3>Título</h3><ul>' +
        '<li><strong>U<span style="color: red;">m.</span></strong><span style="color: red;"> texto um</span></li>' +
        '<li><span style="color: red;"><strong>Dois.</strong> texto dois</span></li>' +
        '<li><span style="color: red;"><strong>Três.</strong> texto</span> três</li>' +
        '</ul><p>Depois</p>',
    )
  })

  it('começando fora da lista: o título recebe o span dentro dele', () => {
    const root = setup(LIST)
    applyInlineStyle(root, between(root, 'Título', 0, 'texto um', -1), 'fontFamily', 'Georgia')
    expect(root.innerHTML).toBe(
      '<h3><span style="font-family: Georgia;">Título</span></h3><ul>' +
        '<li><span style="font-family: Georgia;"><strong>Um.</strong> texto um</span></li>' +
        '<li><strong>Dois.</strong> texto dois</li><li><strong>Três.</strong> texto três</li></ul><p>Depois</p>',
    )
  })

  it('selecionar tudo pelas bordas dos elementos (Ctrl+A no Firefox)', () => {
    const root = setup(LIST)
    const range = document.createRange()
    range.selectNodeContents(root)
    applyInlineStyle(root, range, 'fontSize', '18pt')
    expect(root.querySelectorAll('li')).toHaveLength(3)
    expect(root.querySelectorAll('ul > span, li span li, p span p')).toHaveLength(0)
    expect(root.querySelectorAll('span')).toHaveLength(5)
  })

  it('lista aninhada: a sublista fica dentro do item, cada nível com seu span', () => {
    const root = setup('<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>')
    applyInlineStyle(root, between(root, 'a', 0, 'd', -1), 'color', 'blue')
    expect(root.innerHTML).toBe(
      '<ul><li><span style="color: blue;">a</span><ul><li><span style="color: blue;">b</span></li>' +
        '<li><span style="color: blue;">c</span></li></ul></li><li><span style="color: blue;">d</span></li></ul>',
    )
  })

  it('itens vazios ficam vazios; espaços de formatação entre itens não ganham span', () => {
    const root = setup('<ul>\n  <li>a</li>\n  <li></li>\n  <li><br></li>\n  <li>b</li>\n</ul>')
    applyInlineStyle(root, between(root, 'a', 0, 'b', -1), 'fontSize', '14pt')
    expect(root.innerHTML).toBe(
      '<ul>\n  <li><span style="font-size: 14pt;">a</span></li>\n  <li></li>\n  <li><br></li>\n  <li><span style="font-size: 14pt;">b</span></li>\n</ul>',
    )
  })

  it('tabela: o span não atravessa células nem linhas', () => {
    const root = setup(
      '<table><tbody><tr><td>a1</td><td>b1</td></tr><tr><td>a2</td><td>b2</td></tr></tbody></table>',
    )
    applyInlineStyle(root, between(root, 'a1', 1, 'b2', 1), 'color', 'red')
    expect(root.innerHTML).toBe(
      '<table><tbody><tr><td>a<span style="color: red;">1</span></td><td><span style="color: red;">b1</span></td></tr>' +
        '<tr><td><span style="color: red;">a2</span></td><td><span style="color: red;">b</span>2</td></tr></tbody></table>',
    )
  })

  it('caixa de texto: a alça não editável fica de fora', () => {
    const root = setup(
      '<div class="rich-textbox"><span class="textbox-handle" contenteditable="false">⠿</span><p>um</p><p>dois</p></div>',
    )
    const range = document.createRange()
    range.selectNodeContents(root)
    applyInlineStyle(root, range, 'fontSize', '20pt')
    expect(root.innerHTML).toBe(
      '<div class="rich-textbox"><span class="textbox-handle" contenteditable="false">⠿</span>' +
        '<p><span style="font-size: 20pt;">um</span></p><p><span style="font-size: 20pt;">dois</span></p></div>',
    )
  })

  it('a mesma propriedade sai dos elementos de dentro; as outras ficam', () => {
    const root = setup(
      '<p><span style="font-size: 9pt; color: red;">a</span> b <em style="font-size: 30pt">c</em></p>',
    )
    applyInlineStyle(root, between(root, 'a', 0, 'c', -1), 'fontSize', '14pt')
    expect(root.innerHTML).toBe(
      '<p><span style="font-size: 14pt;"><span style="color: red;">a</span> b <em>c</em></span></p>',
    )
  })

  it('aplicar de novo reaproveita o span (sem empilhar)', () => {
    const root = setup(LIST)
    for (const size of ['14pt', '16pt', '18pt']) {
      applyInlineStyle(root, between(root, 'Um.', 0, 'texto três', -1), 'fontSize', size)
    }
    applyInlineStyle(root, between(root, 'Um.', 0, 'texto três', -1), 'color', 'red')
    expect(root.querySelectorAll('span')).toHaveLength(3)
    root.querySelectorAll('li > span').forEach((span) => {
      expect(span.getAttribute('style')).toBe('font-size: 18pt; color: red;')
    })
  })

  it('spans vizinhos com o mesmo estilo viram um só', () => {
    const root = setup('<p><span style="color: red;">a</span>b</p>')
    applyInlineStyle(root, between(root, 'b', 0, 'b', -1), 'color', 'red')
    expect(root.innerHTML).toBe('<p><span style="color: red;">ab</span></p>')
  })

  it('reversível: revert() devolve o HTML exato (prévia cancelada)', () => {
    for (const html of [
      LIST,
      '<p><span style="font-size: 9pt; color: red;">a</span> b <em style="color: blue">c</em></p>',
      '<table><tbody><tr><td>a1</td><td>b1</td></tr></tbody></table>',
    ]) {
      const root = setup(html)
      const before = root.innerHTML
      const all = texts(root)
      const range = document.createRange()
      range.setStart(all[0], 1)
      range.setEnd(all[all.length - 1], all[all.length - 1].length - 1)
      const result = applyInlineStyle(root, range, 'color', 'green', { reversible: true })
      expect(root.innerHTML).not.toBe(before)
      result!.revert()
      expect(root.innerHTML).toBe(before)
      // Os nós de texto originais voltam inteiros (a seleção guardada continua válida)
      expect(texts(root).map((t) => t.data)).toEqual(all.map((t) => t.data))
      expect(texts(root)[0]).toBe(all[0])
    }
  })

  it('sem texto editável na seleção: nada muda', () => {
    const root = setup('<p><img src="a.png"></p>')
    const range = document.createRange()
    range.selectNodeContents(root)
    expect(applyInlineStyle(root, range, 'fontSize', '14pt')).toBeNull()
    expect(root.innerHTML).toBe('<p><img src="a.png"></p>')
  })
})
