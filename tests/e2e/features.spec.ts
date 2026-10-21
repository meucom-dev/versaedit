import { readFileSync } from 'node:fs'
// Funcionalidades do VersaEdit: props, idiomas, link, imagem, teclado, ref e toque
import { expect, test } from '@playwright/test'
import { mount, PNG, pngFile, selectText } from './helpers'

test.describe('props e idiomas', () => {
  test('barra própria: ícones SVG, sem CoreUI/Bootstrap, estilos injetados', async ({ page }) => {
    const t = await mount(page)
    expect(await t.toolbar.locator('svg.ve-icon').count()).toBeGreaterThanOrEqual(20)
    await expect(page.locator('[class*="form-control"], [class*="d-flex"], .tooltip')).toHaveCount(
      0,
    )
    await expect(page.locator('#versaedit-styles')).toHaveCount(1)
    await expect(page.locator('#versaedit-google-fonts')).toHaveCount(0)
    await expect(t.content).toHaveAttribute('data-placeholder', 'Type your content here...')
  })

  test('pt-BR traduz barra, placeholder e textos inseridos', async ({ page }) => {
    const t = await mount(page, { locale: 'pt-BR', initialContent: '<p>a</p>' })
    await expect(t.btn('Negrito (Ctrl+B)')).toHaveCount(1)
    await t.caretToEnd()
    await t.btn('Inserir caixa de texto').click()
    expect(await t.html()).toContain('Caixa de texto')
    await t.content.evaluate((el) => (el.innerHTML = ''))
    await expect(t.content).toHaveAttribute('data-placeholder', 'Digite o conteúdo aqui...')
  })

  test('labels troca textos da interface', async ({ page }) => {
    const t = await mount(page, { labels: { bold: 'Strong!' } })
    await expect(t.btn('Strong!')).toHaveCount(1)
  })

  test('accentColor, frame e headingFontFamily', async ({ page }) => {
    await mount(page, {
      accentColor: '#7d8c6a',
      headingFontFamily: 'Georgia, serif',
      frame: { width: 6, color: 'rgb(143, 188, 143)', radius: 16 },
    })
    const root = page.locator('#host .ve-root')
    expect(await root.evaluate((el: HTMLElement) => el.style.getPropertyValue('--ve-accent'))).toBe(
      '#7d8c6a',
    )
    expect(
      await root.evaluate((el: HTMLElement) => el.style.getPropertyValue('--ve-heading-font')),
    ).toBe('Georgia, serif')
    const border = await page
      .locator('#host .ve-frame')
      .evaluate((el: HTMLElement) => el.style.border)
    expect(border).toBe('6px solid rgb(143, 188, 143)')
  })

  test('frame={false} remove a moldura', async ({ page }) => {
    await mount(page, { frame: false })
    expect(
      await page.locator('#host .ve-frame').evaluate((el: HTMLElement) => el.style.borderStyle),
    ).toBe('none')
  })

  test('showFileButtons=false esconde Salvar/Abrir', async ({ page }) => {
    const t = await mount(page, { showFileButtons: false })
    await expect(t.btn('Save to file (.html)')).toHaveCount(0)
    await expect(t.btn('Open file (.html)')).toHaveCount(0)
  })

  test('loadGoogleFonts adiciona o link do Google Fonts', async ({ page }) => {
    await mount(page, { loadGoogleFonts: ['Inter'] })
    await expect(page.locator('#versaedit-google-fonts')).toHaveAttribute(
      'href',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
    )
  })

  test('fontFamilies e fontSizes próprios', async ({ page }) => {
    await mount(page, {
      fontFamilies: [{ label: 'Mono', value: 'monospace' }],
      fontSizes: [10, 30],
      fontFamily: 'monospace',
    })
    await expect(page.locator('#host .ve-font-button')).toContainText('Mono')
    const sizes = await page
      .locator('#host select[aria-label="Font size"] option')
      .allTextContents()
    expect(sizes).toEqual(['10 pt', '30 pt'])
  })

  test('conteúdo antigo com amesa-paper é lido e salvo como ve-paper', async ({ page }) => {
    const t = await mount(
      page,
      {
        initialContent:
          '<div class="amesa-paper" data-paper="#ffeeaa" style="background-color:#ffeeaa;"><p>antigo</p></div>',
      },
      { onSave: true },
    )
    expect(await t.content.evaluate((el: HTMLElement) => el.style.backgroundColor)).toBe(
      'rgb(255, 238, 170)',
    )
    await t.btn('Save to file (.html)').click()
    expect((await t.out()).saved).toBe(
      '<div class="ve-paper" data-paper="#ffeeaa" style="background-color:#ffeeaa;"><p>antigo</p></div>',
    )
  })
})

