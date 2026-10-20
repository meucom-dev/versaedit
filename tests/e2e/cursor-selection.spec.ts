// Cursor e seleção nas operações do editor: o texto digitado depois de cada
// operação entra no ponto esperado. Imagem selecionada.
import { expect, test, type Page } from '@playwright/test'
import { mount, PNG } from './helpers'

const IMG = `<img src="data:image/png;base64,${PNG}" style="width: 60px">`
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
