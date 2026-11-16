// Atalhos de negrito, itálico e sublinhado (B3 da auditoria da beta.2, 15/11/2026).
// O editor aplica Ctrl+B/I/U (Cmd no Mac) com o mesmo comando dos botões da barra:
// o Firefox não associa esses atalhos à edição (Ctrl+B abre os favoritos) e o
// WebKit no Windows não sublinha com Ctrl+U. Roda igual nos três navegadores.
import { expect, test, type Page } from '@playwright/test'
import { mount, selectText } from './helpers'

const html = (page: Page) => page.evaluate(() => window.__ref.current!.getHTML())
const selected = (page: Page) => page.evaluate(() => getSelection()!.toString())
const changes = (page: Page) => page.evaluate(() => window.__out.changes)

const CASES = [
  { key: 'b', tag: 'b', button: 'Bold (Ctrl+B)' },
  { key: 'i', tag: 'i', button: 'Italic (Ctrl+I)' },
  { key: 'u', tag: 'u', button: 'Underline (Ctrl+U)' },
] as const

for (const { key, tag, button } of CASES) {
  test(`Ctrl+${key.toUpperCase()}: aplica e retira, com a seleção, o histórico e o onChange`, async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>alpha beta</p>' })
    await selectText(page, 'alpha')
    const before = await changes(page)
    await page.keyboard.press(`Control+${key}`)
    expect(await html(page)).toBe(`<p><${tag}>alpha</${tag}> beta</p>`)
    // A seleção continua no mesmo trecho e o foco na área de edição
    expect(await selected(page)).toBe('alpha')
    await expect(page.locator('#host .ve-content')).toBeFocused()
    expect(await changes(page)).toBeGreaterThan(before)
    // De novo: retira a formatação (alterna)
    await page.keyboard.press(`Control+${key}`)
    expect(await html(page)).toBe('<p>alpha beta</p>')
    expect(await selected(page)).toBe('alpha')
    // Desfazer e refazer passam pela formatação feita pelo atalho
    await page.keyboard.press('Control+z')
    expect(await html(page)).toBe(`<p><${tag}>alpha</${tag}> beta</p>`)
    await page.keyboard.press('Control+z')
    expect(await html(page)).toBe('<p>alpha beta</p>')
    await page.keyboard.press('Control+y')
    expect(await html(page)).toBe(`<p><${tag}>alpha</${tag}> beta</p>`)
  })

  test(`Ctrl+${key.toUpperCase()} e o botão da barra dão o mesmo HTML`, async ({ page }) => {
    await mount(page, { initialContent: '<p>alpha beta gamma</p>' })
    await selectText(page, 'beta')
    await page.keyboard.press(`Control+${key}`)
    const byShortcut = await html(page)
    await mount(page, { initialContent: '<p>alpha beta gamma</p>' })
    await selectText(page, 'beta')
    await page.getByRole('toolbar').first().getByRole('button', { name: button }).click()
    expect(await html(page)).toBe(byShortcut)
  })
}

test('cursor sem seleção: Ctrl+B liga o negrito para o que for digitado', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>' })
  await t.caretToEnd()
  await page.keyboard.press('Control+b')
  await page.keyboard.type(' beta')
  expect(await html(page)).toMatch(/^<p>alpha(<b>\s|\s<b>|&nbsp;<b>|<b>&nbsp;)beta<\/b><\/p>$/)
})

test('os três juntos no mesmo trecho', async ({ page }) => {
  await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'alpha')
  for (const key of ['b', 'i', 'u']) await page.keyboard.press(`Control+${key}`)
  const out = await html(page)
  for (const tag of ['b', 'i', 'u']) expect(out).toContain(`<${tag}>`)
  expect(await page.locator('#host .ve-content').innerText()).toBe('alpha beta')
})

