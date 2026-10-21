// Cursor e seleção nas operações do editor: o texto digitado depois de cada
// operação entra no ponto esperado. Lote 1: imagem selecionada, Enter dentro da
// caixa de texto e remover link com o cursor dentro dele.
import { expect, test, type Page } from '@playwright/test'
import { mount, PNG, pngFile, selectText } from './helpers'

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

test.describe('Backspace logo depois da caixa de texto', () => {
  const CONTENT = `<p>a</p>${TEXTBOX}<p>depois</p>`
  const box = (page: Page) => page.locator('#host .rich-textbox')
  const live = (page: Page) => page.locator('#host [aria-live="polite"].ve-sr-only')

  test('seleciona a caixa, de forma visível, sem apagar nada', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await expect(box(page)).toHaveClass(/\bselected\b/)
    // Contorno de seleção (o CSS anima o contorno em 0,15 s)
    await expect
      .poll(() => box(page).evaluate((el) => getComputedStyle(el).outlineWidth))
      .toBe('3px')
    await expect(page.locator('#host .ve-float-toolbar')).toBeVisible()
    expect(await t.dom()).toBe(
      CONTENT.replace(
        'class="rich-textbox"',
        'class="rich-textbox selected" contenteditable="true"',
      ),
    )
    // O HTML salvo não leva a marca de seleção
    const saved = await page.evaluate(() =>
      (window as unknown as { __ref: { current: { getHTML(): string } } }).__ref.current.getHTML(),
    )
    expect(saved).toBe(CONTENT)
  })

  for (const [locale, text] of [
    ['en', 'Text box selected'],
    ['pt-BR', 'Caixa de texto selecionada'],
    ['es', 'Cuadro de texto seleccionado'],
  ] as const) {
    test(`${locale}: a seleção é anunciada para leitores de tela`, async ({ page }) => {
      await mount(page, { locale, initialContent: CONTENT })
      await caretIn(page, 'depois', 0)
      await page.keyboard.press('Backspace')
      await expect(live(page)).toHaveText(text)
    })
  }

  test('Backspace de novo continua sem apagar a caixa nem juntar o parágrafo', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await expect(box(page)).toHaveCount(1)
    expect(await box(page).textContent()).toBe('⠿Caixa')
    await expect(t.content.locator('p', { hasText: 'depois' })).toHaveText('depois')
  })

  test('digitar depois escreve no parágrafo e tira a seleção da caixa', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await page.keyboard.type('X')
    await expect(box(page)).not.toHaveClass(/\bselected\b/)
    expect(await t.html()).toContain('<p>Xdepois</p>')
  })

  test('Esc tira a seleção da caixa', async ({ page }) => {
    await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Escape')
    await expect(box(page)).not.toHaveClass(/\bselected\b/)
    await expect(page.locator('#host .ve-float-toolbar')).toHaveCount(0)
  })

  test('no meio do parágrafo, Backspace apaga normalmente', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 3)
    await page.keyboard.press('Backspace')
    expect(await t.html()).toContain('<p>deois</p>')
    await expect(box(page)).not.toHaveClass(/\bselected\b/)
  })

  test('depois de um parágrafo comum, Backspace junta os parágrafos como antes', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>um</p><p>dois</p>' })
    await caretIn(page, 'dois', 0)
    await page.keyboard.press('Backspace')
    // Um parágrafo só, com o texto junto (Chromium e WebKit ainda envolvem "dois"
    // num span de font-size ao juntar: comportamento antigo, fora deste lote)
    await expect(t.content.locator('p')).toHaveCount(1)
    await expect(t.content.locator('p')).toHaveText('umdois')
    await expect(t.content.locator('.rich-textbox')).toHaveCount(0)
  })
})

