// Estilo de texto entre blocos (0.5.0-beta.3). Tamanho, família da fonte e cor numa
// seleção que atravessa itens de lista, parágrafos, células ou uma caixa de texto:
// o estilo vai só para o texto selecionado e a estrutura de blocos não muda. Antes,
// o trecho inteiro ia para um span só (<ul><li></li><span><li>…</li></span><li></li>):
// sobravam marcadores vazios, itens partidos e parágrafos dentro de span. A prévia
// de fonte e de cor, cancelada, devolve o HTML e a seleção exatos, sem passo de
// desfazer nem onChange. Negrito, marca-texto e cor rápida (comandos do navegador)
// entram como controle: a estrutura também não pode mudar com eles.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

test.use({ viewport: { width: 1200, height: 1000 } })

const ITEMS = [
  '<strong>Primeiro destaque.</strong> Texto comum do primeiro item.',
  '<strong>Segundo destaque.</strong> Texto comum do segundo item.',
  '<strong>Terceiro destaque.</strong> Texto comum do último item.',
]
const TITLE = '<h3>Título da amostra</h3>'
const AFTER = '<p>Depois do trecho.</p>'
const items = (list: string[]) => list.map((t) => `<li>${t}</li>`).join('')
const TEXTBOX_HANDLE =
  '<span class="textbox-handle" contenteditable="false" title="Drag text box">⠿</span>'

const FIXTURES: Record<string, string> = {
  ul: `${TITLE}<ul>${items(ITEMS)}</ul>${AFTER}`,
  ol: `${TITLE}<ol>${items(ITEMS)}</ol>${AFTER}`,
  aninhada: `${TITLE}<ul><li>${ITEMS[0]}</li><li>${ITEMS[1]}<ul><li>Subitem um</li><li><em>Subitem</em> dois</li></ul></li><li>${ITEMS[2]}</li></ul>${AFTER}`,
  paragrafos: `${TITLE}${ITEMS.map((t) => `<p>${t}</p>`).join('')}${AFTER}`,
  tabela: `${TITLE}<table><tbody><tr><td>Célula <strong>um</strong></td><td>Célula dois</td></tr><tr><td>Célula três</td><td><em>Célula</em> quatro</td></tr></tbody></table>${AFTER}`,
  caixa: `${TITLE}<div class="rich-textbox">${TEXTBOX_HANDLE}<p>Linha <strong>um</strong> da caixa.</p><p>Linha dois da caixa.</p></div>${AFTER}`,
  vazios: `${TITLE}<ul><li>Primeiro item</li><li></li><li><br></li><li><strong>Último</strong> item</li></ul>${AFTER}`,
}
// Bloco em que a seleção começa e termina (a lista, a tabela, a caixa ou os parágrafos)
const SCOPE: Record<string, string> = {
  ul: 'ul',
  ol: 'ol',
  aninhada: 'ul',
  paragrafos: 'p:not(:last-child)',
  tabela: 'table',
  caixa: '.rich-textbox',
  vazios: 'ul',
}

type Selection = 'itens' | 'parcial' | 'fora' | 'ctrlA' | 'invertida'
const SELECTIONS: Selection[] = ['itens', 'parcial', 'fora', 'ctrlA', 'invertida']

type Command =
  'tamanho' | 'fonte' | 'fontePrevia' | 'cor' | 'corPrevia' | 'corRapida' | 'destaque' | 'negrito'
const COMMANDS: Command[] = [
  'tamanho',
  'fonte',
  'fontePrevia',
  'cor',
  'corPrevia',
  'corRapida',
  'destaque',
  'negrito',
]
const PREVIEW = new Set<Command>(['fontePrevia', 'corPrevia'])
// Comandos refeitos na beta.3 (os outros são do navegador: só a estrutura é conferida)
const OWN = new Set<Command>(['tamanho', 'fonte', 'cor', 'fontePrevia', 'corPrevia'])
const EXPECTED: Partial<Record<Command, { kind: Probe; test: (value: string) => boolean }>> = {
  tamanho: { kind: 'fontSize', test: (v) => v === '24px' },
  fonte: { kind: 'fontFamily', test: (v) => v.startsWith('Georgia') },
  cor: { kind: 'color', test: (v) => v === 'rgb(231, 76, 60)' },
}