test.describe('inserções sem apagar a seleção', () => {
  test('caixa de texto entra depois do parágrafo, inteira', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>keep this text</p>' })
    await selectText(page, 'this')
    await t.btn('Insert text box').click()
    expect(await t.html()).toBe(
      '<p>keep this text</p><div class="rich-textbox"><span class="textbox-handle" contenteditable="false" title="Drag text box">⠿</span>Text box</div>',
    )
  })

  test('linha separadora mantém o trecho selecionado', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>keep this text</p>' })
    await selectText(page, 'this')
    await t.btn('Insert horizontal line').click()
    const html = (await t.html())!
    expect(html).toContain('this')
    expect(html).toContain('<hr')
  })
})

test.describe('imagem enviada (onImageUpload)', () => {
  test('entra pela URL devolvida, sem base64', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>a</p>' }, { upload: 'ok' })
    await t.content.click()
    const chooser = page.waitForEvent('filechooser')
    await t.btn('Insert image').click()
    await (await chooser).setFiles(pngFile('foto.png'))
    await expect.poll(t.html).toContain('src="https://cdn.example.com/foto.png"')
    expect(await t.html()).not.toContain('base64')
  })

  test('erro no envio: aviso traduzido e nada inserido', async ({ page }) => {
    const messages: string[] = []
    page.on('dialog', (d) => {
      messages.push(d.message())
      void d.accept()
    })
    const t = await mount(page, { initialContent: '<p>a</p>', locale: 'pt-BR' }, { upload: 'fail' })
    await t.content.click()
    const chooser = page.waitForEvent('filechooser')
    await t.btn('Inserir imagem').click()
    await (await chooser).setFiles(pngFile())
    await expect.poll(() => messages).toEqual(['Não foi possível enviar a imagem.'])
    expect(await t.dom()).not.toContain('<img')
  })
})

test.describe('formulário de link', () => {
  test('Ctrl+K, validação, Enter aplica, edição e Esc', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>go to site now</p>' })
    const form = page.locator('#host .ve-link-popover')
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await expect(form).toBeVisible()
    await expect(form.getByLabel('Link text:')).toHaveValue('site')

    await form.getByLabel('Link URL:').fill('javascript:alert(1)')
    await form.getByRole('button', { name: 'Apply' }).click()
    await expect(form.locator('.ve-link-error')).toBeVisible()

    await form.getByLabel('Link URL:').fill('www.example.org')
    await form.getByLabel('Link URL:').press('Enter')
    await expect(form).toBeHidden()
    expect(await t.html()).toContain(
      '<a href="https://www.example.org" target="_blank" rel="noopener noreferrer">site</a>',
    )

    // Cursor dentro do link: o formulário edita o link inteiro
    await selectText(page, 'sit')
    await t.btn('Insert link (Ctrl+K)').click()
    await expect(form.getByLabel('Link URL:')).toHaveValue('https://www.example.org')
    await form.getByLabel('Link URL:').fill('https://new.example')
    await form.getByRole('button', { name: 'Apply' }).click()
    const html = (await t.html())!
    expect(html).toContain('href="https://new.example"')
    expect(html.match(/<a /g)).toHaveLength(1)

    // Esc cancela e devolve a seleção
    await selectText(page, 'now')
    await page.keyboard.press('Control+k')
    await form.getByLabel('Link URL:').press('Escape')
    await expect(form).toBeHidden()
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('now')
  })

  test('link criado: exportar e reabrir (setHTML e arquivo) mantém target e rel', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>ir ao site</p>' })
    const form = page.locator('#host .ve-link-popover')
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await form.getByLabel('Link URL:').fill('a.com')
    await form.getByLabel('Link URL:').press('Enter')
    const exported = await page.evaluate(() => window.__ref.current!.getHTML())
    expect(exported).toContain('<a href="https://a.com" target="_blank" rel="noopener noreferrer">')
    const reopened = await page.evaluate((html) => {
      const ref = window.__ref.current!
      ref.setHTML('<p>outro</p>')
      ref.setHTML(html)
      const viaSetHtml = ref.getHTML()
      ref.setHTML('<p>outro</p>')
      const core = ref.core as unknown as { loadFileContent(html: string): void }
      core.loadFileContent(`<!doctype html><html><body>${html}</body></html>`)
      return [viaSetHtml, ref.getHTML()]
    }, exported)
    expect(reopened).toEqual([exported, exported])
  })
})

