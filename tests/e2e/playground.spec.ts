// Playground (playground/index.html): o painel "Propriedades", dentro da área
// de desenvolvimento recolhida, muda o editor ao vivo
import { expect, test, type Page } from '@playwright/test'
import { PANEL_TEXT } from '../../playground/PropsPanel'
import { en } from '../../src/core/i18n/en'
import { es } from '../../src/core/i18n/es'
import { ptBR } from '../../src/core/i18n/pt-BR'

async function openPanel(page: Page) {
  await page.goto('/')
  await expect(page.locator('.ve-content')).toBeVisible()
  // Tudo recolhido na tela inicial
  // (no WebKit, o que fica dentro de um <details> fechado ainda tem tamanho,
  // então a conferência é pelo atributo open e pelo checkVisibility)
  await expect(page.locator('#root details').first()).not.toHaveAttribute('open')
  expect(await page.getByTestId('props-panel').evaluate((el) => el.checkVisibility())).toBe(false)
  await page.getByText('Show HTML', { exact: true }).click()
  await page.getByText('Properties', { exact: true }).click()
  await expect(page.getByTestId('events')).toBeVisible()
}

test('grupos da barra, largura e JSX equivalente', async ({ page }) => {
  await openPanel(page)
  const toolbar = page.getByRole('toolbar').first()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toBeVisible()
  await page.getByLabel('insert', { exact: true }).uncheck()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toHaveCount(0)
  await expect(page.getByTestId('jsx')).toContainText('toolbar={["file"')

  await page
    .locator('label', { hasText: /^Width/ })
    .locator('select')
    .selectOption('100%')
  await expect(page.getByTestId('jsx')).toContainText('width="100%"')
  const [root, column] = await Promise.all([
    page.locator('.ve-root').first().boundingBox(),
    page.locator('#root > div').boundingBox(),
  ])
  expect(root!.width).toBeGreaterThan(column!.width - 40)

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toBeVisible()
  await expect(page.getByTestId('jsx')).not.toContainText('toolbar=')
})

test('conteúdos de exemplo e registro de eventos', async ({ page }) => {
  await openPanel(page)
  await page.getByRole('button', { name: 'Load: Table' }).click()
  await expect(page.locator('.ve-content table th').first()).toHaveText('Item')
  await expect(page.getByTestId('events')).toContainText('setHTML')
  // A área "Show HTML" acompanha o conteúdo carregado
  await expect(page.locator('pre').first()).toContainText('<th>Item</th>')
  await page.locator('.ve-content td').first().click()
  await expect(page.getByTestId('events')).toContainText('onFocus')
  await page.keyboard.type('x')
  await expect(page.getByTestId('events')).toContainText('onChange')
  await page.getByRole('button', { name: 'Load: Long content' }).click()
  await expect(page.getByTestId('events')).toContainText('onOverflowChange (true)')
})

test('onError ligado: aviso no registro, sem alert do navegador', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.dismiss()
  })
  await openPanel(page)
  await page.getByLabel('onError (log instead of alert)').check()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open file (.html)' }).first().click()
  await (
    await chooser
  ).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  await expect(page.getByTestId('events')).toContainText('onError file-wrong-type')
  expect(dialogs).toEqual([])
})

test.describe('celular (375px)', () => {
  test.use({ viewport: { width: 375, height: 800 }, hasTouch: true })

  const noHorizontalScroll = async (page: Page) => {
    const { scroll, view } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }))
    expect(scroll, 'rolagem horizontal').toBeLessThanOrEqual(view)
  }

  test('sem rolagem horizontal; editor na largura da tela e funcionando', async ({ page }) => {
    await page.goto('/')
    const content = page.locator('.ve-content')
    await expect(content).toBeVisible()
    await noHorizontalScroll(page)
    const frame = (await page.locator('.ve-frame').boundingBox())!
    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.x + frame.width).toBeLessThanOrEqual(375)
    // Barra de ferramentas inteira dentro da tela (quebra em linhas)
    const toolbar = (await page.getByRole('toolbar').first().boundingBox())!
    expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(375)
    await content.tap()
    await page.keyboard.type('Texto no celular')
    await expect(content).toContainText('Texto no celular')
    await page.getByRole('button', { name: /^Bold/ }).first().tap()
    await noHorizontalScroll(page)
  })

  test('painel Propriedades e segundo editor cabem na tela', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Show HTML', { exact: true }).click()
    await page.getByText('Properties', { exact: true }).click()
    await expect(page.getByTestId('events')).toBeVisible()
    await noHorizontalScroll(page)
    // Eventos e JSX um embaixo do outro
    const [events, jsx] = await Promise.all([
      page.getByTestId('events').boundingBox(),
      page.getByTestId('jsx').boundingBox(),
    ])
    expect(jsx!.y).toBeGreaterThan(events!.y + events!.height - 1)
    await page.getByRole('button', { name: 'Load: Table' }).click()
    await expect(page.locator('.ve-content table').first()).toBeVisible()
    await page.getByRole('button', { name: 'Show editor with onSave' }).click()
    await expect(page.locator('.ve-frame')).toHaveCount(2)
    await noHorizontalScroll(page)
  })
})