type Probe = 'fontSize' | 'fontFamily' | 'color'

/** Seleciona conforme o modo (texto do 1º ao último bloco do escopo) */
async function select(page: Page, scope: string, mode: Selection) {
  if (mode === 'ctrlA') {
    await page.locator('#host .ve-content h3').click()
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(50)
    return
  }
  await page.evaluate(
    ([scope, mode]) => {
      const content = document.querySelector<HTMLElement>('#host .ve-content')!
      const texts = (root: Node) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        const out: Text[] = []
        while (walker.nextNode()) {
          const text = walker.currentNode as Text
          if (text.data.trim() && !text.parentElement!.closest('[contenteditable="false"]'))
            out.push(text)
        }
        return out
      }
      const inside = [...content.querySelectorAll(scope)].flatMap(texts)
      const first = mode === 'fora' ? texts(content.querySelector('h3')!)[0] : inside[0]
      const last = inside[inside.length - 1]
      const start = mode === 'parcial' ? 4 : 0
      const end = mode === 'parcial' ? last.length - 5 : last.length
      content.focus()
      const selection = getSelection()!
      if (mode === 'invertida') selection.setBaseAndExtent(last, end, first, start)
      else selection.setBaseAndExtent(first, start, last, end)
    },
    [scope, mode] as const,
  )
  await page.waitForTimeout(50)
}

/** Aplica o comando pela barra, como o usuário */
async function run(page: Page, command: Command) {
  const toolbar = page.locator('#host .ve-toolbar')
  const leave = async () => {
    await page.mouse.move(1190, 990)
    await page.waitForTimeout(50)
    await page.keyboard.press('Escape')
  }
  switch (command) {
    case 'tamanho':
      await toolbar.locator('select[aria-label="Font size"]').selectOption('18')
      break
    case 'fonte':
    case 'fontePrevia':
      await toolbar.locator('button[aria-label="Font family"]').click()
      if (command === 'fonte') {
        await page.locator('#host .ve-font-option', { hasText: 'Georgia' }).click()
      } else {
        // Duas opções (a prévia troca de uma para outra) e sai sem escolher
        await page.locator('#host .ve-font-option', { hasText: 'Georgia' }).hover()
        await page.locator('#host .ve-font-option', { hasText: 'Verdana' }).hover()
        await leave()
      }
      break
    case 'cor':
    case 'corPrevia':
      await toolbar.locator('button[aria-label="Text color"]').click()
      if (command === 'cor') {
        await page.locator('#host .ve-palette .ve-swatch[title="#E74C3C"]').click()
      } else {
        await page.locator('#host .ve-palette .ve-swatch[title="#E74C3C"]').hover()
        await page.locator('#host .ve-palette .ve-swatch[title="#2980B9"]').hover()
        await leave()
      }
      break
    case 'corRapida':
      await toolbar.locator('button[aria-label^="Text color: apply"]').click()
      break
    case 'destaque':
      await toolbar.getByRole('button', { name: 'Highlight', exact: true }).click()
      await page.locator('#host .ve-highlight-swatch[title="#51CF66"]').click()
      break
    case 'negrito':
      await page.keyboard.press('Control+b')
      break
  }
  await page.waitForTimeout(150)
}

