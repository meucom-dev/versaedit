// ─── ARQUIVO .html E COR DO PAPEL ────────────────────────────────
import { escapeHtml, safeCssColor } from './sanitize'

// Arquivos .html salvos/abertos pelo botão de arquivo
export const FILE_GENERATOR = 'VersaEdit'
export const MAX_OPEN_FILE_BYTES = 20 * 1024 * 1024

// Separa a cor do papel (fundo do editor) do HTML salvo. Lê também o nome
// antigo (amesa-paper), usado pelo conteúdo gravado antes do VersaEdit.
export const PAPER_MARK =
  /^<div class="(?:ve|amesa)-paper" data-paper="([^"]+)"[^>]*>([\s\S]*)<\/div>$/
export const paperWrap = (paper: string, inner: string) =>
  `<div class="ve-paper" data-paper="${paper}" style="background-color:${paper};">${inner}</div>`
export function splitPaper(html: string): { paper: string; inner: string } {
  const m = PAPER_MARK.exec(html)
  return m ? { paper: safeCssColor(m[1]), inner: m[2] } : { paper: '', inner: html }
}

// Conteúdo a salvar: envolve o HTML com a cor do papel, quando definida
export function serializeEditorContent(el: HTMLElement, paper: string): string {
  return paper ? paperWrap(paper, el.innerHTML) : el.innerHTML
}

// HTML do editor para o histórico: sem classes de seleção e com a cor do papel
export function snapshotEditor(el: HTMLElement, paper: string): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.selected, .dragging').forEach((node) => {
    node.classList.remove('selected', 'dragging')
  })
  return paper ? paperWrap(paper, clone.innerHTML) : clone.innerHTML
}

// Página .html completa com o conteúdo do editor (pode ser aberta no navegador)
export function buildHtmlPage(bodyHtml: string, lang: string, title: string): string {
  return [
    '<!doctype html>',
    `<html lang="${lang}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<meta name="generator" content="${FILE_GENERATOR}">`,
    `<title>${escapeHtml(title)}</title>`,
    '</head>',
    `<body>${bodyHtml}</body>`,
    '</html>',
  ].join('\n')
}

// Nome do arquivo: <prefixo>-AAAA-MM-DD-HHMM.html
export function htmlFileName(prefix: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.html`
}

// Baixa o texto como arquivo .html
export function downloadHtml(page: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([page], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Abre o seletor de arquivos do sistema e chama onFile com o arquivo escolhido
export function pickFile(accept: string, onFile: (file: File) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) onFile(file)
  }
  input.click()
}

export const isHtmlFile = (file: File): boolean =>
  /\.html?$/i.test(file.name) || file.type === 'text/html'