test.describe('desfazer / refazer devolvem a seleção', () => {
  // O histórico agrupa a digitação por ~400 ms
  const settle = (page: Page) => page.waitForTimeout(500)
  const selection = (page: Page) =>
    page.evaluate(() => {
      const s = getSelection()!
      const where = (n: Node | null, o: number) =>
        n?.nodeType === 3 ? `${(n as Text).data}:${o}` : `${n?.nodeName}:${o}`
      return {
        text: s.toString(),
        anchor: where(s.anchorNode, s.anchorOffset),
        focus: where(s.focusNode, s.focusOffset),
      }
    })

  test('desfazer a digitação: o cursor volta ao ponto onde ela começou', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um dois</p><p>tres quatro</p>' })
    await caretIn(page, 'quatro', 6)
    await page.keyboard.type(' cinco')
    await settle(page)
    await page.keyboard.press('Control+z')
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>um dois</p><p>tres quatroX</p>')
  })

  test('refazer: o cursor volta ao fim do trecho refeito', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um dois</p><p>tres</p>' })
    await caretIn(page, 'tres', 4)
    await page.keyboard.type(' quatro')
    await settle(page)
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+y')
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>um dois</p><p>tres quatroX</p>')
  })

  test('texto repetido: volta à ocorrência certa', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>aa aa aa</p>' })
    await caretIn(page, 'aa aa aa', 5)
    await page.keyboard.type('X')
    await settle(page)
    await page.keyboard.press('Control+z')
    await page.keyboard.type('Y')
    expect(await t.dom()).toBe('<p>aa aaY aa</p>')
  })

  test('desfazer e refazer uma formatação mantêm o trecho selecionado', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um dois tres</p>' })
    await selectText(page, 'dois')
    // Botão da barra: no Firefox, o Ctrl+B do Playwright não formata
    await t.btn('Bold (Ctrl+B)').click()
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>um dois tres</p>')
    expect((await selection(page)).text).toBe('dois')
    await page.keyboard.press('Control+y')
    expect(await t.dom()).toBe('<p>um <b>dois</b> tres</p>')
    expect((await selection(page)).text).toBe('dois')
  })

  test('seleção de trás para frente entre vários nós: mesma direção e mesmo trecho', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>um <i>dois</i> tres</p><p>quatro</p>' })
    await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      ed.focus()
      const [a, b] = ed.querySelectorAll('p')
      getSelection()!.setBaseAndExtent(b.firstChild!, 3, a.firstChild!, 1)
    })
    const before = await selection(page)
    // Botão da barra: no Firefox, o Ctrl+B do Playwright não formata
    await t.btn('Bold (Ctrl+B)').click()
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>um <i>dois</i> tres</p><p>quatro</p>')
    const after = await selection(page)
    expect(after).toEqual(before)
    expect(after.anchor).toBe('quatro:3')
  })

  test('desfazer a inserção de imagem: o cursor volta ao ponto da inserção', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 1)
    const chooser = page.waitForEvent('filechooser')
    await t.btn('Insert image').click()
    await (await chooser).setFiles(pngFile())
    await expect(t.content.locator('img')).toHaveCount(1)
    await settle(page)
    await page.keyboard.press('Control+z')
    await expect(t.content.locator('img')).toHaveCount(0)
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>aXb</p>')
  })

  test('desfazer a exclusão da imagem: ela volta e o cursor fica junto dela', async ({ page }) => {
    const t = await mount(page, { initialContent: `<p>a${IMG}b</p>` })
    await t.content.locator('img').click()
    await page.keyboard.press('Delete')
    await settle(page)
    await page.keyboard.press('Control+z')
    await expect(t.content.locator('img')).toHaveCount(1)
    await page.keyboard.type('X')
    expect(await clean(page)).toBe('<p>a<img>Xb</p>')
  })

  test('desfazer a inserção da caixa de texto: o cursor volta ao ponto da inserção', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 1)
    await t.btn('Insert text box').click()
    await settle(page)
    await page.keyboard.press('Control+z')
    await expect(t.content.locator('.rich-textbox')).toHaveCount(0)
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>aXb</p>')
  })

  test('desfazer a colagem: o cursor volta ao ponto onde se colou', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'firefox', 'o Firefox descarta dados de colagem sintética')
    const t = await mount(page, { initialContent: '<p>ola mundo</p>' })
    await caretIn(page, 'ola mundo', 4)
    await page.evaluate(() => {
      const data = new DataTransfer()
      data.setData('text/plain', 'lindo ')
      const event = new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
      document.querySelector('#host .ve-content')!.dispatchEvent(event)
    })
    await settle(page)
    await page.keyboard.press('Control+z')
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>ola Xmundo</p>')
  })

  test('vários desfazer e refazer seguidos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 1)
    await page.keyboard.type('1')
    await settle(page)
    await page.keyboard.type('2')
    await settle(page)
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ab</p>')
    expect((await selection(page)).anchor).toBe('ab:1')
    await page.keyboard.press('Control+y')
    await page.keyboard.press('Control+y')
    expect(await t.dom()).toBe('<p>a12b</p>')
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>a12Xb</p>')
  })

  test('pelo botão da barra, com o foco fora do editor', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um dois</p>' })
    await caretIn(page, 'dois', 4)
    await page.keyboard.type(' tres')
    await settle(page)
    await t.btn('Undo (Ctrl+Z)').click()
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>um doisX</p>')
  })

  test('clicar em outro lugar no meio do grupo não muda o ponto de volta', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>primeiro</p><p>segundo</p>' })
    await caretIn(page, 'segundo', 7)
    await page.keyboard.type('abc')
    // Antes de o grupo fechar, o cursor vai para outro parágrafo
    await caretIn(page, 'primeiro', 0)
    await page.keyboard.press('Control+z')
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>primeiro</p><p>segundoX</p>')
  })
})

