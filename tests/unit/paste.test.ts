import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT_FAMILIES } from '../../src/core/defaults'
import {
  applyPendingStyleToFragment,
  buildPasteHtml,
  clipboardFontFamily,
  clipboardFontSizePoints,
  sanitizeRichPaste,
} from '../../src/core/paste'

const FAMILIES = DEFAULT_FONT_FAMILIES
const WORD = `<html><head><style>p.MsoNormal{font-family:"Georgia"}</style></head><body>
<p class="MsoNormal" style="font-size:14pt;color:red;margin:20px;mso-line-height-rule:exactly" onclick="x()">Word <b>bold</b> <a href="javascript:alert(1)">bad</a> <a href="https://ok.com">ok</a></p>
<script>1</script><o:p></o:p></body></html>`

describe('colagem do Word', () => {
  const out = sanitizeRichPaste(WORD, FAMILIES)

  it('remove scripts, eventos, classes Mso e margens', () => {
    expect(out).not.toMatch(/script|onclick|MsoNormal|margin|mso-/)
  })
  it('mantém tamanho, cor e negrito', () => {
    expect(out).toContain('font-size: 14pt')
    expect(out).toContain('color: red')
    expect(out).toContain('<b')
  })
  it('usa a fonte definida na folha de estilos do Word', () => {
    expect(out).toContain('font-family: Georgia')
  })
  it('tira o endereço javascript: e mantém o https', () => {
    expect(out).toMatch(/<a(?![^>]*href)[^>]*>bad<\/a>/)
    expect(out).not.toContain('javascript')
    expect(out).toContain('href="https://ok.com"')
  })
})

describe('colagem sem atributos vazios', () => {
  it('não deixa style="" quando nenhum estilo é permitido', () => {
    const out = sanitizeRichPaste(
      '<h2 style="margin:4px">T</h2><ul><li style="padding:2px">a<ul><li>b</li></ul></li></ul><p class="x">ver <a href="https://ok.com" style="mso-x:1">s</a></p>',
      FAMILIES,
    )
    expect(out).toBe(
      '<h2>T</h2><ul><li>a<ul><li>b</li></ul></li></ul><p>ver <a href="https://ok.com">s</a></p>',
    )
  })
  it('mantém o estilo quando há propriedade permitida', () => {
    expect(sanitizeRichPaste('<p style="color:red;margin:3px">x</p>', FAMILIES)).toBe(
      '<p style="color: red;">x</p>',
    )
  })
})

describe('buildPasteHtml', () => {
  it('prefere o HTML rico quando ele tem texto', () => {
    const r = buildPasteHtml('<p><b>rico</b></p>', 'rico', false, FAMILIES)
    expect(r.html).toBe('<p><b>rico</b></p>')
  })
  it('texto simples: escapa HTML e troca quebras por <br>', () => {
    const r = buildPasteHtml('', 'a <b>\nlinha 2', false, FAMILIES)
    expect(r.html).toBe('a &lt;b&gt;<br>linha 2')
  })
  it('singleLineBreaks junta linhas em branco seguidas', () => {
    const r = buildPasteHtml('', 'linha 1\n\n\nlinha 2', true, FAMILIES)
    expect(r.html).toBe('linha 1<br>linha 2')
  })
  it('só imagem, com pasteImages desligado: cai no texto simples com o estilo de origem', () => {
    const r = buildPasteHtml(
      '<span style="font-size:18pt"><img src="x"></span>',
      'abc',
      false,
      FAMILIES,
      { images: false },
    )
    expect(r.fontSizePt).toBe(18)
    expect(r.html).toBe('<span style="font-size:18pt">abc</span>')
  })
  it('só imagem, com pasteImages ligado (padrão): a imagem é colada', () => {
    const r = buildPasteHtml(
      '<span style="font-size:18pt"><img src="https://site.com/a.png"></span>',
      'abc',
      false,
      FAMILIES,
    )
    expect(r.html).toBe(
      '<span style="font-size: 18pt;"><img src="https://site.com/a.png" style="max-width: 100%;"></span>',
    )
  })
})

