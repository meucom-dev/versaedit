// Agrupamento da digitação com a página travada (integração, eventos REAIS do
// navegador). As teclas são enviadas sem esperar cada uma ser tratada, como faz
// uma pessoa: elas ficam na fila enquanto a página está travada. No Chromium, por
// comandos diretos do protocolo de depuração (CDP); no Firefox e no WebKit, por
// pressionamentos em paralelo do Playwright. A lógica temporal em si (relógio e
// temporizadores controlados) está nos testes unitários do histórico.
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
async function undoAll(page: Page) {
  const seen = [await text(page)]
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Control+z')
    const now = await text(page)
    if (now === seen.at(-1)) break
    seen.push(now)
  }
  return seen
}
// Trava a página `ms` milissegundos, começando daqui a `after` ms
const blockSoon = (page: Page, after: number, ms: number) =>
  page.evaluate(
    ([after, ms]) =>
      setTimeout(() => {
        const t = performance.now()
        while (performance.now() - t < ms);
      }, after),
    [after, ms] as const,
  )
// Teclas enviadas sem esperar o tratamento de cada uma (ficam na fila)
async function queuedKeys(page: Page, browserName: string, chars: string) {
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page)
    const sends: Promise<unknown>[] = []
    for (const ch of chars) {
      const code = `Key${ch.toUpperCase()}`
      sends.push(cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, code }))
      sends.push(cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code }))
    }
    await Promise.all(sends)
  } else {
    await Promise.all([...chars].map((ch) => page.keyboard.press(ch)))
  }
}

test.describe('digitação com a página travada (eventos reais)', () => {
  for (const after of [0, 300]) {
    test(`teclas na fila durante um travamento (começa ${after} ms depois): um passo só`, async ({
      page,
      browserName,
    }) => {
      await mount(page, { initialContent: '<p>um</p>' })
      await settle(page)
      await caretAtEnd(page)
      await page.keyboard.type(' ab')
      await blockSoon(page, after, 900)
      await page.waitForTimeout(after + 100)
      await queuedKeys(page, browserName, 'cd')
      await page.waitForTimeout(1500)
      expect(await undoAll(page)).toEqual(['um abcd', 'um'])
    })
  }

  test('intervalos abaixo de 400 ms: um passo; acima: um passo por tecla', async ({ page }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await page.keyboard.type(' ab', { delay: 200 })
    await settle(page)
    expect(await undoAll(page)).toEqual(['um ab', 'um'])
    await caretAtEnd(page)
    await page.keyboard.type('xy', { delay: 700 })
    await settle(page)
    expect(await undoAll(page)).toEqual(['umxy', 'umx', 'um'])
  })

  test('comando da API logo depois de um travamento: passo próprio, separado da digitação', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await page.keyboard.type(' ab')
    // O temporizador da digitação vence durante o travamento; o app chama a API
    // antes de ele conseguir disparar
    await page.evaluate(() => {
      const t = performance.now()
      while (performance.now() - t < 700);
      const core = window.__ref.current!.core as unknown as { formatBlock(tag: string): void }
      core.formatBlock('h2')
    })
    await settle(page)
    const html = () => page.locator('#host .ve-content').evaluate((el) => el.innerHTML)
    expect(await html()).toBe('<h2>um ab</h2>')
    await page.keyboard.press('Control+z')
    expect(await html()).toBe('<p>um ab</p>')
    await page.keyboard.press('Control+z')
    expect(await html()).toBe('<p>um</p>')
  })

  test('desfazer nativo (execCommand) depois de um travamento: volta um passo, sem estado contraditório', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await settle(page)
    await caretAtEnd(page)
    await page.keyboard.type(' ab')
    await page.evaluate(() => {
      const t = performance.now()
      while (performance.now() - t < 700);
      document.execCommand('undo')
    })
    await settle(page)
    expect(await text(page)).toBe('um')
    await page.keyboard.press('Control+z')
    expect(await text(page)).toBe('um')
  })

  test('dois editores: teclas na fila durante um travamento ficam no editor certo, num passo', async ({
    page,
    browserName,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' }, { secondEditor: '<p>dois</p>' })
    await settle(page)
    await caretAtEnd(page)
    await page.keyboard.type('A')
    await settle(page)
    await caretAtEnd(page, '#host2')
    await page.keyboard.type(' x')
    await blockSoon(page, 300, 900)
    await page.waitForTimeout(400)
    await queuedKeys(page, browserName, 'yz')
    await page.waitForTimeout(1500)
    expect(await text(page, '#host2')).toBe('dois xyz')
    await page.keyboard.press('Control+z')
    expect(await text(page, '#host2')).toBe('dois')
    expect(await text(page)).toBe('umA')
  })
})
