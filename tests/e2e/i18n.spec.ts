// Interface nos três idiomas (en, pt-BR, es): os textos da barra, dos menus,
// das dicas, do formulário de link e das mensagens vêm do dicionário do idioma
// escolhido, sem sobras de outro idioma; em espanhol, o ditado e as telas
// estreitas também.
import { expect, test, type Page } from '@playwright/test'
import type { VersaEditLabels, VersaEditLocale } from '../../src'
import { en } from '../../src/core/i18n/en'
import { es } from '../../src/core/i18n/es'
import { ptBR } from '../../src/core/i18n/pt-BR'
import { mount, PNG, pngFile, selectText } from './helpers'

const DICTS: Record<VersaEditLocale, VersaEditLabels> = { en, 'pt-BR': ptBR, es }
const LOCALES = Object.keys(DICTS) as VersaEditLocale[]

const IMG = `<img src="data:image/png;base64,${PNG}" style="width: 120px; height: 120px">`
const TEXTBOX =
  '<div class="rich-textbox" style="width: 160px"><span contenteditable="false" class="textbox-handle">⠿</span>Caja</div>'

// Textos da interface (atributos de acessibilidade e dicas, rótulos, opções e
// botões), fora do conteúdo editado
async function uiTexts(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#host .ve-root')!
    const out = new Set<string>()
    const add = (v: string | null | undefined) => {
      const t = v?.replace(/\s+/g, ' ').trim()
      if (t) out.add(t)
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('.ve-content') && !el.matches('.ve-content')) continue
      for (const a of ['aria-label', 'title', 'placeholder', 'data-placeholder', 'alt'])
        add(el.getAttribute(a))
      if (el.matches('option, button, label, .ve-link-error, .ve-float-toolbar span'))
        add(el.textContent)
    }
    return [...out]
  })
}

// Um texto da interface é de outro idioma quando coincide com um texto daquele
// dicionário que não existe no idioma escolhido (marcadores {..} valem qualquer coisa)
function foreignTexts(texts: string[], locale: VersaEditLocale) {
  const own = new Set(Object.values(DICTS[locale]))
  const patterns = LOCALES.filter((l) => l !== locale)
    .flatMap((l) => Object.values(DICTS[l]))
    .filter((v) => !own.has(v))
    .map((v) => {
      const re = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.+')
      return new RegExp(`^${re}$|^\\W*${re}\\W*$`)
    })
  return texts.filter((t) => patterns.some((p) => p.test(t)))
}

for (const locale of LOCALES) {
  const L = DICTS[locale]

  test.describe(`interface em ${locale}`, () => {
    test('barra, paletas, marcador, menus da imagem e da caixa, e formulário de link', async ({
      page,
    }) => {
      const t = await mount(
        page,
        {
          locale,
          initialContent: `<p>texto de prueba</p><p>${IMG}</p>${TEXTBOX}<p>fin</p>`,
        },
        { speech: 'fake' },
      )
      const seen = new Set(await uiTexts(page))
      const collect = async () => (await uiTexts(page)).forEach((x) => seen.add(x))

      // Paletas de cor e marcador abertos
      for (const name of [L.textColor, L.paperColor, L.highlight]) {
        await t.btn(name).click()
        await collect()
        await page.keyboard.press('Escape')
        await t.btn(name).click()
      }
      // Menu flutuante da imagem e da caixa de texto (selecionadas)
      await page.locator('#host .ve-content img').click()
      await expect(page.locator('#host .ve-float-toolbar')).toBeVisible()
      await collect()
      await page.locator('#host .ve-content .textbox-handle').click()
      await collect()
      // Formulário de link, com o aviso de endereço inválido
      await selectText(page, 'prueba')
      await page.keyboard.press('Control+k')
      const form = page.locator('#host .ve-link-popover')
      await expect(form).toBeVisible()
      await form.getByLabel(L.linkUrlPrompt).fill('javascript:alert(1)')
      await form.getByRole('button', { name: L.linkApply }).click()
      await expect(form.locator('.ve-link-error')).toHaveText(L.linkInvalid)
      await collect()
      await form.getByRole('button', { name: L.linkCancel }).click()

      const texts = [...seen]
      expect(foreignTexts(texts, locale), 'textos de outro idioma').toEqual([])
      // Os textos esperados aparecem
      for (const key of [
        'toolbar',
        'bold',
        'fontFamily',
        'fontSize',
        'textColor',
        'customColor',
        'highlightNone',
        'insertImage',
        'textboxTools',
        'lineDashed',
        'deleteImage',
        'deleteButton',
        'left',
        'resizeFree',
        'deleteTextbox',
        'linkTextPrompt',
        'linkInvalid',
        'clearAllButton',
        'dictate',
      ] as const)
        expect(
          texts.some((x) => x === L[key] || x.endsWith(` ${L[key]}`) || x.startsWith(`${L[key]} `)),
          key,
        ).toBe(true)
      await t.content.evaluate((el) => (el.innerHTML = ''))
      await expect(t.content).toHaveAttribute('data-placeholder', L.placeholder)
    })

    test('mensagens: alerta, confirmação e onError', async ({ page }) => {
      const dialogs: string[] = []
      page.on('dialog', (d) => {
        dialogs.push(`${d.type()}:${d.message()}`)
        void d.accept()
      })
      // Falha no envio da imagem (alert)
      let t = await mount(page, { locale, initialContent: '<p>a</p>' }, { upload: 'fail' })
      await t.content.click()
      let chooser = page.waitForEvent('filechooser')
      await t.btn(L.insertImage).click()
      await (await chooser).setFiles(pngFile())
      await expect.poll(() => dialogs).toEqual([`alert:${L.imageUploadError}`])
      // Abrir arquivo sobre conteúdo existente (confirm)
      chooser = page.waitForEvent('filechooser')
      await t.btn(L.openFile).click()
      await (
        await chooser
      ).setFiles({ name: 'a.html', mimeType: 'text/html', buffer: Buffer.from('<p>b</p>') })
      await expect.poll(() => dialogs).toContain(`confirm:${L.fileReplaceConfirm}`)
      // Tipo de arquivo errado (onError)
      t = await mount(page, { locale }, { captureErrors: true })
      chooser = page.waitForEvent('filechooser')
      await t.btn(L.openFile).click()
      await (
        await chooser
      ).setFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
      await expect
        .poll(async () => (await t.out()).errors.map((e) => e.message))
        .toEqual([L.fileWrongType])
    })

    test('textos inseridos pelo editor e arquivo salvo', async ({ page }) => {
      const t = await mount(page, { locale, initialContent: '<p>a</p>' })
      await t.caretToEnd()
      await t.btn(L.insertTextbox).click()
      // A caixa nova começa vazia: nenhum texto de exemplo, em nenhum idioma
      expect(await t.html()).not.toContain(L.textboxDefault)
      expect(await t.html()).toContain('⠿</span></div>')
      await expect(page.locator('#host .textbox-handle')).toHaveAttribute('title', L.textboxHandle)
      const download = page.waitForEvent('download')
      await t.btn(L.saveFile).click()
      const file = await download
      expect(file.suggestedFilename()).toMatch(new RegExp(`^${L.fileNamePrefix}-.*\\.html$`))
      const saved = await (await file.createReadStream())!.toArray()
      const page_ = Buffer.concat(saved).toString('utf8')
      expect(page_).toContain(`<html lang="${locale}">`)
      expect(page_).toContain(`<title>${L.fileTitle}</title>`)
    })
  })
}

