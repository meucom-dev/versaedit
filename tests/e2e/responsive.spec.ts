// width="100%": o editor acompanha a largura do container (acréscimo; com
// números o comportamento é o de sempre, conferido por capturas pixel a pixel)
import { expect, test } from '@playwright/test'
import { mount } from './helpers'

for (const container of [400, 1200]) {
  test(`width="100%" num container de ${container}px`, async ({ page }) => {
    await page.setViewportSize({ width: container + 100, height: 900 })
    const t = await mount(page, { initialContent: '<p>texto</p>', width: '100%', height: 300 })
    await page.evaluate((w) => {
      document.getElementById('host')!.style.width = `${w}px`
    }, container)
    const sizes = await page.evaluate(() => {
      const root = document.querySelector('#host .ve-root') as HTMLElement
      const frame = root.querySelector('.ve-frame') as HTMLElement
      const content = root.querySelector('.ve-content') as HTMLElement
      const toolbar = root.querySelector('.ve-toolbar') as HTMLElement
      const border = parseFloat(getComputedStyle(frame).borderLeftWidth) * 2
      return {
        frame: frame.getBoundingClientRect().width,
        content: content.getBoundingClientRect().width + border,
        toolbar: toolbar.getBoundingClientRect().width,
        toolbarLeft: toolbar.getBoundingClientRect().left - root.getBoundingClientRect().left,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        toolbarRows: Math.round(toolbar.getBoundingClientRect().height / 36),
      }
    })
    expect(sizes.frame).toBe(container)
    expect(sizes.content).toBe(container)
    expect(sizes.toolbar).toBe(container)
    expect(sizes.toolbarLeft).toBe(0)
    expect(sizes.overflow).toBe(false)
    if (container === 400) expect(sizes.toolbarRows).toBeGreaterThan(2)
    await t.caretToEnd()
    await page.keyboard.type(' ok')
    expect(await t.html()).toBe('<p>texto ok</p>')
  })
}

test('width="100%" acompanha o container quando ele muda de tamanho', async ({ page }) => {
  await mount(page, { width: '100%' })
  const frameWidth = () =>
    page.locator('#host .ve-frame').evaluate((el) => el.getBoundingClientRect().width)
  await page.evaluate(() => (document.getElementById('host')!.style.width = '700px'))
  expect(await frameWidth()).toBe(700)
  await page.evaluate(() => (document.getElementById('host')!.style.width = '500px'))
  expect(await frameWidth()).toBe(500)
})
