// Ditado (fala → texto) com reconhecimento de voz falso: sem microfone no teste,
// os resultados são simulados por window.__speech (playground/harness.tsx).
import { expect, test } from '@playwright/test'
import { mount } from './helpers'

test('botão some sem suporte do navegador ou com showDictation=false', async ({ page }) => {
  let t = await mount(page, {}, { speech: 'none' })
  await expect(t.btn('Dictate (speech to text)')).toHaveCount(0)
  t = await mount(page, { showDictation: false }, { speech: 'fake' })
  await expect(t.btn('Dictate (speech to text)')).toHaveCount(0)
})

test('pt-BR: comandos de voz, maiúscula e espaço; provisório só no balão', async ({ page }) => {
  const t = await mount(
    page,
    { locale: 'pt-BR', initialContent: '<p>Texto</p>' },
    { speech: 'fake' },
  )
  await t.caretToEnd()
  const mic = t.btn('Ditar (fala para texto)')
  await mic.click()
  const stop = t.btn('Parar o ditado')
  await expect(stop).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#host .ve-dictation-bubble')).toHaveText('Ouvindo…')
  expect(await page.evaluate(() => window.__speech.lang)).toBe('pt-BR')

  // Provisório: aparece no balão e não entra no conteúdo
  await page.evaluate(() => window.__speech.say([['olá vírgula tudo', false]]))
  await expect(page.locator('#host .ve-dictation-bubble')).toHaveText('olá vírgula tudo')
  expect(await t.dom()).toBe('<p>Texto</p>')

  // Confirmado: entra no cursor com pontuação, espaço e maiúscula
  await page.evaluate(() => window.__speech.say([['olá vírgula tudo bem ponto final', true]]))
  await expect.poll(t.html).toBe('<p>Texto olá, tudo bem.</p>')
  await page.evaluate(() => window.__speech.say([[' e você ponto de interrogação', true]]))
  await expect.poll(t.html).toBe('<p>Texto olá, tudo bem. E você?</p>')
  await page.evaluate(() => window.__speech.say([['nova linha segunda linha', true]]))
  await expect.poll(t.html).toBe('<p>Texto olá, tudo bem. E você?<br>Segunda linha</p>')

  // Desligar
  await stop.click()
  await expect(mic).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#host .ve-dictation-bubble')).toHaveCount(0)
})

test('en: idioma do reconhecimento e novo parágrafo', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>Start.</p>' }, { speech: 'fake' })
  await t.caretToEnd()
  await t.btn('Dictate (speech to text)').click()
  expect(await page.evaluate(() => window.__speech.lang)).toBe('en-US')
  await page.evaluate(() =>
    window.__speech.say([['hello comma world new paragraph next one', true]]),
  )
  await expect.poll(t.html).toBe('<p>Start. Hello, world</p><p>Next one</p>')
})

test('speechLang troca o idioma do reconhecimento', async ({ page }) => {
  const t = await mount(page, { speechLang: 'es-ES' }, { speech: 'fake' })
  await t.btn('Dictate (speech to text)').click()
  expect(await page.evaluate(() => window.__speech.lang)).toBe('es-ES')
})

test('reinicia depois do silêncio enquanto ligado', async ({ page }) => {
  const t = await mount(page, {}, { speech: 'fake' })
  await t.btn('Dictate (speech to text)').click()
  await page.evaluate(() => window.__speech.end())
  expect(await page.evaluate(() => window.__speech.starts)).toBe(2)
  await expect(t.btn('Stop dictation')).toHaveAttribute('aria-pressed', 'true')
})

test('microfone negado: aviso traduzido e ditado desligado', async ({ page }) => {
  const t = await mount(page, { locale: 'pt-BR' }, { speech: 'fake' })
  await t.btn('Ditar (fala para texto)').click()
  await page.evaluate(() => window.__speech.fail('not-allowed'))
  await expect(page.locator('#host .ve-dictation-bubble[role="alert"]')).toHaveText(
    'O acesso ao microfone foi negado. Libere no navegador para ditar.',
  )
  await expect(t.btn('Ditar (fala para texto)')).toHaveAttribute('aria-pressed', 'false')
})

test('ditado substitui o trecho selecionado e entra no histórico', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>um dois três</p>' }, { speech: 'fake' })
  await page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    const text = ed.querySelector('p')!.firstChild as Text
    const r = document.createRange()
    r.setStart(text, 3)
    r.setEnd(text, 7)
    ed.focus()
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(r)
  })
  await t.btn('Dictate (speech to text)').click()
  await page.evaluate(() => window.__speech.say([['two', true]]))
  await expect.poll(t.html).toBe('<p>um two três</p>')
  await page.waitForTimeout(500)
  await t.btn('Undo (Ctrl+Z)').click()
  await expect.poll(t.html).toBe('<p>um dois três</p>')
})