test('seletor de idioma: editor, painel e textos do playground em en, pt-BR e es', async ({
  page,
}) => {
  await openPanel(page)
  const L = { en, 'pt-BR': ptBR, es } as const
  const SHOW_HTML = { en: 'Show HTML', 'pt-BR': 'Ver HTML', es: 'Ver HTML' }
  // Todos os textos da página fora do conteúdo editado e dos blocos de código
  const pageTexts = () =>
    page.evaluate(() => {
      const out = new Set<string>()
      const add = (v: string | null | undefined) => {
        const t = v?.replace(/\s+/g, ' ').trim()
        if (t) out.add(t)
      }
      for (const el of document.querySelectorAll('#root *')) {
        if (el.closest('pre') || (el.closest('.ve-content') && !el.matches('.ve-content'))) continue
        for (const a of ['aria-label', 'title', 'placeholder', 'data-placeholder'])
          add(el.getAttribute(a))
        for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) add(n.textContent)
      }
      return [...out]
    })
  const strings = (locale: keyof typeof L): string[] => [
    ...Object.values(L[locale]),
    ...Object.values(PANEL_TEXT[locale]).flatMap((v) =>
      typeof v === 'string' ? [v] : Object.values(v as Record<string, string>),
    ),
    SHOW_HTML[locale],
  ]
  for (const locale of ['es', 'pt-BR', 'en'] as const) {
    await page.locator('.pg-pill select').selectOption(locale)
    await expect(page.locator('#root > div')).toHaveAttribute('lang', locale)
    await expect(
      page.getByRole('toolbar').first().getByRole('button', { name: L[locale].bold }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: L[locale].dictate })).toHaveCount(
      await page.evaluate(() =>
        'SpeechRecognition' in window || 'webkitSpeechRecognition' in window ? 1 : 0,
      ),
    )
    await expect(page.getByText(PANEL_TEXT[locale].title, { exact: true })).toBeVisible()
    await expect(page.getByLabel(PANEL_TEXT[locale].frameRadius)).toBeVisible()
    await expect(page.getByTestId('jsx')).toContainText(
      locale === 'en' ? '<VersaEdit\n  ref={editorRef}\n  width' : `locale="${locale}"`,
    )
    const own = new Set(strings(locale))
    const foreign = new Set(
      (['en', 'pt-BR', 'es'] as const)
        .filter((l) => l !== locale)
        .flatMap(strings)
        .filter((s) => !own.has(s) && !s.includes('{')),
    )
    const texts = await pageTexts()
    expect(
      texts.filter((t) => foreign.has(t)),
      `textos de outro idioma em ${locale}`,
    ).toEqual([])
    expect(texts).toContain(PANEL_TEXT[locale].frame)
    expect(texts).toContain(L[locale].placeholder)
  }
})

test('conteúdos de exemplo carregam no idioma escolhido (en, pt-BR, es)', async ({ page }) => {
  await openPanel(page)
  const EXPECT = {
    en: { th: 'Item', td: 'Bread', alt: 'Blue square', box: 'A text box', h2: 'Heading' },
    'pt-BR': {
      th: 'Item',
      td: 'Pão',
      alt: 'Quadrado azul',
      box: 'Uma caixa de texto',
      h2: 'Título',
    },
    es: {
      th: 'Artículo',
      td: 'Pan',
      alt: 'Cuadrado azul',
      box: 'Un cuadro de texto',
      h2: 'Título',
    },
  } as const
  const editor = page.locator('.ve-content').first()
  for (const locale of ['es', 'pt-BR', 'en'] as const) {
    await page.locator('.pg-pill select').selectOption(locale)
    const T = PANEL_TEXT[locale]
    const e = EXPECT[locale]
    const load = (id: keyof typeof T.samples) =>
      page.getByRole('button', { name: `${T.load}: ${T.samples[id]}` }).click()
    await load('table')
    await expect(editor.locator('th').first()).toHaveText(e.th)
    await expect(editor.locator('td').first()).toHaveText(e.td)
    await load('image')
    await expect(editor.locator('img.pos-right')).toHaveAttribute('alt', e.alt)
    await load('textbox')
    await expect(editor.locator('.rich-textbox')).toContainText(e.box)
    await load('formatted')
    await expect(editor.locator('h2')).toHaveText(e.h2)
    await expect(editor.locator('span[style*="color"]')).toHaveCount(1)
  }
})

test('trocar o idioma não muda o conteúdo em edição; o exemplo muda só ao carregá-lo de novo', async ({
  page,
}) => {
  await openPanel(page)
  const editor = page.locator('.ve-content').first()
  // Editor principal: exemplo em inglês, editado
  await page.getByRole('button', { name: 'Load: Table' }).click()
  await editor.locator('td').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' editado')
  const edited = await editor.innerHTML()
  expect(edited).toContain('Bread editado')
  // Segundo editor (onSave): aberto vazio e editado
  await page.getByRole('button', { name: 'Show editor with onSave' }).click()
  const second = page.locator('.ve-content').nth(1)
  await expect(second).toBeVisible()
  await second.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' texto meu')
  const secondEdited = await second.innerHTML()

  for (const locale of ['es', 'pt-BR'] as const) {
    await page.locator('.pg-pill select').selectOption(locale)
    await expect(
      page
        .getByRole('toolbar')
        .first()
        .getByRole('button', { name: locale === 'es' ? 'Negrita (Ctrl+B)' : 'Negrito (Ctrl+B)' }),
    ).toBeVisible()
    await page.waitForTimeout(200)
    expect(await editor.innerHTML(), `editor principal em ${locale}`).toBe(edited)
    expect(await second.innerHTML(), `segundo editor em ${locale}`).toBe(secondEdited)
  }
  // Carregar o exemplo de novo, explicitamente, traz o texto do idioma atual
  await page.getByRole('button', { name: 'Carregar: Tabela' }).click()
  await expect(editor.locator('td').first()).toHaveText('Pão')
  expect(await second.innerHTML()).toBe(secondEdited)
})
