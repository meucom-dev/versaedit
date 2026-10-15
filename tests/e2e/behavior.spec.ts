// Comportamento de referência do editor: cada ação grava o HTML resultante e
// compara com o arquivo em __snapshots__/behavior.spec.ts/<ação>.json.
// Uma diferença indica mudança de comportamento: se for intencional, atualize
// com `npm run test:e2e -- --update-snapshots` e revise o diff dos arquivos.
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { mount, pngFile, PNG, selectAcross, selectText, snap } from './helpers'

const check = (name: string, value: unknown) => expect(snap(value)).toMatchSnapshot(`${name}.json`)

test('carregar', async ({ page }) => {
  const t = await mount(page, {
    initialContent:
      '<p style="margin:9px">um <span class="x" onclick="a()">dois</span></p><script>1</script>',
  })
  check('carregar', { dom: await t.dom(), changes: (await t.out()).changes })
})

test('digitar', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>abc</p>' })
  await t.caretToEnd()
  await page.keyboard.type(' def')
  check('digitar', await t.html())
})

const FORMAT: [string, string][] = [
  ['negrito', 'Bold (Ctrl+B)'],
  ['italico', 'Italic (Ctrl+I)'],
  ['sublinhado', 'Underline (Ctrl+U)'],
  ['h2', 'Heading H2'],
  ['citacao', 'Quote'],
  ['centralizar', 'Center'],
  ['lista', 'Bulleted list'],
  ['lista-num', 'Numbered list'],
  ['recuo', 'Increase indent'],
  ['limpar-formatacao', 'Clear formatting'],
]
for (const [name, label] of FORMAT) {
  test(name, async ({ page }) => {
    const t = await mount(page, { initialContent: '<p>alpha <b>beta</b> gamma</p>' })
    await selectAcross(page, 'alpha', 'be')
    await t.btn(label).click()
    check(name, await t.html())
  })
}

test('tamanho-18', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'beta')
  await page.locator('#host select[aria-label="Font size"]').selectOption('18')
  check('tamanho-18', await t.html())
})

test('fonte-georgia', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'alpha')
  await page.locator('#host button[aria-label="Font family"]').click()
  await page.locator('#host .ve-font-option', { hasText: 'Georgia' }).click()
  check('fonte-georgia', {
    html: await t.html(),
    label: await page.locator('#host .ve-font-button').textContent(),
  })
})

test('cor-texto', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'beta')
  await page.locator('#host button[aria-label="Text color"]').click()
  await page.locator('#host .ve-swatch[title="#E74C3C"]').click()
  check('cor-texto', await t.html())
})

test('cor-papel', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>' })
  await selectText(page, 'alpha')
  await page.locator('#host button[aria-label="Paper color"]').click()
  await page.locator('#host .ve-swatch[title="#F1C40F"]').click()
  check('cor-papel', await t.html())
})

test('marca-texto', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha beta</p>' })
  await selectText(page, 'beta')
  await t.btn('Highlight').click()
  await page.locator('#host .ve-highlight-swatch[title="#51CF66"]').click()
  check('marca-texto', await t.html())
})

test('estilo-pendente', async ({ page }) => {
  // Sem seleção: o tamanho escolhido vale para o próximo texto digitado
  const t = await mount(page, { initialContent: '<p>abc</p>' })
  await t.caretToEnd()
  await page.locator('#host select[aria-label="Font size"]').selectOption('24')
  await page.keyboard.type('XY')
  check('estilo-pendente', await t.html())
})

test('link', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>' })
  await selectText(page, 'alpha')
  await t.btn('Insert link (Ctrl+K)').click()
  const form = page.locator('#host .ve-link-popover')
  await form.getByLabel('Link URL:').fill('example.com')
  await form.getByLabel('Link text:').fill('site')
  await form.getByRole('button', { name: 'Apply' }).click()
  check('link', await t.html())
})

test('linha', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>' })
  await t.caretToEnd()
  await t.btn('Insert horizontal line').click()
  check('linha', await t.html())
})

test('caixa-texto', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>' })
  await t.caretToEnd()
  await t.btn('Insert text box').click()
  check('caixa-texto', await t.html())
})

test('imagem', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>' })
  await t.caretToEnd()
  const chooser = page.waitForEvent('filechooser')
  await t.btn('Insert image').click()
  await (await chooser).setFiles(pngFile())
  await page.waitForTimeout(300)
  const inserted = await t.html()
  // Selecionar, redimensionar 50%, centralizar, excluir
  await page.locator('#host .ve-content img').click()
  const toolbar = await page.locator('#host .ve-float-toolbar').isVisible()
  const handle = await page.locator('#host .ve-resize-handle').isVisible()
  await page.locator('#host .ve-float-toolbar button', { hasText: '50%' }).click()
  const half = await t.html()
  await page.locator('#host .ve-float-toolbar button', { hasText: 'Center' }).click()
  const centered = await t.html()
  await page.locator('#host .ve-float-toolbar .ve-danger').click()
  const deleted = await t.html()
  check('imagem', { inserted, toolbar, handle, half, centered, deleted })
})

