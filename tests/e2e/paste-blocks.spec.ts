// Colagem de blocos HTML (parágrafos, títulos, listas, tabelas…) dentro de um
// parágrafo e em outros contextos: HTML válido, formatação mantida, cursor no fim
// do que foi colado, desfazer/refazer e exportar → reimportar sem mudar a estrutura.
// O Firefox descarta os dados de um ClipboardEvent criado por script: nele, o
// tratador de colagem do núcleo recebe um evento simulado com os mesmos dados
// (o caminho do editor é o mesmo; só a origem dos dados muda).
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

async function caretIn(page: Page, text: string, offset: number) {
  await page.evaluate(
    ([t, o]) => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const i = node.data.indexOf(t)
        if (i < 0) continue
        ed.focus()
        const range = document.createRange()
        range.setStart(node, i + o)
        range.collapse(true)
        getSelection()!.removeAllRanges()
        getSelection()!.addRange(range)
        return
      }
      throw new Error(`texto não encontrado: ${t}`)
    },
    [text, offset] as const,
  )
}

const paste = (page: Page, html: string) =>
  page.evaluate((html) => {
    const text = html.replace(/<[^>]+>/g, ' ')
    const data = new DataTransfer()
    data.setData('text/html', html)
    data.setData('text/plain', text)
    const event = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    })
    const delivered = event.clipboardData?.getData('text/html') === html
    // O evento sempre é disparado (como numa colagem real, as escutas do editor o
    // veem); no Firefox ele chega sem dados e o editor não cola nada com ele
    document.querySelector('#host .ve-content')!.dispatchEvent(event)
    if (delivered) return
    // Firefox: os dados não chegam ao evento sintético
    const simulated = {
      clipboardData: { getData: (type: string) => (type === 'text/html' ? html : text) },
      preventDefault: () => {},
    }
    const core = window.__ref.current!.core as unknown as { handlePaste(e: unknown): void }
    core.handlePaste(simulated)
  }, html)

// Blocos dentro de blocos que só aceitam texto (HTML inválido) e itens fora de lista
const structureErrors = (page: Page) =>
  page.evaluate(() => {
    const ed = document.querySelector('#host .ve-content')!
    const errors: string[] = []
    ed.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach((el) => {
      const inner = el.querySelector(
        'p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, table, blockquote, pre, hr',
      )
      if (inner) errors.push(`${inner.tagName} dentro de ${el.tagName}`)
    })
    ed.querySelectorAll('li').forEach((li) => {
      if (!li.parentElement?.matches('ul, ol')) errors.push(`LI fora de lista`)
    })
    return errors
  })

const dom = (page: Page) => page.locator('#host .ve-content').evaluate((el) => el.innerHTML)

test.describe('colar blocos no meio de um parágrafo', () => {
  for (const [name, html, expected] of [
    ['dois parágrafos', '<p>um</p><p>dois</p>', '<p>ola um</p><p>doisXmundo</p>'],
    ['título e parágrafo', '<h2>T</h2><p>corpo</p>', '<p>ola </p><h2>T</h2><p>corpoXmundo</p>'],
    ['parágrafo e título', '<p>um</p><h2>T</h2>', '<p>ola um</p><h2>TX</h2><p>mundo</p>'],
    [
      'lista',
      '<ul><li>a</li><li>b</li></ul>',
      '<p>ola </p><ul><li>a</li><li>bX</li></ul><p>mundo</p>',
    ],
    [
      'tabela',
      '<table><tbody><tr><td>c</td></tr></tbody></table>',
      '<p>ola </p><table><tbody><tr><td>cX</td></tr></tbody></table><p>mundo</p>',
    ],
    ['parágrafo e texto solto', '<p>um</p>solto', '<p>ola um</p><p>soltoXmundo</p>'],
    [
      'formatação dentro dos blocos',
      '<p><b>um</b></p><p><a href="https://a.com">dois</a></p>',
      '<p>ola <b>um</b></p><p><a href="https://a.com">dois</a>Xmundo</p>',
    ],
  ] as const) {
    test(`${name}: HTML válido e cursor no fim do colado`, async ({ page }) => {
      await mount(page, { initialContent: '<p>ola mundo</p>' })
      await caretIn(page, 'ola mundo', 4)
      await paste(page, html)
      await page.keyboard.type('X')
      expect(await structureErrors(page)).toEqual([])
      expect(await dom(page)).toBe(expected)
    })
  }
})

