// Playground (playground/index.html): as configurações gerais ficam na engrenagem
// da barra (prop settingsPanel) e mudam o editor ao vivo; as ferramentas do
// playground (exemplos, diagnóstico, eventos e JSX equivalente) ficam em Ver HTML
import { expect, test, type Page } from '@playwright/test'
import { PANEL_TEXT } from '../../playground/PropsPanel'
import { TOOLBAR_GROUPS } from '../../src/react/toolbar/Toolbar'
import { en } from '../../src/core/i18n/en'
import { es } from '../../src/core/i18n/es'
import { ptBR } from '../../src/core/i18n/pt-BR'

const E = PANEL_TEXT.en

async function openPanel(page: Page) {
  await page.goto('/')
  await expect(page.locator('.ve-content')).toBeVisible()
  // Tudo recolhido na tela inicial
  // (no WebKit, o que fica dentro de um <details> fechado ainda tem tamanho,
  // então a conferência é pelo atributo open e pelo checkVisibility)
  await expect(page.locator('#root details').first()).not.toHaveAttribute('open')
  expect(await page.getByTestId('props-panel').evaluate((el) => el.checkVisibility())).toBe(false)
  await page.getByText('Show HTML', { exact: true }).click()
  await page.getByText(PANEL_TEXT.en.title, { exact: true }).click()
  await expect(page.getByTestId('events')).toBeVisible()
}

/** Painel da engrenagem do editor principal, aberto (abre se estiver fechado) */
async function settings(page: Page, name = 'Settings') {
  const panel = page.getByTestId('settings-panel')
  if (!(await panel.isVisible())) {
    await page.getByRole('toolbar').first().getByRole('button', { name }).click()
  }
  await expect(panel).toBeVisible()
  return panel
}

test('grupos da barra, largura e JSX equivalente', async ({ page }) => {
  await openPanel(page)
  const toolbar = page.getByRole('toolbar').first()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toBeVisible()
  const s = await settings(page)
  await s.getByLabel(E.groups.insert, { exact: true }).uncheck()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toHaveCount(0)
  await expect(page.getByTestId('jsx')).toContainText('toolbar={["file"')

  await s.getByLabel(E.width, { exact: true }).selectOption('100%')
  await expect(page.getByTestId('jsx')).toContainText('width="100%"')
  const [root, column] = await Promise.all([
    page.locator('.ve-root').first().boundingBox(),
    page.locator('#root > div').boundingBox(),
  ])
  expect(root!.width).toBeGreaterThan(column!.width - 40)

  await (await settings(page)).getByRole('button', { name: 'Reset' }).click()
  await expect(toolbar.getByRole('button', { name: 'Insert image' })).toBeVisible()
  await expect(page.getByTestId('jsx')).not.toContainText('toolbar=')
  // Restaurar padrões: volta a 800 × 500 px (JSX e tamanho medido da área)
  await expect(page.getByTestId('jsx')).toContainText('width={800}')
  await expect(page.getByTestId('jsx')).toContainText('height={500}')
  const size = await page.locator('.ve-frame').first().boundingBox()
  expect(Math.round(size!.width)).toBe(800)
  expect(Math.round(size!.height)).toBe(500)
})

