// Áudio e vídeo externos: nada é baixado no editor por padrão, e o HTML
// entregue continua idêntico ao recebido.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { mount } from './helpers'

const CONTENT =
  '<p>vídeo:</p><video controls="" src="https://media.example/v.mp4" autoplay=""><source src="https://media.example/v.webm" type="video/webm"></video><audio controls="" src="https://media.example/a.mp3"></audio>'

// Conta os pedidos ao servidor de mídia (respondidos com 404, sem rede real)
async function watchMedia(page: Page) {
  const requests: string[] = []
  await page.route('https://media.example/**', (route) => {
    requests.push(route.request().url())
    return route.fulfill({ status: 404, body: '' })
  })
  return requests
}

test('padrão: nenhum pedido ao servidor de mídia; HTML entregue idêntico', async ({ page }) => {
  const requests = await watchMedia(page)
  const t = await mount(page, { initialContent: CONTENT })
  await page.waitForTimeout(800)
  expect(requests).toEqual([])
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(CONTENT)

  // Editar o texto ao lado: a mídia continua idêntica no onChange
  await page.locator('#host .ve-content p').click()
  await page.keyboard.press('End')
  await page.keyboard.type('!')
  expect(await t.html()).toBe(CONTENT.replace('<p>vídeo:</p>', '<p>vídeo:!</p>'))

  // Desfazer e salvar em arquivo também
  await page.waitForTimeout(500)
  await t.btn('Undo (Ctrl+Z)').click()
  expect(await t.html()).toBe(CONTENT)
  await page.waitForTimeout(500)
  expect(requests).toEqual([])
  const downloading = page.waitForEvent('download')
  await t.btn('Save to file (.html)').click()
  const file = readFileSync((await (await downloading).path())!, 'utf-8')
  expect(file).toContain(`<body>${CONTENT}</body>`)
})

test('allowExternalMedia: a mídia carrega como antes', async ({ page }) => {
  const requests = await watchMedia(page)
  await mount(page, { initialContent: CONTENT, allowExternalMedia: true })
  await expect.poll(() => requests.length, { timeout: 5000 }).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(CONTENT)
})
