// Revisão antes do push (15/11/2026): a consulta de contêiner do editor e a largura em
// que os objetos se apoiam. Com barra de rolagem na área de edição, o Chromium mede a
// consulta sem descontar a barra; o limite gravado (data-ve-stack) a compensa, para o
// texto nunca ficar abaixo da coluna mínima. Arquivo próprio: o Chromium sem janela
// esconde as barras (--hide-scrollbars), e essa opção vale para o arquivo inteiro.
import { expect, test } from '@playwright/test'
import { mount, PNG } from './helpers'

test.use({
  viewport: { width: 1300, height: 1000 },
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
})

const TEXT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(8)
// 40% + 30,8%: coluna de 120px a partir de ~959px de largura útil (logo abaixo de 960)
const CONTENT =
  `<p>A ${TEXT}</p><p><img class="pos-left" src="data:image/png;base64,${PNG}" style="width: 40%; max-width: 40%;"></p>` +
  `<p>B ${TEXT}</p><div class="rich-textbox tb-float-right" style="width: 30.8%; box-sizing: border-box;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>` +
  `<p>C ${TEXT.repeat(4)}</p>`

test('editor com barra de rolagem: lado a lado só com a coluna mínima, em qualquer largura', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'barra clássica: só o Chromium aceita o argumento')
  await mount(page, { initialContent: CONTENT, width: 1060, height: 300 })
  await page.locator('#host .ve-content p').last().click()
  await page.keyboard.type('x')
  const rows = await page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    const frame = ed.closest<HTMLElement>('.ve-frame')!
    const border = frame.offsetWidth - ed.offsetWidth
    const cs = getComputedStyle(ed)
    const out = []
    for (let w = 985; w <= 1060; w++) {
      frame.style.width = `${w}px`
      ed.style.width = `${w - border}px`
      const inner = ed.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const outer = (el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return {
          top: r.top - parseFloat(s.marginTop),
          bottom: r.bottom + parseFloat(s.marginBottom),
          width: r.width + parseFloat(s.marginLeft) + parseFloat(s.marginRight),
        }
      }
      const a = outer(ed.querySelector('img')!)
      const b = outer(ed.querySelector('.rich-textbox')!)
      const side = a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5
      out.push({
        inner,
        side,
        column: inner - a.width - b.width,
        scrollbar: ed.offsetWidth - ed.clientWidth,
        name: cs.containerName,
      })
    }
    return out
  })
  expect(rows[0].scrollbar).toBeGreaterThan(0)
  expect(rows[0].name).toBe('versaedit')
  // Na faixa varrida há larguras com os dois lado a lado e larguras com um abaixo
  expect(rows.some((r) => r.side)).toBe(true)
  expect(rows.some((r) => !r.side)).toBe(true)
  const squeezed = rows.filter((r) => r.side && r.column < 120)
  expect(squeezed).toEqual([])
})

// Lote 1 do redimensionamento (15/11/2026): a barra de rolagem aparece depois da
// edição (a área ficou mais baixa), sem nova edição e sem mudar o HTML. O limite
// gravado já considera a barra que a área pode ter, então a coluna continua legível.
const SHORT =
  `<p>A ${TEXT}</p><p><img class="pos-left" src="data:image/png;base64,${PNG}" style="width: 40%; max-width: 40%;"></p>` +
  `<p>B ${TEXT}</p><div class="rich-textbox tb-float-right" style="width: 30.8%; box-sizing: border-box;"><span class="textbox-handle" contenteditable="false">⠿</span>caixa</div>` +
  `<p>C</p>`

test('barra de rolagem que aparece ao reduzir a altura: coluna legível e HTML igual', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'barra clássica: só o Chromium aceita o argumento')
  await page.setViewportSize({ width: 1300, height: 1500 })
  await mount(page, { initialContent: SHORT, width: 1060, height: 1300, resizable: true })
  await page.locator('#host .ve-content p').last().click()
  await page.keyboard.press('End')
  await page.keyboard.type('x')
  const noBar = await page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    return ed.offsetWidth - ed.clientWidth
  })
  expect(noBar).toBe(0)
  const saved = await page.evaluate(() => window.__ref.current!.getHTML())
  // Área mais baixa pela alça de baixo: a barra aparece
  const s = (await page.locator('#host .ve-frame-handle-s').boundingBox())!
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 - 1000, { steps: 8 })
  await page.mouse.up()
  const rows = await page.evaluate(() => {
    const ed = document.querySelector<HTMLElement>('#host .ve-content')!
    const frame = ed.closest<HTMLElement>('.ve-frame')!
    const border = frame.offsetWidth - ed.offsetWidth
    const cs = getComputedStyle(ed)
    const out = []
    for (let w = 985; w <= 1060; w++) {
      frame.style.width = `${w}px`
      ed.style.width = `${w - border}px`
      const inner = ed.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const outer = (el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        const st = getComputedStyle(el)
        return {
          top: r.top - parseFloat(st.marginTop),
          bottom: r.bottom + parseFloat(st.marginBottom),
          width: r.width + parseFloat(st.marginLeft) + parseFloat(st.marginRight),
        }
      }
      const a = outer(ed.querySelector('img')!)
      const b = outer(ed.querySelector('.rich-textbox')!)
      const side = a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5
      out.push({
        side,
        column: inner - a.width - b.width,
        scrollbar: ed.offsetWidth - ed.clientWidth,
      })
    }
    return out
  })
  expect(rows[0].scrollbar).toBeGreaterThan(0)
  expect(rows.some((r) => r.side)).toBe(true)
  expect(rows.filter((r) => r.side && r.column < 120)).toEqual([])
  expect(await page.evaluate(() => window.__ref.current!.getHTML())).toBe(saved)
})