test.describe('Delete com a caixa de texto selecionada', () => {
  const CONTENT = `<p>a</p>${TEXTBOX}<p>depois</p>`
  const box = (page: Page) => page.locator('#host .rich-textbox')
  const settle = (page: Page) => page.waitForTimeout(500)

  test('Backspace seleciona e Delete exclui a caixa; o cursor continua no parágrafo', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await expect(box(page)).toHaveClass(/\bselected\b/)
    await page.keyboard.press('Delete')
    await expect(box(page)).toHaveCount(0)
    await expect(page.locator('#host .ve-float-toolbar')).toHaveCount(0)
    await page.keyboard.type('X')
    expect(await t.dom()).toBe('<p>a</p><p>Xdepois</p>')
  })

  test('desfazer devolve a caixa, refazer a exclui de novo', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Delete')
    await settle(page)
    await page.keyboard.press('Control+z')
    await expect(box(page)).toHaveCount(1)
    expect(await box(page).textContent()).toBe('⠿Caixa')
    expect(await t.dom()).toBe(CONTENT)
    await page.keyboard.press('Control+y')
    await expect(box(page)).toHaveCount(0)
    expect(await t.dom()).toBe('<p>a</p><p>depois</p>')
  })

  test('com o cursor dentro da caixa, Delete apaga um caractere, não a caixa', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await box(page).click()
    await caretIn(page, 'Caixa', 0)
    await page.keyboard.press('Delete')
    await expect(box(page)).toHaveCount(1)
    expect(await box(page).textContent()).toBe('⠿aixa')
    expect(await t.html()).toContain('<p>depois</p>')
  })

  test('o segundo Backspace continua sem excluir a caixa', async ({ page }) => {
    await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await expect(box(page)).toHaveCount(1)
    await expect(box(page)).toHaveClass(/\bselected\b/)
  })
})

test.describe('links: criar, editar e remover sem espaços duros nem estilos extras', () => {
  const A = (href: string, text: string) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
  const form = (page: Page) => page.locator('#host .ve-link-popover')

  test('a partir da seleção: só o link muda, e o cursor fica depois dele', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ir ao site agora</p>' })
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await form(page).getByLabel('Link URL:').fill('example.com')
    await form(page).getByLabel('Link URL:').press('Enter')
    expect(await t.dom()).toBe(`<p>ir ao ${A('https://example.com', 'site')} agora</p>`)
    await page.keyboard.type('X')
    expect(await t.dom()).toBe(`<p>ir ao ${A('https://example.com', 'site')}X agora</p>`)
  })

  test('no cursor (sem seleção): o link entra no cursor e o cursor fica depois', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 1)
    await page.keyboard.press('Control+k')
    await form(page).getByLabel('Link URL:').fill('example.com')
    await form(page).getByLabel('Link text:').fill('L')
    await form(page).getByRole('button', { name: 'Apply' }).click()
    expect(await t.dom()).toBe(`<p>a${A('https://example.com', 'L')}b</p>`)
    await page.keyboard.type('X')
    expect(await t.dom()).toBe(`<p>a${A('https://example.com', 'L')}Xb</p>`)
  })

  test('sem texto: o link mostra o endereço', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 2)
    await page.keyboard.press('Control+k')
    await form(page).getByLabel('Link URL:').fill('example.com')
    await form(page).getByLabel('Link URL:').press('Enter')
    expect(await t.dom()).toBe(`<p>ab${A('https://example.com', 'https://example.com')}</p>`)
  })

  test('editar um link existente: um link só, com o endereço novo; o cursor fica depois', async ({
    page,
  }) => {
    const t = await mount(page, {
      initialContent: `<p>ir ao ${A('https://a.com', 'site bom')} hoje</p>`,
    })
    await caretIn(page, 'site bom', 2)
    await page.keyboard.press('Control+k')
    await expect(form(page).getByLabel('Link URL:')).toHaveValue('https://a.com')
    await expect(form(page).getByLabel('Link text:')).toHaveValue('site bom')
    await form(page).getByLabel('Link URL:').fill('https://b.com')
    await form(page).getByLabel('Link URL:').press('Enter')
    expect(await t.dom()).toBe(`<p>ir ao ${A('https://b.com', 'site bom')} hoje</p>`)
    await page.keyboard.type('X')
    expect(await t.dom()).toBe(`<p>ir ao ${A('https://b.com', 'site bom')}X hoje</p>`)
  })

  test('seleção dentro do negrito: o link fica dentro do negrito', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um <b>site bom</b></p>' })
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await form(page).getByLabel('Link URL:').fill('example.com')
    await form(page).getByLabel('Link URL:').press('Enter')
    expect(await t.dom()).toBe(`<p>um <b>${A('https://example.com', 'site')} bom</b></p>`)
  })

  test('seleção entre parágrafos: cria um link só, como antes', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um dois</p><p>tres quatro</p>' })
    await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      ed.focus()
      const [a, b] = ed.querySelectorAll('p')
      getSelection()!.setBaseAndExtent(a.firstChild!, 3, b.firstChild!, 4)
    })
    await page.keyboard.press('Control+k')
    await form(page).getByLabel('Link URL:').fill('example.com')
    await form(page).getByLabel('Link URL:').press('Enter')
    await expect(t.content.locator('a')).toHaveCount(1)
  })

  test('desfazer a criação do link devolve o texto e a seleção', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ir ao site agora</p>' })
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await form(page).getByLabel('Link URL:').fill('example.com')
    await form(page).getByLabel('Link URL:').press('Enter')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ir ao site agora</p>')
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('site')
  })

  test('remover o link criado (cursor dentro) devolve o texto original', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ir ao site agora</p>' })
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await form(page).getByLabel('Link URL:').fill('example.com')
    await form(page).getByLabel('Link URL:').press('Enter')
    await caretIn(page, 'site', 2)
    await t.btn('Remove link').click()
    expect(await t.dom()).toBe('<p>ir ao site agora</p>')
  })
})