describe('colagem de tabelas, imagens, linhas e código', () => {
  const paste = (html: string, images = true) => sanitizeRichPaste(html, FAMILIES, { images })

  it('tabela com cabeçalho, legenda e corpo mantém a estrutura', () => {
    expect(
      paste(
        '<table border="1" class="x" style="width:500px"><caption>Idades</caption><thead><tr><th scope="col">Nome</th><th>Idade</th></tr></thead><tbody><tr><td>Ana</td><td>30</td></tr></tbody></table>',
      ),
    ).toBe(
      '<table><caption>Idades</caption><thead><tr><th scope="col">Nome</th><th>Idade</th></tr></thead><tbody><tr><td>Ana</td><td>30</td></tr></tbody></table>',
    )
  })
  it('células mescladas: colspan/rowspan válidos ficam; inválidos saem', () => {
    expect(
      paste(
        '<table><tr><td colspan="2" rowspan="1">a</td><td colspan="x">b</td><td rowspan="99999">c</td></tr></table>',
      ),
    ).toBe('<table><tbody><tr><td colspan="2">a</td><td>b</td><td>c</td></tr></tbody></table>')
  })
  it('sombreamento e alinhamento de célula ficam; borda e largura saem', () => {
    expect(
      paste(
        '<table><tr><td style="background-color:#ffeeaa;text-align:right;border:2px solid red;width:90px">x</td></tr></table>',
      ),
    ).toBe(
      '<table><tbody><tr><td style="background-color: rgb(255, 238, 170); text-align: right;">x</td></tr></tbody></table>',
    )
  })
  it('célula vazia não some (a tabela não se desalinha)', () => {
    expect(paste('<table><tr><td>a</td><td></td></tr></table>')).toBe(
      '<table><tbody><tr><td>a</td><td></td></tr></tbody></table>',
    )
  })
  it('linha horizontal e bloco de código', () => {
    expect(
      paste('<p>a</p><hr class="x"><pre class="y"><code>const x = 1;\n  y()</code></pre>'),
    ).toBe('<p>a</p><hr><pre><code>const x = 1;\n  y()</code></pre>')
  })
  it('imagem: endereço http(s) e alt ficam; atributos estranhos saem', () => {
    expect(
      paste(
        '<p><img src="https://a.com/x.png" alt="foto" width="120" class="c" onclick="x()" data-k="1"></p>',
      ),
    ).toBe('<p><img src="https://a.com/x.png" alt="foto" width="120"></p>')
  })
  it('imagem com endereço perigoso ou svg embutido é descartada', () => {
    expect(
      paste('<p>a<img src="javascript:alert(1)">b<img src="data:image/svg+xml;base64,AAAA"></p>'),
    ).toBe('<p>ab</p>')
  })
  it('pasteImages desligado descarta as imagens e mantém o texto', () => {
    expect(paste('<p>antes <img src="https://a.com/x.png"> depois</p>', false)).toBe(
      '<p>antes  depois</p>',
    )
  })
  it('parágrafo só com imagem não é tratado como vazio', () => {
    expect(paste('<p><img src="https://a.com/x.png" width="10"></p>')).toBe(
      '<p><img src="https://a.com/x.png" width="10"></p>',
    )
  })
})

describe('tamanho e fonte do clipboard', () => {
  it('tamanho em pt, px e <font size>', () => {
    expect(clipboardFontSizePoints('<span style="font-size:11pt">x</span>')).toBe(11)
    expect(clipboardFontSizePoints('<span style="font-size:16px">x</span>')).toBe(12)
    expect(clipboardFontSizePoints('<font size="5">x</font>')).toBe(18)
    expect(clipboardFontSizePoints('')).toBeNull()
  })
  it('fonte só quando está na lista do menu', () => {
    expect(clipboardFontFamily('<span style="font-family:Verdana">x</span>', FAMILIES)).toBe(
      'Verdana, Geneva, sans-serif',
    )
    expect(
      clipboardFontFamily('<span style="font-family:Comic Neue">x</span>', FAMILIES),
    ).toBeNull()
  })
})

describe('estilo pendente na colagem', () => {
  it('envolve cada trecho de texto no estilo escolhido e remove o estilo antigo', () => {
    const t = document.createElement('template')
    t.innerHTML = '<span style="font-size:9pt;color:blue">a</span>b'
    const last = applyPendingStyleToFragment(t.content, { fontSize: '20pt' })
    const div = document.createElement('div')
    div.appendChild(t.content)
    expect(div.innerHTML).toBe(
      '<span style="color: blue;"><span style="font-size: 20pt;">a</span></span><span style="font-size: 20pt;">b</span>',
    )
    expect(last?.textContent).toBe('b')
  })
})
