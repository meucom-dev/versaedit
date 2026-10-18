// @vitest-environment node
// Receitas da documentação (docs/recipes): executadas de verdade, sem DOM global
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { sanitizeOnServer } from '../../docs/recipes/sanitize-on-server'
import { XSS_VECTORS } from '../xss-vectors'

// HTML real produzido pelo editor: os resultados de referência dos testes de navegador
const SNAPSHOTS = path.join(__dirname, '../e2e/__snapshots__/behavior.spec.ts')
const editorOutputs = fs
  .readdirSync(SNAPSHOTS)
  .map((file) => [file, JSON.parse(fs.readFileSync(path.join(SNAPSHOTS, file), 'utf8'))])
  .flatMap(([file, value]) =>
    (Array.isArray(value) ? value : [value])
      .filter((html): html is string => typeof html === 'string' && html.includes('<'))
      .map((html, i) => [`${file}#${i}`, html] as const),
  )

// O HTML como qualquer parser o lê (ex.: <p> dentro de <p>, que o navegador
// gera via DOM, sai separado) — é o que o editor também recebe ao reabrir
const parsed = (html: string) => {
  const { document } = new JSDOM('').window
  const body = document.createElement('body')
  body.innerHTML = html
  return body.innerHTML
}

describe('receita: sanitização no servidor', () => {
  it('há saídas do editor para conferir', () => {
    expect(editorOutputs.length).toBeGreaterThan(20)
  })

  it.each(editorOutputs)('mantém intacto o HTML do editor (%s)', (_name, html) => {
    expect(sanitizeOnServer(html)).toBe(parsed(html))
  })

  it.each(XSS_VECTORS)('neutraliza o vetor %s', (_id, html) => {
    const out = sanitizeOnServer(html)
    expect(out).not.toMatch(/<(script|iframe|object|embed|svg|math|form|style)\b/i)
    expect(out).not.toMatch(/\son\w+\s*=/i)
    expect(out).not.toMatch(/(href|src|action|formaction)\s*=\s*["']?\s*(javascript|vbscript):/i)
    expect(out).not.toMatch(/href\s*=\s*["']?\s*data:/i)
  })

  it('contenteditable só com o valor false (alça da caixa de texto)', () => {
    expect(sanitizeOnServer('<div contenteditable="true">x</div>')).toBe('<div>x</div>')
    expect(sanitizeOnServer('<span contenteditable="false">⠿</span>')).toBe(
      '<span contenteditable="false">⠿</span>',
    )
  })

  it('link com target="_blank" sempre com rel seguro', () => {
    expect(sanitizeOnServer('<a href="https://x.dev" target="_blank">x</a>')).toBe(
      '<a href="https://x.dev" target="_blank" rel="noopener noreferrer">x</a>',
    )
  })
})