test('não interfere: Shift, Alt, composição de teclado (IME) e outras teclas', async ({ page }) => {
  await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'alpha')
  // Eventos sintéticos: o editor não pode reservar a tecla (defaultPrevented falso)
  const prevented = await page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    const send = (init: KeyboardEventInit) => {
      const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
      ed.dispatchEvent(e)
      return e.defaultPrevented
    }
    return {
      ctrlShiftB: send({ key: 'B', code: 'KeyB', ctrlKey: true, shiftKey: true }),
      ctrlAltB: send({ key: 'b', code: 'KeyB', ctrlKey: true, altKey: true }),
      composing: send({ key: 'b', code: 'KeyB', ctrlKey: true, isComposing: true }),
      ctrlN: send({ key: 'n', code: 'KeyN', ctrlKey: true }),
      plainB: send({ key: 'b', code: 'KeyB' }),
      ctrlB: send({ key: 'b', code: 'KeyB', ctrlKey: true }),
    }
  })
  expect(prevented).toEqual({
    ctrlShiftB: false,
    ctrlAltB: false,
    composing: false,
    ctrlN: false,
    plainB: false,
    ctrlB: true,
  })
})

test('teclado não latino: a posição da tecla (KeyB) vale como B', async ({ page }) => {
  await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'alpha')
  // Layout russo: a tecla B produz "и"
  await page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    ed.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'и',
        code: 'KeyB',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  expect(await html(page)).toBe('<p><b>alpha</b> beta</p>')
})

test('foco fora da área de edição (painel de configurações): o atalho não muda o texto', async ({
  page,
}) => {
  await mount(page, { initialContent: '<p>alpha beta</p>' }, { settings: 'node' })
  await selectText(page, 'alpha')
  await page.getByRole('toolbar').first().getByRole('button', { name: 'Settings' }).click()
  const field = page.getByTestId('settings-name')
  await field.click()
  await field.fill('nome')
  for (const key of ['b', 'i', 'u']) await page.keyboard.press(`Control+${key}`)
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('nome')
  expect(await html(page)).toBe('<p>alpha beta</p>')
})

test('sem o grupo "format": nenhum dos três formata (como antes)', async ({ page }) => {
  await mount(page, { initialContent: '<p>alpha beta</p>', toolbar: ['history'] })
  await selectText(page, 'alpha')
  for (const key of ['b', 'i', 'u']) await page.keyboard.press(`Control+${key}`)
  expect(await html(page)).toBe('<p>alpha beta</p>')
})

test.describe('Mac: Cmd formata; Ctrl continua com o sistema', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }),
    )
  })

  test('Cmd+B/I/U usam o comando da barra; Ctrl+B/U não são reservados', async ({ page }) => {
    await mount(page, { initialContent: '<p>alpha beta</p>' })
    await selectText(page, 'alpha')
    const result = await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      const send = (init: KeyboardEventInit) => {
        const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
        ed.dispatchEvent(e)
        return e.defaultPrevented
      }
      const ctrlB = send({ key: 'b', code: 'KeyB', ctrlKey: true })
      const ctrlU = send({ key: 'u', code: 'KeyU', ctrlKey: true })
      const htmlAfterCtrl = window.__ref.current!.getHTML()
      const cmdB = send({ key: 'b', code: 'KeyB', metaKey: true })
      return { ctrlB, ctrlU, htmlAfterCtrl, cmdB, html: window.__ref.current!.getHTML() }
    })
    expect(result).toEqual({
      ctrlB: false,
      ctrlU: false,
      htmlAfterCtrl: '<p>alpha beta</p>',
      cmdB: true,
      html: '<p><b>alpha</b> beta</p>',
    })
  })

  test('dicas dos botões com Cmd no Mac', async ({ page }) => {
    await mount(page, { initialContent: '<p>alpha</p>' })
    const bar = page.getByRole('toolbar').first()
    for (const name of ['Bold (Cmd+B)', 'Italic (Cmd+I)', 'Underline (Cmd+U)']) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await expect(bar.getByRole('button', { name: 'Bold (Ctrl+B)' })).toHaveCount(0)
  })
})

test('dicas dos botões com Ctrl fora do Mac', async ({ page }) => {
  await mount(page, { initialContent: '<p>alpha</p>' })
  const bar = page.getByRole('toolbar').first()
  for (const name of ['Bold (Ctrl+B)', 'Italic (Ctrl+I)', 'Underline (Ctrl+U)']) {
    await expect(bar.getByRole('button', { name, exact: true })).toBeVisible()
  }
})
