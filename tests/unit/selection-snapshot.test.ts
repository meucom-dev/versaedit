// Seleção que sobrevive à troca do HTML (base do desfazer/refazer com seleção):
// captura, relê o HTML (todos os nós ficam novos) e restaura no mesmo lugar
import { afterEach, describe, expect, it } from 'vitest'
import { captureSelection, restoreSelection } from '../../src/core/selection'

let root: HTMLElement

function setup(html: string) {
  root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}
afterEach(() => root?.remove())

// Seleciona, captura, relê o HTML e restaura; devolve o estado da seleção depois
function roundtrip(html: string, select: (root: HTMLElement) => [Node, number, Node, number]) {
  setup(html)
  const [anchorNode, anchorOffset, focusNode, focusOffset] = select(root)
  const snapshot = captureSelection(root, anchorNode, anchorOffset, focusNode, focusOffset)
  const html2 = root.innerHTML
  root.innerHTML = html2 // nós novos, como no desfazer
  restoreSelection(root, snapshot)
  const s = window.getSelection()!
  const describe = (node: Node | null, offset: number) =>
    node?.nodeType === 3
      ? `${JSON.stringify((node as Text).data)}:${offset} em ${node.parentNode!.nodeName}`
      : `${node?.nodeName}:${offset}`
  return {
    snapshot,
    anchor: describe(s.anchorNode, s.anchorOffset),
    focus: describe(s.focusNode, s.focusOffset),
    anchorNode: s.anchorNode,
    focusNode: s.focusNode,
  }
}

const text = (el: Element | null | undefined) => el!.firstChild as Text

