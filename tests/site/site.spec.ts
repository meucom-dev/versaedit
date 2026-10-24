// Site público (site/, gerado por npm run build:site): página inicial em inglês
// (/), português (/pt/) e espanhol (/es/), e o playground em /playground/
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const LANGS = [
  { path: '/', lang: 'en', label: 'English', install: 'Install the beta' },
  { path: '/pt/', lang: 'pt-BR', label: 'Português', install: 'Instalação da versão beta' },
  { path: '/es/', lang: 'es', label: 'Español', install: 'Instalación de la versión beta' },
] as const
const WIDTHS = [320, 375, 768, 1024, 1440]

// Erros de página/console e requisições a outros servidores. A página inicial
// não faz nenhuma; o playground carrega só o Google Fonts (declarado na nota).
let errors: string[] = []
let external: string[] = []
let allowFonts = false
test.beforeEach(({ page }) => {
  errors = []
  external = []
  allowFonts = false
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('request', (r) => {
    const url = new URL(r.url())
    const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
    if (url.hostname !== 'localhost' && url.protocol !== 'data:' && !(allowFonts && fonts))
      external.push(r.url())
  })
})
test.afterEach(() => {
  expect(errors, 'erros no console').toEqual([])
  expect(external, 'requisições a outros servidores').toEqual([])
})

const goto = async (page: Page, url: string) => {
  const res = await page.goto(url)
  expect(res?.status()).toBe(200)
}
const noHorizontalScroll = async (page: Page) => {
  const { scroll, view } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }))
  expect(scroll, 'rolagem horizontal').toBeLessThanOrEqual(view)
}

for (const l of LANGS) {
  for (const width of WIDTHS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${l.path} em ${width}px, tema ${scheme}: sem rolagem horizontal, sem erros, nada externo`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.setViewportSize({ width, height: 900 })
        await goto(page, l.path)
        expect(await page.evaluate(() => document.documentElement.lang)).toBe(l.lang)
        await expect(page.locator('h1')).toHaveText('VersaEdit')
        await noHorizontalScroll(page)
      })
    }
  }
}

test('as três línguas têm a mesma estrutura e nenhuma mistura de textos', async ({ page }) => {
  const read = async (p: string) => {
    await goto(page, p)
    return page.evaluate(() => ({
      ids: [...document.querySelectorAll('main [id]')].map((e) => e.id),
      headings: [...document.querySelectorAll('h2.sec, h3.sec')].map((e) => e.textContent!.trim()),
      counts: ['main li', 'main a', '.facts .row', '.wikitable tbody tr', 'main p'].map(
        (s) => document.querySelectorAll(s).length,
      ),
      text: document.body.innerText,
    }))
  }
  const pages = []
  for (const l of LANGS) pages.push({ ...l, ...(await read(l.path)) })
  const [en] = pages
  for (const p of pages) {
    expect(p.ids, p.path).toEqual(en.ids)
    expect(p.counts, p.path).toEqual(en.counts)
  }
  // Títulos que mudam entre as línguas ("Uso" e "Estilos" são iguais em pt e es)
  for (const a of pages)
    for (const b of pages) {
      if (a === b) continue
      for (const h of a.headings.filter((x) => !b.headings.includes(x)))
        expect(b.text, `"${h}" (${a.path}) na página ${b.path}`).not.toContain(h)
    }
})

test('todos os links levam a um destino real; a troca de idioma mantém a seção', async ({
  page,
}) => {
  for (const l of LANGS) {
    await goto(page, l.path)
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? ''),
    )
    for (const href of links) {
      expect(href, 'link sem destino').not.toBe('')
      if (href.startsWith('#')) {
        expect(await page.locator(href).count(), `âncora ${href}`).toBe(1)
      } else if (href.startsWith('/')) {
        expect((await page.request.get(href.split('#')[0])).status(), href).toBe(200)
      } else {
        expect(href, 'só https e mailto').toMatch(/^(https:\/\/|mailto:support@versaedit\.dev$)/)
      }
      // Publicado (0.5.0-beta.1): o npm só aparece pela página oficial do pacote
      if (/npmjs/.test(href)) {
        expect(href, 'link para o npm').toBe('https://www.npmjs.com/package/versaedit')
      }
    }
  }
  // Seletor: cada página oferece as outras duas línguas, no cabeçalho e no rodapé
  for (const l of LANGS) {
    await goto(page, l.path)
    const others = LANGS.filter((o) => o !== l).map((o) => o.label)
    await expect(page.locator('.site-nav a[data-lang-switch]')).toHaveText(others)
    await expect(page.locator('footer a[data-lang-switch]')).toHaveText(others)
  }
  // Troca de idioma levando a seção aberta: en → pt (cabeçalho) → es (rodapé) → en
  await goto(page, '/#security')
  await page.locator('.site-nav a[data-lang-switch]', { hasText: 'Português' }).click()
  await expect(page).toHaveURL(/\/pt\/#security$/)
  await expect(page.locator('#security')).toHaveText('Segurança')
  await page.locator('footer a[data-lang-switch]', { hasText: 'Español' }).click()
  await expect(page).toHaveURL(/\/es\/#security$/)
  await expect(page.locator('#security')).toHaveText('Seguridad')
  await page.locator('.site-nav a[data-lang-switch]', { hasText: 'English' }).click()
  await expect(page).toHaveURL(/\/#security$/)
  await expect(page.locator('#security')).toHaveText('Security')
})

test('metadados de idioma: lang, canonical, hreflang dos três e x-default', async ({ page }) => {
  for (const l of LANGS) {
    await goto(page, l.path)
    const m = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      alternates: [...document.querySelectorAll('link[rel="alternate"]')].map(
        (e) => `${e.getAttribute('hreflang')} ${e.getAttribute('href')}`,
      ),
      ogLocale: document.querySelector('meta[property="og:locale"]')?.getAttribute('content'),
      description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
    }))
    expect(m.lang).toBe(l.lang)
    expect(m.canonical).toBe(`https://versaedit.dev${l.path}`)
    expect(m.alternates).toEqual([
      'en https://versaedit.dev/',
      'pt-BR https://versaedit.dev/pt/',
      'es https://versaedit.dev/es/',
      'x-default https://versaedit.dev/',
    ])
    expect(m.ogLocale).toBe(l.lang.replace('-', '_'))
    expect(m.description).toBeTruthy()
  }
})