/** Estrutura: problemas de HTML, esqueleto dos blocos e texto de cada bloco */
const structure = (page: Page) =>
  page.locator('#host .ve-content').evaluate((content) => {
    const problems: string[] = []
    content.querySelectorAll('li').forEach((li) => {
      if (!/^(UL|OL)$/.test(li.parentElement!.tagName))
        problems.push(`li em ${li.parentElement!.tagName}`)
    })
    content.querySelectorAll('ul, ol, table, tbody, tr').forEach((parent) => {
      parent.childNodes.forEach((child) => {
        const tag = (child as Element).tagName
        const ok =
          parent.tagName === 'TABLE'
            ? /^(TBODY|THEAD|TFOOT|TR|CAPTION|COLGROUP)$/.test(tag)
            : parent.tagName === 'TR'
              ? /^(TD|TH)$/.test(tag)
              : parent.tagName === 'TBODY'
                ? tag === 'TR'
                : tag === 'LI'
        if (child.nodeType === 1 && !ok) problems.push(`${parent.tagName} > ${tag}`)
        if (child.nodeType === 3 && child.textContent!.trim())
          problems.push(`texto solto em ${parent.tagName}`)
      })
    })
    const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, div, table, tr, td, th'
    content.querySelectorAll('span, strong, b, em, i, u, a, font').forEach((el) => {
      if (el.querySelector(BLOCKS)) problems.push(`bloco dentro de ${el.tagName}`)
    })
    content.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach((el) => {
      if (el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, li, div, table'))
        problems.push(`bloco dentro de ${el.tagName}`)
    })
    if (content.querySelector('.textbox-handle')?.parentElement?.tagName === 'SPAN')
      problems.push('alça da caixa dentro de span')
    const blocks = [...content.querySelectorAll(BLOCKS)]
    const depth = (el: Element) => {
      let d = 0
      for (let p = el.parentElement; p && p !== content; p = p.parentElement) d++
      return d
    }
    return {
      problems: [...new Set(problems)],
      skeleton: blocks.map((el) => `${el.tagName}:${depth(el)}`).join(' '),
      blockTexts: blocks.map((el) => el.textContent),
      text: content.textContent,
    }
  })

/** Estilo calculado de cada caractere do conteúdo e a seleção em posições de texto */
const probe = (page: Page, kind: Probe) =>
  page.locator('#host .ve-content').evaluate((content, kind) => {
    const selection = getSelection()!
    const range = selection.rangeCount ? selection.getRangeAt(0) : null
    let start = -1
    let length = 0
    if (range && content.contains(range.commonAncestorContainer)) {
      const before = document.createRange()
      before.selectNodeContents(content)
      before.setEnd(range.startContainer, range.startOffset)
      start = before.toString().length
      length = range.toString().length
    }
    const values: string[] = []
    const chars: string[] = []
    const editable: boolean[] = []
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const text = walker.currentNode as Text
      const el = text.parentElement!
      const value = getComputedStyle(el)[kind]
      const canEdit = !el.closest('[contenteditable="false"]')
      for (let i = 0; i < text.length; i++) {
        values.push(value)
        chars.push(text.data[i])
        editable.push(canEdit)
      }
    }
    // Direção: com o fim antes do início, a faixa se recolhe
    let backward = false
    if (selection.anchorNode && selection.focusNode && !selection.isCollapsed) {
      const r = document.createRange()
      r.setStart(selection.anchorNode, selection.anchorOffset)
      r.setEnd(selection.focusNode, selection.focusOffset)
      backward = r.collapsed
    }
    return { start, length, values, chars, editable, backward }
  }, kind)

const html = (page: Page) => page.locator('#host .ve-content').evaluate((el) => el.innerHTML)
const changes = (page: Page) => page.evaluate(() => window.__out.changes)

/** Conteúdo salvo e relido (o mesmo caminho de initialContent): estrutura igual */
async function reopenStructure(page: Page) {
  return page.evaluate(() => {
    const saved = window.__ref.current!.getHTML()
    const box = document.createElement('div')
    box.innerHTML = saved
    const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, div, table, tr, td, th'
    const depth = (el: Element) => {
      let d = 0
      for (let p = el.parentElement; p && p !== box; p = p.parentElement) d++
      return d
    }
    return [...box.querySelectorAll(BLOCKS)].map((el) => `${el.tagName}:${depth(el)}`).join(' ')
  })
}