test.describe('teclado na barra (padrão toolbar)', () => {
  test('um único Tab; setas, Home e End', async ({ page }) => {
    const t = await mount(page)
    await expect(t.toolbar.locator('[tabindex="0"]')).toHaveCount(1)
    const active = () => page.evaluate(() => document.activeElement!.getAttribute('aria-label'))
    await t.toolbar.locator('button').first().focus()
    await page.keyboard.press('ArrowRight')
    expect(await active()).toBe('Open file (.html)')
    await page.keyboard.press('End')
    expect(await active()).toBe('Clear formatting')
    await page.keyboard.press('ArrowRight')
    expect(await active()).toBe('Save to file (.html)')
    await page.keyboard.press('ArrowLeft')
    expect(await active()).toBe('Clear formatting')
    await page.keyboard.press('Home')
    expect(await active()).toBe('Save to file (.html)')
    await expect(t.toolbar.locator('[tabindex="0"]')).toHaveAttribute(
      'aria-label',
      'Save to file (.html)',
    )
  })
})

test('ref.core no navegador: identidade, métodos extraídos, ouvintes, instanceof e dois editores', async ({
  page,
}) => {
  await mount(page, { initialContent: '<p>um</p>' }, { secondEditor: '<p>dois</p>' })
  const r = await page.evaluate(() => {
    type Core = {
      getHTML(): string
      setHTML(html: string): void
      undo(): void
      constructor: new (...args: never[]) => unknown
    }
    const a = window.__ref.current!.core as unknown as Core
    const b = window.__ref2.current!.core as unknown as Core
    const { getHTML, setHTML } = a
    setHTML('<p>um extraído</p>')
    const button = document.createElement('button')
    document.body.append(button)
    let calls = 0
    const count = () => calls++
    button.addEventListener('click', a.undo)
    button.addEventListener('click', count)
    button.click()
    button.removeEventListener('click', a.undo)
    const afterUndo = a.getHTML()
    button.click()
    return {
      sameCore: window.__ref.current!.core === window.__ref.current!.core,
      sameMethod: a.getHTML === a.getHTML,
      extracted: getHTML(),
      instance: a instanceof a.constructor && a.constructor.name === 'VersaEditCore',
      sameClass: a.constructor === b.constructor,
      distinct: a !== b && a.getHTML !== b.getHTML,
      second: b.getHTML(),
      afterUndo,
      afterRemove: a.getHTML(),
      calls,
    }
  })
  expect(r.sameCore).toBe(true)
  expect(r.sameMethod).toBe(true)
  expect(r.extracted).toBe('<p>um extraído</p>')
  expect(r.instance).toBe(true)
  expect(r.sameClass).toBe(true)
  expect(r.distinct).toBe(true)
  expect(r.second).toBe('<p>dois</p>')
  // setHTML reinicia o histórico: o undo do ouvinte não tem o que desfazer
  expect(r.afterUndo).toBe('<p>um extraído</p>')
  expect(r.afterRemove).toBe('<p>um extraído</p>')
  expect(r.calls).toBe(2)
})