test('sem busca, versão publicada com link para o npm, instalação da beta', async ({ page }) => {
  for (const l of LANGS) {
    await goto(page, l.path)
    await expect(page.locator('input, [role="search"]')).toHaveCount(0)
    // Nota de topo e quadro de informações apontam para o pacote publicado
    await expect(page.locator('a[href="https://www.npmjs.com/package/versaedit"]')).toHaveCount(2)
    await expect(page.locator('#content')).not.toContainText(
      /not yet published|não foi publicad|não publicad|no se ha publicado|no publicad|planned for npm|prevista para o npm/i,
    )
    const install = page.locator('#installation ~ .code-block').first()
    await expect(install.locator('code')).toHaveText('npm install versaedit@beta')
    await expect(install.locator('.code-label')).toHaveText(l.install)
    await expect(page.locator('footer .privacy li')).toHaveCount(3)
  }
})

test('desktop: sumário fixo à esquerda, tabela de navegadores com cabeçalho', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await goto(page, '/')
  await expect(page.locator('#rail')).toBeVisible()
  await expect(page.locator('#menu-btn')).toBeHidden()
  await expect(page.locator('.wikitable thead th').first()).toBeVisible()
  const [rail, main, facts] = await Promise.all(
    ['#rail', '.article', '.facts'].map((s) => page.locator(s).boundingBox()),
  )
  expect(rail!.x).toBeLessThan(main!.x)
  expect(facts!.x).toBeGreaterThan(main!.x + main!.width)
})

test('celular: botão Conteúdo, caixa sob o título, tabela em blocos', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await goto(page, '/pt/')
  const btn = page.locator('#menu-btn')
  await expect(page.locator('#rail')).toBeHidden()
  await btn.click()
  await expect(btn).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#rail')).toBeVisible()
  await page.locator('#rail a[href="#browsers"]').click()
  await expect(page.locator('#rail')).toBeHidden()
  await expect(btn).toHaveAttribute('aria-expanded', 'false')
  // Caixa de informações antes do texto do artigo
  const [facts, article] = await Promise.all(
    ['.facts', '.article'].map((s) => page.locator(s).boundingBox()),
  )
  expect(facts!.y).toBeLessThan(article!.y)
  // Tabela em blocos: cada célula traz o rótulo da coluna; nada se perde
  const cell = page.locator('.wikitable tbody td').nth(3)
  expect(await cell.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('"Navegador"')
  await expect(page.locator('.wikitable tbody td')).toHaveCount(12)
  await noHorizontalScroll(page)
})

