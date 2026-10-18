// onError e onConfirm: a aplicação trata avisos e confirmações; sem eles, o
// editor continua usando alert() e confirm() do navegador.
import { expect, test, type Page } from '@playwright/test'
import { mount, pngFile } from './helpers'

const dialogs = (page: Page) => {
  const seen: string[] = []
  page.on('dialog', (d) => {
    seen.push(`${d.type()}:${d.message()}`)
    void d.accept()
  })
  return seen
}

async function openFile(page: Page, name: string, body: string, type = 'text/html') {
  const chooser = page.waitForEvent('filechooser')
  await page
    .locator('#host .ve-toolbar')
    .getByRole('button', { name: 'Open file (.html)', exact: true })
    .click()
  await (await chooser).setFiles({ name, mimeType: type, buffer: Buffer.from(body) })
  await page.waitForTimeout(300)
}

test('onError recebe código, nível e mensagem; nenhum alert', async ({ page }) => {
  const seen = dialogs(page)
  const t = await mount(page, {}, { captureErrors: true })
  await openFile(page, 'notas.txt', 'texto', 'text/plain')
  await openFile(page, 'vazio.html', '<html><body><script>x</script></body></html>')
  expect((await t.out()).errors).toEqual([
    {
      code: 'file-wrong-type',
      level: 'error',
      message: 'Choose an .html file saved by the editor.',
    },
    {
      code: 'file-empty',
      level: 'error',
      message: 'The file has no content that can be opened in the editor.',
    },
  ])
  expect(seen).toEqual([])
})

test('conteúdo cortado chega como aviso (level warning)', async ({ page }) => {
  const t = await mount(page, { height: 120, truncateOnOverflow: true }, { captureErrors: true })
  await openFile(page, 'longo.html', `<p>${'texto longo '.repeat(500)}</p>`)
  expect((await t.out()).errors.map((e) => `${e.code}:${e.level}`)).toEqual([
    'file-truncated:warning',
  ])
})

test('falha no envio de imagem chega ao onError', async ({ page }) => {
  const seen = dialogs(page)
  const t = await mount(
    page,
    { initialContent: '<p>a</p>' },
    { upload: 'fail', captureErrors: true },
  )
  await t.content.click()
  const chooser = page.waitForEvent('filechooser')
  await t.btn('Insert image').click()
  await (await chooser).setFiles(pngFile())
  await expect.poll(async () => (await t.out()).errors.map((e) => e.code)).toEqual(['image-upload'])
  expect(seen).toEqual([])
})

for (const [mode, replaced] of [
  ['no', false],
  ['yes', true],
  ['async-no', false],
  ['async-yes', true],
] as const) {
  test(`onConfirm "${mode}": ${replaced ? 'substitui' : 'mantém'} o conteúdo`, async ({ page }) => {
    const seen = dialogs(page)
    const t = await mount(page, { initialContent: '<p>atual</p>' }, { confirm: mode })
    await openFile(page, 'novo.html', '<html><body><p>novo</p></body></html>')
    await page.waitForTimeout(200)
    expect((await t.out()).confirms).toEqual(['file-replace'])
    expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(
      replaced ? '<p>novo</p>' : '<p>atual</p>',
    )
    expect(seen).toEqual([])
  })
}

test('sem os callbacks: alert e confirm do navegador, como antes', async ({ page }) => {
  const seen = dialogs(page)
  await mount(page, { initialContent: '<p>atual</p>' })
  await openFile(page, 'notas.txt', 'x', 'text/plain')
  await openFile(page, 'novo.html', '<html><body><p>novo</p></body></html>')
  expect(seen).toEqual([
    'alert:Choose an .html file saved by the editor.',
    'confirm:Replace the current content with the file? (Ctrl+Z undoes)',
  ])
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe('<p>novo</p>')
})
