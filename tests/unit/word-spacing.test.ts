// Colagem do Word com espaçamento (pasteSpacing) — Lote A (15/11/2026). A amostra
// tests/fixtures/word/word-spacing.htm foi gerada pelo próprio Microsoft Word (texto
// sintético, salvo como página da Web), com as estruturas do documento real que
// motivou o lote.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeRichPaste } from '../../src/core/paste'
import { sanitizeHtml } from '../../src/core/sanitize'
import { lengthToPt, normalizeLineHeight, normalizeSpacing } from '../../src/core/spacing'
import {
  isWordHtml,
  parseDeclarations,
  parseWordRules,
  resolveWordSpacing,
} from '../../src/core/word-styles'

const WORD = readFileSync(resolve(process.cwd(), 'tests/fixtures/word/word-spacing.htm'), 'utf8')
const FAMILIES = [{ label: 'Aptos', value: 'Aptos, sans-serif' }]
const paragraphs = (html: string) =>
  Array.from(new DOMParser().parseFromString(html, 'text/html').body.querySelectorAll('p, h2'))

describe('unidades e limites', () => {
  it('converte comprimentos para pt', () => {
    expect(lengthToPt('8pt')).toBe(8)
    expect(lengthToPt('12px')).toBe(9)
    expect(lengthToPt('1in')).toBe(72)
    expect(lengthToPt('2.54cm')).toBeCloseTo(72, 6)
    expect(lengthToPt('0cm')).toBe(0)
    expect(lengthToPt('0')).toBe(0)
    expect(lengthToPt('1.5em', 12)).toBe(18)
    expect(lengthToPt('-17.85pt')).toBe(-17.85)
    for (const bad of ['10', '1e3pt', 'calc(1px)', 'var(--x)', '12vh', 'url(x)', '']) {
      expect(lengthToPt(bad), bad).toBeNull()
    }
  })

  it('espaçamento vai ao limite seguro', () => {
    expect(normalizeSpacing('margin-top', '200pt')).toBe('72pt')
    expect(normalizeSpacing('margin-bottom', '-5pt')).toBe('0pt')
    expect(normalizeSpacing('margin-left', '500px')).toBe('144pt')
    expect(normalizeSpacing('text-indent', '-200pt')).toBe('-72pt')
    expect(normalizeSpacing('margin-top', 'expression(1)')).toBeNull()
  })

  it('entrelinha salva: número (múltiplo do tamanho) ou pt', () => {
    expect(normalizeLineHeight('1.5')).toBe('1.5')
    expect(normalizeLineHeight('9')).toBe('4')
    expect(normalizeLineHeight('0.1')).toBe('0.5')
    expect(normalizeLineHeight('18pt')).toBe('18pt')
    expect(normalizeLineHeight('24px')).toBe('18pt')
    expect(normalizeLineHeight('300pt')).toBe('144pt')
    for (const bad of ['calc(2)', 'var(--x)', '120%', 'normal', '-2', '0pt']) {
      expect(normalizeLineHeight(bad), bad).toBeNull()
    }
  })
})

describe('cascata do Word (restrita)', () => {
  it('reconhece o HTML do Word', () => {
    expect(isWordHtml(WORD)).toBe(true)
    expect(isWordHtml('<p style="margin:8pt">página da web</p>')).toBe(false)
  })

  it('só propriedades autorizadas, com valores de caracteres seguros', () => {
    expect(
      parseDeclarations(
        'margin-top:8pt; color:red; line-height:expression(alert(1)); text-indent:url(x); mso-line-height-rule:exactly',
      ),
    ).toEqual([
      ['margin-top', '8pt'],
      ['mso-line-height-rule', 'exactly'],
    ])
  })

  it('lê as regras agrupadas das folhas do Word e ignora @page, @font-face e @list', () => {
    const rules = parseWordRules(WORD)
    const has = (tag: string | null, cls: string | null) =>
      rules.some((r) => r.tag === tag && r.className === cls)
    expect(has('P', 'MsoNormal')).toBe(true)
    expect(has('LI', 'MsoNormal')).toBe(true)
    expect(has(null, 'MsoPapDefault')).toBe(true)
    expect(has('H2', null)).toBe(true)
    expect(has('P', 'MsoListParagraphCxSpFirst')).toBe(true)
    expect(rules.every((r) => r.declarations.every(([name]) => !name.startsWith('@')))).toBe(true)
  })

  it('resolve cada parágrafo da amostra como o Word os definiu', () => {
    const rules = parseWordRules(WORD)
    const doc = new DOMParser().parseFromString(WORD, 'text/html')
    const blocks = Array.from(doc.body.querySelectorAll('p, h2'))
    const r = (i: number) => resolveWordSpacing(blocks[i], rules)!
    // 1 título: 24pt depois (inline) sobre o 8pt da classe; entrelinha da classe
    expect(r(0)).toMatchObject({
      marginTop: 0,
      marginBottom: 24,
      lineHeight: { kind: 'multiple', value: 1.15 },
    })
    expect(r(2)).toMatchObject({ textIndent: 35.4, marginBottom: 8 })
    expect(r(4)).toMatchObject({ marginLeft: 36 })
    expect(r(5)).toMatchObject({
      marginTop: 12,
      marginBottom: 6,
      lineHeight: { kind: 'exact', pt: 18 },
    })
    // "Pelo menos": comprimento sem regra
    expect(r(6)).toMatchObject({ lineHeight: { kind: 'atLeast', pt: 20 } })
    expect(r(7)).toMatchObject({ lineHeight: { kind: 'multiple', value: 1.5 } })
    expect(r(8)).toMatchObject({ lineHeight: { kind: 'multiple', value: 2 } })
    // Título 2: regra da tag
    expect(r(10)).toMatchObject({ marginTop: 8, marginBottom: 4 })
    // Espaçamento contextual: 0 entre os parágrafos de lista, 8pt depois do último
    expect(r(12)).toMatchObject({ marginBottom: 0, marginLeft: 36 })
    expect(r(13)).toMatchObject({ marginTop: 0, marginBottom: 0 })
    expect(r(14)).toMatchObject({ marginBottom: 8 })
  })
})