test('acessibilidade básica: título único, textos alternativos, regiões e atalho', async ({
  page,
}) => {
  for (const l of LANGS) {
    await goto(page, l.path)
    await expect(page.locator('h1')).toHaveCount(1)
    for (const img of await page.locator('img').all()) {
      expect((await img.getAttribute('alt'))?.trim()).toBeTruthy()
    }
    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('main#content')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(1)
    await expect(page.locator('nav[aria-label]')).toHaveCount(3)
    for (const b of await page.locator('button').all()) {
      expect((await b.innerText()).trim()).not.toBe('')
    }
    // Atalho "Pular para o conteúdo": primeiro item do Tab, leva ao artigo
    await page.keyboard.press('Tab')
    await expect(page.locator('.skip')).toBeFocused()
    await expect(page.locator('.skip')).toHaveAttribute('href', '#content')
  }
})

test('playground em /playground/: edita, nota de privacidade, sem o harness', async ({ page }) => {
  allowFonts = true
  await goto(page, '/playground/')
  const content = page.locator('.ve-content')
  await expect(content).toBeVisible()
  await content.click()
  await page.keyboard.type('Hello from the public playground')
  await expect(content).toContainText('Hello from the public playground')
  await expect(page.getByTestId('site-note')).toContainText('VersaEdit has no server')
  await expect(page.getByTestId('site-note')).toContainText('Google Fonts')
  // A nota acompanha a largura da caixa de edição (não passa da borda dela)
  const [note, frame] = await Promise.all([
    page.getByTestId('site-note').boundingBox(),
    page.locator('.ve-frame').boundingBox(),
  ])
  expect(Math.abs(note!.x - frame!.x)).toBeLessThan(1)
  expect(note!.x + note!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1)
  // Fontes do playground: Montserrat no texto, Playfair Display nos títulos
  await expect(
    page.locator('#versaedit-google-fonts, link[href*="fonts.googleapis.com"]').first(),
  ).toHaveAttribute('href', /Montserrat.*Playfair\+Display/)
  expect(await content.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Montserrat/)
  // O menu de fontes já abre mostrando a fonte do texto
  await page.reload()
  await expect(page.locator('.ve-font-button')).toHaveText(/^Montserrat/)
  await page.getByRole('combobox').first().selectOption('pt-BR')
  await expect(page.getByTestId('site-note')).toContainText('o VersaEdit não tem servidor')
  // A página de testes (harness) não vai para o site
  expect((await page.request.get('/playground/harness.html')).status()).toBe(404)
})

test('arquivos do site: CNAME do domínio e nada de dados locais ou chaves', () => {
  const site = path.resolve('site')
  expect(fs.readFileSync(path.join(site, 'CNAME'), 'utf8').trim()).toBe('versaedit.dev')
  for (const page of ['index.html', 'pt/index.html', 'es/index.html']) {
    expect(fs.existsSync(path.join(site, page)), page).toBe(true)
  }
  const files = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  for (const file of files(site)) {
    const text = fs.readFileSync(file, 'utf8')
    expect(text, file).not.toMatch(/[A-Za-z]:[\\/]{1,2}Users\b|\/home\/[a-z]/)
    expect(text, file).not.toMatch(/service_role|sk-(or|ant|proj)-|eyJ[A-Za-z0-9_-]{30,}\./)
  }
})