test.describe('matriz: comandos × estruturas × seleções', () => {
  for (const [fixture, initialContent] of Object.entries(FIXTURES)) {
    for (const command of COMMANDS) {
      test(`${fixture} · ${command}`, async ({ page }) => {
        for (const mode of SELECTIONS) {
          const label = `${fixture} · ${command} · ${mode}`
          await mount(page, { initialContent, height: 760 })
          await select(page, SCOPE[fixture], mode)
          const kind = EXPECTED[command]?.kind ?? 'fontSize'
          const before = { html: await html(page), shape: await structure(page) }
          const probeBefore = await probe(page, kind)
          const changesBefore = await changes(page)
          expect(probeBefore.length, `${label}: seleção vazia`).toBeGreaterThan(0)
          expect(probeBefore.backward, label).toBe(mode === 'invertida')

          await run(page, command)
          const shape = await structure(page)
          expect(shape.problems, label).toEqual([])
          expect(shape.skeleton, label).toBe(before.shape.skeleton)
          expect(shape.blockTexts, label).toEqual(before.shape.blockTexts)
          expect(shape.text, label).toBe(before.shape.text)

          if (PREVIEW.has(command)) {
            // Cancelar a prévia: HTML e seleção exatos, sem onChange
            expect(await html(page), label).toBe(before.html)
            const after = await probe(page, kind)
            expect([after.start, after.length, after.backward], label).toEqual([
              probeBefore.start,
              probeBefore.length,
              probeBefore.backward,
            ])
            expect(await changes(page), label).toBe(changesBefore)
            continue
          }

          const after = await probe(page, kind)
          if (OWN.has(command)) {
            // Mesma seleção (mesmo texto, mesma direção)
            expect([after.start, after.length, after.backward], label).toEqual([
              probeBefore.start,
              probeBefore.length,
              probeBefore.backward,
            ])
            // Estilo só no texto selecionado; fora dele (e na alça) nada muda
            const expected = EXPECTED[command]!
            const wrong: string[] = []
            for (let i = 0; i < after.values.length; i++) {
              const inside = i >= probeBefore.start && i < probeBefore.start + probeBefore.length
              if (inside && after.editable[i]) {
                // Espaços dentro do trecho também recebem o estilo (sem conferir)
                if (after.chars[i].trim() && !expected.test(after.values[i]))
                  wrong.push(`dentro ${i} "${after.chars[i]}"`)
              } else if (after.values[i] !== probeBefore.values[i]) {
                wrong.push(`fora ${i} "${after.chars[i]}"`)
              }
            }
            expect(wrong.slice(0, 5), label).toEqual([])
          }
          const changed = await html(page)
          expect(await reopenStructure(page), `${label}: reabrir`).toBe(shape.skeleton)

          // Desfazer volta ao HTML exato; refazer reaplica
          await page.locator('#host .ve-content').focus()
          await page.keyboard.press('Control+z')
          await page.waitForTimeout(150)
          expect(await html(page), `${label}: desfazer`).toBe(before.html)
          await page.keyboard.press('Control+y')
          await page.waitForTimeout(150)
          expect(await html(page), `${label}: refazer`).toBe(changed)
        }
      })
    }
  }
})

