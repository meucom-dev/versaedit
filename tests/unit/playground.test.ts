// Playground: o JSX equivalente mostrado no painel compila e reproduz as props
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  PLAYGROUND_FONTS,
  samplesFor,
  settingsToJsx,
  settingsToProps,
} from '../../playground/PropsPanel'

describe('JSX equivalente do painel Propriedades', () => {
  it('sem mudanças, largura e altura de sempre e as fontes do playground', () => {
    expect(settingsToProps(DEFAULT_SETTINGS)).toEqual({
      width: 900,
      height: 420,
      ...PLAYGROUND_FONTS,
    })
  })

  it('compila e entrega ao VersaEdit as mesmas props aplicadas no playground', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      toolbar: ['format', 'link'] as typeof DEFAULT_SETTINGS.toolbar,
      width: '100%',
      frameWidth: 3,
      accentColor: '#0f766e',
      pasteImages: false,
      useOnError: true,
    }
    const jsx = settingsToJsx(settings, 'pt-BR')
    expect(jsx).toContain('toolbar={["format","link"]}')
    const out = ts.transpileModule(`return ${jsx}`, {
      compilerOptions: { jsx: ts.JsxEmit.React },
      reportDiagnostics: true,
    })
    expect(out.diagnostics).toEqual([])
    const element = new Function('React', 'VersaEdit', 'setHtml', 'editorRef', out.outputText)(
      { createElement: (_type: unknown, props: unknown) => props },
      'VersaEdit',
      'setHtml',
      'editorRef',
    )
    const { ref, locale, onChange, onError, ...props } = element
    expect([ref, locale, onChange, typeof onError]).toEqual([
      'editorRef',
      'pt-BR',
      'setHtml',
      'function',
    ])
    expect(props).toEqual(settingsToProps(settings))
  })

  it('JSX equivalente em espanhol: locale="es"', () => {
    expect(settingsToJsx(DEFAULT_SETTINGS, 'es').split('\n').slice(0, 3)).toEqual([
      '<VersaEdit',
      '  ref={editorRef}',
      '  locale="es"',
    ])
  })
})

describe('conteúdos de exemplo nos três idiomas', () => {
  const LOCALES = ['en', 'pt-BR', 'es'] as const
  // Estrutura sem o texto: etiquetas, atributos (sem o alt), estilos e a imagem
  const structure = (html: string) =>
    html
      .replace(/>[^<]+</g, '><')
      .replace(/ alt="[^"]*"/g, ' alt=""')
      .replace(/^[^<]+|[^>]+$/g, '')

  it('mesmos exemplos, na mesma ordem, e a mesma estrutura HTML em todos os idiomas', () => {
    const en = samplesFor('en')
    for (const locale of LOCALES) {
      const list = samplesFor(locale)
      expect(list.map((x) => x.id)).toEqual(en.map((x) => x.id))
      for (const [i, sample] of list.entries())
        expect(structure(sample.html), `${locale} ${sample.id}`).toBe(structure(en[i].html))
    }
  })

  it('o texto muda com o idioma', () => {
    const text = (locale: (typeof LOCALES)[number], id: string) =>
      samplesFor(locale).find((x) => x.id === id)!.html
    expect(text('en', 'table')).toContain('<td>Bread</td>')
    expect(text('pt-BR', 'table')).toContain('<td>Pão</td>')
    expect(text('es', 'table')).toContain('<td>Pan</td>')
    expect(text('pt-BR', 'image')).toContain('alt="Quadrado azul"')
    expect(text('es', 'image')).toContain('alt="Cuadrado azul"')
    expect(text('es', 'textbox')).toContain('Un cuadro de texto')
    expect(text('es', 'long')).toContain('<p>Párrafo 40.</p>')
    for (const id of ['formatted', 'table', 'image', 'textbox', 'long'])
      expect(new Set(LOCALES.map((l) => text(l, id))).size, id).toBe(3)
  })

  it('o inglês continua igual ao de antes', () => {
    const [, formatted, table, image, textbox] = samplesFor('en')
    expect(formatted.html).toBe(
      '<h2>Heading</h2><p><b>Bold</b>, <i>italic</i>, <u>underline</u>, ' +
        '<span style="color: rgb(190, 18, 60);">color</span> and a <a href="https://example.com">link</a>.</p>' +
        '<ul><li>First</li><li>Second</li></ul><blockquote>A quote.</blockquote>',
    )
    expect(table.html).toBe(
      '<table><thead><tr><th>Item</th><th>Qty</th></tr></thead>' +
        '<tbody><tr><td>Bread</td><td>2</td></tr><tr><td>Milk</td><td>1</td></tr></tbody></table><p></p>',
    )
    expect(
      image.html.startsWith(
        '<p>An image floated to the right:</p><img src="data:image/png;base64,',
      ),
    ).toBe(true)
    expect(
      image.html.endsWith(
        '" class="pos-right" style="width: 120px" alt="Blue square"><p>Text next to it.</p>',
      ),
    ).toBe(true)
    expect(textbox.html).toBe(
      '<p>Before.</p><div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>A text box</div><p>After.</p>',
    )
  })
})