describe('seleção guardada e restaurada depois de reler o HTML', () => {
  it('texto repetido: volta à segunda ocorrência, não à primeira', () => {
    const r = roundtrip('<p>aa aa aa</p>', (root) => {
      const t = text(root.querySelector('p'))
      return [t, 3, t, 5]
    })
    expect(r.snapshot.anchor.offset).toBe(3)
    expect([r.anchor, r.focus]).toEqual(['"aa aa aa":3 em P', '"aa aa aa":5 em P'])
  })

  it('nós de texto divididos (que se fundem ao reler o HTML)', () => {
    const r = roundtrip('<p>abcdef</p>', (root) => {
      const p = root.querySelector('p')!
      ;(p.firstChild as Text).splitText(3)
      return [p.lastChild!, 1, p.lastChild!, 1]
    })
    expect(r.anchor).toBe('"abcdef":4 em P')
  })

  it('fim do negrito continua dentro do negrito', () => {
    const r = roundtrip('<p>um <b>dois</b> tres</p>', (root) => {
      const t = text(root.querySelector('b'))
      return [t, 4, t, 4]
    })
    expect(r.anchor).toBe('"dois":4 em B')
  })

  it('começo do texto depois do negrito continua fora do negrito', () => {
    const r = roundtrip('<p>um <b>dois</b> tres</p>', (root) => {
      const t = root.querySelector('b')!.nextSibling!
      return [t, 0, t, 0]
    })
    expect(r.anchor).toBe('" tres":0 em P')
  })

  it('logo depois de uma imagem (ponto entre elementos)', () => {
    const r = roundtrip('<p>a<img src="x.png">b</p>', (root) => {
      const p = root.querySelector('p')!
      return [p, 2, p, 2]
    })
    expect(r.snapshot.anchor.offset).toBe(2)
    expect(r.anchor).toBe('P:2')
  })

  it('dentro da caixa de texto: a alça não editável conta como uma unidade', () => {
    const html =
      '<p>x</p><div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>Caixa</div>'
    const r = roundtrip(html, (root) => {
      const t = root.querySelector('.rich-textbox')!.lastChild!
      return [t, 2, t, 2]
    })
    // Segundo bloco; dentro dele, a alça (1) + "Ca" (2)
    expect([r.snapshot.anchor.block, r.snapshot.anchor.offset]).toEqual([1, 1 + 2])
    expect(r.anchor).toBe('"Caixa":2 em DIV')
  })

  it('ponto dentro de um elemento não editável conta como logo antes dele', () => {
    const html = '<p>ab<span contenteditable="false">xyz</span>cd</p>'
    setup(html)
    const inside = root.querySelector('span')!.firstChild!
    const snapshot = captureSelection(root, inside, 2, inside, 2)
    expect(snapshot.anchor.offset).toBe(2)
  })

  it('parágrafo vazio', () => {
    const r = roundtrip('<p>a</p><p><br></p><p>b</p>', (root) => {
      const p = root.querySelectorAll('p')[1]
      return [p, 0, p, 0]
    })
    expect(r.anchor).toBe('P:0')
    expect(r.anchorNode).toBe(root.querySelectorAll('p')[1])
  })

  it('seleção de trás para frente entre parágrafos mantém a direção', () => {
    const r = roundtrip('<p>primeiro</p><p>segundo</p>', (root) => {
      const [a, b] = root.querySelectorAll('p')
      return [text(b), 3, text(a), 2]
    })
    expect([r.anchor, r.focus]).toEqual(['"segundo":3 em P', '"primeiro":2 em P'])
  })

  it('seleção atravessando negrito e itálico', () => {
    const r = roundtrip('<p>um <b>dois <i>tres</i></b> quatro</p>', (root) => [
      text(root.querySelector('p')),
      1,
      text(root.querySelector('i')),
      2,
    ])
    expect([r.anchor, r.focus]).toEqual(['"um ":1 em P', '"tres":2 em I'])
  })

  it('dois parágrafos com o mesmo texto: volta ao segundo', () => {
    const r = roundtrip('<p>igual</p><p>igual</p>', (root) => {
      const t = text(root.querySelectorAll('p')[1])
      return [t, 0, t, 5]
    })
    expect(r.focusNode!.parentNode).toBe(root.querySelectorAll('p')[1])
    expect(
      r.anchorNode === root.querySelectorAll('p')[1] ||
        r.anchorNode!.parentNode === root.querySelectorAll('p')[1],
    ).toBe(true)
  })

  it('elementos futuros sem caso especial: tabela, iframe e vídeo', () => {
    const html =
      '<p>a<iframe src="about:blank"></iframe>b</p><table><tbody><tr><td>ab</td><td>cd</td></tr></tbody></table><video src="v.mp4"></video><p>fim</p>'
    const r = roundtrip(html, (root) => {
      const cd = text(root.querySelectorAll('td')[1])
      const fim = text(root.querySelectorAll('p')[1])
      return [cd, 1, fim, 2]
    })
    // Tabela (bloco 1): "ab" (2) + "c" (1); "fim" é o bloco 3
    expect([r.snapshot.anchor.block, r.snapshot.anchor.offset]).toEqual([1, 2 + 1])
    expect([r.snapshot.focus.block, r.snapshot.focus.offset]).toEqual([3, 2])
    expect([r.anchor, r.focus]).toEqual(['"cd":1 em TD', '"fim":2 em P'])
  })

  it('conteúdo que encolheu: a ponta vai para o fim do bloco, sem erro', () => {
    setup('<p>um texto longo</p>')
    const t = text(root.querySelector('p'))
    const snapshot = captureSelection(root, t, 10, t, 10)
    root.innerHTML = '<p>curto</p>'
    restoreSelection(root, snapshot)
    expect(window.getSelection()!.anchorNode).toBe(root.querySelector('p'))
    expect(window.getSelection()!.anchorOffset).toBe(1)
  })

  it('bloco que não existe mais: a ponta vai para o fim do editor, sem erro', () => {
    setup('<p>a</p><p>b</p><p>c</p>')
    const t = text(root.querySelectorAll('p')[2])
    const snapshot = captureSelection(root, t, 1, t, 1)
    root.innerHTML = '<p>a</p>'
    restoreSelection(root, snapshot)
    expect(window.getSelection()!.anchorNode).toBe(root)
    expect(window.getSelection()!.anchorOffset).toBe(1)
  })
})

