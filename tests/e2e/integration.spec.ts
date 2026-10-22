// Integração do editor (regressão permanente): sequências combinadas, documento
// grande, vários editores, montagens repetidas, toque, API e documentos antigos.
// Vieram das auditorias de integração dos lotes D1–D7.
//
// Eventos reais × sintéticos:
// - teclado, mouse e toque: entrada real do navegador (Playwright), eventos isTrusted;
// - colagem: SINTÉTICA. Um ClipboardEvent montado pelo teste (no Firefox, que entrega
//   o evento sem os dados, o tratador recebe os dados diretamente). Prova o tratamento
//   da colagem, não a área de transferência do sistema;
// - API: chamadas diretas ao núcleo, como um app faria.
// O desfazer/refazer do próprio navegador está em cursor-selection.spec.ts.
import { expect, test, type Page } from '@playwright/test'
import { mount, PNG, pngFile, selectText } from './helpers'

const IMG = `<img src="data:image/png;base64,${PNG}" style="width: 40px">`
const settle = (page: Page) => page.waitForTimeout(500)
const dom = (page: Page) => page.locator('#host .ve-content').evaluate((el) => el.innerHTML)
const html = (page: Page) => page.evaluate(() => window.__ref.current!.getHTML())

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
        const r = document.createRange()
        r.setStart(node, i + o)
        r.collapse(true)
        getSelection()!.removeAllRanges()
        getSelection()!.addRange(r)
        return
      }
      throw new Error('texto não encontrado: ' + t)
    },
    [text, offset] as const,
  )
}

// Colagem (no Firefox, o evento sintético chega vazio: o tratador recebe os dados)
const paste = (page: Page, h: string) =>
  page.evaluate((h) => {
    const text = h.replace(/<[^>]+>/g, ' ')
    const data = new DataTransfer()
    data.setData('text/html', h)
    data.setData('text/plain', text)
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
      clipboardData: { getData: (t: string) => (t === 'text/html' ? h : text) },
      preventDefault: () => {},
    })
  }, h)

// Estrutura inválida: blocos dentro de blocos de texto, itens fora de lista
const structureErrors = (page: Page) =>
  page.evaluate(() => {
    const ed = document.querySelector('#host .ve-content')!
    const errors: string[] = []
    ed.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach((el) => {
      const inner = el.querySelector(
        'p, div, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, hr',
      )
      if (inner) errors.push(`${inner.tagName} dentro de ${el.tagName}`)
    })
    ed.querySelectorAll('li').forEach(
      (li) => !li.parentElement?.matches('ul, ol') && errors.push('LI fora de lista'),
    )
    if (
      ed.querySelectorAll('.rich-textbox').length !==
      ed.querySelectorAll('.rich-textbox > .textbox-handle').length
    )
      errors.push('caixa de texto sem alça')
    return errors
  })

// Exportar → setHTML → exportar de novo: mesma coisa
async function roundtrip(page: Page) {
  const exported = await html(page)
  const again = await page.evaluate((h) => {
    const ref = window.__ref.current!
    ref.setHTML(h)
    return ref.getHTML()
  }, exported)
  return { exported, again }
}

const BIG = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `<p>Parágrafo ${i + 1} com <b>negrito</b> e <i>itálico</i>.</p>`,
  ).join('')

// Seleção no bloco que começa com `prefix` (sem procurar no documento inteiro)
async function selectIn(page: Page, prefix: string, text: string, collapseToEnd = false) {
  await page.evaluate(
    ([prefix, text, end]) => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      const block = Array.from(ed.querySelectorAll<HTMLElement>('p, h2, blockquote')).find((b) =>
        (b.textContent ?? '').startsWith(prefix),
      )
      if (!block) throw new Error('bloco não encontrado: ' + prefix)
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const i = node.data.indexOf(text)
        if (i < 0) continue
        ed.focus()
        const r = document.createRange()
        r.setStart(node, end ? i + text.length : i)
        r.setEnd(node, i + text.length)
        getSelection()!.removeAllRanges()
        getSelection()!.addRange(r)
        return
      }
      throw new Error('texto não encontrado: ' + text)
    },
    [prefix, text, collapseToEnd] as const,
  )
  await selectionProcessed(page)
}

