// ─── ESPAÇAMENTO DO WORD NA COLAGEM ──────────────────────────────
// O Word grava a maior parte do espaçamento em regras de classe na folha de
// estilos do documento (p.MsoNormal { margin-bottom: 8pt; line-height: 115% }),
// e só as exceções no style de cada parágrafo. Este módulo resolve essa cascata
// de forma restrita: lê o texto das folhas de estilo (sem aplicá-las nem executar
// nada), aceita só seletores simples (tag, tag.classe ou .classe, agrupados por
// vírgula) e só as propriedades da lista abaixo, com valores de caracteres
// seguros. A ordem é a do CSS: padrão do documento (.MsoPapDefault), tag, classe,
// tag.classe e, por último, o style do próprio parágrafo.
import { lengthToPt, SPACING_BLOCKS } from './spacing'

/** Documento do Microsoft Word (HTML da área de transferência ou salvo pelo Word) */
export function isWordHtml(html: string): boolean {
  return /urn:schemas-microsoft-com:office:(?:office|word)|<meta[^>]+content=["']?Word\.Document|\bclass=["']?Mso[A-Z]/i.test(
    html,
  )
}

const ALLOWED = new Set([
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'text-indent',
  'line-height',
  'mso-line-height-rule',
  'font-size',
  'font-family',
])
const SAFE_VALUE = /^[\w\s.,%"'-]{1,120}$/
const SIMPLE_SELECTOR = /^(p|li|div|h[1-6])?(?:\.([A-Za-z][\w-]*))?$/i
const DOCUMENT_DEFAULT = 'MsoPapDefault'

interface WordRule {
  tag: string | null
  className: string | null
  /** padrão do documento < tag < classe < tag.classe */
  rank: number
  order: number
  declarations: [string, string][]
}

/** Declarações permitidas de um texto de estilo (style="" ou corpo de regra) */
export function parseDeclarations(text: string): [string, string][] {
  const out: [string, string][] = []
  for (const part of text.split(';')) {
    const colon = part.indexOf(':')
    if (colon < 0) continue
    const name = part.slice(0, colon).trim().toLowerCase()
    const value = part
      .slice(colon + 1)
      .replace(/\s+/g, ' ')
      .trim()
    if (ALLOWED.has(name) && SAFE_VALUE.test(value)) out.push([name, value])
  }
  return out
}

/** Regras de espaçamento das folhas de estilo do documento colado */
export function parseWordRules(html: string): WordRule[] {
  const css = Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi), (m) => m[1])
    .join('\n')
    .replace(/<!--|-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
  const rules: WordRule[] = []
  let order = 0
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].trim()
    // @font-face, @page, @list…: não são regras de parágrafo
    if (!selectors || selectors.startsWith('@')) continue
    const declarations = parseDeclarations(match[2])
    if (!declarations.length) continue
    for (const raw of selectors.split(',')) {
      const selector = raw.trim()
      const simple = SIMPLE_SELECTOR.exec(selector)
      if (!simple || (!simple[1] && !simple[2])) continue
      const tag = simple[1]?.toUpperCase() ?? null
      const className = simple[2] ?? null
      const rank =
        className === DOCUMENT_DEFAULT && !tag ? 0 : tag && className ? 3 : className ? 2 : 1
      rules.push({ tag, className, rank, order: order++, declarations })
    }
  }
  return rules
}

/** Espaçamento resolvido de um bloco, em pt (entrelinha conforme a regra do Word) */
export interface WordSpacing {
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  textIndent?: number
  /**
   * multiple: múltiplo da linha simples do Word (115% → 1,15); exact: altura fixa
   * (mso-line-height-rule: exactly); atLeast: altura mínima (comprimento sem regra,
   * que é como o Word exporta "Pelo menos")
   */
  lineHeight?: { kind: 'multiple'; value: number } | { kind: 'exact' | 'atLeast'; pt: number }
  /** Fonte do estilo do Word para o parágrafo */
  fontFamily?: string
  /** Fonte do texto dentro do parágrafo (span), quando difere do estilo */
  textFontFamily?: string
  fontSizePt?: number
}

/** Cascata restrita para um bloco do documento colado */
export function resolveWordSpacing(block: Element, rules: WordRule[]): WordSpacing | null {
  if (!SPACING_BLOCKS.has(block.tagName)) return null
  const matched = rules
    .filter(
      (rule) =>
        (rule.rank === 0 && rule.className === DOCUMENT_DEFAULT) ||
        ((!rule.tag || rule.tag === block.tagName) &&
          (!rule.className || block.classList.contains(rule.className)) &&
          rule.rank > 0),
    )
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
  // div: só com regra própria (div.MsoNormal) ou estilo inline; o padrão do documento
  // é de parágrafos, não do envoltório do corpo (div.WordSection1)
  if (
    block.tagName === 'DIV' &&
    !matched.some((rule) => rule.rank > 0) &&
    !parseDeclarations(block.getAttribute('style') ?? '').length
  ) {
    return null
  }
  const values = new Map<string, string>()
  const assign = (declarations: [string, string][]) => {
    for (const [name, value] of declarations) {
      if (name === 'margin') {
        const parts = value.split(' ')
        if (parts.length < 1 || parts.length > 4) continue
        // 1 a 4 valores, como no CSS: cima, direita, baixo, esquerda
        const top = parts[0]
        const bottom = parts[2] ?? top
        const left = parts[3] ?? parts[1] ?? top
        values.set('margin-top', top)
        values.set('margin-bottom', bottom)
        values.set('margin-left', left)
      } else {
        values.set(name, value)
      }
    }
  }
  for (const rule of matched) assign(rule.declarations)
  assign(parseDeclarations(block.getAttribute('style') ?? ''))

  const fontSizePt = lengthToPt(values.get('font-size') ?? '') ?? undefined
  const out: WordSpacing = {}
  const length = (name: string) => {
    const raw = values.get(name)
    return raw === undefined ? undefined : (lengthToPt(raw, fontSizePt ?? 12) ?? undefined)
  }
  out.marginTop = length('margin-top')
  out.marginBottom = length('margin-bottom')
  out.marginLeft = length('margin-left')
  out.textIndent = length('text-indent')
  const lineHeight = values.get('line-height')?.toLowerCase()
  if (lineHeight) {
    const percent = /^(\d+(?:\.\d+)?)%$/.exec(lineHeight)
    const number = /^(\d+(?:\.\d+)?)$/.exec(lineHeight)
    if (percent) out.lineHeight = { kind: 'multiple', value: Number(percent[1]) / 100 }
    else if (number) out.lineHeight = { kind: 'multiple', value: Number(number[1]) }
    else if (lineHeight === 'normal') out.lineHeight = { kind: 'multiple', value: 1 }
    else {
      const pt = lengthToPt(lineHeight, fontSizePt ?? 12)
      if (pt !== null && pt > 0) {
        const rule = values.get('mso-line-height-rule')?.toLowerCase()
        out.lineHeight = { kind: rule === 'exactly' ? 'exact' : 'atLeast', pt }
      }
    }
  }
  const family = values.get('font-family')
  if (family) out.fontFamily = family
  if (fontSizePt !== undefined) out.fontSizePt = fontSizePt
  return out
}