test.describe('API por ref', () => {
  test('getHTML, setHTML, focus, clear, undo, core', async ({ page }) => {
    await mount(page, { initialContent: '<p>start</p>' })
    const r = await page.evaluate(async () => {
      const ref = window.__ref.current!
      const out: Record<string, unknown> = { first: ref.getHTML() }
      ref.setHTML('<p>novo <script>x()</script>conteúdo</p>')
      out.afterSet = ref.getHTML()
      ref.focus()
      out.focused = document.activeElement === document.querySelector('#host .ve-content')
      ref.clear()
      out.afterClear = ref.getHTML()
      ref.undo()
      await new Promise((resolve) => setTimeout(resolve, 50))
      out.afterUndo = ref.getHTML()
      out.hasCore = Boolean(ref.core)
      return out
    })
    expect(r).toEqual({
      first: '<p>start</p>',
      afterSet: '<p>novo conteúdo</p>',
      focused: true,
      afterClear: '',
      afterUndo: '<p>novo conteúdo</p>',
      hasCore: true,
    })
  })
})

test.describe('toque', () => {
  test.use({ hasTouch: true })

  test('arrastar imagem com o dedo e redimensionar pela alça', async ({
    page,
    context,
    browserName,
  }) => {
    // O toque é simulado pelo protocolo do Chromium (CDP)
    test.skip(browserName !== 'chromium', 'toque simulado só no Chromium')
    const t = await mount(page, {
      initialContent: `<p>texto de exemplo para a imagem</p><img src="data:image/png;base64,${PNG}" class="pos-left" style="width:60px">`,
    })
    const img = page.locator('#host .ve-content img')
    const box = (await img.boundingBox())!
    const ed = (await t.content.boundingBox())!
    const cdp = await context.newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x === undefined ? [] : [{ x, y: y!, id: 1 }],
      })
    const sx = box.x + box.width / 2
    const sy = box.y + box.height / 2
    const ex = ed.x + ed.width - 80
    await touch('touchStart', sx, sy)
    for (let i = 1; i <= 10; i++) await touch('touchMove', sx + ((ex - sx) * i) / 10, sy + 5)
    expect(await img.evaluate((el: HTMLElement) => el.style.transform)).toMatch(/^translate\(\d/)
    await touch('touchEnd')
    await expect(img).toHaveClass(/pos-right/)

    const handle = (await page.locator('#host .ve-resize-handle').boundingBox())!
    const w0 = await img.evaluate((el: HTMLElement) => el.offsetWidth)
    await touch('touchStart', handle.x + 7, handle.y + 7)
    await touch('touchMove', handle.x + 47, handle.y + 37)
    await touch('touchEnd')
    expect(await img.evaluate((el: HTMLElement) => el.offsetWidth)).toBeGreaterThan(w0)
  })
})

test.describe('desempenho', () => {
  test('digitar com imagem grande e limite de altura continua rápido', async ({ page }) => {
    const t = await mount(page, { height: 300, truncateOnOverflow: true })
    await page.evaluate((b) => {
      window.__ref.current!.setHTML(
        `<p>abc</p><img src="data:image/png;base64,${b}" style="width:40px">`,
      )
    }, 'A'.repeat(3_000_000))
    await t.content.locator('p').click()
    // Tempo medido dentro da página: só o trabalho do editor a cada caractere
    // (inserção + input + onChange + verificação de altura), sem a comunicação
    // do Playwright com o navegador, que oscila com vários testes em paralelo.
    // A mediana de 10 caracteres descarta picos isolados.
    const perKey = await page.evaluate(() => {
      const times: number[] = []
      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        document.execCommand('insertText', false, String(i))
        times.push(performance.now() - start)
      }
      times.sort((a, b) => a - b)
      return (times[4] + times[5]) / 2
    })
    expect(await t.html()).toContain('0123456789')
    // Máquinas do CI são mais lentas e variáveis: limite maior lá
    expect(perKey).toBeLessThan(process.env.CI ? 150 : 50)
  })
})