// Espera o aviso de mudança de seleção (selectionchange, assíncrono) ser tratado.
// Uma pessoa não seleciona por código no mesmo instante de um clique; sem esta
// espera, no WebKit, o atalho seguinte (Ctrl+K) podia chegar antes do aviso, e o
// editor ficava com a seleção do clique.
const selectionProcessed = (page: Page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )

// Clique real no bloco (o usuário clica antes de selecionar)
async function clickBlock(page: Page, prefix: string) {
  await page
    .locator('#host .ve-content')
    .locator('p, h2, blockquote')
    .filter({ hasText: new RegExp('^' + prefix) })
    .first()
    .click({ position: { x: 4, y: 4 } })
  await selectionProcessed(page)
}

// Seleção descrita por texto: o selecionado, o bloco e a posição no bloco
const selDesc = (page: Page) =>
  page.evaluate(() => {
    const s = getSelection()!
    if (!s.rangeCount || !s.anchorNode) return 'sem seleção'
    const ed = document.querySelector('#host .ve-content')!
    if (!ed.contains(s.anchorNode)) return 'fora do editor'
    const el = s.anchorNode.nodeType === 1 ? (s.anchorNode as Element) : s.anchorNode.parentElement!
    const block = el.closest('p, h2, blockquote, li, div.rich-textbox') ?? ed
    const pre = document.createRange()
    pre.setStart(block, 0)
    pre.setEnd(s.anchorNode, s.anchorOffset)
    return `${JSON.stringify(s.toString())} em "${(block.textContent ?? '').slice(0, 24)}" @${pre.toString().length}`
  })

// Aparência dos blocos de recuo e citação
const look = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('#host .ve-content blockquote')).map((el) => {
      const s = getComputedStyle(el)
      return `ml=${s.marginLeft} fs=${s.fontStyle} bl=${s.borderLeftWidth}`
    }),
  )

async function reopen(page: Page, h: string) {
  return page.evaluate((h) => {
    const ref = window.__ref.current!
    ref.setHTML('<p>outro</p>')
    ref.setHTML(h)
    return ref.getHTML()
  }, h)
}