test.describe('junção de blocos sem estilos artificiais (Backspace/Delete)', () => {
  // Sem span de estilo criado pelo navegador; a formatação do usuário fica
  const noStyleSpan = (html: string) => !/<span style="[^"]*">/.test(html)

  for (const [name, html, at, offset, key] of [
    ['Backspace entre parágrafos', '<p>um</p><p>dois</p>', 'dois', 0, 'Backspace'],
    ['Delete entre parágrafos', '<p>um</p><p>dois</p>', 'um', 2, 'Delete'],
  ] as const) {
    test(`${name}: junta sem span e o cursor fica na junção`, async ({ page }) => {
      const t = await mount(page, { initialContent: html })
      await caretIn(page, at, offset)
      await page.keyboard.press(key)
      expect(await t.dom()).toBe('<p>umdois</p>')
      await page.keyboard.type('X')
      expect(await t.dom()).toBe('<p>umXdois</p>')
    })
  }

  test('Backspace de um parágrafo para um título: o texto entra no título, sem estilo sem efeito', async ({
    page,
    browserName,
  }) => {
    const t = await mount(page, { initialContent: '<h2>titulo</h2><p>dois</p>' })
    await caretIn(page, 'dois', 0)
    await page.keyboard.press('Backspace')
    // O Firefox deixa o texto com o tamanho do título. O Chromium e o WebKit
    // mantêm o tamanho de parágrafo no texto movido (font-size com efeito, que
    // fica); o caret-color, sem efeito, sai.
    expect(await t.dom()).toBe(
      browserName === 'firefox'
        ? '<h2>titulodois</h2>'
        : '<h2>titulo<span style="font-size: 12pt;">dois</span></h2>',
    )
  })

  test('Backspace entre itens de lista: um item só, sem span', async ({ page }) => {
    const t = await mount(page, { initialContent: '<ul><li>um</li><li>dois</li></ul>' })
    await caretIn(page, 'dois', 0)
    await page.keyboard.press('Backspace')
    const html = await t.dom()
    expect(noStyleSpan(html), html).toBe(true)
    await expect(t.content.locator('li')).toHaveCount(1)
    await expect(t.content.locator('li')).toHaveText('umdois')
  })

  for (const [name, second, expected] of [
    ['negrito', '<p><b>dois</b></p>', '<p>um<b>dois</b></p>'],
    [
      'cor própria',
      '<p><span style="color: rgb(200, 0, 0);">dois</span></p>',
      '<p>um<span style="color: rgb(200, 0, 0);">dois</span></p>',
    ],
    [
      'tamanho igual ao herdado, escolhido pelo usuário',
      '<p><span style="font-size: 12pt;">dois</span></p>',
      '<p>um<span style="font-size: 12pt;">dois</span></p>',
    ],
  ] as const) {
    test(`formatação do usuário (${name}) é mantida`, async ({ page }) => {
      const t = await mount(page, { initialContent: `<p>um</p>${second}` })
      await caretIn(page, 'dois', 0)
      await page.keyboard.press('Backspace')
      expect(await t.dom()).toBe(expected)
    })
  }

  test('Backspace no meio do parágrafo apaga um caractere, como sempre', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um</p><p>dois</p>' })
    await caretIn(page, 'dois', 2)
    await page.keyboard.press('Backspace')
    expect(await t.dom()).toBe('<p>um</p><p>dis</p>')
  })

  test('desfazer a junção volta os dois parágrafos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um</p><p>dois</p>' })
    await caretIn(page, 'dois', 0)
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>um</p><p>dois</p>')
  })
})
test.describe('Delete logo antes da caixa de texto', () => {
  const CONTENT = `<p>antes</p>${TEXTBOX}<p>depois</p>`
  const box = (page: Page) => page.locator('#host .rich-textbox')

  test('seleciona a caixa, sem juntar nem mudar a estrutura', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'antes', 5)
    await page.keyboard.press('Delete')
    await expect(box(page)).toHaveClass(/\bselected\b/)
    await expect(box(page)).toHaveCount(1)
    expect(await box(page).textContent()).toBe('⠿Caixa')
    await expect(t.content.locator('p')).toHaveText(['antes', 'depois'])
  })

  test('Delete de novo exclui a caixa (como depois do Backspace); desfazer a devolve', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'antes', 5)
    await page.keyboard.press('Delete')
    await page.keyboard.press('Delete')
    await expect(box(page)).toHaveCount(0)
    expect(await t.dom()).toBe('<p>antes</p><p>depois</p>')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+z')
    await expect(box(page)).toHaveCount(1)
  })

  test('Delete no meio do parágrafo apaga um caractere, como sempre', async ({ page }) => {
    const t = await mount(page, { initialContent: CONTENT })
    await caretIn(page, 'antes', 2)
    await page.keyboard.press('Delete')
    await expect(t.content.locator('p').first()).toHaveText('anes')
    await expect(box(page)).not.toHaveClass(/\bselected\b/)
  })
})

