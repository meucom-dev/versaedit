// Bateria de XSS no navegador real: os vetores chamam window.__xss(id) se forem
// executados. Cada um é carregado (setHTML) e colado; nenhum pode disparar.
import { expect, test } from '@playwright/test'
import { XSS_VECTORS } from '../xss-vectors'
import { mount } from './helpers'

test('nenhum vetor executa código ao carregar ou colar', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __xssHits: string[]; __xss: (id: string) => void }
    w.__xssHits = []
    w.__xss = (id) => w.__xssHits.push(id)
  })
  const t = await mount(page)
  const content = t.content

  for (const [id, html] of XSS_VECTORS) {
    // Carregar
    await page.evaluate((h) => window.__ref.current!.setHTML(h), html)
    await content.hover()
    // Colar no fim do conteúdo
    await content.evaluate((el, h) => {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = getSelection()!
      sel.removeAllRanges()
      sel.addRange(range)
      const dt = new DataTransfer()
      dt.setData('text/html', h)
      dt.setData('text/plain', 'x')
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      )
    }, html)
    await content.hover()
    // Nenhum atributo de evento sobra no conteúdo
    const handlers = await content.evaluate((el) =>
      Array.from(el.querySelectorAll('*')).flatMap((node) =>
        Array.from(node.attributes)
          .filter((a) => a.name.toLowerCase().startsWith('on'))
          .map((a) => `${node.tagName}.${a.name}`),
      ),
    )
    expect(handlers, id).toEqual([])
  }

  // Tempo para erros de imagem, mídia e temporizadores dispararem
  await page.waitForTimeout(500)
  expect(
    await page.evaluate(() => (window as unknown as { __xssHits: string[] }).__xssHits),
  ).toEqual([])
})