test('es: ditado em espanhol, com pontuação falada', async ({ page }) => {
  const t = await mount(page, { locale: 'es', initialContent: '<p>Texto</p>' }, { speech: 'fake' })
  await t.caretToEnd()
  const mic = t.btn(es.dictate)
  await mic.click()
  await expect(t.btn(es.dictateStop)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#host .ve-dictation-bubble')).toHaveText(es.dictationListening)
  expect(await page.evaluate(() => window.__speech.lang)).toBe('es-ES')
  await page.evaluate(() => window.__speech.say([['hola coma qué tal punto final', true]]))
  await expect.poll(t.html).toBe('<p>Texto hola, qué tal.</p>')
  await page.evaluate(() => window.__speech.say([[' y usted signo de interrogación', true]]))
  await expect.poll(t.html).toBe('<p>Texto hola, qué tal. Y usted?</p>')
  await page.evaluate(() => window.__speech.say([['nueva línea segunda línea', true]]))
  await expect.poll(t.html).toBe('<p>Texto hola, qué tal. Y usted?<br>Segunda línea</p>')
  await t.btn(es.dictateStop).click()
  await expect(mic).toHaveAttribute('aria-pressed', 'false')
})

// Os textos em espanhol são os mais longos: barra e menus continuam cabendo
for (const width of [320, 375]) {
  test.describe(`es em ${width}px`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true })

    test('sem rolagem horizontal; menu da imagem e grupo da caixa dentro da área', async ({
      page,
    }) => {
      await mount(page, {
        locale: 'es',
        width: '100%',
        height: 420,
        initialContent: `<p>Texto antes.</p><p>${IMG}</p><p>Texto después.</p>`,
      })
      const view = page.viewportSize()!.width
      const scroll = () => page.evaluate(() => document.documentElement.scrollWidth)
      expect(await scroll(), 'rolagem horizontal').toBeLessThanOrEqual(view)
      const group = await page.locator('#host .ve-group').boundingBox()
      const bar = await page.locator('#host .ve-toolbar').boundingBox()
      expect(group!.x + group!.width).toBeLessThanOrEqual(bar!.x + bar!.width)
      expect(group!.height, 'grupo da caixa em até duas linhas').toBeLessThan(75)

      await page.locator('#host .ve-content img').tap()
      const menu = page.locator('#host .ve-float-toolbar')
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('button', { name: es.deleteButton })).toBeVisible()
      const m = (await menu.boundingBox())!
      const frame = (await page.locator('#host .ve-frame').boundingBox())!
      expect(m.x).toBeGreaterThanOrEqual(frame.x)
      expect(m.x + m.width).toBeLessThanOrEqual(frame.x + frame.width)
      expect(m.height, 'menu em até duas linhas').toBeLessThan(70)
      expect(await scroll(), 'rolagem horizontal').toBeLessThanOrEqual(view)
    })
  })
}
