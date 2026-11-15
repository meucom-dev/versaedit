// Margem dos objetos configurável (prop objectMargin, 15/11/2026): imagens e caixas
// de texto com a margem por lado (texto, fora, topo, baixo), igual no editor e no
// conteúdo publicado (objectMarginStyle no contêiner), e refeita ao vivo sem mudar
// o HTML nem o histórico.
import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_OBJECT_MARGIN, objectMarginStyle } from '../../src/core/defaults'
import { mount, PNG } from './helpers'

test.use({ viewport: { width: 1300, height: 1200 } })

const TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. '.repeat(4)
const IMG = (cls: string) =>
  `<img class="${cls}" src="data:image/png;base64,${PNG}" style="width: 120px;">`
const BOX = (cls: string) =>
  `<div class="rich-textbox${cls ? ` ${cls}` : ''}" style="width: 200px;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>`
const CONTENT =
  `<p>A ${TEXT}</p>${IMG('pos-left')}<p>B ${TEXT}</p>${IMG('pos-right')}<p>C ${TEXT}</p>` +
  `${IMG('pos-center')}<p>D ${TEXT}</p>${BOX('')}<p>E ${TEXT}</p>${BOX('tb-float-left')}` +
  `<p>F ${TEXT}</p>${BOX('tb-float-right')}<p>G ${TEXT}</p>`
const OBJECTS = [
  'img.pos-left',
  'img.pos-right',
  'img.pos-center',
  '.rich-textbox:not([class*="tb-"])',
  '.rich-textbox.tb-float-left',
  '.rich-textbox.tb-float-right',
]

/** Margens calculadas [topo, direita, baixo, esquerda] de cada objeto, em px */
const margins = (page: Page, root: string) =>
  page.evaluate(
    ([sel, objects]) =>
      objects.map((o) => {
        const cs = getComputedStyle(document.querySelector(`${sel} ${o}`)!)
        return [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(parseFloat)
      }),
    [root, OBJECTS] as const,
  )

/** O que se espera para cada objeto, a partir dos quatro lados configurados */
function expected(m: { text: number; outer: number; top: number; bottom: number }, auto: number) {
  return [
    [m.top, m.text, m.bottom, m.outer], // imagem à esquerda: texto à direita
    [m.top, m.outer, m.bottom, m.text], // imagem à direita: texto à esquerda
    [m.text, auto, m.text, auto], // imagem centralizada: texto em cima e embaixo
    [m.text, m.outer, m.text, m.outer], // caixa no fluxo
    [m.top, m.text, m.bottom, m.outer], // caixa à esquerda
    [m.top, m.outer, m.bottom, m.text], // caixa à direita
  ]
}

const cssText = (style: Record<string, string>) =>
  Object.entries(style)
    .map(([k, v]) => `${k}:${v};`)
    .join('')

test('padrão: 16px do lado do texto, 0 do lado de fora, 4 em cima e 12 embaixo', async ({
  page,
}) => {
  await mount(page, { initialContent: CONTENT, width: 900, height: 1000 })
  const got = await margins(page, '#host .ve-content')
  // A margem automática da imagem centralizada depende da largura: só os lados fixos
  const auto = got[2][1]
  expect(got).toEqual(expected(DEFAULT_OBJECT_MARGIN, auto))
  expect(got[2][1]).toBe(got[2][3])
})

test('objectMargin por lado; o publicado com objectMarginStyle fica igual (com e sem espelho)', async ({
  page,
}) => {
  const custom = { text: 24, outer: 8, top: 2, bottom: 20 }
  await mount(page, { initialContent: CONTENT, width: 900, height: 1000, objectMargin: custom })
  const editor = await margins(page, '#host .ve-content')
  expect(editor).toEqual(expected(custom, editor[2][1]))
  const html = await page.evaluate(() => window.__ref.current!.getHTML())
  // A margem não vai para o HTML: os objetos só têm a classe e a largura
  expect(html).not.toMatch(/margin/)
  for (const mirror of [false, true]) {
    await page.evaluate(([h, m, s]) => window.__showPublished(h, { mirror: m, style: s }), [
      html,
      mirror,
      cssText(objectMarginStyle(custom)),
    ] as const)
    const published = await margins(page, '#published')
    expect(published, `mirror=${mirror}`).toEqual(expected(custom, published[2][1]))
  }
  // Sem as variáveis, o publicado usa o padrão (o mesmo do editor sem a prop)
  await page.evaluate((h) => window.__showPublished(h), html)
  const plain = await margins(page, '#published')
  expect(plain).toEqual(expected(DEFAULT_OBJECT_MARGIN, plain[2][1]))
})

test('só os lados informados mudam; os outros ficam no padrão', async ({ page }) => {
  await mount(page, {
    initialContent: CONTENT,
    width: 900,
    height: 1000,
    objectMargin: { text: 30 },
  })
  const got = await margins(page, '#host .ve-content')
  expect(got).toEqual(expected({ ...DEFAULT_OBJECT_MARGIN, text: 30 }, got[2][1]))
})

test('mudar a prop ao vivo: margens refeitas, HTML, histórico e seleção intactos', async ({
  page,
}) => {
  // Um objeto só (sem par na mesma faixa): a margem não tem limite a gravar no HTML
  await mount(page, {
    initialContent: `<p>A ${TEXT}</p>${IMG('pos-left')}<p>B ${TEXT}</p>`,
    width: 900,
    height: 1000,
  })
  const content = page.locator('#host .ve-content')
  // Uma edição real, para haver histórico
  await content.locator('p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type('!')
  const html = await page.evaluate(() => window.__ref.current!.getHTML())
  const changes = await page.evaluate(() => window.__out.changes)
  const custom = { text: 40, outer: 20, top: 10, bottom: 30 }
  await page.evaluate((m) => window.__setProps({ objectMargin: m }), custom)
  const first = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('#host .ve-content img')!)
      return [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(parseFloat)
    })
  await expect.poll(first).toEqual(expected(custom, 0)[0])
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(html)
  // Sem coluna estreita nesta largura: nada a gravar, nenhum onChange
  expect(await page.evaluate(() => window.__out.changes)).toBe(changes)
  // Desfazer tira a edição do usuário (a margem não entrou no histórico)
  await content.focus()
  await page.keyboard.press('Control+z')
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).not.toContain('!')
  expect(await first()).toEqual(expected(custom, 0)[0])
})