test('layoutMirror: prévia publicada com ve-mirror, igual ao editor', async ({ page }) => {
  await openPanel(page)
  await expect(page.getByTestId('published-mirror')).toHaveCount(0)
  await (await settings(page)).getByLabel(E.options.layoutMirror, { exact: true }).check()
  await expect(page.getByTestId('jsx')).toContainText('layoutMirror={true}')
  await expect(page.locator('.ve-content')).toHaveClass(/\bve-mirror\b/)
  await page.getByRole('button', { name: 'Load: Formatted text' }).click()
  const published = page.getByTestId('published-mirror')
  await expect(published).toHaveClass('versaedit-content ve-mirror')
  await expect(published.locator('h2')).toHaveText('Heading')
  // Mesma fonte, tamanho e espaço do título e da lista nas duas pontas
  const look = (root: string) =>
    page.evaluate((r) => {
      const el = document.querySelector(r)!
      const h2 = getComputedStyle(el.querySelector('h2')!)
      const ul = el.querySelector('ul')!
      return [h2.fontFamily, h2.fontSize, h2.marginTop, ul.getBoundingClientRect().height]
    }, root)
  expect(await look('[data-testid="published-mirror"]')).toEqual(await look('.ve-content'))
  await (await settings(page)).getByLabel(E.options.layoutMirror, { exact: true }).uncheck()
  await expect(page.getByTestId('published-mirror')).toHaveCount(0)
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

  test('engrenagem, ferramentas e segundo editor cabem na tela', async ({ page }) => {
    await page.goto('/')
    // Painel da engrenagem inteiro na largura da tela
    const s = await settings(page)
    const box = (await s.locator('xpath=..').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    await noHorizontalScroll(page)
    // Fechado com Esc (aberto, ele cobre o que está embaixo na tela estreita)
    await page.keyboard.press('Escape')
    await expect(s).toHaveCount(0)
    await page.getByText('Show HTML', { exact: true }).click()
    await page.getByText(PANEL_TEXT.en.title, { exact: true }).click()
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
    const s = await settings(page, L[locale].settings)
    await expect(s.getByLabel(PANEL_TEXT[locale].frameRadius)).toBeVisible()
    // Engrenagem no idioma: nenhum nome de prop, grupo, alça ou valor como texto
    // visível (o nome técnico fica só na dica, em title)
    const visible = (await s.innerText()).split(/\s+/)
    for (const id of [
      'insert',
      'format',
      'layoutMirror',
      'pasteImages',
      'pasteSpacing',
      'preserve',
      'resizable',
      'sizeControls',
      'nw',
      'maxWidth',
    ]) {
      expect(visible, `${id} visível em ${locale}`).not.toContain(id)
    }
    await expect(s.getByLabel(PANEL_TEXT[locale].options.resizable)).toBeVisible()
    await expect(s.getByTitle('pasteSpacing')).toContainText(
      PANEL_TEXT[locale].options.pasteSpacing,
    )
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

test('Dimensões: largura e altura selecionáveis, uma abaixo da outra, com a unidade', async ({
  page,
}) => {
  await openPanel(page)
  const s = await settings(page)
  const width = s.getByLabel(E.width, { exact: true })
  const height = s.getByLabel(E.height, { exact: true })
  const jsx = page.getByTestId('jsx')
  // Uma abaixo da outra, alinhadas
  const [w, h] = [(await width.boundingBox())!, (await height.boundingBox())!]
  expect(Math.round(w.x)).toBe(Math.round(h.x))
  expect(h.y).toBeGreaterThan(w.y + w.height - 1)
  // Altura é uma seleção em px; o editor muda na hora e o painel fica aberto
  await expect(height).toHaveValue('500')
  expect(await height.locator('option').allTextContents()).toEqual(
    ['300', '400', '500', '600', '700', '800', '900'].map((v) => `${v} px`),
  )
  await height.selectOption('700')
  await expect(jsx).toContainText('height={700}')
  expect(Math.round((await page.locator('.ve-frame').first().boundingBox())!.height)).toBe(700)
  await expect(s).toBeVisible()
  // Largura: px nas opções numéricas
  expect(await width.locator('option').allTextContents()).toEqual([
    '800 px',
    '900 px',
    '640 px',
    '100%',
  ])
  // Restaurar padrões: 800 × 500
  await s.getByRole('button', { name: 'Reset' }).click()
  await expect(height).toHaveValue('500')
  await expect(width).toHaveValue('800')
})

test('Alças em uma coluna; Limites com px e o padrão do editor no campo vazio', async ({
  page,
}) => {
  await openPanel(page)
  await settings(page)
  const panel = page.getByTestId('resize-settings')
  const handles = await panel
    .getByRole('checkbox')
    .evaluateAll((els) =>
      els
        .filter((el) => el.closest('label')?.getAttribute('title')?.startsWith("'"))
        .map((el) => Math.round(el.getBoundingClientRect().left)),
    )
  expect(handles).toHaveLength(8)
  expect(new Set(handles).size).toBe(1)
  const placeholders: string[] = []
  for (const key of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const) {
    const field = panel.getByLabel(E.limitNames[key], { exact: true })
    placeholders.push((await field.getAttribute('placeholder'))!)
    // A unidade logo à direita do campo
    const box = (await field.boundingBox())!
    const unit = await field.evaluate((el) => {
      const r = el.nextElementSibling!.getBoundingClientRect()
      return { text: el.nextElementSibling!.textContent, left: r.left }
    })
    expect(unit.text).toBe('px')
    expect(unit.left).toBeGreaterThan(box.x + box.width - 1)
  }
  expect(placeholders).toEqual(['160', 'container', '80', 'none'])
  await expect(panel.getByText(E.limitsHint)).toBeVisible()
})

// Redimensionamento da área (Lote 3): ligado no painel, com campos, alças e limites;
// o registro mostra onResize e o JSX equivalente acompanha
test('painel: redimensionamento com campos, alças, limites e onResize no registro', async ({
  page,
}) => {
  await openPanel(page)
  const panel = (await settings(page)).getByTestId('resize-settings')
  await panel.getByLabel(E.options.resizable).check()
  await panel.getByLabel(E.options.sizeControls).check()
  await panel.getByLabel(E.handleNames.nw, { exact: true }).check()
  await panel.getByLabel(E.limitNames.maxWidth).fill('800')
  const editor = page.locator('.ve-root').first()
  await expect(editor.locator('.ve-frame-handle-nw')).toHaveCount(1)
  const width = editor.locator('.ve-size-controls').getByLabel('Width')
  await width.fill('700')
  await width.press('Enter')
  await expect(page.getByTestId('events')).toContainText('onResize end (700×')
  await expect(page.getByTestId('jsx')).toContainText(
    'resizable={{handles: ["e","s","se","nw"],maxWidth: 800}}',
  )
  await expect(page.getByTestId('jsx')).toContainText('sizeControls={true}')
  // Acima do limite configurado: fica no máximo
  await width.fill('950')
  await width.press('Enter')
  await expect(width).toHaveValue('800')
})

test('painel: Layout Mirror acompanha a largura escolhida pelos campos', async ({ page }) => {
  await openPanel(page)
  const s = await settings(page)
  await s.getByLabel(E.options.layoutMirror, { exact: true }).check()
  const panel = s.getByTestId('resize-settings')
  await panel.getByLabel(E.options.resizable).check()
  await panel.getByLabel(E.options.sizeControls).check()
  const width = page.locator('.ve-root').first().locator('.ve-size-controls').getByLabel('Width')
  await width.fill('700')
  await width.press('Enter')
  // Largura útil da área: 700 − moldura (2 × 1) − 32 de espaço interno
  await expect
    .poll(() =>
      page.getByTestId('published-mirror').evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBe(666)
})

// Engrenagem do playground: as configurações gerais ficam só nela (sem duplicação
// em Ver HTML) e o JSX equivalente acompanha na hora
test('configurações gerais na engrenagem, sem duplicação; JSX acompanha', async ({ page }) => {
  await openPanel(page)
  const tools = page.getByTestId('props-panel')
  for (const label of [
    E.groups.insert,
    E.options.layoutMirror,
    E.options.resizable,
    E.options.pasteSpacing,
  ]) {
    await expect(tools.getByLabel(label, { exact: true })).toHaveCount(0)
  }
  await expect(tools.getByRole('button', { name: 'Reset' })).toHaveCount(0)
  // Ferramentas que ficam em Ver HTML
  await expect(tools.getByRole('button', { name: 'Load: Table' })).toBeVisible()
  await expect(tools.getByLabel('onError (log instead of alert)')).toBeVisible()
  // pasteSpacing na engrenagem: Manter por padrão; o JSX muda sem fechar o painel
  const s = await settings(page)
  const spacing = s.getByLabel(E.options.pasteSpacing)
  await expect(spacing).toHaveValue('preserve')
  await expect(page.getByTestId('jsx')).toContainText('pasteSpacing="preserve"')
  await spacing.selectOption('remove')
  await expect(page.getByTestId('jsx')).not.toContainText('pasteSpacing')
  await spacing.selectOption('preserve')
  await expect(page.getByTestId('jsx')).toContainText('pasteSpacing="preserve"')
  await expect(s).toBeVisible()
  // Todos os grupos desligados: a barra continua com a engrenagem, para religar
  for (const g of [
    'file',
    'history',
    'font',
    'block',
    'format',
    'highlight',
    'color',
    'align',
    'list',
    'indent',
    'link',
    'insert',
    'textbox',
    'clear',
  ] as const) {
    await s.getByLabel(E.groups[g], { exact: true }).uncheck()
  }
  // Botões de arquivo só em Funções do Menu (Arquivo), sem repetição em Comportamento
  await expect(s.getByLabel(E.groups.file, { exact: true })).toHaveCount(1)
  await expect(s.getByText('File buttons')).toHaveCount(0)
  // Funções do Menu: uma coluna, na ordem dos botões da barra
  const groups = s.getByTestId('toolbar-groups').locator('label')
  const boxes = await groups.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left), y: r.top, id: el.getAttribute('title') }
    }),
  )
  expect(boxes.map((b) => b.id)).toEqual(TOOLBAR_GROUPS.filter((g) => g !== 'dictation'))
  expect(new Set(boxes.map((b) => b.x)).size).toBe(1)
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y)
  const toolbar = page.getByRole('toolbar').first()
  // Na barra, só a engrenagem (o painel aberto fica dentro dela)
  await expect(toolbar.locator(':scope > *')).toHaveCount(1)
  await expect(toolbar.locator(':scope > .ve-settings-wrap')).toHaveCount(1)
  await s.getByLabel(E.groups.format, { exact: true }).check()
  await expect(toolbar.getByRole('button', { name: /^Bold/ })).toBeVisible()
})