test('nenhum erro de página nas ações básicas', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const t = await mount(page, { initialContent: '<p>abc</p>' })
  await t.caretToEnd()
  await page.keyboard.type('xyz')
  await t.btn('Bold (Ctrl+B)').click()
  await t.btn('Undo (Ctrl+Z)').click()
  expect(errors).toEqual([])
})

test.describe('onChange só quando o HTML muda', () => {
  test('focar e sair sem editar não avisa; cada alteração avisa uma vez', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>abc</p>' })
    const changes = async () => (await t.out()).changes

    // Clicar no editor e sair dele, sem editar
    await t.content.click()
    await page.mouse.click(5, 880)
    expect(await changes()).toBe(0)

    // Uma tecla = um aviso
    await t.caretToEnd()
    await page.keyboard.type('x')
    expect(await changes()).toBe(1)
    expect(await t.html()).toBe('<p>abcx</p>')
    // Passos separados no histórico (a digitação é agrupada por ~400 ms)
    await page.waitForTimeout(500)

    // Cor do papel: um aviso só (o papel e a cor eram avisados separadamente)
    await page.locator('#host button[aria-label="Paper color"]').click()
    await page.locator('#host .ve-swatch[title="#F1C40F"]').click()
    expect(await changes()).toBe(2)

    // Sair de novo sem editar: nada
    await page.mouse.click(5, 880)
    expect(await changes()).toBe(2)

    // Desfazer avisa (o conteúdo mudou)
    await page.waitForTimeout(500)
    await t.btn('Undo (Ctrl+Z)').click()
    expect(await changes()).toBe(3)
    expect(await t.html()).toBe('<p>abcx</p>')
  })
})

test.describe('foco ao clicar em imagem', () => {
  const content = `<p>alpha beta</p><img src="data:image/png;base64,${PNG}" class="pos-left" style="width:40px">`

  test('clique direto na imagem: teclado funciona sem selecionar texto', async ({ page }) => {
    const t = await mount(page, { initialContent: content })
    const img = page.locator('#host .ve-content img')
    await img.click()
    expect(
      await page.evaluate(() => document.activeElement?.classList.contains('ve-content')),
    ).toBe(true)
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('')
    await page.keyboard.press('Control+ArrowRight')
    // O Firefox grava translate(1px, 0px) como translate(1px)
    expect(await img.evaluate((el: HTMLElement) => el.style.transform)).toMatch(
      /^translate\(1px(, 0px)?\)$/,
    )
    await page.keyboard.press('Control+ArrowRight')
    expect(await img.evaluate((el: HTMLElement) => el.style.transform)).toMatch(
      /^translate\(2px(, 0px)?\)$/,
    )
    await page.keyboard.press('Delete')
    await expect(img).toHaveCount(0)
    expect(await t.html()).toBe('<p>alpha beta</p>')
  })

  test('arrasto e alça continuam funcionando depois do foco', async ({ page }) => {
    await mount(page, { initialContent: content })
    const img = page.locator('#host .ve-content img')
    const box = (await img.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 300, box.y + 10, { steps: 5 })
    await page.mouse.up()
    await expect(img).toHaveClass(/pos-left|pos-right/)
    const handle = (await page.locator('#host .ve-resize-handle').boundingBox())!
    const w0 = await img.evaluate((el: HTMLElement) => el.offsetWidth)
    await page.mouse.move(handle.x + 7, handle.y + 7)
    await page.mouse.down()
    await page.mouse.move(handle.x + 47, handle.y + 37, { steps: 4 })
    await page.mouse.up()
    expect(await img.evaluate((el: HTMLElement) => el.offsetWidth)).toBeGreaterThan(w0)
  })
})