test.describe('I. sequências combinadas', () => {
  test('I1 digitar, negrito, link, digitar; 4 × desfazer e 4 × refazer voltam aos mesmos estados', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>um dois tres</p>' })
    // Logo depois da montagem a página ainda pode travar mais de 400 ms entre duas
    // teclas, e o agrupamento por tempo dividiria a digitação (comportamento esperado)
    await settle(page)
    const states: string[] = [await dom(page)]
    await caretIn(page, 'tres', 4)
    await page.keyboard.type(' quatro')
    await settle(page)
    states.push(await dom(page))
    await selectText(page, 'dois')
    await t.btn('Bold (Ctrl+B)').click()
    await settle(page)
    states.push(await dom(page))
    await selectText(page, 'um')
    await page.keyboard.press('Control+k')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').fill('a.com')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').press('Enter')
    await settle(page)
    states.push(await dom(page))
    await page.keyboard.type('X')
    await settle(page)
    states.push(await dom(page))
    for (let i = states.length - 2; i >= 0; i--) {
      await page.keyboard.press('Control+z')
      expect(await dom(page), `desfazer até o estado ${i}`).toBe(states[i])
    }
    for (let i = 1; i < states.length; i++) {
      await page.keyboard.press('Control+y')
      expect(await dom(page), `refazer até o estado ${i}`).toBe(states[i])
    }
    expect(await structureErrors(page)).toEqual([])
  })

  // Limitação conhecida (F1): a junção com Backspace deixa o font-size do parágrafo
  // num <span> dentro do título. Fica registrada aqui até haver a regra semântica.
  test.fixme('I2 colar blocos (sintético), juntar com Backspace na fronteira, desfazer duas vezes', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>ola mundo</p>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<h2>T</h2><p>corpo</p>')
    await settle(page)
    const pasted = await dom(page)
    await caretIn(page, 'corpo', 0)
    await page.keyboard.press('Backspace')
    await settle(page)
    expect(await dom(page)).not.toMatch(/<span style=/)
    expect(await structureErrors(page)).toEqual([])
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe(pasted)
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe('<p>ola mundo</p>')
  })

  test('I3 caixa de texto: inserir, digitar, Enter, sair, Backspace seleciona, Delete exclui, desfazer devolve tudo', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: '<p>antes</p><p>depois</p>' })
    await caretIn(page, 'antes', 5)
    await t.btn('Insert text box').click()
    await page.keyboard.type(' um')
    await page.keyboard.press('Enter')
    await page.keyboard.type('dois')
    await settle(page)
    const withBox = await dom(page)
    expect(await structureErrors(page)).toEqual([])
    await caretIn(page, 'depois', 0)
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Delete')
    await expect(t.content.locator('.rich-textbox')).toHaveCount(0)
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe(
      withBox
        .replace(/ class="rich-textbox( selected)?"/, ' class="rich-textbox"')
        .replace(' contenteditable="true"', ''),
    )
  })

  test('I4 imagem: selecionar, digitar, apagar a letra, Delete na imagem, desfazer', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: `<p>a${IMG}b</p>` })
    await t.content.locator('img').click()
    await page.keyboard.type('XY')
    await page.keyboard.press('Backspace')
    await settle(page)
    await expect(t.content.locator('img')).toHaveCount(1)
    await t.content.locator('img').click()
    await page.keyboard.press('Delete')
    await settle(page)
    await page.keyboard.press('Control+z')
    await expect(t.content.locator('img')).toHaveCount(1)
    expect((await dom(page)).replace(/<img [^>]*>/, '<img>')).toBe('<p>a<img>Xb</p>')
  })

  test('I5 link: criar, remover com o cursor dentro, desfazer, refazer', async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>ir ao site agora</p>' })
    await selectText(page, 'site')
    await page.keyboard.press('Control+k')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').fill('a.com')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').press('Enter')
    await settle(page)
    const linked = await dom(page)
    await caretIn(page, 'site', 2)
    await t.btn('Remove link').click()
    await settle(page)
    expect(await dom(page)).toBe('<p>ir ao site agora</p>')
    await page.keyboard.press('Control+z')
    expect(await dom(page)).toBe(linked)
    await page.keyboard.press('Control+y')
    expect(await dom(page)).toBe('<p>ir ao site agora</p>')
  })

  test('I6 tamanho escolhido sem seleção, digitar, desfazer: o cursor volta ao ponto', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um</p>' })
    await caretIn(page, 'um', 2)
    await page.locator('#host .ve-toolbar select[aria-label="Font size"]').selectOption('18')
    await page.keyboard.type('abc')
    await settle(page)
    await page.keyboard.press('Control+z')
    await page.keyboard.type('Z')
    expect(await dom(page)).toBe('<p>umZ</p>')
  })

  test('I7 colar blocos num item de lista, Tab indenta, Shift+Tab sai, Tab volta', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<ul><li>ola mundo</li></ul>' })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<p>um</p><p>dois</p>')
    expect(await structureErrors(page)).toEqual([])
    await page.keyboard.press('Tab')
    expect(await dom(page)).toContain('&nbsp;&nbsp;&nbsp;&nbsp;')
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('#host .ve-toolbar'))).toBe(
      true,
    )
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('#host .ve-content'))).toBe(
      true,
    )
  })

  test('I8 depois de tudo (colagem sintética): exportar, sanitizar e reimportar sem mudar a estrutura', async ({
    page,
  }) => {
    const t = await mount(page, { initialContent: `<p>ola mundo</p><p>a${IMG}b</p>` })
    await caretIn(page, 'ola mundo', 4)
    await paste(page, '<h2>T</h2><ul><li>x</li></ul><p><b>corpo</b></p>')
    await caretIn(page, 'corpo', 5)
    await t.btn('Insert text box').click()
    await page.keyboard.type('caixa')
    await selectText(page, 'mundo')
    await page.keyboard.press('Control+k')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').fill('b.com')
    await page.locator('#host .ve-link-popover').getByLabel('Link URL:').press('Enter')
    expect(await structureErrors(page)).toEqual([])
    const r = await roundtrip(page)
    expect(r.again).toBe(r.exported)
    expect(await structureErrors(page)).toEqual([])
  })
})

