// Bateria de XSS: cada vetor passa pelas três entradas de HTML do editor
// (carregar, abrir arquivo, colar) e o resultado é verificado estruturalmente.
import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT_FAMILIES } from '../../src/core/defaults'
import { splitPaper } from '../../src/core/file'
import { buildPasteHtml } from '../../src/core/paste'
import { sanitizeHtml } from '../../src/core/sanitize'
import { XSS_VECTORS } from '../xss-vectors'

const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'meta',
  'link',
  'style',
  'form',
  'input',
  'button',
  'svg',
  'math',
  'template',
  'noscript',
]
// <video>/<audio>/<source> não executam código (os atributos on* são removidos e
// verificados abaixo); que mídia externa seja aceita no conteúdo é decisão de
// política, não de XSS — ver relatório do lote v0.1.x.

/** Problemas de segurança encontrados no HTML (lista vazia = seguro) */
function findProblems(html: string): string[] {
  const problems: string[] = []
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase()
    if (FORBIDDEN_TAGS.includes(tag)) problems.push(`tag <${tag}>`)
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      // eslint-disable-next-line no-control-regex
      const value = attr.value.replace(/[\u0000- ]/g, '').toLowerCase()
      if (name.startsWith('on')) problems.push(`atributo ${name}`)
      if (['srcdoc', 'formaction', 'action', 'xlink:href'].includes(name)) {
        problems.push(`atributo ${name}`)
      }
      if (/^(javascript|vbscript):/.test(value)) problems.push(`${name}=${value.slice(0, 20)}`)
      if ((name === 'href' || name === 'src') && value.startsWith('data:')) {
        if (!(name === 'src' && /^data:image\/(png|jpe?g|gif|webp|bmp);/.test(value))) {
          problems.push(`${name} data:`)
        }
      }
      if (name === 'style' && /url\(|expression\(|behavior|binding|javascript:/.test(value)) {
        problems.push(`style perigoso: ${value.slice(0, 40)}`)
      }
    }
  }
  return problems
}

describe.each(XSS_VECTORS)('vetor %s', (_id, vector) => {
  it('carregar (initialContent / setHTML)', () => {
    const { inner } = splitPaper(vector)
    expect(findProblems(sanitizeHtml(inner))).toEqual([])
  })

  it('abrir arquivo .html', () => {
    const page = `<!doctype html><html><head><title>x</title></head><body>${vector}</body></html>`
    const body = new DOMParser().parseFromString(page, 'text/html').body.innerHTML.trim()
    expect(findProblems(sanitizeHtml(splitPaper(body).inner))).toEqual([])
  })

  it('colar (HTML rico)', () => {
    const pasted = buildPasteHtml(vector, 'texto', false, DEFAULT_FONT_FAMILIES)
    expect(findProblems(pasted.html)).toEqual([])
  })
})

describe('cor do papel', () => {
  it('valor com CSS extra é descartado', () => {
    const { paper } = splitPaper(
      '<div class="ve-paper" data-paper="red;background:url(https://evil.example/t)" style=""><p>t</p></div>',
    )
    expect(paper).toBe('')
  })
})

describe('o verificador detecta os problemas (controle)', () => {
  it.each([
    ['<img src=x onerror=1>', 'atributo onerror'],
    ['<a href="javascript:1">x</a>', 'href=javascript:1'],
    ['<script>1</script>', 'tag <script>'],
    ['<div style="background:url(x)">x</div>', 'style perigoso: background:url(x)'],
    ['<a href="data:text/html,x">x</a>', 'href data:'],
  ])('%s', (html, expected) => {
    expect(findProblems(html)).toContain(expected)
  })
})
