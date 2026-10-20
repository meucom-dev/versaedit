// Serialização estável: exportar e reabrir várias vezes não muda o documento.
// Duas igualdades diferentes:
// - textual: o mesmo HTML, caractere por caractere;
// - semântica: a mesma árvore, com atributos e classes comparados como conjuntos
//   e o style comparado propriedade por propriedade, pelo CSSOM do navegador
//   (style="margin:0" e style="margin: 0px;" são equivalentes).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mount, selectText } from './helpers'

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
    expect(r.semantic, `equivalência semântica: ${where}`).toBe(true)
    expect(r.outsideCss, `igualdade textual fora do CSS: ${where}`).toBe(true)
    if (!r.textual)
      test.info().annotations.push({ type: 'só o texto do CSS muda', description: r.name })
    expect(r.stable, `ciclos 2 a 5 iguais ao 1º: ${r.name}`).toBe(true)
    expect(r.file, `reabrir por arquivo igual a setHTML: ${r.name}`).toBe(true)
  }
})

test.describe('recuo e citação: a mesma aparência depois de exportar e reabrir', () => {
  type Run = (t: Awaited<ReturnType<typeof mount>>, page: Page) => Promise<void>
  const quote: Run = (_t, page) =>
    page.evaluate(() =>
      (window.__ref.current!.core as unknown as { formatBlock(tag: string): void }).formatBlock(
        'blockquote',
      ),
    )
  const press =
    (...labels: string[]): Run =>
    async (t) => {
      for (const label of labels) await t.btn(label).click()
    }
  const CASES: [string, string, Run][] = [
    ['recuo', '<p>alpha beta</p>', press('Increase indent')],
    ['recuo duplo', '<p>alpha beta</p>', press('Increase indent', 'Increase indent')],
    ['título recuado', '<h2>alpha beta</h2>', press('Increase indent')],
    ['recuo centralizado', '<p>alpha beta</p>', press('Increase indent', 'Center')],
    ['citação', '<p>alpha beta</p>', quote],
    [
      'citação centralizada',
      '<p>alpha beta</p>',
      async (t, page) => {
        await quote(t, page)
        await t.btn('Center').click()
      },
    ],
    [
      'citação recuada',
      '<p>alpha beta</p>',
      async (t, page) => {
        await quote(t, page)
        await t.btn('Increase indent').click()
      },
    ],
  ]

  // Aparência de cada bloco: recuo, itálico, borda e fundo calculados
  const look = (page: Page) =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          '#host .ve-content blockquote, #host .ve-content p, #host .ve-content h2',
        ),
      ).map((el) => {
        const s = getComputedStyle(el)
        return `${el.tagName} ml=${s.marginLeft} fs=${s.fontStyle} bl=${s.borderLeftWidth} bg=${s.backgroundColor}`
      }),
    )

  for (const [name, html, run] of CASES) {
    test(name, async ({ page }) => {
      const t = await mount(page, { initialContent: html })
      await selectText(page, 'alpha')
      await run(t, page)
      const edited = await look(page)
      const exported = await page.evaluate(() => window.__ref.current!.getHTML())
      const reopened: string[][] = []
      const outputs: string[] = []
      for (let i = 0; i < 3; i++) {
        const out = await page.evaluate(
          (h) => {
            const ref = window.__ref.current!
            ref.setHTML('<p>outro</p>')
            ref.setHTML(h)
            return ref.getHTML()
          },
          outputs.at(-1) ?? exported,
        )
        outputs.push(out)
        reopened.push(await look(page))
      }
      await page.evaluate((h) => {
        const ref = window.__ref.current!
        ref.setHTML('<p>outro</p>')
        const core = ref.core as unknown as { loadFileContent(html: string): void }
        core.loadFileContent(`<!doctype html><html><body>${h}</body></html>`)
      }, exported)
      const viaFile = await look(page)
      const where = `\n  editado:  ${exported}\n  reaberto: ${outputs[0]}`
      for (const [i, r] of reopened.entries()) expect(r, `ciclo ${i + 1}${where}`).toEqual(edited)
      expect(viaFile, `arquivo${where}`).toEqual(edited)
      expect(new Set(outputs).size, 'ciclos seguintes iguais ao primeiro').toBe(1)
    })
  }

  test('documento antigo (recuo do Chromium/WebKit sem role) reabre como recuo', async ({
    page,
  }) => {
    await mount(page, {
      initialContent:
        '<blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;"><p>alpha</p></blockquote><blockquote><p>citação</p></blockquote>',
    })
    const [indent, , cite] = await look(page)
    expect(indent).toBe('BLOCKQUOTE ml=40px fs=normal bl=0px bg=rgba(0, 0, 0, 0)')
    expect(cite).toMatch(/^BLOCKQUOTE ml=0px fs=italic bl=3px /)
  })

  test('acessibilidade: o recuo não é anunciado como citação; a citação sim', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>alpha</p><p>beta</p>' })
    await selectText(page, 'alpha')
    await t.btn('Increase indent').click()
    await selectText(page, 'beta')
    await quote(t, page)
    const roles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#host .ve-content blockquote')).map((el) =>
        el.contains(document.evaluate("//*[text()='alpha']", el, null, 9).singleNodeValue)
          ? `recuo:${el.getAttribute('role') ?? ''}`
          : `citação:${el.getAttribute('role') ?? ''}`,
      ),
    )
    // Firefox recua sem blockquote (margin-left no parágrafo): só a citação aparece
    expect(roles.filter((r) => r.startsWith('citação'))).toEqual(['citação:'])
    expect(
      roles.filter((r) => r.startsWith('recuo')).every((r) => r === 'recuo:presentation'),
    ).toBe(true)
  })
})
