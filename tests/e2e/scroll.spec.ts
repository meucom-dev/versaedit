// Rolagem da área de edição (prop scrollable, padrão true) e o menu/alça do
// objeto selecionado acompanhando a rolagem
import { expect, test, type Page } from '@playwright/test'
import { mount, PNG } from './helpers'

const LONG =
  Array.from({ length: 30 }, (_, i) => `<p>Paragraph ${i + 1}</p>`).join('') +
  `<img src="data:image/png;base64,${PNG}" style="width: 80px; height: 80px">` +
  '<p>end</p>'

const scrollTop = (page: Page) => page.locator('#host .ve-content').evaluate((el) => el.scrollTop)

async function wheel(page: Page, dy: number) {
  // Na borda direita da área, longe da imagem e do menu flutuante
  const box = (await page.locator('#host .ve-content').boundingBox())!
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2)
  await page.mouse.wheel(0, dy)
  await page.waitForTimeout(250)
}

test('padrão: o conteúdo maior que a área rola pela roda do mouse', async ({ page }) => {
  await mount(page, { initialContent: LONG, height: 300 }, { overflow: true })
  await expect(page.locator('#host .ve-content')).toHaveClass(/ve-scroll/)
  expect(await scrollTop(page)).toBe(0)
  await wheel(page, 600)
  expect(await scrollTop(page)).toBeGreaterThan(0)
  // O aviso de conteúdo maior que a área continua valendo com a rolagem
  expect((await page.evaluate(() => window.__out)).overflow).toBe(true)
})

test('scrollable={false}: como antes — o que passa fica escondido, sem rolagem', async ({
  page,
}) => {
  await mount(page, { initialContent: LONG, height: 300, scrollable: false })
  await expect(page.locator('#host .ve-content')).not.toHaveClass(/ve-scroll/)
  await wheel(page, 600)
  expect(await scrollTop(page)).toBe(0)
})

test('imagem selecionada: menu e alça acompanham a rolagem e somem fora da área', async ({
  page,
}) => {
  await mount(page, { initialContent: LONG, height: 300 })
  await wheel(page, 2000)
  const img = page.locator('#host .ve-content img')
  await img.click()
  const handle = page.locator('#host .ve-resize-handle')
  const menu = page.locator('#host .ve-float-toolbar')
  await expect(handle).toBeVisible()
  await expect(menu).toBeVisible()

  // Rola um pouco: a alça continua no canto inferior direito da imagem
  await wheel(page, -100)
  const [ib, hb] = await Promise.all([img.boundingBox(), handle.boundingBox()])
  expect(Math.abs(hb!.y + hb!.height / 2 - (ib!.y + ib!.height))).toBeLessThan(4)
  expect(Math.abs(hb!.x + hb!.width / 2 - (ib!.x + ib!.width))).toBeLessThan(4)

  // Imagem fora da parte visível: menu e alça não ficam soltos sobre a página
  await wheel(page, -3000)
  await expect(handle).toHaveCount(0)
  await expect(menu).toHaveCount(0)

  // De volta: reaparecem no lugar
  await wheel(page, 3000)
  await expect(handle).toBeVisible()
  const [ib2, hb2] = await Promise.all([img.boundingBox(), handle.boundingBox()])
  expect(Math.abs(hb2!.y + hb2!.height / 2 - (ib2!.y + ib2!.height))).toBeLessThan(4)
})
