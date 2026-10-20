// Cursor e seleção nas operações do editor: o texto digitado depois de cada
// operação entra no ponto esperado. Lote 1: imagem selecionada, Enter dentro da
// caixa de texto e remover link com o cursor dentro dele.
import { expect, test, type Page } from '@playwright/test'
import { mount, PNG, selectText } from './helpers'

const IMG = `<img src="data:image/png;base64,${PNG}" style="width: 60px">`
const TEXTBOX =
  '<div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>Caixa</div>'

// Cursor em `offset` dentro do primeiro nó de texto que contém `text`
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
  await page.waitForTimeout(50)
}

// HTML do editor sem o conteúdo da imagem e sem os atributos de seleção
const clean = async (page: Page) =>
  (await page.locator('#host .ve-content').evaluate((el) => el.innerHTML)).replace(
    /<img [^>]*>/g,
    '<img>',
  )

test.describe('imagem selecionada', () => {
  const CONTENT = `<p>inicio</p><p>a${IMG}b</p><p>fim</p>`

  test('digitar com a imagem selecionada escreve logo depois dela', async ({ page }) => {
    await mount(page, { initialContent: CONTENT })
    await page.locator('#host .ve-content img').click()
    await page.keyboard.type('X')
    expect(await clean(page)).toBe('<p>inicio</p><p>a<img>Xb</p><p>fim</p>')
  })

  test('digitar tira a seleção da imagem: Backspace apaga a letra, não a imagem', async ({
    page,
  }) => {
    await mount(page, { initialContent: CONTENT })
    await page.locator('#host .ve-content img').click()
    await page.keyboard.type('XY')
    await expect(page.locator('#host .ve-float-toolbar')).toHaveCount(0)
    await page.keyboard.press('Backspace')
    expect(await clean(page)).toBe('<p>inicio</p><p>a<img>Xb</p><p>fim</p>')
  })

  for (const key of ['Delete', 'Backspace']) {
    test(`${key} apaga a imagem e o cursor fica no lugar dela`, async ({ page }) => {
      await mount(page, { initialContent: CONTENT })
      await page.locator('#host .ve-content img').click()
      await page.keyboard.press(key)
      await page.keyboard.type('X')
      expect(await clean(page)).toBe('<p>inicio</p><p>aXb</p><p>fim</p>')
    })
  }

  test('excluir pelo menu da imagem deixa o cursor no lugar dela', async ({ page }) => {
    await mount(page, { initialContent: CONTENT })
    await page.locator('#host .ve-content img').click()
    await page.locator('#host .ve-float-toolbar .ve-danger').click()
    await page.keyboard.type('X')
    expect(await clean(page)).toBe('<p>inicio</p><p>aXb</p><p>fim</p>')
  })

  test('depois de mover a imagem (Alt+↓), digitar escreve junto dela no novo lugar', async ({
    page,
  }) => {
    await mount(page, { initialContent: `<p>inicio</p><p>${IMG}</p><p>fim</p>` })
    await page.locator('#host .ve-content img').click()
    await page.keyboard.press('Alt+ArrowDown')
    const moved = await clean(page)
    await page.keyboard.type('X')
    const html = await clean(page)
    expect(html.indexOf('X'), `${moved} → ${html}`).toBe(html.indexOf('<img>') + '<img>'.length)
  })

  test.describe('no celular (toque)', () => {
    test.use({ viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true })
    test.skip(({ browserName }) => browserName === 'firefox', 'isMobile não existe no Firefox')

    test('tocar na imagem e digitar escreve logo depois dela', async ({ page }) => {
      await mount(page, { initialContent: CONTENT, width: '100%' })
      await page.locator('#host .ve-content img').tap()
      await page.keyboard.type('X')
      expect(await clean(page)).toBe('<p>inicio</p><p>a<img>Xb</p><p>fim</p>')
    })
  })
})

