// Arrastar e soltar imagem/caixa de texto: o elemento fica onde foi solto,
// com o texto contornando pelo lado livre e a margem mínima de 40px
import { expect, test, type Locator, type Page } from '@playwright/test'
import { mount, PNG } from './helpers'

const TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. '
const IMG = `<img src="data:image/png;base64,${PNG}" style="width: 120px; height: 120px">`
const CONTENT = `<p>${IMG}</p><p>${TEXT.repeat(2)}</p><p>${TEXT.repeat(3)}</p>`

// Arrasta segurando o centro do elemento até a fração (fx, fy) da área
async function dragTo(page: Page, el: Locator, fx: number, fy: number) {
  const area = (await page.locator('#host .ve-content').boundingBox())!
  const box = (await el.boundingBox())!
  const grab = { x: box.width / 2, y: box.height / 2 }
  await page.mouse.move(box.x + grab.x, box.y + grab.y)
  await page.mouse.down()
  const to = { x: area.x + fx * area.width, y: area.y + fy * area.height }
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(100)
  return { area, expectedLeft: to.x - grab.x, expectedRight: to.x + grab.x }
}

const marginLeft = (el: Locator) => el.evaluate((n: HTMLElement) => n.style.marginLeft)
const marginRight = (el: Locator) => el.evaluate((n: HTMLElement) => n.style.marginRight)

test('imagem solta à esquerda do meio: fica no ponto, texto à direita, margem preservada', async ({
  page,
}) => {
  await mount(page, { initialContent: CONTENT, width: 900, height: 500 })
  const img = page.locator('#host .ve-content img')
  const { expectedLeft } = await dragTo(page, img, 0.35, 0.4)
  await expect(img).toHaveClass(/pos-left/)
  const box = (await img.boundingBox())!
  expect(Math.abs(box.x - expectedLeft)).toBeLessThan(3)
  expect(parseFloat(await marginLeft(img))).toBeGreaterThan(40)
  // Texto contorna pela direita: há linha de texto ao lado da imagem, à direita
  const besideRight = await page.evaluate(
    ([top, bottom, right]) => {
      const ed = document.querySelector('#host .ve-content')!
      const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      while (walker.nextNode()) {
        range.selectNodeContents(walker.currentNode)
        for (const r of Array.from(range.getClientRects())) {
          if (r.top < bottom && r.bottom > top && r.left >= right + 30) return true
        }
      }
      return false
    },
    [box.y, box.y + box.height, box.x + box.width],
  )
  expect(besideRight).toBe(true)
})

test('imagem solta à direita do meio: flutua à direita, no ponto', async ({ page }) => {
  await mount(page, { initialContent: CONTENT, width: 900, height: 500 })
  const img = page.locator('#host .ve-content img')
  const { expectedRight } = await dragTo(page, img, 0.62, 0.4)
  await expect(img).toHaveClass(/pos-right/)
  const box = (await img.boundingBox())!
  expect(Math.abs(box.x + box.width - expectedRight)).toBeLessThan(3)
  expect(parseFloat(await marginRight(img))).toBeGreaterThan(40)
})

test('solta junto à borda: fica na borda com a margem do CSS, sem estilo a mais', async ({
  page,
}) => {
  await mount(page, { initialContent: CONTENT, width: 900, height: 500 })
  const img = page.locator('#host .ve-content img')
  await dragTo(page, img, 0.03, 0.4)
  await expect(img).toHaveClass(/pos-left/)
  expect(await marginLeft(img)).toBe('')
  expect(await img.evaluate((n) => getComputedStyle(n).marginLeft)).toBe('40px')
})

test('botão de alinhamento desfaz o deslocamento do arrasto', async ({ page }) => {
  await mount(page, { initialContent: CONTENT, width: 900, height: 500 })
  const img = page.locator('#host .ve-content img')
  await dragTo(page, img, 0.35, 0.4)
  expect(await marginLeft(img)).not.toBe('')
  await page.evaluate(() => window.__ref.current!.core!.floatImage('left'))
  expect(await marginLeft(img)).toBe('')
  // O HTML entregue leva a posição (o site mostra igual com versaedit-content.css)
  await dragTo(page, img, 0.35, 0.4)
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toMatch(
    /<img[^>]*margin-left: \d+px[^>]*>/,
  )
})

test('caixa de texto: também fica onde foi solta', async ({ page }) => {
  const box =
    '<div class="rich-textbox" style="width: 160px"><span contenteditable="false" class="textbox-handle">⠿</span>Caixa</div>'
  await mount(page, {
    initialContent: `${box}<p>${TEXT.repeat(2)}</p><p>${TEXT.repeat(3)}</p>`,
    width: 900,
    height: 500,
  })
  const tb = page.locator('#host .ve-content .rich-textbox')
  // Arrasta pela alça
  const handle = tb.locator('.textbox-handle')
  const area = (await page.locator('#host .ve-content').boundingBox())!
  const hb = (await handle.boundingBox())!
  const tb0 = (await tb.boundingBox())!
  const grabDx = hb.x + hb.width / 2 - tb0.x
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  const to = { x: area.x + 0.35 * area.width, y: area.y + 0.4 * area.height }
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(100)
  await expect(tb).toHaveClass(/tb-float-left/)
  const after = (await tb.boundingBox())!
  expect(Math.abs(after.x - (to.x - grabDx))).toBeLessThan(3)
})

test.describe('menu da imagem dentro da área', () => {
  const menuAndImage = async (page: Page) => {
    const [area, img, menu] = await Promise.all([
      page.locator('#host .ve-content').boundingBox(),
      page.locator('#host .ve-content img').boundingBox(),
      page.locator('#host .ve-float-toolbar').boundingBox(),
    ])
    return { area: area!, img: img!, menu: menu! }
  }

  test('normal: acima da imagem, alinhado à esquerda dela, numa linha só', async ({ page }) => {
    await mount(page, { initialContent: CONTENT, width: 900, height: 500 })
    const img = page.locator('#host .ve-content img')
    await dragTo(page, img, 0.35, 0.4)
    const { img: i, menu: m } = await menuAndImage(page)
    expect(m.y + m.height).toBeLessThanOrEqual(i.y)
    expect(Math.abs(m.x - i.x)).toBeLessThan(3)
    expect(m.height).toBeLessThan(40)
  })

  test('perto da borda direita: o menu inverte e alinha pela direita da imagem', async ({
    page,
  }) => {
    await mount(page, { initialContent: CONTENT, width: 900, height: 500 })
    const img = page.locator('#host .ve-content img')
    await dragTo(page, img, 0.93, 0.4)
    const { area: a, img: i, menu: m } = await menuAndImage(page)
    expect(m.x + m.width).toBeLessThanOrEqual(a.x + a.width)
    expect(Math.abs(m.x + m.width - (i.x + i.width))).toBeLessThan(3)
    expect(m.height).toBeLessThan(40)
  })

  test('imagem no topo: o menu vai para baixo dela, sem cobrir a barra', async ({ page }) => {
    await mount(page, {
      initialContent: `<p>${IMG} Texto ao lado.</p>`,
      width: 900,
      height: 400,
    })
    await page.locator('#host .ve-content img').click()
    const { area: a, img: i, menu: m } = await menuAndImage(page)
    expect(m.y).toBeGreaterThanOrEqual(i.y + i.height)
    expect(m.y).toBeGreaterThanOrEqual(a.y)
  })
})
