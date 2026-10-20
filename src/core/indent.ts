// ─── RECUO E CITAÇÃO ─────────────────────────────────────────────
// O recuo do navegador tem duas formas: Chromium e WebKit envolvem o bloco num
// <blockquote> sem borda e com margem esquerda; o Firefox (em modo CSS) põe
// margin-left no próprio bloco. Uma citação é um <blockquote> comum.
// A distinção é feita pelos valores que o navegador lê do style (CSSOM), nunca
// pelo texto do atributo, e o blockquote de recuo é marcado com o papel ARIA
// padrão role="presentation": ele não é uma citação, só um deslocamento.

/** Cada nível de recuo do navegador desloca o bloco 40px */
export const INDENT_STEP_PX = 40
const MAX_INDENT_LEVELS = 20

/** Margem esquerda do style, se for um recuo do editor (múltiplo de 40px) */
export function indentMargin(el: HTMLElement): string | null {
  const value = el.style.marginLeft
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value)
  if (!match) return null
  const levels = Number(match[1]) / INDENT_STEP_PX
  return Number.isInteger(levels) && levels >= 1 && levels <= MAX_INDENT_LEVELS ? value : null
}

/** blockquote usado como recuo (sem borda à esquerda e com a margem do recuo) */
export function isIndentBlockquote(el: HTMLElement): boolean {
  return el.tagName === 'BLOCKQUOTE' && el.style.borderLeftStyle === 'none' && !!indentMargin(el)
}

/** Marca os blockquotes de recuo ainda sem papel (depois de recuar no editor) */
export function markIndentBlockquotes(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('blockquote:not([role])').forEach((el) => {
    if (isIndentBlockquote(el)) el.setAttribute('role', 'presentation')
  })
}