// Caso original (23/11/2026): lista colada do Word com pasteSpacing 'preserve',
// arraste só sobre os itens com marcador e 14 pt. Sobravam um marcador vazio acima
// e outro abaixo; o botão de marcador no item vazio de cima inseria uma linha em vez
// de tirar o marcador.
test.describe('regressão: lista do Word, tamanho 14 pt arrastando só sobre os itens', () => {
  const WORD = readFileSync(
    resolve(process.cwd(), 'tests/fixtures/word/word-bullets-style.htm'),
    'utf8',
  )

  async function pasteWord(page: Page, browserName: string) {
    await mount(page, { initialContent: '<p><br></p>', pasteSpacing: 'preserve', height: 760 })
    if (browserName === 'firefox') {
      // No Firefox, o evento de colar criado pelo teste chega sem dados (ver
      // word-paste-lists.spec.ts): a colagem passa pela mesma função do editor
      // Módulos do próprio editor, servidos pelo Vite da página de testes (/@fs/…)
      const src = `/@fs/${process.cwd().split('\\').join('/')}/src/core`
      await page.evaluate(
        async ([h, src]) => {
          const load = (path: string) => import(/* @vite-ignore */ path)
          const { buildPasteHtml } = await load(`${src}/paste.ts`)
          const { DEFAULT_FONT_FAMILIES } = await load(`${src}/defaults.ts`)
          const pasted = buildPasteHtml(h, 'x', false, DEFAULT_FONT_FAMILIES, {
            images: false,
            spacing: 'preserve',
          })
          window.__ref.current!.setHTML(pasted.html)
        },
        [WORD, src] as const,
      )
    } else {
      await page.locator('#host .ve-content').evaluate((el, h) => {
        el.focus()
        const range = document.createRange()
        range.selectNodeContents(el)
        getSelection()!.removeAllRanges()
        getSelection()!.addRange(range)
        const data = new DataTransfer()
        data.setData('text/html', h)
        data.setData('text/plain', 'x')
        el.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
        )
      }, WORD)
    }
    await page.waitForTimeout(200)
    await expect(page.locator('#host .ve-content li')).toHaveCount(4)
  }

  // Arraste do mouse: do começo do texto do 1º item ao fim do texto do último
  async function dragOverItems(page: Page) {
    const lis = page.locator('#host .ve-content li')
    const first = (await lis.first().locator('strong, b').first().boundingBox())!
    const lastBox = (await lis.last().boundingBox())!
    const end = await lis.last().evaluate((li) => {
      const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT)
      let last: Text | null = null
      while (walker.nextNode())
        if ((walker.currentNode as Text).data.trim()) last = walker.currentNode as Text
      const r = document.createRange()
      r.setStart(last!, last!.length - 1)
      r.setEnd(last!, last!.length)
      const b = r.getBoundingClientRect()
      return { x: b.right, y: b.top + b.height / 2 }
    })
    await page.mouse.move(first.x + 1, first.y + first.height / 2)
    await page.mouse.down()
    await page.mouse.move(end.x + 1, end.y, { steps: 12 })
    await page.mouse.up()
    expect(lastBox.height).toBeGreaterThan(0)
    const selected = await page.evaluate(() => getSelection()!.toString())
    expect(selected).toContain('Primeiro item em negrito.')
    expect(selected).toContain('último item da amostra.')
    expect(selected).not.toContain('Título da amostra')
  }

  // Botão de marcador com o cursor no 1º item: o item sai da lista, sem linha nova
  async function toggleFirstBullet(page: Page) {
    await page.locator('#host .ve-content li').first().locator('strong, b').first().click()
    await page
      .locator('#host .ve-toolbar')
      .getByRole('button', { name: 'Bulleted list', exact: true })
      .click()
    await page.waitForTimeout(150)
  }

  test('sem marcador vazio, estilo nos 4 itens e o botão de marcador tira o 1º item', async ({
    page,
    browserName,
  }) => {
    // Referência: o mesmo documento sem o tamanho; o botão de marcador no 1º item
    await pasteWord(page, browserName)
    await toggleFirstBullet(page)
    const reference = await structure(page)

    await pasteWord(page, browserName)
    const pasted = await structure(page)
    await dragOverItems(page)
    await page.locator('#host .ve-toolbar select[aria-label="Font size"]').selectOption('14')
    await page.waitForTimeout(150)

    const shape = await structure(page)
    expect(shape.problems).toEqual([])
    expect(shape.skeleton).toBe(pasted.skeleton)
    expect(shape.blockTexts).toEqual(pasted.blockTexts)
    const lis = page.locator('#host .ve-content li')
    await expect(lis).toHaveCount(4)
    for (const li of await lis.all()) {
      expect((await li.textContent())!.trim()).not.toBe('')
      const sizes = await li.evaluate((el) => {
        const out: string[] = []
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const t = walker.currentNode as Text
          if (t.data.trim()) out.push(getComputedStyle(t.parentElement!).fontSize)
        }
        return out
      })
      for (const size of sizes) expect(Math.abs(parseFloat(size) - 18.667)).toBeLessThan(0.1)
    }
    // O título (fora da seleção) fica como estava
    const titleSize = await page
      .locator('#host .ve-content > :first-child')
      .evaluate((el) => getComputedStyle(el.querySelector('span') ?? el).fontSize)
    expect(Math.abs(parseFloat(titleSize) - 18.667)).toBeLessThan(0.1)

    await toggleFirstBullet(page)
    const toggled = await structure(page)
    expect(toggled.problems).toEqual([])
    // Mesmo resultado do documento sem o tamanho: só o 1º item saiu da lista
    expect(toggled.skeleton).toBe(reference.skeleton)
    expect(toggled.blockTexts).toEqual(reference.blockTexts)
    await expect(lis).toHaveCount(3)
  })
})