describe('sanitizeRichPaste com pasteSpacing', () => {
  it("'remove' (padrão) é o comportamento de antes: igual a não passar a opção", () => {
    const before = sanitizeRichPaste(WORD, FAMILIES, { images: true })
    const remove = sanitizeRichPaste(WORD, FAMILIES, { images: true, spacing: 'remove' })
    expect(remove).toBe(before)
    expect(remove).not.toMatch(/margin|text-indent|pt;?"?>?<br>/)
    // Linhas em branco do Word saem, como sempre
    expect(paragraphs(remove).every((p) => p.textContent!.trim())).toBe(true)
  })

  it("'preserve': espaçamento normalizado, entrelinha sobre a linha simples medida, linhas em branco", () => {
    const families: string[] = []
    const out = sanitizeRichPaste(WORD, FAMILIES, {
      images: true,
      spacing: 'preserve',
      // Linha simples do navegador para a fonte (aqui, um valor de teste)
      measureLineHeight: (family) => {
        families.push(family)
        return family.includes('Georgia') ? 1.25 : 1.2
      },
    })
    const ps = paragraphs(out) as HTMLElement[]
    expect(ps).toHaveLength(17)
    const style = (i: number, prop: string) => ps[i].style.getPropertyValue(prop)
    expect(style(0, 'margin-bottom')).toBe('24pt')
    expect(style(0, 'line-height')).toBe('1.38') // 1,15 × 1,2
    expect(ps[1].innerHTML).toBe('<br>')
    expect(style(2, 'text-indent')).toBe('35.4pt')
    expect(style(4, 'margin-left')).toBe('36pt')
    expect(style(5, 'line-height')).toBe('18pt')
    expect(style(5, 'margin-top')).toBe('12pt')
    // Pelo menos 20pt: maior que a linha simples (1,2 × 12pt = 14,4pt)
    expect(style(6, 'line-height')).toBe('20pt')
    expect(style(7, 'line-height')).toBe('1.8')
    expect(style(8, 'line-height')).toBe('2.4')
    // Linha em branco de 6pt: a altura vem do tamanho da fonte dela
    expect(ps[9].innerHTML).toBe('<span style="font-size: 6pt;"><br></span>')
    expect(ps[10].tagName).toBe('H2')
    expect(style(14, 'margin-bottom')).toBe('8pt')
    // Parágrafo em Georgia: a linha simples é a da Georgia
    expect(families.some((f) => f.includes('Georgia'))).toBe(true)
    expect(style(15, 'line-height')).toBe('1.438') // 1,15 × 1,25
    // Nada da folha de estilos nem das classes do Word sobra
    expect(out).not.toMatch(/Mso|mso-|class=|<style|<o:p/)
  })

  it("'preserve' sem medida (sem layout): o múltiplo do Word fica como está", () => {
    const out = sanitizeRichPaste(WORD, FAMILIES, { images: true, spacing: 'preserve' })
    expect((paragraphs(out)[0] as HTMLElement).style.lineHeight).toBe('1.15')
  })

  it("'preserve' não muda colagens que não vêm do Word", () => {
    const web = '<p style="margin:20px;line-height:150%">a</p><p></p><p>b</p>'
    expect(sanitizeRichPaste(web, FAMILIES, { images: true, spacing: 'preserve' })).toBe(
      sanitizeRichPaste(web, FAMILIES, { images: true }),
    )
  })

  it("'preserve' com regras maliciosas no documento: nada passa além de números", () => {
    const evil =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin-top:expression(alert(1));line-height:url(javascript:x);text-indent:calc(100vw)} p.MsoNormal{margin-bottom:var(--x)}</style></head><body><p class=MsoNormal style="margin-left:1e9pt">x</p></body></html>'
    const out = sanitizeRichPaste(evil, FAMILIES, { images: true, spacing: 'preserve' })
    expect(out).not.toMatch(/expression|url\(|calc|var\(|javascript/)
    expect(out).toBe('<p>x</p>')
  })
})

describe('sanitizeHtml: espaçamento salvo sobrevive a reabrir, sem depender da colagem', () => {
  it('a saída do preserve passa pela sanitização sem perder nada', () => {
    const pasted = sanitizeRichPaste(WORD, FAMILIES, {
      images: true,
      spacing: 'preserve',
      measureLineHeight: () => 1.2,
    })
    expect(sanitizeHtml(pasted)).toBe(pasted)
    expect(sanitizeHtml(sanitizeHtml(pasted))).toBe(pasted)
  })

  it('valores perigosos ou fora do limite: recusados ou trazidos ao limite', () => {
    expect(sanitizeHtml('<p style="margin-top: 900pt; line-height: 50">a</p>')).toBe(
      '<p style="margin-top: 72pt; line-height: 4;">a</p>',
    )
    expect(
      sanitizeHtml('<p style="margin-top: calc(1px + 2px); text-indent: var(--x)">a</p>'),
    ).toBe('<p>a</p>')
    // Imagem e caixa de texto seguem as regras de layout próprias
    expect(
      sanitizeHtml('<img src="https://a.example/x.png" style="text-indent: 10pt">'),
    ).not.toMatch(/text-indent/)
  })
})