test.describe('II. documento grande', () => {
  const BIG = Array.from(
    { length: 1500 },
    (_, i) => `<p>Parágrafo ${i + 1} com <b>negrito</b> e <i>itálico</i>.</p>`,
  ).join('')

  test('II1 desfazer no fim de um documento grande devolve o cursor e o deixa à vista', async ({
    page,
  }) => {
    await mount(page, { initialContent: BIG, height: 400 })
    await caretIn(page, 'Parágrafo 1500 ', 15)
    await page.keyboard.type('XYZ')
    await settle(page)
    await page.evaluate(() => (document.querySelector('#host .ve-content')!.scrollTop = 0))
    await page.keyboard.press('Control+z')
    const r = await page.evaluate(() => {
      const ed = document.querySelector('#host .ve-content')!
      const rect = getSelection()!.getRangeAt(0).getClientRects()[0]
      const box = ed.getBoundingClientRect()
      return {
        visible: !!rect && rect.top >= box.top && rect.bottom <= box.bottom,
        text: getSelection()!.anchorNode?.textContent,
      }
    })
    expect(r.visible).toBe(true)
    expect(r.text).toContain('Parágrafo 1500')
  })

  test('II2 colar blocos (sintético) no meio de um documento grande mantém a estrutura', async ({
    page,
  }) => {
    await mount(page, { initialContent: BIG })
    await caretIn(page, 'Parágrafo 750 ', 10)
    await paste(page, '<h2>T</h2><table><tbody><tr><td>c</td></tr></tbody></table><p>fim</p>')
    expect(await structureErrors(page)).toEqual([])
    const r = await roundtrip(page)
    expect(r.again).toBe(r.exported)
  })
})

test.describe('III. vários editores e montagens repetidas', () => {
  test('III1 dois editores no playground: desfazer num não mexe no outro', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Show HTML', { exact: true }).click()
    await page.getByRole('button', { name: 'Show editor with onSave' }).click()
    const [a, b] = [page.locator('.ve-content').nth(0), page.locator('.ve-content').nth(1)]
    await a.click()
    await page.keyboard.type('primeiro')
    await settle(page)
    await b.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' segundo')
    await settle(page)
    const bBefore = await b.innerHTML()
    await a.click()
    await page.keyboard.press('Control+z')
    expect(await a.innerHTML()).not.toContain('primeiro')
    expect(await b.innerHTML()).toBe(bBefore)
    // Shift+Tab sai do segundo editor (sem armadilha) e não afeta o primeiro
    await b.click()
    await page.keyboard.press('Shift+Tab')
    expect(
      await page.evaluate(() => !document.activeElement?.classList.contains('ve-content')),
    ).toBe(true)
  })

  test('III2 montar e desmontar 30 vezes não acumula escutas no documento', async ({ page }) => {
    await page.goto('/harness.html')
    await page.waitForFunction(() => typeof window.__mount === 'function')
    await page.evaluate(() => {
      const counts: Record<string, number> = {}
      const add = document.addEventListener.bind(document)
      const remove = document.removeEventListener.bind(document)
      document.addEventListener = ((type: string, l: EventListener, o?: unknown) => {
        counts[type] = (counts[type] ?? 0) + 1
        return add(type, l, o as AddEventListenerOptions)
      }) as typeof document.addEventListener
      document.removeEventListener = ((type: string, l: EventListener, o?: unknown) => {
        counts[type] = (counts[type] ?? 0) - 1
        return remove(type, l, o as EventListenerOptions)
      }) as typeof document.removeEventListener
      ;(window as unknown as { __counts: typeof counts }).__counts = counts
    })
    const read = () =>
      page.evaluate(() => ({
        ...(window as unknown as { __counts: Record<string, number> }).__counts,
      }))
    await page.evaluate(() => window.__mount({ initialContent: '<p>montagem 0</p>' }, {}))
    const one = await read()
    for (let i = 1; i <= 30; i++) {
      await page.evaluate((i) => window.__mount({ initialContent: `<p>montagem ${i}</p>` }, {}), i)
    }
    // Uma montagem ativa: as mesmas escutas de quando havia uma só (sem acúmulo)
    expect(await read()).toEqual(one)
  })
})

test.describe('IV. toque', () => {
  test.use({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true })
  test.skip(({ browserName }) => browserName === 'firefox', 'isMobile não existe no Firefox')

  test('IV1 tocar na imagem, digitar, tocar no negrito com seleção, desfazer', async ({ page }) => {
    const t = await mount(page, { initialContent: `<p>um dois</p><p>a${IMG}b</p>`, width: '100%' })
    await t.content.locator('img').tap()
    await page.keyboard.type('X')
    expect((await dom(page)).replace(/<img [^>]*>/, '<img>')).toBe('<p>um dois</p><p>a<img>Xb</p>')
    await selectText(page, 'dois')
    await t.btn('Bold (Ctrl+B)').tap()
    expect(await dom(page)).toContain('<b>dois</b>')
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await dom(page)).not.toContain('<b>')
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('dois')
  })
})

