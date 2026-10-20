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

describe('links em nova aba (target="_blank")', () => {
  const editorLink = '<a href="https://a.com" target="_blank" rel="noopener noreferrer">a</a>'
  it('o link criado pelo editor volta igual (purify e carregamento)', () => {
    expect(purifyHtml(editorLink)).toBe(editorLink)
    expect(sanitizeHtml(`<p>${editorLink}</p>`)).toBe(`<p>${editorLink}</p>`)
  })
  it('sem rel, ganha rel seguro', () => {
    expect(purifyHtml('<a href="https://a.com" target="_blank">a</a>')).toBe(editorLink)
  })
  it('rel com "opener" perde o opener; outros valores ficam', () => {
    expect(purifyHtml('<a href="https://a.com" target="_blank" rel="opener nofollow">a</a>')).toBe(
      '<a href="https://a.com" target="_blank" rel="nofollow noopener noreferrer">a</a>',
    )
  })
  it('_BLANK maiúsculo é normalizado', () => {
    expect(purifyHtml('<a href="https://a.com" target="_BLANK">a</a>')).toBe(editorLink)
  })
  it('outros destinos e outros elementos continuam sem target', () => {
    expect(purifyHtml('<a href="https://a.com" target="_self">a</a>')).toBe(
      '<a href="https://a.com">a</a>',
    )
    expect(purifyHtml('<a href="https://a.com" target="janela">a</a>')).toBe(
      '<a href="https://a.com">a</a>',
    )
    expect(purifyHtml('<p target="_blank">t</p>')).toBe('<p>t</p>')
  })
  it('link sem target fica como estava (inclusive o rel)', () => {
    expect(purifyHtml('<a href="https://a.com" rel="nofollow">a</a>')).toBe(
      '<a href="https://a.com" rel="nofollow">a</a>',
    )
  })
  it('href perigoso continua removido, mesmo com target', () => {
    expect(purifyHtml('<a href="javascript:alert(1)" target="_blank">x</a>')).toBe(
      '<a target="_blank" rel="noopener noreferrer">x</a>',
    )
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

describe('sanitizeHtml — recuo e citação', () => {
  const first = (html: string) => {
    const body = document.createElement('body')
    body.innerHTML = html
    return body.firstElementChild as HTMLElement
  }
  // Recuo do Chromium/WebKit, gravado antes desta versão (sem role)
  const CHROMIUM_INDENT =
    '<blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;"><p>a</p></blockquote>'

  it('recuo do Chromium/WebKit continua recuo: geometria mantida e role="presentation"', () => {
    const el = first(sanitizeHtml(CHROMIUM_INDENT))
    expect(el.tagName).toBe('BLOCKQUOTE')
    expect(el.getAttribute('role')).toBe('presentation')
    expect(el.style.marginLeft).toBe('40px')
    expect(el.style.marginTop).toMatch(/^0(px)?$/)
    expect(el.style.borderLeftStyle).toBe('none')
    expect(el.style.paddingLeft).toMatch(/^0(px)?$/)
    expect(el.innerHTML).toBe('<p>a</p>')
  })
  it('recuo aninhado: cada nível marcado', () => {
    const out = sanitizeHtml(
      '<blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;"><blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;"><p>a</p></blockquote></blockquote>',
    )
    expect(out.match(/role="presentation"/g)).toHaveLength(2)
  })
  it('recuo do Firefox (margin-left no bloco) é mantido', () => {
    expect(first(sanitizeHtml('<p style="margin-left: 40px;">a</p>')).style.marginLeft).toBe('40px')
    expect(first(sanitizeHtml('<p style="margin-left: 80px;">a</p>')).style.marginLeft).toBe('80px')
    expect(first(sanitizeHtml('<h2 style="margin-left: 40px;">a</h2>')).style.marginLeft).toBe(
      '40px',
    )
  })
  it('citação continua citação (sem role); citação recuada mantém o recuo', () => {
    expect(sanitizeHtml('<blockquote>a</blockquote>')).toBe('<blockquote>a</blockquote>')
    const quote = first(sanitizeHtml('<blockquote style="margin-left: 40px;">a</blockquote>'))
    expect(quote.hasAttribute('role')).toBe(false)
    expect(quote.style.marginLeft).toBe('40px')
  })
  it('margens que não são recuo do editor continuam removidas', () => {
    expect(sanitizeHtml('<p style="margin-left: 48px;">a</p>')).toBe('<p>a</p>')
    expect(sanitizeHtml('<p style="margin-left: -40px;">a</p>')).toBe('<p>a</p>')
    expect(sanitizeHtml('<p style="margin: 20px;">a</p>')).toBe('<p>a</p>')
    expect(sanitizeHtml('<p><span style="margin-left: 40px;">a</span></p>')).toBe(
      '<p><span>a</span></p>',
    )
    // Sem margem, um blockquote sem borda não é recuo
    expect(sanitizeHtml('<blockquote style="border: none;">a</blockquote>')).toBe(
      '<blockquote>a</blockquote>',
    )
  })
  it('reabrir de novo não muda mais nada', () => {
    for (const html of [CHROMIUM_INDENT, '<p style="margin-left: 80px;">a</p>']) {
      const once = sanitizeHtml(html)
      expect(sanitizeHtml(once)).toBe(once)
    }
  })
})

describe('sanitizeHtml — atributos ficam onde estavam', () => {
  it('class e style mantêm a posição', () => {
    const handle = '<span class="textbox-handle" contenteditable="false" title="Mover">⠿</span>'
    expect(sanitizeHtml(handle)).toBe(handle)
    const img =
      '<img src="data:image/png;base64,iVBORw0KGgo=" class="pos-left" draggable="false" style="max-width: 50%;" alt="foto">'
    expect(sanitizeHtml(img)).toBe(img)
  })
  it('atributos funcionais, semânticos e de acessibilidade continuam, na ordem', () => {
    const p =
      '<p class="pos-left" id="p1" dir="rtl" lang="en" title="t" aria-label="a" role="note" style="color: red;">t</p>'
    expect(sanitizeHtml(p)).toBe(p)
    const cell =
      '<table><tbody><tr><td style="background-color: rgb(255, 255, 0);" colspan="2">c</td></tr></tbody></table>'
    expect(sanitizeHtml(cell)).toBe(cell)
  })
  it('a filtragem não muda: classe estranha e estilo proibido saem, no lugar', () => {
    expect(
      sanitizeHtml('<p class="x pos-left y" title="t" style="margin: 9px; color: red;">t</p>'),
    ).toBe('<p class="pos-left" title="t" style="color: red;">t</p>')
    expect(sanitizeHtml('<p class="x" title="t" style="margin: 9px;">t</p>')).toBe(
      '<p title="t">t</p>',
    )
  })
  it('cor antiga (bgcolor) vira style, como antes', () => {
    expect(
      sanitizeHtml('<table><tbody><tr><td bgcolor="#ff0" colspan="2">c</td></tr></tbody></table>'),
    ).toBe(
      '<table><tbody><tr><td colspan="2" style="background-color: rgb(255, 255, 0);">c</td></tr></tbody></table>',
    )
  })
  it('vários ciclos seguidos dão o mesmo HTML', () => {
    const doc =
      '<p style="color: red;" class="pos-left" title="t">a</p><div class="rich-textbox" style="width: 200px;"><span class="textbox-handle" contenteditable="false">⠿</span>b</div>'
    let html = doc
    for (let i = 0; i < 5; i++) html = sanitizeHtml(html)
    expect(html).toBe(doc)
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
