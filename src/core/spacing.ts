// ─── ESPAÇAMENTO DE PARÁGRAFOS ───────────────────────────────────
// Espaço antes e depois, recuo à esquerda, recuo da primeira linha e entrelinha
// de blocos de texto (p, h1–h6, li, div, blockquote). Usado na colagem do Word
// (pasteSpacing: 'preserve') e na sanitização de documentos salvos, que aceita
// esses estilos sempre que forem válidos. Só números com as unidades abaixo,
// dentro de limites: nada de calc(), var(), url() ou valores negativos onde não
// cabem. Os valores saem em pt, a unidade do Word (1pt = 1,333px a 96 dpi).

/** Limites em pt (valores fora são trazidos para o limite) */
export const SPACING_LIMITS = {
  'margin-top': [0, 72],
  'margin-bottom': [0, 72],
  'margin-left': [0, 144],
  'text-indent': [-72, 144],
} as const
export type SpacingProperty = keyof typeof SPACING_LIMITS
export const SPACING_PROPERTIES = Object.keys(SPACING_LIMITS) as SpacingProperty[]

/** Entrelinha absoluta (pt) e múltipla (número sem unidade) */
export const LINE_HEIGHT_PT = [6, 144] as const
export const LINE_HEIGHT_NUMBER = [0.5, 4] as const

/** Blocos de texto que recebem espaçamento */
export const SPACING_BLOCKS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'DIV',
  'BLOCKQUOTE',
])

/** Marcadores aceitos em listas (list-style-type no style de ol/ul) */
export const LIST_STYLE_TYPES = new Set([
  'disc',
  'circle',
  'square',
  'decimal',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
])

const PT_PER_UNIT: Record<string, number> = {
  pt: 1,
  px: 0.75,
  in: 72,
  cm: 72 / 2.54,
  mm: 72 / 25.4,
  pc: 12,
}

const clamp = (value: number, [low, high]: readonly [number, number]) =>
  Math.min(high, Math.max(low, value))
const round = (value: number, digits = 2) => Number(value.toFixed(digits))

/** Comprimento CSS em pt (pt, px, in, cm, mm, pc, em; 0 sem unidade); null se não for */
export function lengthToPt(raw: string, fontSizePt = 12): number | null {
  const match = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(pt|px|in|cm|mm|pc|em)?$/.exec(
    raw.trim().toLowerCase(),
  )
  if (!match) return null
  const number = Number(match[1])
  if (!Number.isFinite(number)) return null
  const unit = match[2]
  if (!unit) return number === 0 ? 0 : null
  return unit === 'em' ? number * fontSizePt : number * PT_PER_UNIT[unit]
}

export const formatPt = (value: number) => `${round(value)}pt`

/** Valor de espaçamento normalizado (pt, dentro do limite); null se inválido */
export function normalizeSpacing(
  property: SpacingProperty,
  raw: string,
  fontSizePt = 12,
): string | null {
  const value = lengthToPt(raw, fontSizePt)
  if (value === null) return null
  return formatPt(clamp(value, SPACING_LIMITS[property]))
}

/**
 * Margens e recuo de listas (ul/ol): espaço em cima e embaixo (0–72pt) e recuo do
 * texto (padding-left, 0–144pt). Usado pelas listas do Word reconstruídas na colagem
 */
export function normalizeListBox(
  property: 'margin-top' | 'margin-bottom' | 'padding-left',
  raw: string,
): string | null {
  return normalizeSpacing(property === 'padding-left' ? 'margin-left' : property, raw)
}

/**
 * Entrelinha de um documento salvo: número sem unidade (múltiplo do tamanho da
 * fonte, como no CSS) ou comprimento absoluto em pt; null se inválida
 */
export function normalizeLineHeight(raw: string, fontSizePt = 12): string | null {
  const value = raw.trim().toLowerCase()
  if (/^\d+(?:\.\d+)?$|^\.\d+$/.test(value)) {
    return String(round(clamp(Number(value), LINE_HEIGHT_NUMBER), 3))
  }
  const pt = lengthToPt(value, fontSizePt)
  return pt === null || pt <= 0 ? null : formatPt(clamp(pt, LINE_HEIGHT_PT))
}

/** Remove os estilos de espaçamento do bloco (Limpar formatação) */
export function clearSpacing(block: HTMLElement, keepMarginLeft: boolean): void {
  for (const property of SPACING_PROPERTIES) {
    if (property === 'margin-left' && keepMarginLeft) continue
    block.style.removeProperty(property)
  }
  block.style.removeProperty('line-height')
  if (block.getAttribute('style') === '') block.removeAttribute('style')
}

/**
 * Entrelinha "normal" da fonte no navegador, em múltiplos do tamanho da fonte.
 * É a linha simples do navegador, medida com a própria fonte (sem tabela): não é
 * a linha simples do Word, que usa outras métricas da mesma fonte (diferenças de
 * cerca de -8% a +6% nas fontes comuns). Medida num tamanho grande para não
 * perder precisão no arredondamento de pixels. null sem layout (servidor, jsdom).
 */
export function measureNormalLineHeight(fontFamily: string): number | null {
  if (typeof document === 'undefined' || !document.body) return null
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;white-space:pre;line-height:normal;font-size:100px;padding:0;border:0;margin:0'
  if (fontFamily) probe.style.fontFamily = fontFamily
  probe.textContent = 'X\nX\nX\nX'
  document.body.appendChild(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  const ratio = height / 4 / 100
  return Number.isFinite(ratio) && ratio > 0.5 && ratio < 3 ? ratio : null
}