test('caixa-texto-menu', async ({ page }) => {
  const t = await mount(page, {
    initialContent:
      '<p>alpha</p><div class="rich-textbox"><span class="textbox-handle" contenteditable="false">⠿</span>tb</div>',
  })
  await page.locator('#host .rich-textbox').click({ position: { x: 60, y: 10 } })
  const toolbar = await page.locator('#host .ve-float-toolbar').isVisible()
  await page.locator('#host select[aria-label="Text box border width"]').selectOption('4')
  const w4 = await t.html()
  await page.locator('#host select[aria-label="Text box border line style"]').selectOption('double')
  const dbl = await t.html()
  await page.locator('#host .ve-float-toolbar button', { hasText: '75%' }).click()
  const p75 = await t.html()
  await page.locator('#host .ve-float-toolbar .ve-danger').click()
  const del = await t.html()
  check('caixa-texto-menu', { toolbar, w4, dbl, p75, del })
})

test('desfazer-refazer', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>abc</p>' })
  await t.caretToEnd()
  await page.keyboard.type('XYZ')
  await page.waitForTimeout(700)
  await selectText(page, 'abc')
  await t.btn('Bold (Ctrl+B)').click()
  await page.waitForTimeout(700)
  const after = await t.dom()
  await page.keyboard.press('Control+z')
  const undo1 = await t.dom()
  await page.keyboard.press('Control+z')
  const undo2 = await t.dom()
  await page.keyboard.press('Control+y')
  const redo1 = await t.dom()
  await t.btn('Redo (Ctrl+Y)').click()
  const redo2 = await t.dom()
  check('desfazer-refazer', { after, undo1, undo2, redo1, redo2 })
})

test('colar-word', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>' })
  await t.caretToEnd()
  await t.content.evaluate((el) => {
    const dt = new DataTransfer()
    dt.setData(
      'text/html',
      '<html><head><style>p.MsoNormal{font-family:"Georgia"}</style></head><body><p class="MsoNormal" style="font-size:14pt;color:red;margin:20px" onclick="x()">Word <b>bold</b> <a href="javascript:alert(1)">bad</a> <a href="https://ok.com">ok</a></p><script>1</script></body></html>',
    )
    dt.setData('text/plain', 'Word bold bad ok')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  })
  check('colar-word', await t.html())
})

test('colar-texto', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>alpha</p>', singleLineBreaks: true })
  await t.caretToEnd()
  await t.content.evaluate((el) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'linha 1\n\n\nlinha <2>')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  })
  check('colar-texto', await t.html())
})

test('salvar-abrir', async ({ page }) => {
  const t = await mount(page, {
    initialContent:
      '<div class="ve-paper" data-paper="#ffeeaa" style="background-color:#ffeeaa;"><p>conteúdo <b>salvo</b></p></div>',
  })
  const downloading = page.waitForEvent('download')
  await t.btn('Save to file (.html)').click()
  const download = await downloading
  const file = readFileSync((await download.path())!, 'utf-8')
  await t.btn('Clear the editing area (deletes all content)').click()
  const cleared = await t.html()
  const chooser = page.waitForEvent('filechooser')
  await t.btn('Open file (.html)').click()
  await (
    await chooser
  ).setFiles({ name: 'x.html', mimeType: 'text/html', buffer: Buffer.from(file) })
  await page.waitForTimeout(300)
  const reopened = await t.html()
  check('salvar-abrir', {
    name: download.suggestedFilename().replace(/\d/g, '0'),
    file,
    cleared,
    reopened,
  })
})

test('onSave', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>x</p>' }, { onSave: true })
  await t.btn('Save to file (.html)').click()
  check('onSave', (await t.out()).saved)
})

test('limite-altura', async ({ page }) => {
  const long = '<p>' + 'linha longa de texto '.repeat(400) + '</p>'
  const t = await mount(page, { initialContent: long, height: 160, truncateOnOverflow: true })
  const o = await t.out()
  const len = await t.content.evaluate((el) => el.textContent!.length)
  check('limite-altura', {
    overflow: o.overflow,
    emitted: o.html !== null,
    shorter: len < 400 * 21,
  })
})

test('overflow-sem-corte', async ({ page }) => {
  const long = '<p>' + 'texto '.repeat(1500) + '</p>'
  const t = await mount(page, { initialContent: long, height: 160 })
  check('overflow-sem-corte', (await t.out()).overflow)
})

test('tab', async ({ page }) => {
  const t = await mount(page, { initialContent: '<p>ab</p>' })
  await t.caretToEnd()
  await page.keyboard.press('Tab')
  check('tab', await t.html())
})

test('nudge-imagem', async ({ page }) => {
  const t = await mount(page, {
    initialContent: `<p>alpha</p><img src="data:image/png;base64,${PNG}" class="pos-left" style="width:40px">`,
  })
  await page.locator('#host .ve-content img').click()
  await page.keyboard.press('Control+ArrowRight')
  await page.keyboard.press('Control+Shift+ArrowDown')
  const nudged = await t.html()
  await page.keyboard.press('Alt+ArrowRight')
  const floated = await t.html()
  await page.keyboard.press('Delete')
  const deleted = await t.html()
  check('nudge-imagem', { nudged, floated, deleted })
})

test('pt-BR', async ({ page }) => {
  await mount(page, {
    locale: 'pt-BR',
    showFileButtons: false,
    accentColor: '#7d8c6a',
    frame: { width: 6, color: '#8fbc8f', radius: 16 },
  })
  const labels = await page
    .locator('#host .ve-toolbar button[aria-label]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  const frame = await page
    .locator('#host .ve-frame')
    .evaluate((el: HTMLElement) => el.style.border + ' | ' + el.style.borderRadius)
  const accent = await page
    .locator('#host .ve-root')
    .evaluate((el: HTMLElement) => el.style.getPropertyValue('--ve-accent'))
  check('pt-BR', { labels, frame, accent })
})