test('margem maior ao vivo: o objeto que deixaria a coluna estreita passa a descer', async ({
  page,
}) => {
  // Imagem a 40% à esquerda e caixa a 25% à direita, lado a lado com a margem padrão
  const PAIR =
    `<p>A ${TEXT}</p><img class="pos-left" src="data:image/png;base64,${PNG}" style="width: 40%;">` +
    `<p>B ${TEXT}</p><div class="rich-textbox tb-float-right" style="width: 25%; box-sizing: border-box;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>` +
    `<p>C ${TEXT.repeat(3)}</p>`
  const t = await mount(page, { initialContent: PAIR, width: 900, height: 1000 })
  await t.caretToEnd()
  await page.keyboard.type('.')
  const box = page.locator('#host .rich-textbox')
  const before = await box.getAttribute('data-ve-stack')
  const changes = await page.evaluate(() => window.__out.changes)
  // Margem de 120px do lado do texto: a coluna entre os dois não cabe mais em 900px
  await page.evaluate(() => window.__setProps({ objectMargin: { text: 120 } }))
  await expect.poll(() => box.getAttribute('data-ve-stack')).not.toBe(before)
  const after = Number(await box.getAttribute('data-ve-stack'))
  expect(after).toBeGreaterThan(900)
  // O HTML mudou (o limite gravado): onChange avisa a aplicação
  expect(await page.evaluate(() => window.__out.changes)).toBeGreaterThan(changes)
  // De volta ao padrão: o limite volta ao de antes
  await page.evaluate(() => window.__setProps({ objectMargin: undefined }))
  await expect.poll(() => box.getAttribute('data-ve-stack')).toBe(before)
})