test.describe('alinhamento e recuo iguais em todos os navegadores', () => {
  test('centralizar usa text-align, sem o atributo align', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
    await selectText(page, 'alpha')
    await t.btn('Center').click()
    const html = (await t.html())!
    expect(html).not.toContain('align=')
    expect(await t.content.locator('p').evaluate((el) => getComputedStyle(el).textAlign)).toBe(
      'center',
    )
  })

  test('recuo de 40px sem aparência de citação; retirar volta ao original; negrito continua <b>', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
    await selectText(page, 'alpha')
    await t.btn('Increase indent').click()
    const html = (await t.html())!
    expect(html).not.toMatch(/<blockquote>/) // blockquote sem estilo = citação
    const block = t.content.locator('p, blockquote').first()
    const box = await block.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { margin: cs.marginLeft, border: cs.borderLeftWidth }
    })
    expect(box).toEqual({ margin: '40px', border: '0px' })
    // Recuo não tem aparência de citação (aprovado no lote complementar v0.2.x)
    const look = await block.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { italic: cs.fontStyle, background: cs.backgroundColor }
    })
    expect(look).toEqual({ italic: 'normal', background: 'rgba(0, 0, 0, 0)' })

    await selectText(page, 'alpha')
    await t.btn('Decrease indent').click()
    expect(await t.html()).toBe('<p>alpha beta</p>')

    // O modo CSS não fica ligado: o negrito seguinte continua sendo <b>
    await selectText(page, 'beta')
    await t.btn('Bold (Ctrl+B)').click()
    expect(await t.html()).toContain('<b>beta</b>')
  })
})

test.describe('histórico com imagem embutida', () => {
  test('desfazer/refazer: HTML idêntico e cursor no mesmo lugar', async ({ page }) => {
    const big = 'A'.repeat(200_000)
    const t = await mount(page)
    const original = `<p>texto</p><img src="data:image/png;base64,${big}" class="pos-left" style="width: 40px;">`
    // Referência: o HTML como este navegador o entrega depois de carregar
    // (o Firefox, por exemplo, grava style antes de class)
    const loaded = await page.evaluate((h) => {
      window.__ref.current!.setHTML(h)
      return window.__ref.current!.getHTML()
    }, original)
    await t.content.locator('p').click()
    await page.keyboard.press('End')
    await page.keyboard.type('XY')
    await page.waitForTimeout(500)
    // Apagar a imagem (passo separado)
    await page.locator('#host .ve-content img').click()
    await page.keyboard.press('Delete')
    await page.waitForTimeout(500)
    const caret = () =>
      page.evaluate(() => {
        const s = getSelection()!
        return {
          node: s.anchorNode?.nodeName ?? null,
          text: s.anchorNode?.textContent?.slice(0, 20) ?? null,
          offset: s.anchorOffset,
          collapsed: s.isCollapsed,
        }
      })
    const html = () => page.evaluate(() => window.__ref.current!.getHTML())

    await page.keyboard.press('Control+z')
    expect(await html()).toBe(loaded.replace('texto', 'textoXY'))
    const afterUndo1 = await caret()
    await page.keyboard.press('Control+z')
    expect(await html()).toBe(loaded)
    const afterUndo2 = await caret()
    await page.keyboard.press('Control+y')
    await page.keyboard.press('Control+y')
    expect(await html()).toBe('<p>textoXY</p>')
    const afterRedo = await caret()
    // Cursor no ponto de cada passo (antes, desfazer/refazer o recolocavam no
    // início do editor): desfazer a exclusão devolve a imagem e o cursor fica logo
    // depois dela; desfazer a digitação, no fim de "texto"; refazer as duas, onde
    // a imagem estava
    expect(afterUndo1).toEqual({ node: 'DIV', text: 'textoXY', offset: 2, collapsed: true })
    expect(afterUndo2).toEqual({ node: '#text', text: 'texto', offset: 5, collapsed: true })
    expect(afterRedo).toEqual({ node: 'DIV', text: 'textoXY', offset: 1, collapsed: true })
  })
})

