// Composição de caracteres (IME: japonês, chinês, coreano; acentos compostos):
// a composição inteira é um passo de desfazer/refazer, sem estados intermediários.
//
// Real × sintético:
// - REAL (só Chromium): o protocolo de depuração (CDP Input.imeSetComposition /
//   insertText) faz o próprio navegador compor, com eventos isTrusted;
// - SINTÉTICO (três motores): CompositionEvent e InputEvent montados pelo teste, com
//   o texto mudado pelo teste, na ordem da especificação (inclusive a do Safari, que
//   insere o texto final depois do compositionend). Prova o tratamento no editor, não
//   o comportamento do teclado de composição.
// Teclados IME reais (sistema operacional) dependem de verificação manual:
// docs/undo-redo-homologacao.md.
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

const settle = (page: Page) => page.waitForTimeout(500)
const text = (page: Page, host = '#host') =>
  page.locator(`${host} .ve-content`).evaluate((el) => el.textContent ?? '')
const caretAtEnd = (page: Page, host = '#host') =>
  page.evaluate((host) => {
    const ed = document.querySelector<HTMLElement>(`${host} .ve-content`)!
    const node = ed.querySelector('p')!.firstChild!
    ed.focus()
    getSelection()!.setBaseAndExtent(node, node.textContent!.length, node, node.textContent!.length)
  }, host)
// Estados vistos desfazendo até não mudar mais (e o refazer de volta)
async function undoAll(page: Page) {
  const seen = [await text(page)]
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Control+z')
    const now = await text(page)
    if (now === seen.at(-1)) break
    seen.push(now)
  }
  return seen
}

test.describe('composição real (Chromium, CDP)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP só no Chromium')

  const compose = async (page: Page, updates: string[], final: string | null, pause = 0) => {
    const cdp = await page.context().newCDPSession(page)
    for (const t of updates) {
      await cdp.send('Input.imeSetComposition', {
        text: t,
        selectionStart: t.length,
        selectionEnd: t.length,
      })
      if (pause) await page.waitForTimeout(pause)
    }
    if (final !== null) await cdp.send('Input.insertText', { text: final })
    return cdp
  }

  test('pausas longas na composição: um passo só, sem estados intermediários', async ({ page }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await compose(page, ['n', 'ni', 'nih', 'niho', 'nihon'], '日本', 600)
    await settle(page)
    expect(await undoAll(page)).toEqual(['um日本', 'um'])
    await page.keyboard.press('Control+y')
    expect(await text(page)).toBe('um日本')
  })

  test('digitação e depois composição: dois passos, cada um inteiro', async ({ page }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await page.keyboard.type(' a')
    await compose(page, ['k', 'ka'], 'か', 450)
    await settle(page)
    expect(await undoAll(page)).toEqual(['um aか', 'um a', 'um'])
  })

  test('composição cancelada: conteúdo e seleção como antes, sem passo novo', async ({ page }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await page.keyboard.type('X')
    await settle(page)
    await compose(page, ['k', 'ka', ''], null, 450)
    await settle(page)
    expect(await text(page)).toBe('umX')
    const caret = await page.evaluate(() => getSelection()!.anchorOffset)
    expect(caret).toBe(3)
    // O único passo continua sendo o "X"
    expect(await undoAll(page)).toEqual(['umX', 'um'])
  })

  test('composição interrompida por um clique fora: o texto confirmado é um passo', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await compose(page, ['s', 'sa'], null, 450)
    await page.mouse.click(5, 5)
    await settle(page)
    expect(await text(page)).toBe('umsa')
    await page.locator('#host .ve-content').focus()
    expect(await undoAll(page)).toEqual(['umsa', 'um'])
  })

  test('composição em outro editor ou num campo externo não mexe neste histórico', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' }, { secondEditor: '<p>dois</p>' })
    await settle(page)
    await caretAtEnd(page)
    await page.keyboard.type('A')
    await settle(page)
    await caretAtEnd(page, '#host2')
    await compose(page, ['b', 'bo'], 'ぼ', 450)
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('afterbegin', '<input id="campo">')
      document.getElementById('campo')!.focus()
    })
    await compose(page, ['c'], 'ち', 0)
    await settle(page)
    expect(await page.locator('#campo').inputValue()).toBe('ち')
    expect(await text(page, '#host2')).toBe('doisぼ')
    await caretAtEnd(page)
    expect(await undoAll(page)).toEqual(['umA', 'um'])
    expect(await text(page, '#host2')).toBe('doisぼ')
  })
})

test.describe('composição sintética (três motores, ordem da especificação)', () => {
  // Simula o navegador: eventos montados pelo teste e o texto mudado à mão
  const step = (page: Page, type: string, data: string, mutate: boolean, inputType?: string) =>
    page.evaluate(
      ([type, data, mutate, inputType]) => {
        const ed = document.querySelector<HTMLElement>('#host .ve-content')!
        const node = ed.querySelector('p')!.firstChild as Text
        const w = window as unknown as { __base: string }
        if (type === 'compositionstart') w.__base = node.data
        if (type.startsWith('composition')) {
          ed.dispatchEvent(new CompositionEvent(type, { data: data as string, bubbles: true }))
          return
        }
        const composing = type !== 'final'
        const init = { inputType, data, isComposing: composing, bubbles: true }
        ed.dispatchEvent(new InputEvent('beforeinput', { ...init, cancelable: !composing }))
        if (mutate) {
          node.data = w.__base + data
          const end = node.data.length
          getSelection()!.setBaseAndExtent(node, end, node, end)
        }
        ed.dispatchEvent(new InputEvent('input', init))
      },
      [type, data, mutate, inputType] as const,
    )

  test('Safari: texto final depois do compositionend, com pausas: um passo só', async ({
    page,
    browserName,
  }) => {
    // O construtor InputEvent do Chromium troca deleteCompositionText e
    // insertFromComposition (tipos que o Chrome não emite) por inputType vazio
    test.skip(browserName === 'chromium', 'Chromium não constrói esses inputType')
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await step(page, 'compositionstart', '', false)
    for (const t of ['n', 'ni', 'nih']) {
      await step(page, 'update', t, true, 'insertCompositionText')
      await page.waitForTimeout(500)
    }
    await step(page, 'compositionend', 'にほ', false)
    await step(page, 'final', '', true, 'deleteCompositionText')
    await step(page, 'final', 'にほ', true, 'insertFromComposition')
    await settle(page)
    expect(await undoAll(page)).toEqual(['umにほ', 'um'])
  })

  test('Chromium/Firefox: texto final antes do compositionend, com pausas: um passo só', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await step(page, 'compositionstart', '', false)
    for (const t of ['a', 'á']) {
      await step(page, 'update', t, true, 'insertCompositionText')
      await page.waitForTimeout(500)
    }
    await step(page, 'compositionend', 'á', false)
    await settle(page)
    expect(await undoAll(page)).toEqual(['umá', 'um'])
  })
})
