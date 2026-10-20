// Serialização estável: exportar e reabrir várias vezes não muda o documento.
// Duas igualdades diferentes:
// - textual: o mesmo HTML, caractere por caractere;
// - semântica: a mesma árvore, com atributos e classes comparados como conjuntos
//   e o style comparado propriedade por propriedade, pelo CSSOM do navegador
//   (style="margin:0" e style="margin: 0px;" são equivalentes).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { mount } from './helpers'

const SNAPSHOTS = path.resolve('tests/e2e/__snapshots__/behavior.spec.ts')

// HTML real produzido pelo editor (os resultados de referência) e um documento
// com atributos funcionais, semânticos e de acessibilidade
const CORPUS: [string, string][] = [
  ...readdirSync(SNAPSHOTS).flatMap((file) => {
    const value: unknown = JSON.parse(readFileSync(path.join(SNAPSHOTS, file), 'utf8'))
    return (Array.isArray(value) ? value : [value])
      .filter((html): html is string => typeof html === 'string' && html.includes('<'))
      .map((html, i): [string, string] => [`${file}#${i}`, html])
  }),
  [
    'atributos',
    '<p class="pos-left" id="p1" dir="rtl" lang="en" title="t" aria-label="a" style="color: red;">t</p>' +
      '<table><tbody><tr><th style="text-align: left;" scope="col">h</th><td style="background-color: rgb(255, 255, 0);" colspan="2">c</td></tr></tbody></table>' +
      '<ol start="3" reversed=""><li value="5">i</li></ol>' +
      '<p><a href="https://a.com" target="_blank" rel="noopener noreferrer" title="site">a</a></p>' +
      '<div class="rich-textbox tb-float-left" style="width: 200px;"><span class="textbox-handle" contenteditable="false" title="Mover">⠿</span>caixa</div>',
  ],
]

// Recuo do Chromium/WebKit: perde a margem ao reabrir (defeito conhecido, lote D5)
const INDENT_LOST = new Set(['recuo.json#0'])

test('exportar e reabrir 5 vezes (setHTML e arquivo): estável e equivalente', async ({ page }) => {
  await mount(page)
  const results = await page.evaluate((corpus) => {
    // Semântica: mesma árvore, mesmos atributos (classes como conjunto) e, para
    // cada propriedade declarada em um dos lados, o mesmo valor calculado
    const render = (html: string) => {
      const box = document.createElement('div')
      box.innerHTML = html
      document.body.append(box)
      return box
    }
    const same = (a: Node, b: Node): boolean => {
      if (a.nodeType !== b.nodeType) return false
      if (a.nodeType === Node.TEXT_NODE) return a.nodeValue === b.nodeValue
      if (a.nodeType !== Node.ELEMENT_NODE) return true
      const x = a as HTMLElement
      const y = b as HTMLElement
      if (x.tagName !== y.tagName) return false
      const attrs = (el: HTMLElement) =>
        Array.from(el.attributes)
          .filter((at) => at.name !== 'style')
          .map((at) =>
            at.name === 'class'
              ? `class=${Array.from(el.classList).sort().join(' ')}`
              : `${at.name}=${at.value}`,
          )
          .sort()
          .join('|')
      if (attrs(x) !== attrs(y)) return false
      const props = new Set([...Array.from(x.style), ...Array.from(y.style)])
      const cx = getComputedStyle(x)
      const cy = getComputedStyle(y)
      for (const p of props) if (cx.getPropertyValue(p) !== cy.getPropertyValue(p)) return false
      if (x.childNodes.length !== y.childNodes.length) return false
      return Array.from(x.childNodes).every((child, i) => same(child, y.childNodes[i]))
    }
    const semantic = (a: string, b: string) => {
      const ra = render(a)
      const rb = render(b)
      const result = same(ra, rb)
      ra.remove()
      rb.remove()
      return result
    }
    // Textual fora do CSS: o mesmo HTML, atributos na mesma posição; só o texto
    // dentro de style="…" pode mudar (o navegador reescreve o CSS ao filtrá-lo)
    const outsideCss = (html: string) => html.replace(/ style="[^"]*"/g, ' style')
    const parsed = (html: string) => {
      const body = document.createElement('body')
      body.innerHTML = html
      return body.innerHTML
    }
    const ref = window.__ref.current!
    const core = ref.core as unknown as { loadFileContent(html: string): void }
    return corpus.map(([name, input]) => {
      const cycles: string[] = []
      let html = input
      for (let i = 0; i < 5; i++) {
        ref.setHTML('<p>outro</p>')
        ref.setHTML(html)
        html = ref.getHTML()
        cycles.push(html)
      }
      ref.setHTML('<p>outro</p>')
      core.loadFileContent(`<!doctype html><html><body>${cycles[0]}</body></html>`)
      return {
        name,
        textual: cycles[0] === parsed(input),
        outsideCss: outsideCss(cycles[0]) === outsideCss(parsed(input)),
        semantic: semantic(cycles[0], input),
        stable: cycles.every((c) => c === cycles[0]),
        file: ref.getHTML() === cycles[0],
        input: parsed(input),
        output: cycles[0],
      }
    })
  }, CORPUS)

  for (const r of results) {
    const where = `${r.name}\n  entrada: ${r.input}\n  saída:   ${r.output}`
    expect(r.semantic, `equivalência semântica: ${where}`).toBe(!INDENT_LOST.has(r.name))
    expect(r.outsideCss, `igualdade textual fora do CSS: ${where}`).toBe(!INDENT_LOST.has(r.name))
    if (!r.textual)
      test.info().annotations.push({ type: 'só o texto do CSS muda', description: r.name })
    expect(r.stable, `ciclos 2 a 5 iguais ao 1º: ${r.name}`).toBe(true)
    expect(r.file, `reabrir por arquivo igual a setHTML: ${r.name}`).toBe(true)
  }
})