test.describe('logo oficial', () => {
  const measure = (page: Page) =>
    page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect()
      const bg = (s: string) => getComputedStyle(document.querySelector(s)!).backgroundColor
      const btn = document.getElementById('menu-btn')!
      return {
        head: r('.logo img'),
        facts: r('.facts .logo-band img'),
        rail: r('#rail'),
        btn: getComputedStyle(btn).display === 'none' ? null : btn.getBoundingClientRect(),
        backgrounds: ['.logo', '.logo img', '.facts .logo-band', '.facts .logo-band img'].map(bg),
        view: window.innerWidth,
      }
    })

  for (const scheme of ['light', 'dark'] as const) {
    test(`mesmo tamanho (110px) no cabeçalho e na caixa, sem fundo — tema ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme })
      for (const width of [1440, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await goto(page, '/')
        const m = await measure(page)
        expect(m.head.width, `${width}px`).toBeCloseTo(110, 0)
        expect(m.facts.width, `${width}px`).toBeCloseTo(m.head.width, 1)
        expect(m.facts.height, `${width}px`).toBeCloseTo(m.head.height, 1)
        // Proporção do arquivo (880×455), sem distorção
        expect(m.head.width / m.head.height).toBeCloseTo(880 / 455, 2)
        for (const c of m.backgrounds)
          expect(c, 'sem fundo, selo ou faixa').toBe('rgba(0, 0, 0, 0)')
      }
    })
  }

  test('canto superior esquerdo: alinhado ao sumário no desktop, acima do botão nas telas menores', async ({
    page,
  }) => {
    for (const l of LANGS) {
      await page.setViewportSize({ width: 1440, height: 900 })
      await goto(page, l.path)
      let m = await measure(page)
      expect(Math.round(m.head.left)).toBe(Math.round(m.rail.left))
      expect(m.head.top).toBeLessThan(m.rail.top)
      for (const width of [768, 375, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await goto(page, l.path)
        m = await measure(page)
        expect(m.btn, `${width}px: botão Conteúdo visível`).not.toBeNull()
        expect(m.btn!.top, `${width}px: botão abaixo do logo`).toBeGreaterThanOrEqual(m.head.bottom)
        expect(Math.round(m.head.left), `${width}px: logo à esquerda`).toBe(Math.round(m.btn!.left))
        // Não centralizado
        expect(m.head.left + m.head.width / 2).toBeLessThan(m.view / 2)
      }
    }
  })
})

test.describe('logo por tema', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const file = scheme === 'dark' ? '/assets/logo-dark.png' : '/assets/logo.png'
    test(`tema ${scheme}: cabeçalho e caixa usam ${file}, sem filtro, com 110px`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme })
      for (const l of LANGS) {
        for (const width of [1440, 375]) {
          await page.setViewportSize({ width, height: 900 })
          await goto(page, l.path)
          const imgs = await page.evaluate(() =>
            ['.logo img', '.facts .logo-band img'].map((s) => {
              const img = document.querySelector<HTMLImageElement>(s)!
              return {
                src: new URL(img.currentSrc).pathname,
                filter: getComputedStyle(img).filter,
                width: img.getBoundingClientRect().width,
                loaded: img.complete && img.naturalWidth > 0,
              }
            }),
          )
          for (const img of imgs) {
            expect(img.src, `${l.path} ${width}px`).toBe(file)
            expect(img.loaded, 'imagem carregada').toBe(true)
            expect(img.filter, 'sem filtro de CSS').toBe('none')
            expect(img.width).toBeCloseTo(110, 0)
          }
        }
      }
    })
  }

  test('a variante escura tem a mesma forma do logo oficial (transparência idêntica)', async ({
    page,
  }) => {
    await goto(page, '/')
    const r = await page.evaluate(async () => {
      const pixels = async (src: string) => {
        const img = new Image()
        img.src = src
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const g = c.getContext('2d')!
        g.drawImage(img, 0, 0)
        return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data }
      }
      const [a, b] = [await pixels('/assets/logo.png'), await pixels('/assets/logo-dark.png')]
      let alphaDiff = 0
      for (let i = 3; i < a.d.length; i += 4) if (a.d[i] !== b.d[i]) alphaDiff++
      return { same: a.w === b.w && a.h === b.h, alphaDiff, corner: b.d[3] }
    })
    expect(r.same, 'mesmas dimensões').toBe(true)
    expect(r.alphaDiff, 'pixels com transparência diferente').toBe(0)
    expect(r.corner, 'fundo transparente').toBe(0)
  })
})

test('interface do editor nos três idiomas: introdução e exemplo de uso com o locale da página', async ({
  page,
}) => {
  const EXPECT = {
    '/': { locale: 'en', langs: ['English', 'Brazilian Portuguese', 'Spanish'] },
    '/pt/': { locale: 'pt-BR', langs: ['inglês', 'português do Brasil', 'espanhol'] },
    '/es/': { locale: 'es', langs: ['inglés', 'portugués de Brasil', 'español'] },
  } as const
  for (const l of LANGS) {
    const e = EXPECT[l.path]
    await goto(page, l.path)
    const usage = page.locator('pre', { hasText: '<VersaEdit' })
    await expect(usage).toContainText(`locale="${e.locale}"`)
    const lead = await page.locator('#content p', { hasText: 'Next.js' }).first().textContent()
    for (const lang of e.langs) expect(lead, `${l.path}: ${lang}`).toContain(lang)
  }
})

// The VersaEdit Philosophy: uma página por língua (o original em português,
// scripts/site/philosophy.pt.md, e as traduções em inglês e espanhol), link no
// menu principal e a síntese na página inicial
test.describe('filosofia', () => {
  const PAGES = [
    {
      home: '/',
      path: '/philosophy/',
      lang: 'en',
      file: 'philosophy.en.md',
      link: 'Philosophy',
      languages: ['Português', 'Español'],
      synthesis: [
        'Versatility will be our differentiator. Precision will be our reputation.',
        'Preserve the past. Improve the present. Do not limit the future.',
      ],
    },
    {
      home: '/pt/',
      path: '/pt/filosofia/',
      lang: 'pt-BR',
      file: 'philosophy.pt.md',
      link: 'Filosofia',
      languages: ['English', 'Español'],
      synthesis: [
        'A versatilidade será nosso diferencial. A precisão será nossa reputação.',
        'Preservar o passado. Aperfeiçoar o presente. Não limitar o futuro.',
      ],
    },
    {
      home: '/es/',
      path: '/es/filosofia/',
      lang: 'es',
      file: 'philosophy.es.md',
      link: 'Filosofía',
      languages: ['English', 'Português'],
      synthesis: [
        'La versatilidad será nuestro diferencial. La precisión será nuestra reputación.',
        'Preservar el pasado. Perfeccionar el presente. No limitar el futuro.',
      ],
    },
  ] as const
  // Cada linha do texto, sem a marcação (#, **, *, ---)
  const linesOf = (file: string) =>
    fs
      .readFileSync(path.resolve('scripts/site', file), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && l !== '---')
      .map((l) =>
        l
          .replace(/^#+\s+/, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1'),
      )

  test('menu principal e síntese da página inicial levam à filosofia da mesma língua', async ({
    page,
  }) => {
    for (const p of PAGES) {
      await goto(page, p.home)
      await expect(page.locator('.site-nav a', { hasText: p.link })).toHaveAttribute('href', p.path)
      const synthesis = page.locator('blockquote.synthesis')
      await expect(synthesis.locator('p')).toHaveText([...p.synthesis, 'The VersaEdit Philosophy'])
      await expect(synthesis.locator('a')).toHaveAttribute('href', p.path)
    }
    await goto(page, '/pt/')
    await page.locator('.site-nav a', { hasText: 'Filosofia' }).click()
    await expect(page).toHaveURL(/\/pt\/filosofia\/$/)
  })

  for (const p of PAGES) {
    test(`${p.path}: o texto inteiro de ${p.file}, na ordem, com os 13 princípios`, async ({
      page,
    }) => {
      await goto(page, p.path)
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(p.lang)
      await expect(page.locator('h1')).toHaveText('The VersaEdit Philosophy')
      const article = await page.locator('main article').innerText()
      let from = 0
      for (const line of linesOf(p.file)) {
        const at = article.indexOf(line, from)
        expect(at, `linha de ${p.file}: "${line}"`).toBeGreaterThanOrEqual(from)
        from = at + line.length
      }
      const sections = await page.locator('main h2').allTextContents()
      expect(sections.filter((h) => /^[IVX]+\. /.test(h))).toHaveLength(13)
      expect(sections).toHaveLength(16)
      await expect(page.locator('main hr')).toHaveCount(3)
    })
  }

  test('mesma identidade do site; a troca de língua leva à filosofia na outra língua; links reais', async ({
    page,
  }) => {
    for (const p of PAGES) {
      await goto(page, p.path)
      await expect(page.locator('.site-header .logo img')).toBeVisible()
      await expect(page.locator('.site-nav a', { hasText: p.link })).toHaveAttribute('href', p.path)
      await expect(page.locator('.site-nav a[data-lang-switch]')).toHaveText([...p.languages])
      await expect(page.locator('footer a[data-lang-switch]')).toHaveText([...p.languages])
      for (const other of PAGES.filter((o) => o !== p)) {
        await expect(
          page.locator(`.site-nav a[data-lang-switch][hreflang="${other.lang}"]`),
        ).toHaveAttribute('href', other.path)
      }
      await expect(page.locator('footer')).toContainText('support@versaedit.dev')
      expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(
        `https://versaedit.dev${p.path}`,
      )
      const links = await page.evaluate(() =>
        [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? ''),
      )
      for (const href of links) {
        expect(href, 'link sem destino').not.toBe('')
        if (href.startsWith('#')) expect(await page.locator(href).count(), href).toBe(1)
        else if (href.startsWith('/'))
          expect((await page.request.get(href.split('#')[0])).status(), href).toBe(200)
        else expect(href).toMatch(/^(https:\/\/|mailto:support@versaedit\.dev$)/)
      }
    }
  })

  for (const p of PAGES) {
    for (const width of WIDTHS) {
      for (const scheme of ['light', 'dark'] as const) {
        test(`${p.path} em ${width}px, tema ${scheme}: sem rolagem horizontal, sem erros, nada externo`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: scheme })
          await page.setViewportSize({ width, height: 900 })
          await goto(page, p.path)
          await noHorizontalScroll(page)
        })
      }
    }
  }
})