test.describe('desfazer / refazer: o cursor fica visível, com o menor deslocamento', () => {
  const PARAS = Array.from({ length: 60 }, (_, i) => `<p>Parágrafo ${i + 1}.</p>`).join('')
  const settle = (page: Page) => page.waitForTimeout(500)
  // Posição do cursor em relação a uma caixa (a área de edição ou outro contêiner)
  const caretInside = (page: Page, selector: string | null) =>
    page.evaluate((sel) => {
      const range = getSelection()!.getRangeAt(0)
      const rect =
        range.getClientRects()[0] ?? range.startContainer.parentElement!.getBoundingClientRect()
      const box = sel
        ? document.querySelector(sel)!.getBoundingClientRect()
        : { top: 0, bottom: window.visualViewport?.height ?? innerHeight }
      return rect.top >= box.top && rect.bottom <= box.bottom
    }, selector)
  const scrolls = (page: Page) =>
    page.evaluate(() => ({
      area: document.querySelector('#host .ve-content')!.scrollTop,
      page: Math.round(window.scrollY),
    }))

  test('área com rolagem: depois de desfazer longe dali, o cursor volta à vista', async ({
    page,
  }) => {
    await mount(page, { initialContent: PARAS, height: 300 })
    await caretIn(page, 'Parágrafo 2.', 11)
    await page.keyboard.type(' novo')
    await settle(page)
    await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      ed.scrollTop = ed.scrollHeight
    })
    const pageBefore = (await scrolls(page)).page
    await page.keyboard.press('Control+z')
    expect(await caretInside(page, '#host .ve-content')).toBe(true)
    // Só a área rolou; a página não saltou
    expect((await scrolls(page)).page).toBe(pageBefore)
    // Menor deslocamento: o parágrafo editado fica perto da borda de cima, não no meio
    const offset = await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      const p = ed.querySelectorAll('p')[1].getBoundingClientRect()
      return Math.round(p.top - ed.getBoundingClientRect().top)
    })
    expect(offset).toBeLessThan(40)
  })

  test('refazer também traz o cursor à vista', async ({ page }) => {
    await mount(page, { initialContent: PARAS, height: 300 })
    await caretIn(page, 'Parágrafo 2.', 11)
    await page.keyboard.type(' novo')
    await settle(page)
    await page.keyboard.press('Control+z')
    await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      ed.scrollTop = ed.scrollHeight
    })
    await page.keyboard.press('Control+y')
    expect(await caretInside(page, '#host .ve-content')).toBe(true)
  })

  test('com o cursor já visível, nada rola', async ({ page }) => {
    await mount(page, { initialContent: PARAS, height: 300 })
    await caretIn(page, 'Parágrafo 3.', 11)
    await page.keyboard.type(' novo')
    await settle(page)
    const before = await scrolls(page)
    await page.keyboard.press('Control+z')
    expect(await scrolls(page)).toEqual(before)
  })

  test('editor expandido (sem rolagem própria): a página rola o mínimo', async ({ page }) => {
    await mount(page, { initialContent: PARAS, height: 2400 })
    await caretIn(page, 'Parágrafo 2.', 11)
    await page.keyboard.type(' novo')
    await settle(page)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.keyboard.press('Control+z')
    expect(await caretInside(page, null)).toBe(true)
  })

  test('dentro de um contêiner rolável da aplicação: o contêiner rola', async ({ page }) => {
    await mount(page, { initialContent: PARAS, height: 2400 })
    await page.addStyleTag({ content: '#host { height: 300px; overflow: auto; }' })
    await caretIn(page, 'Parágrafo 2.', 11)
    await page.keyboard.type(' novo')
    await settle(page)
    await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('#host')!
      host.scrollTop = host.scrollHeight
    })
    await page.keyboard.press('Control+z')
    expect(await caretInside(page, '#host')).toBe(true)
  })

  test('área de altura fixa sem rolagem (scrollable=false): o desfazer não a rola', async ({
    page,
  }) => {
    await mount(page, { initialContent: PARAS, height: 300, scrollable: false })
    await caretIn(page, 'Parágrafo 2.', 11)
    await page.keyboard.type(' novo')
    await settle(page)
    // O navegador pode rolar a área escondida ao digitar; o desfazer não mexe nela
    const before = await scrolls(page)
    await page.keyboard.press('Control+z')
    expect(await scrolls(page)).toEqual(before)
  })

  test.describe('no celular', () => {
    test.use({ viewport: { width: 375, height: 640 }, hasTouch: true, isMobile: true })
    test.skip(({ browserName }) => browserName === 'firefox', 'isMobile não existe no Firefox')

    test('com o cursor visível, desfazer não faz a página saltar', async ({ page }) => {
      await mount(page, { initialContent: PARAS, height: 300, width: '100%' })
      await caretIn(page, 'Parágrafo 1.', 11)
      await page.keyboard.type(' novo')
      await settle(page)
      const before = await scrolls(page)
      await page.keyboard.press('Control+z')
      expect(await scrolls(page)).toEqual(before)
    })
  })
})