test.describe('colar blocos no início e no fim do parágrafo', () => {
  test('no início: sem parágrafo vazio antes', async ({ page }) => {
    await mount(page, { initialContent: '<p>mundo</p>' })
    await caretIn(page, 'mundo', 0)
    await paste(page, '<h2>T</h2><p>corpo</p>')
    await page.keyboard.type('X')
    expect(await structureErrors(page)).toEqual([])
    expect(await dom(page)).toBe('<h2>T</h2><p>corpoXmundo</p>')
  })

  test('no fim: sem parágrafo vazio depois', async ({ page }) => {
    await mount(page, { initialContent: '<p>ola</p>' })
    await caretIn(page, 'ola', 3)
    await paste(page, '<p>um</p><h2>T</h2>')
    await page.keyboard.type('X')
    expect(await structureErrors(page)).toEqual([])
    expect(await dom(page)).toBe('<p>olaum</p><h2>TX</h2>')
  })
})

test.describe('colar blocos em outros contextos', () => {
  test('cursor dentro de negrito: o negrito é dividido junto', async ({ page }) => {
    await mount(page, { initialContent: '<p>a<b>bcde</b>f</p>' })
    await caretIn(page, 'bcde', 2)
    await paste(page, '<h2>T</h2>')
    await page.keyboard.type('X')
    expect(await structureErrors(page)).toEqual([])
    expect(await dom(page)).toBe('<p>a<b>bc</b></p><h2>TX</h2><p><b>de</b>f</p>')
  })

  test('dentro de um título: o título é dividido e os parágrafos das pontas entram nele', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<h2>ola mundo</h2>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<p>um</p><p>dois</p>')
    await page.keyboard.type('X')
    expect(await structureErrors(page)).toEqual([])
    expect(await dom(page)).toBe('<h2>ola um</h2><h2>doisXmundo</h2>')
  })

  test('dentro de um item de lista: o item é dividido e os parágrafos viram itens', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<ul><li>ola mundo</li></ul>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<p>um</p><p>meio</p><p>dois</p>')
    await page.keyboard.type('X')
    expect(await structureErrors(page)).toEqual([])
    expect(await dom(page)).toBe('<ul><li>ola um</li><li>meio</li><li>doisXmundo</li></ul>')
  })

  test('dentro de uma célula de tabela: os blocos entram na célula', async ({ page }) => {
    await mount(page, {
      initialContent: '<table><tbody><tr><td>ola mundo</td></tr></tbody></table>',
    })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<h2>T</h2><p>corpo</p>')
    await page.keyboard.type('X')
    expect(await structureErrors(page)).toEqual([])
    await expect(page.locator('#host .ve-content td')).toHaveCount(1)
    expect(await page.locator('#host .ve-content td').evaluate((el) => el.innerHTML)).toBe(
      'ola <h2>T</h2><p>corpoX</p>mundo',
    )
  })

  test('dentro de um bloco de código: entra só o texto', async ({ page }) => {
    await mount(page, { initialContent: '<pre>ola mundo</pre>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<h2>T</h2><p>corpo</p>')
    await page.keyboard.type('X')
    expect(await dom(page)).toBe('<pre>ola T\ncorpoXmundo</pre>')
  })

  test('imagem dentro de um parágrafo colado é mantida', async ({ page }) => {
    await mount(page, { initialContent: '<p>ola mundo</p>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(
      page,
      '<p>um</p><p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC" alt="x">fim</p>',
    )
    expect(await structureErrors(page)).toEqual([])
    await expect(page.locator('#host .ve-content img')).toHaveCount(1)
  })

  test('colagem só de texto (sem blocos) continua como antes', async ({ page }) => {
    await mount(page, { initialContent: '<p>ola mundo</p>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<b>forte</b> ')
    await page.keyboard.type('X')
    // Caminho de colagem inline sem mudança (o espaço vira &nbsp; ao digitar logo
    // depois, como já acontecia)
    expect(await dom(page)).toMatch(/^<p>ola <b>forte<\/b>(&nbsp;| )Xmundo<\/p>$/)
  })
})

test.describe('colar blocos: histórico e reimportação', () => {
  test('desfazer volta ao parágrafo original com o cursor no ponto; refazer cola de novo', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>ola mundo</p>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<h2>T</h2><p>corpo</p>')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe('<p>ola mundo</p>')
    await page.keyboard.press('Control+y')
    expect(await dom(page)).toBe('<p>ola </p><h2>T</h2><p>corpomundo</p>')
    await page.keyboard.press('Control+z')
    await page.keyboard.type('X')
    expect(await dom(page)).toBe('<p>ola Xmundo</p>')
  })

  test('exportar, sanitizar e reimportar não muda a estrutura', async ({ page }) => {
    await mount(page, { initialContent: '<p>ola mundo</p>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(
      page,
      '<p><b>um</b></p><ul><li>a</li></ul><table><tbody><tr><td>c</td></tr></tbody></table><p>dois</p>',
    )
    const exported = await page.evaluate(() => window.__ref.current!.getHTML())
    const reimported = await page.evaluate((html) => {
      const ref = window.__ref.current!
      ref.setHTML(html)
      return ref.getHTML()
    }, exported)
    expect(reimported).toBe(exported)
    expect(await structureErrors(page)).toEqual([])
  })
})