test.describe('seleção por arrasto e por teclado', () => {
  test('arrasto do mouse sobre os itens: tamanho e cor sem mudar a estrutura', async ({ page }) => {
    await mount(page, { initialContent: FIXTURES.aninhada, height: 760 })
    const before = await structure(page)
    const first = (await page.locator('#host .ve-content li strong').first().boundingBox())!
    const last = (await page.locator('#host .ve-content > ul > li').last().boundingBox())!
    await page.mouse.move(first.x + 1, first.y + first.height / 2)
    await page.mouse.down()
    await page.mouse.move(last.x + last.width - 4, last.y + last.height / 2, { steps: 12 })
    await page.mouse.up()
    for (const command of ['tamanho', 'cor'] as const) {
      await run(page, command)
      const shape = await structure(page)
      expect(shape.problems, command).toEqual([])
      expect(shape.skeleton, command).toBe(before.skeleton)
      expect(shape.blockTexts, command).toEqual(before.blockTexts)
    }
  })

  test('Shift+setas e Shift+End: tamanho só no trecho, seleção mantida', async ({ page }) => {
    await mount(page, { initialContent: FIXTURES.ul, height: 760 })
    const before = await structure(page)
    await page.locator('#host .ve-content li').first().click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('Shift+End')
    const sel = await probe(page, 'fontSize')
    await run(page, 'tamanho')
    const shape = await structure(page)
    expect(shape.problems).toEqual([])
    expect(shape.skeleton).toBe(before.skeleton)
    const after = await probe(page, 'fontSize')
    expect([after.start, after.length]).toEqual([sel.start, sel.length])
    // O cursor continua a partir da ponta móvel: Shift+← encurta a seleção
    await page.keyboard.press('Shift+ArrowLeft')
    const shorter = await probe(page, 'fontSize')
    expect([shorter.start, shorter.length]).toEqual([sel.start, sel.length - 1])
  })

  test('seleção de trás para frente: a ponta móvel continua no começo', async ({ page }) => {
    await mount(page, { initialContent: FIXTURES.ul, height: 760 })
    await select(page, 'ul', 'invertida')
    const sel = await probe(page, 'fontSize')
    await run(page, 'tamanho')
    // Shift+→ move a ponta móvel (o começo): a seleção encolhe por ali
    await page.keyboard.press('Shift+ArrowRight')
    const shorter = await probe(page, 'fontSize')
    expect(shorter.backward).toBe(true)
    expect([shorter.start, shorter.length]).toEqual([sel.start + 1, sel.length - 1])
  })
})

test.describe('sem spans acumulados', () => {
  const spansPerItem = (page: Page) =>
    page
      .locator('#host .ve-content li')
      .evaluateAll((lis) => lis.map((li) => li.querySelectorAll('span').length))

  test('o mesmo comando repetido não empilha spans', async ({ page }) => {
    await mount(page, { initialContent: FIXTURES.ul, height: 760 })
    await select(page, 'ul', 'itens')
    for (let i = 0; i < 3; i++) await run(page, 'tamanho')
    await page.locator('#host .ve-toolbar select[aria-label="Font size"]').selectOption('24')
    await page.waitForTimeout(100)
    expect(await spansPerItem(page)).toEqual([1, 1, 1])
    const sizes = await page
      .locator('#host .ve-content li > span')
      .evaluateAll((spans) => spans.map((s) => (s as HTMLElement).style.fontSize))
    expect(sizes).toEqual(['24pt', '24pt', '24pt'])
  })

  test('tamanho, fonte e cor juntos ficam num span por item; negrito depois mantém a estrutura', async ({
    page,
  }) => {
    await mount(page, { initialContent: FIXTURES.ul, height: 760 })
    const before = await structure(page)
    await select(page, 'ul', 'itens')
    await run(page, 'tamanho')
    await run(page, 'fonte')
    await run(page, 'cor')
    expect(await spansPerItem(page)).toEqual([1, 1, 1])
    const style = await page
      .locator('#host .ve-content li > span')
      .first()
      .evaluate((s) => [s.style.fontSize, s.style.fontFamily.split(',')[0], s.style.color])
    expect(style).toEqual(['18pt', 'Georgia', 'rgb(231, 76, 60)'])
    await run(page, 'negrito')
    const shape = await structure(page)
    expect(shape.problems).toEqual([])
    expect(shape.skeleton).toBe(before.skeleton)
  })

  test('aplicar dentro de um trecho já estilizado mantém a outra propriedade', async ({ page }) => {
    await mount(page, {
      initialContent: '<p>alpha <span style="color: rgb(231, 76, 60);">beta gamma</span> delta</p>',
    })
    await page.evaluate(() => {
      const span = document.querySelector('#host .ve-content span')!
      const text = span.firstChild as Text
      const r = document.createRange()
      r.setStart(text, 0)
      r.setEnd(text, 4)
      ;(document.querySelector('#host .ve-content') as HTMLElement).focus()
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(r)
    })
    await run(page, 'tamanho')
    expect(await html(page)).toBe(
      '<p>alpha <span style="color: rgb(231, 76, 60);"><span style="font-size: 18pt;">beta</span> gamma</span> delta</p>',
    )
  })
})