// Margem dos objetos (prop objectMargin) em Aparência: padrão da biblioteca, só os
// lados mudados no JSX, editor e prévia publicada (Layout Mirror) com a mesma margem
test('Aparência: margem dos objetos por lado, no editor, no JSX e no publicado', async ({
  page,
}) => {
  await openPanel(page)
  await page.getByRole('button', { name: 'Load: Image' }).click()
  const s = await settings(page)
  const fields = s.getByTestId('object-margin')
  const field = (side: keyof typeof E.marginNames) =>
    fields.getByLabel(E.marginNames[side], { exact: true })
  for (const [side, value] of [
    ['text', '16'],
    ['outer', '0'],
    ['top', '4'],
    ['bottom', '12'],
  ] as const) {
    await expect(field(side)).toHaveValue(value)
  }
  await expect(page.getByTestId('jsx')).not.toContainText('objectMargin')
  await field('text').fill('30')
  await field('outer').fill('6')
  await expect(page.getByTestId('jsx')).toContainText('objectMargin={{text: 30,outer: 6}}')
  const marginOf = (root: string) =>
    page.evaluate((sel) => {
      const cs = getComputedStyle(document.querySelector(`${sel} img.pos-right`)!)
      return [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft]
    }, root)
  // Imagem à direita: topo | fora | baixo | texto
  expect(await marginOf('.ve-root')).toEqual(['4px', '6px', '12px', '30px'])
  await s.getByLabel(E.options.layoutMirror, { exact: true }).check()
  await expect(page.getByTestId('published-mirror')).toBeVisible()
  expect(await marginOf('[data-testid="published-mirror"]')).toEqual(['4px', '6px', '12px', '30px'])
  // Restaurar: volta ao padrão e some do JSX
  await s.getByRole('button', { name: 'Reset' }).click()
  await expect(field('text')).toHaveValue('16')
  await expect(page.getByTestId('jsx')).not.toContainText('objectMargin')
})