test.describe('Enter dentro da caixa de texto', () => {
  const CONTENT = `<p>a</p>${TEXTBOX}<p>b</p>`
  const boxes = (page: Page) => page.locator('#host .rich-textbox')

  test('no fim do texto: quebra a linha dentro da mesma caixa', async ({ page }) => {
    await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'Caixa', 5)
    await page.keyboard.press('Enter')
    await page.keyboard.type('X')
    await expect(boxes(page)).toHaveCount(1)
    await expect(boxes(page).locator('.textbox-handle')).toHaveCount(1)
    expect(await boxes(page).evaluate((el) => el.innerHTML)).toMatch(/Caixa<br>X/)
  })

  test('no meio do texto: divide a linha dentro da mesma caixa', async ({ page }) => {
    await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'Caixa', 3)
    await page.keyboard.press('Enter')
    await page.keyboard.type('X')
    await expect(boxes(page)).toHaveCount(1)
    expect(await boxes(page).evaluate((el) => el.innerHTML)).toMatch(/Cai<br>Xxa/)
  })

  test('Shift+Enter também fica dentro da mesma caixa', async ({ page }) => {
    await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'Caixa', 5)
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type('X')
    await expect(boxes(page)).toHaveCount(1)
    expect(await boxes(page).textContent()).toContain('X')
  })

  test('fora da caixa, Enter continua criando um parágrafo novo', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 1)
    await page.keyboard.press('Enter')
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>a</p><p>Xb</p>')
  })
})

test.describe('remover link', () => {
  const CONTENT = '<p>ir ao <a href="https://a.com">site bom</a> hoje</p>'

  test('com o cursor dentro do link: remove o link inteiro e o cursor fica no lugar', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'site bom', 2)
    await t.btn('Remove link').click()
    expect(await t.dom()).toBe('<p>ir ao site bom hoje</p>')
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>ir ao siXte bom hoje</p>')
  })

  test('com o link selecionado: remove o link (como antes)', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await selectText(page, 'site bom')
    await t.btn('Remove link').click()
    expect(await t.dom()).toBe('<p>ir ao site bom hoje</p>')
  })

  test('com o cursor fora de qualquer link: nada muda e o cursor fica no lugar', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'hoje', 2)
    await t.btn('Remove link').click()
    expect(await t.dom()).toBe(CONTENT)
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>ir ao <a href="https://a.com">site bom</a> hoXje</p>')
  })
})

test.describe('saída do editor pelo teclado (sem armadilha de teclado)', () => {
  const inEditor = (page: Page) =>
    page.evaluate(() => !!document.activeElement?.closest('#host .ve-content'))

  test('Tab continua inserindo espaços (indentação)', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>texto</p>' })
    await caretIn(page, 'texto', 0)
    await page.keyboard.press('Tab')
    expect(await inEditor(page)).toBe(true)
    expect(await t.dom()).toBe('<p>&nbsp;&nbsp;&nbsp;&nbsp;texto</p>')
  })

  test('Shift+Tab sai do editor para a barra, sem mudar o texto', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>texto</p>' })
    await caretIn(page, 'texto', 5)
    await page.keyboard.press('Shift+Tab')
    expect(await inEditor(page)).toBe(false)
    expect(await page.evaluate(() => !!document.activeElement?.closest('#host .ve-toolbar'))).toBe(
      true,
    )
    expect(await t.dom()).toBe('<p>texto</p>')
  })

  test('Esc e depois Tab vão para o próximo elemento da página, sem mudar o texto', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>texto</p>' })
    // Como numa página real, há algo focável depois do editor (sem isso, o Firefox
    // manda o foco para a interface do navegador e o activeElement não muda)
    await page.evaluate(() => {
      const next = document.createElement('button')
      next.id = 'depois-do-editor'
      next.textContent = 'depois'
      document.querySelector('#host')!.after(next)
    })
    await caretIn(page, 'texto', 5)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('depois-do-editor')
    expect(await t.dom()).toBe('<p>texto</p>')
  })

  test('depois de Esc, outra tecla devolve ao Tab a indentação', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>texto</p>' })
    await caretIn(page, 'texto', 5)
    await page.keyboard.press('Escape')
    await page.keyboard.type('X')
    await page.keyboard.press('Tab')
    expect(await inEditor(page)).toBe(true)
    expect(await t.dom()).toBe('<p>textoX&nbsp;&nbsp;&nbsp;&nbsp;</p>')
  })

  test('Tab a partir da barra volta ao editor', async ({ page }) => {
    await mount(page, { initialContent: '<p>texto</p>' })
    await caretIn(page, 'texto', 5)
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    expect(await inEditor(page)).toBe(true)
  })

  // A tecla Shift se chama Mayús nos teclados em espanhol
  for (const [locale, shift] of [
    ['en', /Shift\+Tab/],
    ['pt-BR', /Shift\+Tab/],
    ['es', /Mayús\+Tab/],
  ] as const) {
    test(`${locale}: a área de edição descreve como sair pelo teclado`, async ({ page }) => {
      await mount(page, { locale, initialContent: '<p>texto</p>' })
      const description = await page.locator('#host .ve-content').evaluate((el) => {
        const ids = (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
        return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
      })
      expect(description).toMatch(/Esc.*Tab/)
      expect(description).toMatch(shift)
    })
  }
})
