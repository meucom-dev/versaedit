import { describe, expect, it } from 'vitest'
import {
  linkHtml,
  normalizeLinkUrl,
  textboxHtml,
  unwrapListsFromParagraphs,
} from '../../src/core/commands'
import { DEFAULT_FONT_FAMILIES, googleFontsUrl } from '../../src/core/defaults'
import { closestFontSizeOption, cssFontSizeToPoints, matchFontFamily } from '../../src/core/fonts'
import { en } from '../../src/core/i18n/en'
import { format, resolveLabels } from '../../src/core/i18n'
import { ptBR } from '../../src/core/i18n/pt-BR'

describe('idiomas', () => {
  it('pt-BR tem exatamente as mesmas chaves do en, todas preenchidas', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort())
    for (const [key, value] of Object.entries(ptBR)) expect(value, key).not.toBe('')
  })
  it('marcadores {..} iguais nos dois idiomas', () => {
    const marks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(marks(ptBR[key]), key).toBe(marks(en[key]))
    }
  })
  it('resolveLabels aplica as trocas da prop labels', () => {
    const L = resolveLabels('pt-BR', { bold: 'Forte' })
    expect(L.bold).toBe('Forte')
    expect(L.italic).toBe('Itálico (Ctrl+I)')
  })
  it('format preenche marcadores e deixa os desconhecidos', () => {
    expect(format('Borda {n}px {x}', { n: 3 })).toBe('Borda 3px {x}')
  })
})

describe('links', () => {
  it.each([
    ['example.com', 'https://example.com'],
    ['  www.a.org ', 'https://www.a.org'],
    ['http://a.com', 'http://a.com'],
    ['mailto:x@y.z', 'mailto:x@y.z'],
    ['#topo', '#topo'],
    ['javascript:alert(1)', null],
    ['ftp://a.com', null],
    ['', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLinkUrl(input)).toBe(expected)
  })
  it('linkHtml escapa endereço e texto', () => {
    expect(linkHtml('https://a.com/?a=1&b="2"', '<b>')).toBe(
      '<a href="https://a.com/?a=1&amp;b=&quot;2&quot;" target="_blank" rel="noopener noreferrer">&lt;b&gt;</a>',
    )
  })
  it('caixa de texto escapa os textos traduzidos', () => {
    expect(textboxHtml('a"b', '<i>')).toContain('title="a&quot;b"')
    expect(textboxHtml('a"b', '<i>')).toContain('&lt;i&gt;</div>')
  })
})

describe('listas fora de <p>', () => {
  it('desembrulha o parágrafo que contém a lista', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>antes</p><p><ul><li>a</li></ul></p>'
    // o parser não aceita <ul> dentro de <p>: monta o caso pelo DOM
    const p = document.createElement('p')
    const ul = document.createElement('ul')
    ul.innerHTML = '<li>a</li>'
    p.appendChild(ul)
    root.innerHTML = '<p>antes</p>'
    root.appendChild(p)
    unwrapListsFromParagraphs(root)
    expect(root.innerHTML).toBe('<p>antes</p><ul><li>a</li></ul>')
  })
  it('não mexe em parágrafos sem lista', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>a</p><ul><li>b</li></ul>'
    unwrapListsFromParagraphs(root)
    expect(root.innerHTML).toBe('<p>a</p><ul><li>b</li></ul>')
  })
})

describe('fontes', () => {
  it('converte px e pt para pontos (6 a 72)', () => {
    expect(cssFontSizeToPoints('16px')).toBe(12)
    expect(cssFontSizeToPoints('10.5pt')).toBe(10.5)
    expect(cssFontSizeToPoints('2pt')).toBeNull()
    expect(cssFontSizeToPoints('large')).toBeNull()
  })
  it('escolhe o tamanho mais próximo do menu', () => {
    expect(closestFontSizeOption(13, [8, 12, 14])).toBe('12')
    expect(closestFontSizeOption(13.5, [8, 12, 14])).toBe('14')
  })
  it('encontra a fonte do menu pela família calculada', () => {
    expect(matchFontFamily('"Courier New", monospace', DEFAULT_FONT_FAMILIES)?.label).toBe(
      'Courier New',
    )
    expect(matchFontFamily('Papyrus', DEFAULT_FONT_FAMILIES)).toBeUndefined()
  })
  it('URL do Google Fonts aceita nome simples ou especificação completa', () => {
    expect(googleFontsUrl(['Open Sans', 'Fraunces:opsz,wght@9..144,700'])).toBe(
      'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&family=Fraunces:opsz,wght@9..144,700&display=swap',
    )
  })
})
