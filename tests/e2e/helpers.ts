import type { Page } from '@playwright/test'
import type { VersaEditProps } from '../../src'
import type { HarnessOptions, HarnessOutput } from '../../playground/harness'

export const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC'
export const pngFile = (name = 'a.png') => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
})

/** Monta um editor na página de testes e devolve atalhos para os testes */
export async function mount(
  page: Page,
  props: Partial<VersaEditProps> = {},
  options: HarnessOptions = {},
) {
  await page.goto('/harness.html')
  await page.waitForFunction(() => typeof window.__mount === 'function')
  await page.evaluate(([p, o]) => window.__mount(p, o), [props, options] as const)
  const content = page.locator('#host .ve-content')
  return {
    content,
    toolbar: page.locator('#host .ve-toolbar'),
    btn: (name: string) =>
      page.locator('#host .ve-toolbar').getByRole('button', { name, exact: true }),
    out: () => page.evaluate(() => window.__out) as Promise<HarnessOutput>,
    html: () => page.evaluate(() => window.__out.html),
    dom: () => content.evaluate((el) => el.innerHTML),
    caretToEnd: async () => {
      await content.click()
      await page.keyboard.press('Control+End')
    },
  }
}

/** Seleciona o primeiro trecho igual a `text` dentro do editor */
export async function selectText(page: Page, text: string) {
  await page.evaluate((t) => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const i = node.data.indexOf(t)
      if (i >= 0) {
        const range = document.createRange()
        range.setStart(node, i)
        range.setEnd(node, i + t.length)
        ed.focus()
        getSelection()!.removeAllRanges()
        getSelection()!.addRange(range)
        return
      }
    }
    throw new Error(`texto não encontrado: ${t}`)
  }, text)
  await page.waitForTimeout(50)
}

/** Seleção do início de `a` até o fim de `b` (podem estar em nós diferentes) */
export async function selectAcross(page: Page, a: string, b: string) {
  await page.evaluate(
    ([a, b]) => {
      const ed = document.querySelector<HTMLElement>('#host .ve-content')!
      const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      let started = false
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (!started && node.data.includes(a)) {
          range.setStart(node, node.data.indexOf(a))
          started = true
        }
        if (started && node.data.includes(b)) {
          range.setEnd(node, node.data.indexOf(b) + b.length)
          break
        }
      }
      ed.focus()
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(range)
    },
    [a, b] as const,
  )
  await page.waitForTimeout(50)
}

/** Valor serializado para comparar com o resultado de referência */
export const snap = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
