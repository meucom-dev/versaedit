// Compatibilidade com conteúdo real do À Mesa (teste externo, só local).
// Amostras em compat-samples/*.json (fora do git): lista de objetos com o HTML
// em "content" ou "value" (formato de exportação do SQL Editor do Supabase).
// Sem a pasta, o teste é pulado. Relatório: test-results/compat-amesa.json
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { mount } from './helpers'

const DIR = path.resolve('compat-samples')
const samples: { id: string; html: string }[] = fs.existsSync(DIR)
  ? fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .flatMap((file) => {
        const rows = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')) as Record<
          string,
          unknown
        >[]
        return rows
          .map((row, i) => ({
            id: `${file}#${String(row.id ?? row.key ?? i)}`,
            html: String(row.content ?? row.value ?? ''),
          }))
          .filter((s) => s.html.includes('<'))
      })
  : []

// Comparação feita no navegador: texto, elementos estruturais e o que mudou
interface Diff {
  textOriginal: string
  textEditor: string
  lostElements: Record<string, number>
  removedStyles: string[]
  removedAttributes: string[]
}

const report: Record<string, Diff & { stable: boolean }> = {}

test.describe('compatibilidade com conteúdo do À Mesa', () => {
  test.skip(samples.length === 0, 'sem amostras em compat-samples/')

  for (const sample of samples) {
    test(sample.id, async ({ page }) => {
      await mount(page, { initialContent: sample.html })
      const once = await page.evaluate(() => window.__ref.current!.getHTML())
      // Estável: carregar o que o editor devolveu dá o mesmo resultado
      await page.evaluate((html) => window.__ref.current!.setHTML(html), once)
      const twice = await page.evaluate(() => window.__ref.current!.getHTML())

      const diff = await page.evaluate(
        ([before, after]) => {
          const parse = (html: string) =>
            new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
          const a = parse(before)
          const b = parse(after)
          const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()
          const STRUCTURE =
            'p,h1,h2,h3,h4,h5,h6,ul,ol,li,a,img,table,tr,td,th,b,strong,i,em,u,blockquote,hr'
          const count = (el: HTMLElement) => {
            const c: Record<string, number> = {}
            el.querySelectorAll(STRUCTURE).forEach((n) => {
              const tag = n.tagName.toLowerCase()
              c[tag] = (c[tag] ?? 0) + 1
            })
            return c
          }
          const ca = count(a)
          const cb = count(b)
          const lostElements: Record<string, number> = {}
          for (const [tag, n] of Object.entries(ca)) {
            if ((cb[tag] ?? 0) < n) lostElements[tag] = n - (cb[tag] ?? 0)
          }
          const props = (el: HTMLElement, kind: 'style' | 'attr') => {
            const set = new Set<string>()
            el.querySelectorAll<HTMLElement>('*').forEach((n) => {
              const tag = n.tagName.toLowerCase()
              if (kind === 'style') {
                for (const p of Array.from(n.style)) set.add(`${tag} ${p}`)
              } else {
                for (const at of Array.from(n.attributes)) {
                  if (at.name !== 'style') set.add(`${tag}[${at.name}]`)
                }
              }
            })
            return set
          }
          const minus = (x: Set<string>, y: Set<string>) => [...x].filter((v) => !y.has(v)).sort()
          return {
            textOriginal: text(a),
            textEditor: text(b),
            lostElements,
            removedStyles: minus(props(a, 'style'), props(b, 'style')),
            removedAttributes: minus(props(a, 'attr'), props(b, 'attr')),
          }
        },
        [sample.html, once] as const,
      )
      report[sample.id] = { ...diff, stable: once === twice }

      expect(diff.textEditor, 'nenhum texto perdido').toBe(diff.textOriginal)
      expect(diff.lostElements, 'nenhum elemento estrutural perdido').toEqual({})
      expect(twice, 'carregar de novo não muda nada').toBe(once)
    })
  }

  test.afterAll(() => {
    if (!Object.keys(report).length) return
    const out = path.resolve('test-results/compat-amesa.json')
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(report, null, 2))
  })
})