test.describe('desfazer / refazer: seleção em ilhas editáveis', () => {
  const settle = (page: Page) => page.waitForTimeout(500)
  // Objeto não editável com uma legenda editável (como um incorporado futuro),
  // montado direto no DOM
  const withFigure = async (page: Page) => {
    const t = await mount(page, { initialContent: '<p>antes</p><p>depois</p>' })
    await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      const figure = document.createElement('figure')
      figure.setAttribute('contenteditable', 'false')
      figure.innerHTML =
        '<span>objeto</span><figcaption contenteditable="true">legenda</figcaption>'
      ed.querySelectorAll('p')[0].after(figure)
    })
    await settle(page)
    return t
  }

  test('desfazer a digitação na legenda devolve o cursor à legenda', async ({ page }) => {
    const t = await withFigure(page)
    await caretIn(page, 'legenda', 7)
    await page.keyboard.type('X')
    await settle(page)
    await page.keyboard.press('Control+z')
    await expect(t.content.locator('figcaption')).toHaveText('legenda')
    expect(
      await page.evaluate(() => {
        const s = getSelection()!
        return `${s.anchorNode?.parentElement?.tagName}:${s.anchorOffset}`
      }),
    ).toBe('FIGCAPTION:7')
  })

  test('seleção de trás para frente que entra na legenda volta igual', async ({ page }) => {
    const t = await withFigure(page)
    await page.evaluate(() => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      ed.focus()
      const depois = ed.querySelectorAll('p')[1].firstChild!
      const legenda = ed.querySelector('figcaption')!.firstChild!
      getSelection()!.setBaseAndExtent(depois, 3, legenda, 2)
    })
    const before = await page.evaluate(() => getSelection()!.toString())
    await t.btn('Bold (Ctrl+B)').click()
    await settle(page)
    await page.keyboard.press('Control+z')
    const after = await page.evaluate(() => {
      const s = getSelection()!
      return {
        text: s.toString(),
        anchor: `${s.anchorNode?.textContent}:${s.anchorOffset}`,
        focus: `${s.focusNode?.textContent}:${s.focusOffset}`,
      }
    })
    expect(after.text).toBe(before)
    expect(after.anchor).toBe('depois:3')
    expect(after.focus).toBe('legenda:2')
  })
})

test.describe('desfazer: operações distintas em passos separados, mesmo em menos de 400 ms', () => {
  const settle = (page: Page) => page.waitForTimeout(500)
  const sel = (page: Page) => page.evaluate(() => getSelection()!.toString())

  test('digitar e logo aplicar negrito: dois passos, cada um com a sua seleção', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>um dois</p>' })
    await caretIn(page, 'dois', 4)
    await page.keyboard.type('X')
    await selectText(page, 'um')
    await t.btn('Bold (Ctrl+B)').click()
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>um doisX</p>')
    expect(await sel(page)).toBe('um')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>um dois</p>')
    await page.keyboard.press('Control+y')
    expect(await t.dom()).toBe('<p>um doisX</p>')
    await page.keyboard.press('Control+y')
    expect(await t.dom()).toBe('<p><b>um</b> doisX</p>')
    expect(await sel(page)).toBe('um')
  })

  test('negrito e logo digitar: dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>um dois</p>' })
    await selectText(page, 'um')
    await t.btn('Bold (Ctrl+B)').click()
    await caretIn(page, 'dois', 4)
    await page.keyboard.type('Y')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p><b>um</b> dois</p>')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>um dois</p>')
  })

  test('digitar e logo colar: dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ola mundo</p>' })
    await caretIn(page, 'ola mundo', 3)
    await page.keyboard.type('X')
    await page.evaluate(() => {
      const h = '<h2>T</h2><p>corpo</p>'
      const data = new DataTransfer()
      data.setData('text/html', h)
      data.setData('text/plain', 'T corpo')
      const event = new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
      const delivered = event.clipboardData?.getData('text/html') === h
      document.querySelector('#host .ve-content')!.dispatchEvent(event)
      if (delivered) return
      const core = window.__ref.current!.core as unknown as { handlePaste(e: unknown): void }
      core.handlePaste({
        clipboardData: { getData: (type: string) => (type === 'text/html' ? h : 'T corpo') },
        preventDefault: () => {},
      })
    })
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>olaX mundo</p>')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ola mundo</p>')
  })

  test('digitar e logo criar um link: dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ir ao site</p>' })
    await caretIn(page, 'site', 4)
    await page.keyboard.type('X')
    await selectText(page, 'ir')
    await page.keyboard.press('Control+k')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').fill('a.com')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').press('Enter')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ir ao siteX</p>')
    expect(await sel(page)).toBe('ir')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ir ao site</p>')
  })

  test('criar um link e logo digitar: dois passos (o formulário não conta como digitação)', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>ir ao site</p>' })
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').fill('a.com')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').press('Enter')
    await page.keyboard.type('X')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toMatch(/^<p>ir ao <a [^>]+>site<\/a><\/p>$/)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ir ao site</p>')
  })

  test('digitar e logo inserir caixa de texto: dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 2)
    await page.keyboard.type('X')
    await t.btn('Insert text box').click()
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>abX</p>')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ab</p>')
  })

  test('digitar e logo inserir imagem: dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ab</p>' })
    await caretIn(page, 'ab', 2)
    await page.keyboard.type('X')
    const chooser = page.waitForEvent('filechooser')
    await t.btn('Insert image').click()
    await (await chooser).setFiles(pngFile())
    await expect(t.content.locator('img')).toHaveCount(1)
    await settle(page)
    await page.keyboard.press('Control+z')
    await expect(t.content.locator('img')).toHaveCount(0)
    expect(await t.dom()).toBe('<p>abX</p>')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>ab</p>')
  })

  test('digitar e logo mover a imagem pelo teclado (Alt+↓): dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: `<p>um</p><p>${IMG}</p><p>tres</p>` })
    await caretIn(page, 'um', 2)
    await page.keyboard.type('X')
    await t.content.locator('img').click()
    await page.keyboard.press('Alt+ArrowDown')
    await settle(page)
    const moved = await clean(page)
    await page.keyboard.press('Control+z')
    const once = await clean(page)
    expect(once).not.toBe(moved)
    expect(once).toContain('<p>umX</p>')
    await page.keyboard.press('Control+z')
    expect(await clean(page)).toContain('<p>um</p>')
  })

  test('arrastar a imagem é um passo só, separado da digitação', async ({ page }) => {
    const t = await mount(page, {
      initialContent: `<p>um texto longo para soltar</p><p>${IMG}</p>`,
    })
    await caretIn(page, 'um', 2)
    await page.keyboard.type('X')
    const img = t.content.locator('img')
    const box = (await img.boundingBox())!
    const target = (await t.content.locator('p').first().boundingBox())!
    await page.mouse.move(box.x + 10, box.y + 10)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(
        box.x + 10 + (target.x + 60 - box.x) * (i / 8),
        box.y + 10 + (target.y - box.y) * (i / 8),
      )
    await page.mouse.up()
    await settle(page)
    const dragged = await clean(page)
    await page.keyboard.press('Control+z')
    expect(await clean(page), 'um desfazer desfaz o arrasto inteiro').not.toBe(dragged)
    expect(await clean(page)).toContain('umX')
    await page.keyboard.press('Control+z')
    expect(await clean(page)).toContain('<p>um texto longo para soltar</p>')
  })

  test('digitar, clicar em outro lugar e digitar: dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>primeiro</p><p>segundo</p>' })
    await caretIn(page, 'primeiro', 8)
    await page.keyboard.type('A')
    await t.content.locator('p').nth(1).click()
    await page.keyboard.press('End')
    await page.keyboard.type('B')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>primeiroA</p><p>segundo</p>')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>primeiro</p><p>segundo</p>')
  })

  test('digitar, mover o cursor com as setas e digitar: dois passos', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>abcdef</p>' })
    await caretIn(page, 'abcdef', 6)
    await page.keyboard.type('X')
    await page.keyboard.press('Home')
    await page.keyboard.type('Y')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>abcdefX</p>')
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>abcdef</p>')
  })

  test('digitação contínua (com Backspace, Enter e Shift) continua um passo só', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>um</p>' })
    await caretIn(page, 'um', 2)
    await page.keyboard.type(' dois')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('s Tres')
    await page.keyboard.press('Enter')
    await page.keyboard.type('quatro')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await t.dom()).toBe('<p>um</p>')
  })
})

