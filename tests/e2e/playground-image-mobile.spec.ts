// Toque na imagem do exemplo do playground (flutuando à direita) em celulares:
// seleciona, abre o menu dentro da área e da tela, sem cobrir a imagem, sem
// rolagem horizontal e sem rolar a página. Antes da correção, o menu era medido
// numa posição provisória que passava da borda direita; no celular a página
// ficava mais larga por um instante, rolava para cima, e o clique do toque caía
// fora da imagem (em 320px, sobre o texto, desmarcando a imagem).
import { expect, test } from '@playwright/test'

const LOAD_IMAGE = { en: 'Load: Image', 'pt-BR': 'Carregar: Imagem', es: 'Cargar: Imagen' } as const

for (const width of [320, 340, 375, 768]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 640 }, hasTouch: true, isMobile: true })
    test.skip(({ browserName }) => browserName === 'firefox', 'isMobile não existe no Firefox')

    for (const locale of Object.keys(LOAD_IMAGE) as (keyof typeof LOAD_IMAGE)[]) {
      test(`${locale}: tocar na imagem seleciona e abre o menu`, async ({ page }) => {
        await page.goto('/')
        await page.locator('.pg-pill select').selectOption(locale)
        await page.locator('#root details summary').first().click()
        await page.getByTestId('props-panel').locator('summary').click()
        await page
          .getByTestId('props-panel')
          .getByRole('button', { name: LOAD_IMAGE[locale] })
          .click()
        await page.locator('#root details summary').first().click()

        const img = page.locator('.ve-content img').first()
        await img.scrollIntoViewIfNeeded()
        const scrollBefore = await page.evaluate(() => window.scrollY)
        const before = (await img.boundingBox())!
        await page.touchscreen.tap(before.x + before.width / 2, before.y + before.height / 2)

        // Selecionada, com o menu aberto
        await expect(img).toHaveClass(/\bselected\b/)
        const menu = page.locator('.ve-float-toolbar')
        await expect(menu).toBeVisible()
        await page.waitForTimeout(300)
        await expect(img).toHaveClass(/\bselected\b/)

        // A página não rolou e a imagem continua no mesmo lugar da tela
        expect(await page.evaluate(() => window.scrollY), 'a página rolou').toBe(scrollBefore)
        const after = (await img.boundingBox())!
        expect(Math.abs(after.y - before.y), 'a imagem saiu do lugar').toBeLessThanOrEqual(1)

        // Menu dentro da área e da tela, sem cobrir a imagem, sem rolagem horizontal
        const m = (await menu.boundingBox())!
        const frame = (await page.locator('.ve-frame').first().boundingBox())!
        expect(m.x).toBeGreaterThanOrEqual(frame.x)
        expect(m.x + m.width).toBeLessThanOrEqual(frame.x + frame.width)
        expect(m.x + m.width).toBeLessThanOrEqual(width)
        const overlap =
          m.x < after.x + after.width &&
          after.x < m.x + m.width &&
          m.y < after.y + after.height &&
          after.y < m.y + m.height
        expect(overlap, 'menu sobre a imagem').toBe(false)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        )
      })
    }
  })
}
