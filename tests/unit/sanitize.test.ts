import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  isSafeUrl,
  purifyHtml,
  safeCssColor,
  sanitizeHtml,
} from '../../src/core/sanitize'

describe('purifyHtml — ataques bloqueados', () => {
  const attacks: [string, string, string][] = [
    ['script', '<p>ok</p><script>alert(1)</script>', '<p>ok</p>'],
    ['onerror', '<img src="x" onerror="alert(1)">', '<img src="x">'],
    ['javascript:', '<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
    ['javascript: com tabulação', '<a href="java\tscript:alert(1)">x</a>', '<a>x</a>'],
    ['javascript: maiúsculo', '<a href="JaVaScRiPt:alert(1)">x</a>', '<a>x</a>'],
    ['vbscript:', '<a href="vbscript:msgbox(1)">x</a>', '<a>x</a>'],
    ['data: em link', '<a href="data:text/html,<script>1</script>">x</a>', '<a>x</a>'],
    ['svg em data:', '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">', '<img>'],
    ['iframe', '<iframe src="https://evil"></iframe><p>t</p>', '<p>t</p>'],
    ['svg', '<svg><script>alert(1)</script></svg><p>t</p>', '<p>t</p>'],
    ['math', '<math><mi>x</mi></math><p>t</p>', '<p>t</p>'],
    ['style', '<style>body{display:none}</style><p>t</p>', '<p>t</p>'],
    ['object/embed', '<object data="x"></object><embed src="x"><p>t</p>', '<p>t</p>'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=x"><p>t</p>', '<p>t</p>'],
    ['srcdoc', '<p srcdoc="<script>1</script>">t</p>', '<p>t</p>'],
  ]
  it.each(attacks)('%s', (_name, input, expected) => {
    expect(purifyHtml(input)).toBe(expected)
  })

  it('formulário vira só o texto', () => {
    const out = purifyHtml('<form action="x"><input value="a"><button>b</button></form><p>t</p>')
    expect(out).not.toMatch(/<form|<input|<button|action=/)
    expect(out).toContain('<p>t</p>')
  })
})

describe('purifyHtml — conteúdo do editor preservado', () => {
  it('imagem PNG embutida com classe, draggable e estilo', () => {
    const img =
      '<img src="data:image/png;base64,iVBORw0KGgo=" class="pos-left" draggable="false" style="max-width:50%;height:auto;">'
    expect(purifyHtml(img)).toBe(img)
  })
  it('caixa de texto com alça não editável', () => {
    const box =
      '<div class="rich-textbox" contenteditable="true" style="width:200px"><span class="textbox-handle" contenteditable="false">⠿</span>Caixa</div>'
    expect(purifyHtml(box)).toBe(box)
  })
  it('links https e mailto', () => {
    expect(purifyHtml('<a href="https://a.com">a</a>')).toBe('<a href="https://a.com">a</a>')
    expect(purifyHtml('<a href="mailto:x@y.z">m</a>')).toBe('<a href="mailto:x@y.z">m</a>')
  })
})

describe('isSafeUrl', () => {
  it.each([
    ['href', 'https://a.com', true],
    ['href', '/relativo', true],
    ['href', '#ancora', true],
    ['href', 'javascript:x', false],
    ['href', ' \njavascript:x', false],
    ['src', 'data:image/png;base64,AAAA', true],
    ['src', 'data:image/jpeg;base64,AAAA', true],
    ['src', 'data:image/webp;base64,AAAA', true],
    ['src', 'data:image/svg+xml;base64,AAAA', false],
    ['src', 'data:text/html,x', false],
    ['href', 'data:image/png;base64,AAAA', false],
  ])('%s=%s → %s', (attr, url, expected) => {
    expect(isSafeUrl(attr, url)).toBe(expected)
  })
})

describe('sanitizeHtml (carregar conteúdo)', () => {
  it('remove margens e classes estranhas de textos comuns', () => {
    expect(sanitizeHtml('<p style="margin:9px" class="landing x">um</p>')).toBe('<p>um</p>')
  })
  it('mantém formatação de texto permitida', () => {
    const out = sanitizeHtml(
      '<p style="text-align:center;line-height:1.5"><span style="font-size:16px;color:red;font-weight:700;background-color:yellow">x</span></p>',
    )
    expect(out).toContain('text-align: center')
    expect(out).toContain('line-height: 1.5')
    expect(out).toContain('font-size: 12pt') // 16px = 12pt
    expect(out).toContain('color: red')
    expect(out).toContain('font-weight: 700')
    expect(out).toContain('background-color: yellow')
  })
  it('mantém layout de imagens e caixas de texto (e só delas)', () => {
    const out = sanitizeHtml(
      '<img src="a.png" class="pos-right selected" style="width:120px;margin-top:8px;transform:translate(3px, 4px)"><div class="rich-textbox tb-float-left" style="border-style:dashed;border-width:2px;margin-left:5px">t</div>',
    )
    expect(out).toContain('class="pos-right"')
    expect(out).toContain('width: 120px')
    expect(out).toContain('transform: translate(3px, 4px)')
    expect(out).toContain('class="rich-textbox tb-float-left"')
    expect(out).toContain('border-width: 2px')
    expect(out).not.toContain('selected')
  })
  it('desfaz tags <font> antigas mantendo o texto', () => {
    expect(sanitizeHtml('<p><font color="red" size="5">velho</font></p>')).toBe('<p>velho</p>')
  })
  it('limpa fonte com caracteres suspeitos', () => {
    const out = sanitizeHtml('<span style="font-family: Arial; ">x</span>')
    expect(out).toBe('<span style="font-family: Arial;">x</span>')
  })
})

describe('escapeHtml e safeCssColor', () => {
  it('escapa os cinco caracteres especiais', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    )
  })
  it('cor do papel aceita cores válidas e recusa injeção de CSS', () => {
    expect(safeCssColor('#ffeeaa')).toBe('#ffeeaa')
    expect(safeCssColor(' rgb(1, 2, 3) ')).toBe('rgb(1, 2, 3)')
    expect(safeCssColor('red;background:url(x)')).toBe('')
    expect(safeCssColor('url(javascript:1)')).toBe('')
    expect(safeCssColor('nao-e-cor')).toBe('')
  })
})