describe('posição contada dentro do bloco (custo independente do tamanho do documento)', () => {
  it('a posição no último bloco não depende de quantos blocos vêm antes', () => {
    for (const before of [1, 500]) {
      setup('<p>x</p>'.repeat(before) + '<p>alvo <b>aqui</b></p>')
      const t = text(root.querySelector('b'))
      const snapshot = captureSelection(root, t, 2, t, 2)
      expect(snapshot.anchor).toEqual({ block: before, offset: 5 + 2, path: [0], inText: true })
      root.remove()
    }
  })

  it('texto solto na raiz e ponto entre blocos usam a posição desde o começo do editor', () => {
    const r = roundtrip('solto<p>b</p>', (root) => [root.firstChild!, 3, root, 2])
    expect(r.snapshot.anchor.block).toBe(-1)
    expect(r.snapshot.focus.block).toBe(-1)
    expect([r.anchor, r.focus]).toEqual(['"solto":3 em DIV', 'DIV:2'])
  })

  it('seleção que atravessa muitos blocos volta igual, nos dois sentidos', () => {
    const html = Array.from({ length: 40 }, (_, i) => `<p>linha ${i}</p>`).join('')
    const forward = roundtrip(html, (root) => [
      text(root.querySelectorAll('p')[3]),
      2,
      text(root.querySelectorAll('p')[37]),
      4,
    ])
    expect([forward.anchor, forward.focus]).toEqual(['"linha 3":2 em P', '"linha 37":4 em P'])
    root.remove()
    const backward = roundtrip(html, (root) => [
      text(root.querySelectorAll('p')[37]),
      4,
      text(root.querySelectorAll('p')[3]),
      2,
    ])
    expect([backward.anchor, backward.focus]).toEqual(['"linha 37":4 em P', '"linha 3":2 em P'])
  })
})

describe('ilhas editáveis dentro de objetos não editáveis', () => {
  const FIGURE =
    '<p>a</p><figure contenteditable="false"><img src="x.png"><figcaption contenteditable="true">legenda</figcaption></figure><p>b</p>'

  it('cursor dentro da legenda editável volta à legenda', () => {
    const r = roundtrip(FIGURE, (root) => {
      const t = text(root.querySelector('figcaption'))
      return [t, 3, t, 3]
    })
    expect(r.anchor).toBe('"legenda":3 em FIGCAPTION')
  })

  it('seleção de trás para frente, do parágrafo seguinte até dentro da legenda', () => {
    const r = roundtrip(FIGURE, (root) => [
      text(root.querySelectorAll('p')[1]),
      1,
      text(root.querySelector('figcaption')),
      2,
    ])
    expect([r.anchor, r.focus]).toEqual(['"b":1 em P', '"legenda":2 em FIGCAPTION'])
  })

  it('ilhas aninhadas (editável dentro de não editável dentro de editável)', () => {
    const html =
      '<div contenteditable="false"><span>rótulo</span><div contenteditable="true">fora<span contenteditable="false">x<em contenteditable="true">dentro</em></span></div></div>'
    const r = roundtrip(html, (root) => {
      const t = text(root.querySelector('em'))
      return [t, 4, t, 4]
    })
    expect(r.anchor).toBe('"dentro":4 em EM')
  })

  it('ilha plaintext-only também é editável', () => {
    const html = '<div contenteditable="false"><p contenteditable="plaintext-only">nota</p></div>'
    const r = roundtrip(html, (root) => {
      const t = text(root.querySelector('p'))
      return [t, 2, t, 2]
    })
    expect(r.anchor).toBe('"nota":2 em P')
  })

  it('objeto não editável sem ilhas continua uma unidade (posições iguais às de antes)', () => {
    setup('<p>ab<span contenteditable="false">xyz</span>cd</p>')
    const t = root.querySelector('p')!.lastChild!
    expect(captureSelection(root, t, 1, t, 1).anchor.offset).toBe(2 + 1 + 1)
  })
})