test.describe('desfazer: seleção certa quando o app chama a API do editor', () => {
  const settle = (page: Page) => page.waitForTimeout(500)
  // Seleção descrita por texto: o selecionado, o bloco, a posição no bloco e a direção
  const where = (page: Page, host = '#host') =>
    page.evaluate((host) => {
      const s = getSelection()!
      if (!s.rangeCount || !s.anchorNode || !s.focusNode) return 'sem seleção'
      const ed = document.querySelector(`${host} .ve-content`)!
      if (!ed.contains(s.anchorNode)) return 'fora do editor'
      const at = (node: Node, offset: number) => {
        const el = node.nodeType === 1 ? (node as Element) : node.parentElement!
        const block = el.closest('p, h2, li, blockquote') ?? ed
        const pre = document.createRange()
        pre.setStart(block, 0)
        pre.setEnd(node, offset)
        return `"${(block.textContent ?? '').slice(0, 16)}"@${pre.toString().length}`
      }
      const text = JSON.stringify(s.toString())
      return `${text} ${at(s.anchorNode, s.anchorOffset)}→${at(s.focusNode, s.focusOffset)}`
    }, host)
  const dom = (page: Page, host = '#host') =>
    page.locator(`${host} .ve-content`).evaluate((el) => el.innerHTML)
  // Barra do app, fora do editor: botões que chamam a API (sem tirar o foco) e um campo
  const externalToolbar = (page: Page) =>
    page.evaluate(() => {
      const bar = document.createElement('div')
      bar.id = 'ext'
      bar.innerHTML =
        '<button id="ext-h2">H2</button><button id="ext-p">P</button><input id="ext-input">'
      document.body.prepend(bar)
      const core = () => window.__ref.current!.core as unknown as { formatBlock(tag: string): void }
      for (const [id, tag] of [
        ['ext-h2', 'h2'],
        ['ext-p', 'p'],
      ]) {
        const button = document.getElementById(id)!
        button.addEventListener('mousedown', (e) => e.preventDefault())
        button.addEventListener('click', () => core().formatBlock(tag))
      }
    })
  const api = (page: Page, tag: string) =>
    page.evaluate((tag) => {
      const core = window.__ref.current!.core as unknown as { formatBlock(t: string): void }
      core.formatBlock(tag)
    }, tag)

  test('clicar em outro parágrafo e logo chamar a API: desfazer e refazer devolvem a seleção certa', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>um dois</p><p>tres quatro</p>' })
    await caretIn(page, 'dois', 4)
    await page.keyboard.type('X')
    await settle(page)
    await t.content.locator('p').nth(1).click()
    const before = await where(page)
    await api(page, 'h2')
    const after = await where(page)
    await settle(page)
    expect(await dom(page)).toBe('<p>um doisX</p><h2>tres quatro</h2>')
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe('<p>um doisX</p><p>tres quatro</p>')
    expect(await where(page)).toBe(before)
    await page.keyboard.press('Control+y')
    expect(await dom(page)).toBe('<p>um doisX</p><h2>tres quatro</h2>')
    expect(await where(page)).toBe(after)
  })

  test('barra externa logo depois de digitar: passo próprio, com a seleção de antes', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um dois</p><p>tres</p>' })
    await externalToolbar(page)
    await caretIn(page, 'dois', 4)
    await page.keyboard.type('X')
    const before = await where(page)
    await page.locator('#ext-h2').click()
    await settle(page)
    expect(await dom(page)).toBe('<h2>um doisX</h2><p>tres</p>')
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe('<p>um doisX</p><p>tres</p>')
    expect(await where(page)).toBe(before)
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe('<p>um dois</p><p>tres</p>')
  })

  test('foco num campo fora do editor: vale a última seleção do editor', async ({ page }) => {
    await mount(page, { initialContent: '<p>um dois</p><p>tres quatro</p>' })
    await externalToolbar(page)
    await caretIn(page, 'tres', 2)
    const before = await where(page)
    await page.locator('#ext-input').click()
    await page.keyboard.type('abc')
    await page.evaluate(() => {
      const ref = window.__ref.current!
      ref.focus()
      const core = ref.core as unknown as { formatBlock(t: string): void }
      core.formatBlock('h2')
    })
    await settle(page)
    expect(await dom(page)).not.toBe('<p>um dois</p><p>tres quatro</p>')
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe('<p>um dois</p><p>tres quatro</p>')
    expect(await where(page)).toBe(before)
    expect(await page.locator('#ext-input').inputValue()).toBe('abc')
  })

  test('dois editores: a seleção de um nunca vai para o histórico do outro', async ({ page }) => {
    await mount(
      page,
      { initialContent: '<p>um dois</p><p>tres quatro</p>' },
      { secondEditor: '<p>outro editor</p>' },
    )
    await caretIn(page, 'tres', 2)
    const aBefore = await where(page)
    await page.keyboard.type('Y')
    await settle(page)
    await page.locator('#host2 .ve-content').click()
    await page.keyboard.press('End')
    await page.keyboard.type('Z')
    await settle(page)
    const b = await dom(page, '#host2')
    // O app desfaz no editor A com a seleção no B: A volta à sua própria seleção
    await page.evaluate(() => window.__ref.current!.undo())
    expect(await dom(page)).toBe('<p>um dois</p><p>tres quatro</p>')
    expect(await dom(page, '#host2')).toBe(b)
    expect(await where(page)).toBe(aBefore)
    await page.evaluate(() => window.__ref2.current!.undo())
    expect(await dom(page, '#host2')).toBe('<p>outro editor</p>')
    expect(await dom(page)).toBe('<p>um dois</p><p>tres quatro</p>')
    expect(await where(page, '#host2')).toContain('"outro editor"@12')
  })

  test('seleção da direita para a esquerda, comando pela API: a direção volta igual', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um dois tres</p><p>fim</p>' })
    await caretIn(page, 'fim', 3)
    await page.keyboard.type('!')
    await settle(page)
    await page.evaluate(() => {
      const text = document.querySelector('#host .ve-content p')!.firstChild!
      getSelection()!.setBaseAndExtent(text, 7, text, 3)
    })
    const before = await where(page)
    expect(before).toContain('"dois"')
    await page.evaluate(() => {
      const core = window.__ref.current!.core as unknown as { execCommand(c: string): void }
      core.execCommand('bold')
    })
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await where(page)).toBe(before)
  })

  test('documento de 5.000 parágrafos: clique e API no meio dele', async ({ page }) => {
    const big = Array.from({ length: 5000 }, (_, i) => `<p>Parágrafo ${i + 1}.</p>`).join('')
    await mount(page, { initialContent: big, height: 400 })
    await caretIn(page, 'Parágrafo 1.', 3)
    await page.keyboard.type('Q')
    await settle(page)
    await caretIn(page, 'Parágrafo 4000.', 5)
    const before = await where(page)
    await api(page, 'h2')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await where(page)).toBe(before)
    await page.keyboard.press('Control+z')
    expect(await where(page)).toContain('"Parágrafo 1."@3')
  })

  test('app que lê getHTML a cada tecla: a digitação contínua continua um passo só', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await page.evaluate(() =>
      document.addEventListener('input', () => window.__ref.current!.getHTML()),
    )
    await caretIn(page, 'um', 2)
    const before = await where(page)
    await page.keyboard.type(' dois tres')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe('<p>um</p>')
    expect(await where(page)).toBe(before)
  })
})
