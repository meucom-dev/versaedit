// Site público (site/, gerado por npm run build:site): página inicial em inglês
// (/) e em português (/pt/), e o playground em /playground/
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const LANGS = [
  { path: '/', lang: 'en', other: '/pt/', otherLabel: 'Português' },
  { path: '/pt/', lang: 'pt-BR', other: '/', otherLabel: 'English' },
] as const
const WIDTHS = [375, 768, 1024, 1440]

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
    test(`${l.path} em ${width}px: sem rolagem horizontal, sem erros, nada externo`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await goto(page, l.path)
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(l.lang)
      await expect(page.locator('h1')).toHaveText('VersaEdit')
      await noHorizontalScroll(page)
    })
  }
}

test('as duas línguas têm a mesma estrutura e nenhuma mistura de textos', async ({ page }) => {
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
  const en = await read('/')
  const pt = await read('/pt/')
  expect(pt.ids).toEqual(en.ids)
  expect(pt.counts).toEqual(en.counts)
  for (const h of pt.headings) expect(en.text, `"${h}" na página em inglês`).not.toContain(h)
  for (const h of en.headings) expect(pt.text, `"${h}" na página em português`).not.toContain(h)
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
      expect(href, 'nada aponta para o npm antes da publicação').not.toMatch(/npmjs/)
    }
  }
  // Troca de idioma levando a seção aberta
  await goto(page, '/#security')
  await page.locator('.site-nav a[data-lang-switch]').click()
  await expect(page).toHaveURL(/\/pt\/#security$/)
  await expect(page.locator('#security')).toHaveText('Segurança')
  await page.locator('footer a[data-lang-switch]').click()
  await expect(page).toHaveURL(/\/#security$/)
  await expect(page.locator('#security')).toHaveText('Security')
})

test('sem busca, sem link para o npm, instalação marcada como uso futuro', async ({ page }) => {
  for (const l of LANGS) {
    await goto(page, l.path)
    await expect(page.locator('input, [role="search"]')).toHaveCount(0)
    await expect(page.locator('a[href*="npmjs"]')).toHaveCount(0)
    const install = page.locator('#installation ~ .code-block').first()
    await expect(install.locator('code')).toHaveText('npm install versaedit@beta')
    await expect(install.locator('.code-label')).toHaveText(
      l.lang === 'en' ? 'For use after publication' : 'Para uso após a publicação',
    )
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
  for (const page of ['index.html', 'pt/index.html']) {
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
