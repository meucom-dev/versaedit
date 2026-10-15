import { describe, expect, it } from 'vitest'
import {
  buildHtmlPage,
  htmlFileName,
  isHtmlFile,
  paperWrap,
  serializeEditorContent,
  snapshotEditor,
  splitPaper,
} from '../../src/core/file'

describe('cor do papel no HTML salvo', () => {
  it('ve-paper ida e volta', () => {
    const html = paperWrap('#ffeeaa', '<p>x</p>')
    expect(html).toBe(
      '<div class="ve-paper" data-paper="#ffeeaa" style="background-color:#ffeeaa;"><p>x</p></div>',
    )
    expect(splitPaper(html)).toEqual({ paper: '#ffeeaa', inner: '<p>x</p>' })
  })
  it('lê o nome antigo amesa-paper', () => {
    const old =
      '<div class="amesa-paper" data-paper="#fff" style="background-color:#fff;"><p>x</p></div>'
    expect(splitPaper(old)).toEqual({ paper: '#fff', inner: '<p>x</p>' })
  })
  it('sem marcador: papel vazio e conteúdo intacto', () => {
    expect(splitPaper('<p>x</p>')).toEqual({ paper: '', inner: '<p>x</p>' })
  })
  it('cor inválida no marcador é descartada', () => {
    const bad = '<div class="ve-paper" data-paper="red;x:y" style=""><p>x</p></div>'
    expect(splitPaper(bad).paper).toBe('')
  })
})

describe('serializar', () => {
  it('snapshot tira as marcas de seleção e arrasto', () => {
    const el = document.createElement('div')
    el.innerHTML =
      '<img class="selected pos-left" src="a.png"><div class="rich-textbox dragging">t</div>'
    expect(snapshotEditor(el, '')).toBe(
      '<img class="pos-left" src="a.png"><div class="rich-textbox">t</div>',
    )
    // o editor em si não é alterado
    expect(el.querySelector('.selected')).not.toBeNull()
  })
  it('serializa com o papel quando definido', () => {
    const el = document.createElement('div')
    el.innerHTML = '<p>x</p>'
    expect(serializeEditorContent(el, '')).toBe('<p>x</p>')
    expect(serializeEditorContent(el, '#000')).toContain('data-paper="#000"')
  })
})

describe('arquivo .html', () => {
  it('página completa com idioma, gerador e título escapado', () => {
    const page = buildHtmlPage('<p>x</p>', 'pt-BR', 'A & <B>')
    expect(page).toContain('<html lang="pt-BR">')
    expect(page).toContain('<meta name="generator" content="VersaEdit">')
    expect(page).toContain('<title>A &amp; &lt;B&gt;</title>')
    expect(page).toContain('<body><p>x</p></body>')
  })
  it('nome do arquivo com data e hora', () => {
    expect(htmlFileName('conteudo', new Date(2026, 0, 5, 9, 7))).toBe(
      'conteudo-2026-01-05-0907.html',
    )
  })
  it('reconhece arquivo .html pelo nome ou pelo tipo', () => {
    expect(isHtmlFile(new File([''], 'a.HTML'))).toBe(true)
    expect(isHtmlFile(new File([''], 'a.htm'))).toBe(true)
    expect(isHtmlFile(new File([''], 'sem-ext', { type: 'text/html' }))).toBe(true)
    expect(isHtmlFile(new File([''], 'a.txt', { type: 'text/plain' }))).toBe(false)
  })
})