test.describe('V. depois de D1–D7', () => {
  test('V1 documento de 5.000 parágrafos: 10 operações seguidas, desfazer e refazer tudo, reabrir', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    const t = await mount(page, { initialContent: BIG(5000), height: 500 })
    const states = [await dom(page)]
    const before: string[] = []
    const after: string[] = []
    const step = async (prepare: () => Promise<void>, run: () => Promise<void>) => {
      await prepare()
      before.push(await selDesc(page))
      await run()
      after.push(await selDesc(page))
      states.push(await dom(page))
    }
    const form = page.locator('#host .ve-link-popover')
    // Sem pausas: todas as operações em menos de 400 ms umas das outras quando possível
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2500 ')
        await selectIn(page, 'Parágrafo 2500 ', 'itálico', true)
      },
      () => page.keyboard.type(' abc'),
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2500 ')
        await selectIn(page, 'Parágrafo 2500 ', 'Parágrafo')
      },
      () => t.btn('Bold (Ctrl+B)').click(),
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2500 ')
        await selectIn(page, 'Parágrafo 2500 ', 'negrito')
      },
      async () => {
        await page.keyboard.press('Control+k')
        await form.getByLabel('Link URL:').fill('a.com')
        await form.getByLabel('Link URL:').press('Enter')
      },
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2501 ')
        await selectIn(page, 'Parágrafo 2501 ', 'com', true)
      },
      () => t.btn('Increase indent').click(),
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2502 ')
        await selectIn(page, 'Parágrafo 2502 ', 'com', true)
      },
      () => t.btn('Quote').click(),
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2503 ')
        await selectIn(page, 'Parágrafo 2503 ', 'com', true)
      },
      () => paste(page, '<h2>Título colado</h2><p>corpo colado</p>'),
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2504 ')
        await selectIn(page, 'Parágrafo 2504 ', '.', true)
      },
      () => t.btn('Insert text box').click(),
    )
    await step(
      async () => {},
      () => page.keyboard.type(' caixa'),
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2505 ')
        await selectIn(page, 'Parágrafo 2505 ', '.', true)
      },
      async () => {
        const chooser = page.waitForEvent('filechooser')
        await t.btn('Insert image').click()
        await (await chooser).setFiles(pngFile())
        await expect(t.content.locator('img')).toHaveCount(1)
      },
    )
    await step(
      async () => {
        await clickBlock(page, 'Parágrafo 2506 ')
        await selectIn(page, 'Parágrafo 2506 ', '.', true)
      },
      () => page.keyboard.type(' fim'),
    )
    await settle(page)
    expect(await structureErrors(page)).toEqual([])
    const n = before.length
    const problems: string[] = []
    for (let i = n - 1; i >= 0; i--) {
      await page.keyboard.press('Control+z')
      if ((await dom(page)) !== states[i]) problems.push(`desfazer ${i + 1}: HTML diferente`)
      const sel = await selDesc(page)
      if (sel !== before[i]) problems.push(`desfazer ${i + 1}: seleção ${sel} ≠ ${before[i]}`)
    }
    for (let i = 0; i < n; i++) {
      await page.keyboard.press('Control+y')
      if ((await dom(page)) !== states[i + 1]) problems.push(`refazer ${i + 1}: HTML diferente`)
      const sel = await selDesc(page)
      if (sel !== after[i]) problems.push(`refazer ${i + 1}: seleção ${sel} ≠ ${after[i]}`)
    }
    expect(problems).toEqual([])
    // Exportar e reabrir 3 vezes: igual, com a mesma aparência de recuo e citação
    const looks = await look(page)
    const exported = await html(page)
    const outs = [await reopen(page, exported)]
    outs.push(await reopen(page, outs[0]))
    outs.push(await reopen(page, outs[1]))
    const show = (a: string, b: string, la: string, lb: string) => {
      let i = 0
      while (a[i] === b[i]) i++
      return `${la}: ${a.slice(i - 150, i + 200)}
  ${lb}: ${b.slice(i - 150, i + 200)}`
    }
    for (const k of [1, 2])
      if (outs[k] !== outs[0])
        throw new Error(
          `ciclo 1 ≠ ciclo ${k + 1}:\n  ${show(outs[0], outs[k], 'ciclo1', `ciclo${k + 1}`)}`,
        )
    // Primeiro ciclo: só o texto dentro de style pode ser reescrito pelo navegador
    const outsideCss = (h: string) => h.replace(/ style="[^"]*"/g, ' style')
    if (outsideCss(outs[0]) !== outsideCss(exported))
      throw new Error(
        `exportado ≠ ciclo 1 fora do CSS:\n  ${show(outsideCss(exported), outsideCss(outs[0]), 'exportado', 'ciclo1')}`,
      )
    expect(await look(page)).toEqual(looks)
    expect(await structureErrors(page)).toEqual([])
  })

  test('V1b API chamada de fora do editor logo depois de um clique: desfazer volta ao ponto clicado', async ({
    page,
  }) => {
    await mount(page, { initialContent: '<p>um dois</p><p>tres quatro</p>' })
    await clickBlock(page, 'um')
    await selectIn(page, 'um', 'dois', true)
    await page.keyboard.type('X')
    await settle(page)
    // O usuário clica no segundo parágrafo; o app chama a API (botão próprio, fora do editor)
    await clickBlock(page, 'tres')
    await selectIn(page, 'tres', 'tres', true)
    const before = await selDesc(page)
    await page.evaluate(() =>
      (window.__ref.current!.core as unknown as { formatBlock(t: string): void }).formatBlock('h2'),
    )
    await settle(page)
    await page.keyboard.press('Control+z')
    expect(await selDesc(page)).toBe(before)
  })

  test('V2 dois editores: recuo e digitação em cada um; desfazer e refazer não vazam', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByText('Show HTML', { exact: true }).click()
    await page.getByRole('button', { name: 'Show editor with onSave' }).click()
    const [a, b] = [page.locator('.ve-content').nth(0), page.locator('.ve-content').nth(1)]
    const bar = (i: number) => page.locator('.ve-toolbar').nth(i)
    await a.click()
    await page.keyboard.press('Control+Home')
    await bar(0).getByRole('button', { name: 'Increase indent', exact: true }).click()
    await page.keyboard.type('recuado ')
    const aAfter = await a.innerHTML()
    await b.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' segundo')
    await bar(1).getByRole('button', { name: 'Increase indent', exact: true }).click()
    await settle(page)
    const bAfter = await b.innerHTML()
    await a.click()
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+z')
    expect(await a.innerHTML()).not.toBe(aAfter)
    expect(await b.innerHTML()).toBe(bAfter)
    await page.keyboard.press('Control+y')
    await page.keyboard.press('Control+y')
    expect(await a.innerHTML()).toBe(aAfter)
    expect(await b.innerHTML()).toBe(bAfter)
    await b.click()
    await page.keyboard.press('Control+z')
    expect(await a.innerHTML()).toBe(aAfter)
  })

  test('V3 documento antigo com tudo: reabrir 5 vezes, editar e desfazer', async ({ page }) => {
    const legacy =
      '<blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;"><p>recuo antigo</p></blockquote>' +
      '<p style="margin-left: 80px;">recuo do Firefox</p>' +
      '<blockquote><p>uma citação</p></blockquote>' +
      '<p><a href="https://a.com" target="_blank" rel="noopener noreferrer">link</a> e <b>negrito</b></p>' +
      '<div class="rich-textbox" style="width: 200px;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>' +
      `<p>a${IMG}b</p>` +
      '<table><tbody><tr><td colspan="2" style="background-color: rgb(255, 255, 0);">c</td></tr></tbody></table>'
    const t = await mount(page, { initialContent: legacy })
    const looks = await look(page)
    expect(looks[0]).toBe('ml=40px fs=normal bl=0px')
    expect(looks[1]).toMatch(/^ml=0px fs=italic bl=3px/)
    const indents = await page.evaluate(
      () => getComputedStyle(document.querySelectorAll('#host .ve-content > p')[0]).marginLeft,
    )
    expect(indents).toBe('80px')
    const first = await html(page)
    let out = first
    for (let i = 0; i < 5; i++) out = await reopen(page, out)
    expect(out).toBe(first)
    expect(first).toContain('target="_blank" rel="noopener noreferrer"')
    expect(first).toContain('<span class="textbox-handle" contenteditable="false">')
    expect(await look(page)).toEqual(looks)
    await selectIn(page, 'recuo antigo', 'antigo', true)
    await page.keyboard.type(' editado')
    await settle(page)
    expect(await look(page)).toEqual(looks)
    await page.keyboard.press('Control+z')
    expect(await html(page)).toBe(first)
    void t
  })
})
