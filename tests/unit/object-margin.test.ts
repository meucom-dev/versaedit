// Margem dos objetos configurável (prop objectMargin, 15/11/2026): variáveis CSS
// geradas por objectMarginStyle, regras do editor e do publicado, e o HTML do
// servidor com as variáveis na raiz.
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_OBJECT_MARGIN, objectMarginStyle, VersaEdit } from '../../src'
import { CONTENT_CSS, EDITOR_CSS } from '../../src/core/styles'

describe('objectMarginStyle', () => {
  it('só os lados informados, em px', () => {
    expect(objectMarginStyle({ text: 24, outer: 8, top: 2, bottom: 20 })).toEqual({
      '--ve-object-text': '24px',
      '--ve-object-outer': '8px',
      '--ve-object-top': '2px',
      '--ve-object-bottom': '20px',
    })
    expect(objectMarginStyle({ text: 30 })).toEqual({ '--ve-object-text': '30px' })
    expect(objectMarginStyle()).toEqual({})
    expect(objectMarginStyle({})).toEqual({})
  })

  it('ignora valores inválidos ou negativos; arredonda; no máximo 200px', () => {
    expect(objectMarginStyle({ text: -1, outer: Number.NaN, top: Infinity, bottom: 12.6 })).toEqual(
      { '--ve-object-bottom': '13px' },
    )
    expect(objectMarginStyle({ text: 999 })).toEqual({ '--ve-object-text': '200px' })
    // Valor de outro tipo (JavaScript sem tipos) também é ignorado
    expect(objectMarginStyle({ text: '20px' as unknown as number })).toEqual({})
  })

  it('o padrão é o dos editores de referência', () => {
    expect(DEFAULT_OBJECT_MARGIN).toEqual({ text: 16, outer: 0, top: 4, bottom: 12 })
  })
})

describe('regras do editor e do publicado', () => {
  for (const [name, css, scope] of [
    ['editor', EDITOR_CSS, '.ve-content'],
    ['publicado', CONTENT_CSS, '.versaedit-content'],
  ] as const) {
    it(`${name}: as quatro variáveis com o padrão como reserva, sem os 40px antigos`, () => {
      const rule = (selector: string) => {
        const m = new RegExp(`${scope.replace('.', '\\.')} ${selector} \\{[^}]*\\}`).exec(css)
        return m?.[0] ?? ''
      }
      const left =
        'var(--ve-object-top, 4px) var(--ve-object-text, 16px) var(--ve-object-bottom, 12px) var(--ve-object-outer, 0px)'
      const right =
        'var(--ve-object-top, 4px) var(--ve-object-outer, 0px) var(--ve-object-bottom, 12px) var(--ve-object-text, 16px)'
      expect(rule('img\\.pos-left')).toContain(`margin: ${left};`)
      expect(rule('img\\.pos-right')).toContain(`margin: ${right};`)
      expect(rule('img\\.pos-center')).toContain('margin: var(--ve-object-text, 16px) auto;')
      expect(rule('\\.rich-textbox\\.tb-float-left')).toContain(`margin: ${left};`)
      expect(rule('\\.rich-textbox\\.tb-float-right')).toContain(`margin: ${right};`)
      expect(rule('\\.rich-textbox')).toContain(
        'margin: var(--ve-object-text, 16px) var(--ve-object-outer, 0px);',
      )
      expect(css).not.toMatch(/(img\.pos-\w+|rich-textbox[\w.-]*) \{[^}]*margin: 40px/)
    })
  }
})

describe('renderização no servidor', () => {
  it('as variáveis da margem saem na raiz do editor', () => {
    const html = renderToString(
      createElement(VersaEdit, { initialContent: '<p>olá</p>', objectMargin: { text: 24 } }),
    )
    expect(html).toMatch(/class="ve-root" style="[^"]*--ve-object-text:24px/)
    expect(html).not.toContain('--ve-object-outer')
  })
})
