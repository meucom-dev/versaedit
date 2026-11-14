// Layout Mirror (lote 3, 14/11/2026): o conteúdo publicado com a classe ve-mirror
// (versaedit-content.css) tem a mesma aparência da área de edição. Os testes montam o
// editor e, ao lado, o HTML que ele entrega (getHTML) num contêiner .versaedit-content
// da mesma largura útil, e comparam elemento a elemento as propriedades calculadas e as
// posições/dimensões reais — não só o HTML.
import { expect, test, type Page } from '@playwright/test'
import { mount, PNG } from './helpers'

const IMG = `data:image/png;base64,${PNG}`

/** CSS de um site comum (no estilo dos frameworks): mexe em tudo o que o texto usa */
const HOST_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body { font: 18px/2 Georgia, serif; color: #444; text-align: center; letter-spacing: .02em; }
p { margin: 0 0 1rem; font-size: 1.05rem; }
h1, h2, h3, h4, h5, h6 { margin: 0 0 .5rem; font-weight: 500; line-height: 1.1; font-size: 2.5rem; }
h2 { font-size: 2rem; }
ul, ol { padding-left: 2rem; margin: 0 0 1rem; list-style: square; }
li { margin-bottom: .25rem; }
blockquote { margin: 0 0 1rem; font-size: 1.25rem; padding: 0; }
a { color: #0d6efd; text-decoration: none; }
img { vertical-align: middle; border: 2px solid red; }
table { caption-side: bottom; }
th, td { padding: 12px; }
em, i { font-style: normal; }
u { text-decoration: none; }
pre, code { font-size: 1rem; }
`

/** Elementos dos dois lados, na mesma ordem; diferenças acima de 1px ou de estilo */
async function differences(page: Page) {
  return page.evaluate(() => {
    const PROPS = [
      'display',
      'float',
      'fontSize',
      'lineHeight',
      'fontFamily',
      'fontWeight',
      'fontStyle',
      'textDecorationLine',
      'color',
      'backgroundColor',
      'textAlign',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'borderTopWidth',
      'borderLeftWidth',
      'listStyleType',
      'letterSpacing',
      'boxSizing',
    ] as const
    const editor = document.querySelector<HTMLElement>('#host .ve-content')!
    let published = document.querySelector<HTMLElement>('#published')!
    // Cor do papel: no editor ela pinta a área de edição; publicada, é um <div> envoltório
    const paper = published.querySelector<HTMLElement>(':scope > .ve-paper')
    if (paper) published = paper
    const origin = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        x: r.left + el.clientLeft + parseFloat(cs.paddingLeft),
        y: r.top + el.clientTop + parseFloat(cs.paddingTop),
      }
    }
    const oe = origin(editor)
    const op = origin(published)
    const list = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLElement>('*')].filter(
        (el) => !el.matches('.textbox-handle, .textbox-handle *'),
      )
    const a = list(editor)
    const b = list(published)
    const out: string[] = []
    if (a.length !== b.length) out.push(`elementos: editor ${a.length}, publicado ${b.length}`)
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const [x, y] = [a[i], b[i]]
      const name = `${i}:${x.tagName.toLowerCase()}${x.className ? '.' + x.className : ''}`
      if (x.tagName !== y.tagName) {
        out.push(`${name}: tag ${y.tagName}`)
        continue
      }
      const cx = getComputedStyle(x)
      const cy = getComputedStyle(y)
      for (const p of PROPS) if (cx[p] !== cy[p]) out.push(`${name}: ${p} ${cx[p]} ≠ ${cy[p]}`)
      const rx = x.getBoundingClientRect()
      const ry = y.getBoundingClientRect()
      const dims: [string, number, number][] = [
        ['top', rx.top - oe.y, ry.top - op.y],
        ['left', rx.left - oe.x, ry.left - op.x],
        ['height', rx.height, ry.height],
        ['width', rx.width, ry.width],
      ]
      for (const [k, v1, v2] of dims)
        if (Math.abs(v1 - v2) > 1) out.push(`${name}: ${k} ${v1.toFixed(1)} ≠ ${v2.toFixed(1)}`)
    }
    return out
  })
}

/** Monta o editor com o conteúdo e mostra, ao lado, o HTML que ele entrega */
async function mirrorOf(
  page: Page,
  html: string,
  opts: { hostCss?: boolean; editorMirror?: boolean; width?: number | string } = {},
) {
  if (opts.hostCss) await page.addInitScript(addHostCss, HOST_CSS)
  const t = await mount(page, {
    initialContent: html,
    layoutMirror: opts.editorMirror ?? true,
    width: opts.width ?? 900,
    height: 1600,
  })
  const saved = await page.evaluate(() => window.__ref.current!.getHTML())
  await page.evaluate((h) => window.__showPublished(h, { mirror: true }), saved)
  // Imagens carregadas dos dois lados antes de medir
  await page.waitForFunction(() => [...document.images].every((i) => i.complete))
  return { t, saved }
}

function addHostCss(css: string) {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style')
    s.id = 'host-css'
    s.textContent = css
    document.head.prepend(s)
  })
}

const LONG =
  'O VersaEdit preserva a aparência do texto entre a edição e a publicação, com a mesma quebra de linhas, os mesmos espaços e as mesmas fontes, em qualquer largura.'

const CASES: Record<string, string> = {
  'parágrafos e quebras de linha': `<p>${LONG}</p><p>linha um<br>linha dois<br>linha três</p><p><br></p><p>${LONG} ${LONG}</p><p>endereço-muito-longo-sem-espaços-https://example.com/caminho/que/não/acaba/nunca/e/continua/até/passar/da/largura/da/coluna/inteira/sem/parar</p>`,
  'títulos e subtítulos': `<h1>Título 1</h1><p>${LONG}</p><h2>Título 2</h2><h3>Título 3</h3><p>texto</p><h4>Título 4</h4><h5>Título 5</h5><h6>Título 6</h6><p>fim</p>`,
  'listas ordenadas e não ordenadas': `<p>antes</p><ul><li>um</li><li>dois<ul><li>dois.um<ul><li>dois.um.um</li></ul></li></ul></li><li>${LONG}</li></ul><ol><li>primeiro</li><li>segundo<ol><li>segundo.a</li></ol></li></ol><p>depois</p>`,
  'negrito, itálico, sublinhado e cores': `<p>normal <b>negrito</b> <i>itálico</i> <u>sublinhado</u> <s>riscado</s> <strong>forte</strong> <em>ênfase</em> <span style="color: rgb(231, 76, 60);">vermelho</span> <span style="background-color: rgb(255, 255, 0);">marca-texto</span> <span style="font-size: 18pt;">18pt</span> <span style="font-family: Georgia, &quot;Times New Roman&quot;, serif;">Georgia</span></p><h2>título com <b>negrito</b> e <i>itálico</i></h2>`,
  alinhamentos: `<p style="text-align: center;">${LONG}</p><p style="text-align: right;">à direita</p><p style="text-align: justify;">${LONG} ${LONG}</p><p style="text-align: left;">à esquerda</p><p>sem alinhamento</p><h2 style="text-align: center;">título centralizado</h2>`,
  'citações e links': `<p>texto com <a href="https://example.com" target="_blank" rel="noopener noreferrer">um link</a> no meio.</p><blockquote>${LONG}</blockquote><p>depois</p><blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;" role="presentation"><p>parágrafo recuado</p></blockquote><blockquote><p>citação com <a href="https://example.com/b">link</a></p></blockquote>`,
  'imagens e caixas de texto': `<p>${LONG}</p><img class="pos-left" src="${IMG}" style="width: 120px;"><p>${LONG} ${LONG}</p><img class="pos-right" src="${IMG}" style="width: 90px;"><p>${LONG}</p><img class="pos-center" src="${IMG}" style="width: 200px;"><img src="${IMG}" style="width: 60px;"><div class="rich-textbox" style="width: 300px;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa de texto com <b>conteúdo</b> que ocupa mais de uma linha <i>dentro</i> da caixa</div><div class="rich-textbox tb-float-left" style="width: 200px;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa à <b>esquerda</b></div><p>${LONG}</p>`,
  'estilos personalizados': `<div class="ve-paper" data-paper="#fff8e1" style="background-color:#fff8e1;"><p style="color: rgb(46, 125, 50); font-family: Verdana, Geneva, sans-serif;">parágrafo com cor e fonte</p><p><span style="font-size: 24pt;">grande</span> e <span style="font-size: 9pt;">pequeno</span></p><table><caption>Tabela</caption><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>${LONG}</td></tr></tbody></table><pre>código
  com espaços</pre><p>inline <code>code()</code></p><hr style="border:none;border-top:1px solid #ccc;margin:12px 0;clear:both;"><p>fim</p></div>`,
}

test.describe('Layout Mirror: publicado igual ao editor', () => {
  for (const [name, html] of Object.entries(CASES)) {
    test(name, async ({ page }) => {
      await mirrorOf(page, html)
      expect(await differences(page)).toEqual([])
    })
  }

  test('fonte do texto e dos títulos pelas variáveis --ve-font e --ve-heading-font', async ({
    page,
  }) => {
    const font = 'Georgia, "Times New Roman", serif'
    const heading = '"Courier New", Courier, monospace'
    await mount(page, {
      initialContent: '<h2>Título</h2><p>texto</p>',
      layoutMirror: true,
      fontFamily: font,
      headingFontFamily: heading,
      height: 600,
    })
    const saved = await page.evaluate(() => window.__ref.current!.getHTML())
    await page.evaluate(
      ([h, f, hf]) =>
        window.__showPublished(h, {
          mirror: true,
          style: `--ve-font: ${f}; --ve-heading-font: ${hf};`,
        }),
      [saved, font, heading] as const,
    )
    expect(await differences(page)).toEqual([])
  })
})

test.describe('Layout Mirror: responsividade', () => {
  test('editor em 100% numa tela de celular: publicado igual, sem rolagem lateral', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mirrorOf(
      page,
      CASES['imagens e caixas de texto'] + CASES['listas ordenadas e não ordenadas'],
      {
        width: '100%',
      },
    )
    expect(await differences(page)).toEqual([])
    const overflow = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>('#published')!
      return p.scrollWidth - p.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('contêiner publicado fluido: imagem maior que a coluna encolhe junto', async ({ page }) => {
    await mount(page)
    await page.evaluate(
      (src) =>
        window.__showPublished(`<p>texto</p><img src="${src}" style="width: 900px;">`, {
          mirror: true,
          width: 300,
        }),
      IMG,
    )
    const w = await page
      .locator('#published img')
      .evaluate((el) => el.getBoundingClientRect().width)
    expect(w).toBeLessThanOrEqual(300)
  })
})

test.describe('Layout Mirror: convivência com o CSS do site', () => {
  for (const name of [
    'parágrafos e quebras de linha',
    'títulos e subtítulos',
    'listas ordenadas e não ordenadas',
    'negrito, itálico, sublinhado e cores',
    'citações e links',
    'imagens e caixas de texto',
    'estilos personalizados',
  ]) {
    test(`CSS agressivo do site não quebra a paridade: ${name}`, async ({ page }) => {
      await mirrorOf(page, CASES[name], { hostCss: true })
      expect(await page.locator('#host-css').count()).toBe(1)
      expect(await differences(page)).toEqual([])
    })
  }

  test('sem ve-mirror, o CSS do site continua valendo no publicado', async ({ page }) => {
    await page.addInitScript(addHostCss, HOST_CSS)
    await mount(page, { height: 400 })
    await page.evaluate(() =>
      window.__showPublished(
        '<p id="p">texto</p><h2 id="h">título</h2><ul id="u"><li>item</li></ul>',
      ),
    )
    const cs = (id: string, prop: string) =>
      page
        .locator(`#published #${id}`)
        .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
    expect(await cs('p', 'margin-bottom')).not.toBe('0px')
    expect(parseFloat(await cs('p', 'font-size'))).toBeCloseTo(16.8, 1)
    expect(await cs('h', 'font-size')).toBe('32px')
    expect(await cs('h', 'font-weight')).toBe('500')
    expect(await cs('u', 'list-style-type')).toBe('square')
  })

  test('sem layoutMirror, o editor continua como antes diante do CSS do site', async ({ page }) => {
    await page.addInitScript(addHostCss, HOST_CSS)
    await mount(page, { initialContent: '<h2>título</h2><ul><li>item</li></ul>', height: 400 })
    const cs = (sel: string, prop: string) =>
      page
        .locator(`#host .ve-content ${sel}`)
        .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
    // O que o editor já fixava (margens, altura da linha) e o que vinha do site
    expect(await cs('h2', 'margin-bottom')).toBe('0px')
    expect(await cs('h2', 'font-size')).toBe('32px')
    expect(await cs('ul', 'list-style-type')).toBe('square')
  })

  test('uma classe ve-mirror na página não afeta elementos fora do conteúdo', async ({ page }) => {
    await page.addInitScript(addHostCss, HOST_CSS)
    await mount(page, { height: 300 })
    await page.evaluate(() => {
      const d = document.createElement('div')
      d.className = 've-mirror'
      d.innerHTML = '<p id="fora">fora do VersaEdit</p>'
      document.body.appendChild(d)
    })
    expect(
      await page.locator('#fora').evaluate((el) => getComputedStyle(el).marginBottom),
    ).not.toBe('0px')
  })
})

test.describe('Layout Mirror: sem efeito no HTML nem no editor de sempre', () => {
  test('o HTML entregue é o mesmo com e sem layoutMirror', async ({ page }) => {
    const all = Object.values(CASES).join('')
    await mount(page, { initialContent: all, height: 1600 })
    const before = await page.evaluate(() => window.__ref.current!.getHTML())
    await mount(page, { initialContent: all, height: 1600, layoutMirror: true })
    const after = await page.evaluate(() => window.__ref.current!.getHTML())
    expect(after).toBe(before)
    expect(after).not.toContain('ve-mirror')
  })

  test('sem CSS do site, o editor com layoutMirror é idêntico ao de sempre (pixel a pixel)', async ({
    browser,
  }) => {
    const shot = async (layoutMirror: boolean) => {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1800 } })
      await mount(page, {
        initialContent: Object.values(CASES).join(''),
        height: 1700,
        layoutMirror,
      })
      await page.waitForFunction(() => [...document.images].every((i) => i.complete))
      const image = await page.locator('#host .ve-content').screenshot({ animations: 'disabled' })
      await page.close()
      return image
    }
    const plain = await shot(false)
    const mirrored = await shot(true)
    expect(mirrored.equals(plain)).toBe(true)
  })

  test('a classe ve-mirror vai só na área de edição, ao lado de contentClassName', async ({
    page,
  }) => {
    await mount(page, { layoutMirror: true, contentClassName: 'artigo' })
    const cls = await page.locator('#host .ve-content').getAttribute('class')
    expect(cls?.split(' ')).toEqual(expect.arrayContaining(['ve-content', 've-mirror', 'artigo']))
    await mount(page, { contentClassName: 'artigo' })
    expect(await page.locator('#host .ve-content').getAttribute('class')).not.toContain('ve-mirror')
  })
})
