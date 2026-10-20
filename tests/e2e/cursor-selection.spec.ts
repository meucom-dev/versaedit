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
