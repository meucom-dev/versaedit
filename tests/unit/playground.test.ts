// Playground: o JSX equivalente mostrado no painel compila e reproduz as props
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  PLAYGROUND_FONTS,
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