test('citação verdadeira mantém a aparência de citação', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'alpha')
  await t.btn('Quote').click()
  expect(await t.html()).toBe('<blockquote>alpha beta</blockquote>')
  const look = await t.content.locator('blockquote').evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      italic: cs.fontStyle,
      border: cs.borderLeftWidth,
      hasBackground: cs.backgroundColor !== 'rgba(0, 0, 0, 0)',
    }
  })
  expect(look).toEqual({ italic: 'italic', border: '3px', hasBackground: true })
})

test('marcas de seleção ficam só na tela, fora do HTML entregue', async ({ page }) => {
  const content = `<p>alpha</p><img src="data:image/png;base64,${PNG}" class="pos-left" style="width:40px">`
  const t = await mount(page, { initialContent: content })
  await page.locator('#host .ve-content img').click()
  await page.locator('#host .ve-float-toolbar button', { hasText: '50%' }).click()
  // Na tela: selecionada, com menu
  await expect(page.locator('#host .ve-content img')).toHaveClass(/selected/)
  await expect(page.locator('#host .ve-float-toolbar')).toBeVisible()
  // No HTML entregue: sem marcas da interface
  const delivered = [await t.html(), await page.evaluate(() => window.__ref.current!.getHTML())]
  for (const html of delivered) {
    expect(html).not.toMatch(/selected|dragging|class=""/)
    expect(html).toContain('class="pos-left"')
  }
  const downloading = page.waitForEvent('download')
  await t.btn('Save to file (.html)').click()
  const file = readFileSync((await (await downloading).path())!, 'utf-8')
  expect(file).not.toContain('selected')
})

test('onFocus e onBlur: só quando o foco entra ou sai do editor', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
  const counts = async () => {
    const o = await t.out()
    return { focus: o.focus, blur: o.blur }
  }
  expect(await counts()).toEqual({ focus: 0, blur: 0 })
  await t.content.click()
  expect(await counts()).toEqual({ focus: 1, blur: 0 })
  // Botões da barra mantêm o foco no editor
  await selectText(page, 'alpha')
  await t.btn('Bold (Ctrl+B)').click()
  await t.btn('Italic (Ctrl+I)').click()
  expect(await counts()).toEqual({ focus: 1, blur: 0 })
  // Clicar numa imagem também não tira o foco
  await page.evaluate((png) => {
    window.__ref.current!.setHTML(
      `<p>alpha</p><img src="data:image/png;base64,${png}" style="width:40px">`,
    )
  }, PNG)
  await t.content.locator('img').click()
  expect((await counts()).blur).toBe(0)
  // Sair do editor
  await page.mouse.click(5, 710) // dentro da janela (1280×720), fora do editor
  expect(await counts()).toEqual({ focus: 1, blur: 1 })
  // Formulário de link: o foco vai para o campo de endereço (saída do editor)
  await t.content.click()
  await page.keyboard.press('Control+k')
  expect(await counts()).toEqual({ focus: 2, blur: 2 })
})

test('caixa de texto editável no editor, sem contenteditable no HTML publicado', async ({
  page,
}) => {
  const legacy =
    '<p>a</p><div class="rich-textbox" contenteditable="true"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>'
  const t = await mount(page, { initialContent: legacy })
  // Conteúdo antigo com o atributo: o HTML entregue sai limpo
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(
    '<p>a</p><div class="rich-textbox"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>',
  )
  // No editor a caixa continua editável (digitação dentro dela)
  await t.content.locator('.rich-textbox').click({ position: { x: 80, y: 12 } })
  await expect(t.content.locator('.rich-textbox')).toHaveAttribute('contenteditable', 'true')
  await page.keyboard.press('End')
  await page.keyboard.type(' nova')
  const html = (await t.html())!
  expect(html).toContain('caixa nova</div>')
  expect(html).not.toContain('contenteditable="true"')
  expect(html).toContain('<span class="textbox-handle" contenteditable="false">')
})