test.describe('prévia de fonte e cor', () => {
  test('cancelar não cria passo de desfazer nem onChange', async ({ page }) => {
    await mount(page, { initialContent: FIXTURES.ul, height: 760 })
    const initial = await html(page)
    // Um passo real antes (digitação no fim do último parágrafo)
    await page.locator('#host .ve-content > p').last().click()
    await page.keyboard.press('End')
    await page.keyboard.type('X')
    await page.waitForTimeout(500)
    const typed = await html(page)
    const typedChanges = await changes(page)
    await select(page, 'ul', 'parcial')
    const sel = await probe(page, 'fontFamily')
    await run(page, 'fontePrevia')
    await run(page, 'corPrevia')
    expect(await html(page)).toBe(typed)
    expect(await changes(page)).toBe(typedChanges)
    const after = await probe(page, 'fontFamily')
    expect([after.start, after.length]).toEqual([sel.start, sel.length])
    // Desfazer tira a digitação: a prévia não deixou passo no histórico
    await page.locator('#host .ve-content').focus()
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(150)
    expect(await html(page)).toBe(initial)
  })

  test('confirmar depois de várias prévias é um passo só', async ({ page }) => {
    await mount(page, { initialContent: FIXTURES.aninhada, height: 760 })
    const initial = await html(page)
    await select(page, 'ul', 'itens')
    await page.locator('#host .ve-toolbar button[aria-label="Font family"]').click()
    await page.locator('#host .ve-font-option', { hasText: 'Verdana' }).hover()
    await page.locator('#host .ve-font-option', { hasText: 'Arial' }).hover()
    await page.locator('#host .ve-font-option', { hasText: 'Georgia' }).click()
    await page.waitForTimeout(150)
    const committed = await html(page)
    expect(committed).not.toBe(initial)
    expect(committed).not.toContain('Verdana')
    expect(committed).not.toContain('Arial')
    expect((await structure(page)).problems).toEqual([])
    await page.locator('#host .ve-content').focus()
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(150)
    expect(await html(page)).toBe(initial)
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(150)
    expect(await html(page)).toBe(committed)
  })
})

test('salvar e reabrir: a mesma estrutura e o mesmo HTML', async ({ page }) => {
  await mount(page, { initialContent: FIXTURES.aninhada, height: 760 })
  await select(page, 'ul', 'parcial')
  await run(page, 'tamanho')
  await run(page, 'cor')
  const shape = await structure(page)
  const saved = await page.evaluate(() => window.__ref.current!.getHTML())
  await mount(page, { initialContent: saved, height: 760 })
  const reopened = await structure(page)
  expect(reopened.problems).toEqual([])
  expect(reopened.skeleton).toBe(shape.skeleton)
  expect(reopened.blockTexts).toEqual(shape.blockTexts)
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(saved)
})
