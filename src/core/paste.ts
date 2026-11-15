// ─── COLAGEM (Word, Google Docs, texto simples) ──────────────────
import type { FontFamilyOption } from './defaults'
import { cssFontSizeToPoints } from './fonts'
import { isSafeUrl, purifyHtml } from './sanitize'
import type { PendingTypingStyle } from './selection'
import {
  formatPt,
  LINE_HEIGHT_NUMBER,
  LINE_HEIGHT_PT,
  LIST_STYLE_TYPES,
  normalizeListBox,
  normalizeSpacing,
} from './spacing'
import { parseWordListIndents, parseWordListLevels, reconstructWordLists } from './word-lists'
import { isWordHtml, parseWordRules, resolveWordSpacing, type WordSpacing } from './word-styles'

export function clipboardFontSizePoints(html: string): number | null {
  if (!html) return null
  const clipboardDoc = new DOMParser().parseFromString(html, 'text/html')
  const styledElement = clipboardDoc.body.querySelector<HTMLElement>('[style*="font-size"]')
  const inlineSize = styledElement?.style.fontSize
  if (inlineSize) return cssFontSizeToPoints(inlineSize)

  const sizeInMarkup = html.match(/font-size\s*:\s*([\d.]+\s*(?:pt|px))/i)?.[1]
  if (sizeInMarkup) return cssFontSizeToPoints(sizeInMarkup)

  const legacySize = Number(clipboardDoc.body.querySelector('font[size]')?.getAttribute('size'))
  const legacyPoints: Record<number, number> = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 }
  return legacyPoints[legacySize] ?? null
}

export function clipboardFontFamily(html: string, fontFamilies: FontFamilyOption[]): string | null {
  if (!html) return null
  const clipboardDoc = new DOMParser().parseFromString(html, 'text/html')
  const styledElement = clipboardDoc.body.querySelector<HTMLElement>('[style*="font-family"]')
  const families = Array.from(html.matchAll(/font-family\s*:\s*([^;{}]+)/gi)).map((match) =>
    match[1].split(',')[0].replace(/['"]/g, '').trim().toLowerCase(),
  )
  if (styledElement?.style.fontFamily) {
    families.unshift(
      styledElement.style.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase(),
    )
  }

  for (const family of families) {
    const matchingFont = fontFamilies.find(
      (font) => font.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase() === family,
    )
    if (matchingFont) return matchingFont.value
  }
  return null
}

export interface PasteOptions {
  /** Mantém as imagens coladas (endereço validado); false descarta */
  images: boolean
  /**
   * Espaçamento de documentos do Word: 'remove' (padrão, como sempre) ou
   * 'preserve' (espaço antes e depois, recuos, entrelinha e parágrafos vazios)
   */
  spacing?: 'remove' | 'preserve'
  /**
   * Entrelinha "normal" da fonte no navegador (múltiplo do tamanho), para
   * converter a entrelinha múltipla do Word; sem ela (ou sem layout), o múltiplo
   * do Word é gravado como está
   */
  measureLineHeight?: (fontFamily: string) => number | null
}

const DEFAULT_PASTE_OPTIONS: PasteOptions = { images: true }

// Tabelas, linhas e código entram na colagem; imagens dependem da opção
const TABLE_TAGS = ['TABLE', 'CAPTION', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD']
const CELL_TAGS = new Set(['TD', 'TH'])
const TH_SCOPES = new Set(['row', 'col', 'rowgroup', 'colgroup'])

// Mescla de células: só números inteiros de 1 a 1000
const validSpan = (value: string | null): string | null =>
  value && /^\d{1,4}$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= 1000
    ? String(Number(value))
    : null

// Atributos que cada tag preserva na colagem (o resto é removido)
function keptAttributes(element: Element, wordLists = false): [string, string][] {
  const tag = element.tagName
  const kept: [string, string][] = []
  const get = (name: string) => element.getAttribute(name)
  // Listas reconstruídas do Word (pasteSpacing: 'preserve'): número de partida e
  // tipo de numeração; no modo padrão, como sempre, nenhum atributo de lista
  if (wordLists && tag === 'OL') {
    const start = get('start')
    if (start && /^\d{1,4}$/.test(start) && Number(start) > 1)
      kept.push(['start', String(Number(start))])
    const type = get('type')
    if (type && ['1', 'a', 'A', 'i', 'I'].includes(type)) kept.push(['type', type])
  }
  if (tag === 'A' && get('href') !== null) kept.push(['href', get('href')!])
  if (CELL_TAGS.has(tag)) {
    const colspan = validSpan(get('colspan'))
    const rowspan = validSpan(get('rowspan'))
    if (colspan && colspan !== '1') kept.push(['colspan', colspan])
    if (rowspan && rowspan !== '1') kept.push(['rowspan', rowspan])
  }
  if (tag === 'TH' && TH_SCOPES.has((get('scope') ?? '').toLowerCase())) {
    kept.push(['scope', get('scope')!.toLowerCase()])
  }
  if (tag === 'IMG') {
    const src = get('src') ?? ''
    if (src && isSafeUrl('src', src)) kept.push(['src', src])
    const alt = get('alt')
    if (alt) kept.push(['alt', alt])
    for (const dim of ['width', 'height']) {
      const value = get(dim)
      if (value && /^\d{1,5}$/.test(value.trim())) kept.push([dim, value.trim()])
    }
  }
  return kept
}

export function sanitizeRichPaste(
  html: string,
  fontFamilies: FontFamilyOption[],
  options: PasteOptions = DEFAULT_PASTE_OPTIONS,
): string {
  const pasted = new DOMParser().parseFromString(purifyHtml(html), 'text/html')
  // Word costuma definir Aptos em regras CSS de classes Mso*, não inline.
  // Lemos a família antes de remover a folha de estilos do clipboard.
  const inheritedClipboardFamily = clipboardFontFamily(html, fontFamilies)
  // Espaçamento do Word (pasteSpacing: 'preserve'): resolvido antes de as classes
  // e os estilos de origem serem removidos, e reaplicado normalizado no fim
  const spacing = new Map<Element, WordSpacing>()
  const preserveWord = options.spacing === 'preserve' && isWordHtml(html)
  if (preserveWord) {
    const rules = parseWordRules(html)
    pasted.body.querySelectorAll('*').forEach((block) => {
      const resolved = resolveWordSpacing(block, rules)
      if (resolved) spacing.set(block, withTextFont(block, resolved))
    })
    // Listas do Word (parágrafos mso-list e listas mistas) viram ul/ol/li
    reconstructWordLists(
      pasted.body,
      parseWordListLevels(html),
      spacing,
      parseWordListIndents(html),
    )
  }
  pasted.body
    .querySelectorAll('script,style,meta,link,iframe,object,embed')
    .forEach((node) => node.remove())

  const allowedTags = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'DIV',
    'DEL',
    'EM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'I',
    'LI',
    'OL',
    'P',
    'S',
    'SPAN',
    'STRONG',
    'SUB',
    'SUP',
    'U',
    'UL',
    ...TABLE_TAGS,
    'HR',
    'PRE',
    'CODE',
    ...(options.images ? ['IMG'] : []),
  ])
  const elements = Array.from(pasted.body.querySelectorAll('*'))
  for (const element of elements) {
    if (!element.isConnected) continue
    if (element.tagName === 'FONT') {
      const span = pasted.createElement('span')
      const fontSize = cssFontSizeToPoints(element.getAttribute('size') ?? '')
      const face = element.getAttribute('face')
      const color = element.getAttribute('color')
      if (fontSize) span.style.fontSize = `${fontSize}pt`
      if (face) span.style.fontFamily = face
      if (color && CSS.supports('color', color)) span.style.color = color
      while (element.firstChild) span.appendChild(element.firstChild)
      element.replaceWith(span)
      continue
    }
    if (!allowedTags.has(element.tagName)) {
      // Imagem recusada (opção desligada) sai inteira; as outras tags dão lugar ao conteúdo
      if (element.tagName === 'IMG') element.remove()
      else element.replaceWith(...Array.from(element.childNodes))
      continue
    }
    // Imagem sem endereço (ou com endereço recusado, que o DOMPurify já
    // removeu) não tem o que mostrar
    const imgSrc = element.tagName === 'IMG' ? (element.getAttribute('src') ?? '').trim() : ''
    if (element.tagName === 'IMG' && (!imgSrc || !isSafeUrl('src', imgSrc))) {
      element.remove()
      continue
    }

    const style = element instanceof HTMLElement ? element.style : null
    const fontSize = style ? cssFontSizeToPoints(style.fontSize) : null
    const fontFamily = style?.fontFamily
      ? style.fontFamily.replace(/[^a-zA-Z0-9 ,"'_-]/g, '').trim()
      : (inheritedClipboardFamily ?? '')
    const color = style?.color
    const backgroundColor = style?.backgroundColor
    const fontWeight = style?.fontWeight
    const fontStyle = style?.fontStyle
    const textDecoration = style?.textDecoration
    const textAlign = style?.textAlign
    const lineHeight = Number.parseFloat(style?.lineHeight ?? '')
    // Tipo de marcador das listas reconstruídas do Word (resiste ao Layout Mirror)
    const isList = preserveWord && (element.tagName === 'OL' || element.tagName === 'UL')
    const listStyle = isList ? (style?.listStyleType ?? '') : ''
    // Recuo e margens das listas reconstruídas (como no Word)
    const listBox = isList
      ? ([
          ['margin-top', style?.marginTop ?? ''],
          ['margin-bottom', style?.marginBottom ?? ''],
          ['padding-left', style?.paddingLeft ?? ''],
        ] as const)
      : []

    const kept = keptAttributes(element, preserveWord)
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name)
    for (const [name, value] of kept) element.setAttribute(name, value)

    if (style) {
      style.cssText = ''
      if (fontSize !== null) style.fontSize = `${fontSize}pt`
      if (fontFamily) style.fontFamily = fontFamily
      if (color && CSS.supports('color', color)) style.color = color
      // Preserva o marca-texto (spans) e o sombreamento de células de tabela,
      // mas não fundos de outros containers copiados.
      if (
        (element.tagName === 'SPAN' || CELL_TAGS.has(element.tagName)) &&
        backgroundColor &&
        CSS.supports('background-color', backgroundColor)
      ) {
        style.backgroundColor = backgroundColor
      }
      if (fontWeight && /^(bold|bolder|[1-9]00)$/.test(fontWeight)) style.fontWeight = fontWeight
      if (fontStyle === 'italic' || fontStyle === 'oblique') style.fontStyle = fontStyle
      if (textDecoration && /underline|line-through/.test(textDecoration)) {
        style.textDecoration = textDecoration
      }
      if (textAlign && ['left', 'center', 'right', 'justify'].includes(textAlign)) {
        style.textAlign = textAlign
      }
      if (Number.isFinite(lineHeight) && lineHeight >= 0.8 && lineHeight <= 3) {
        style.lineHeight = String(lineHeight)
      }
      if (LIST_STYLE_TYPES.has(listStyle)) style.listStyleType = listStyle
      for (const [property, raw] of listBox) {
        const value = raw ? normalizeListBox(property, raw) : null
        if (value) style.setProperty(property, value)
      }
      // Imagem colada sem largura definida não passa da largura do editor
      if (element.tagName === 'IMG' && !element.getAttribute('width')) style.maxWidth = '100%'
      const blockSpacing = spacing.get(element)
      if (blockSpacing && element instanceof HTMLElement) {
        applyWordSpacing(element, blockSpacing, options.measureLineHeight, inheritedClipboardFamily)
      }
      // Nenhum estilo permitido: tira o atributo vazio (style="")
      if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
    }

    if (element.tagName === 'A') {
      const href = (element as HTMLAnchorElement).getAttribute('href') ?? ''
      if (!/^(https?:|mailto:|#)/i.test(href)) element.removeAttribute('href')
    }
  }

  // Blocos vazios saem — mas não os que só contêm imagem, linha ou tabela. Com
  // o espaçamento do Word preservado, os parágrafos vazios do Word (linhas em
  // branco, <o:p>&nbsp;</o:p>) ficam, como <p><br></p> com o tamanho de fonte
  // que tinham (a altura da linha em branco)
  pasted.body.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li').forEach((block) => {
    if ((block.textContent ?? '').trim() || block.querySelector('img,hr,table')) return
    if (block.tagName === 'P' && spacing.has(block)) keepEmptyParagraph(block as HTMLElement)
    else block.remove()
  })
  return pasted.body.innerHTML
}

// Fonte e tamanho do texto do parágrafo (o Word põe a fonte de um parágrafo
// diferente do estilo num span interno): definem a linha simples da entrelinha
function withTextFont(block: Element, resolved: WordSpacing): WordSpacing {
  const inner = block.querySelector<HTMLElement>('[style*="font-family"], [style*="font-size"]')
  if (!inner) return resolved
  const out = { ...resolved }
  const family = inner.style.fontFamily
  const size = cssFontSizeToPoints(inner.style.fontSize)
  if (family) out.textFontFamily = family
  if (size !== null) out.fontSizePt = size
  return out
}

// Espaçamento resolvido do Word no bloco colado, normalizado e dentro dos limites.
// Espaço antes e depois sempre (inclusive 0: o Word não tem o espaçamento do
// site); recuos só quando existem. Entrelinha:
// - múltipla (115%): o Word multiplica a linha simples DO WORD para a fonte; o
//   navegador não conhece essa medida. Grava-se o mesmo múltiplo sobre a linha
//   simples DO NAVEGADOR para a mesma fonte (medida, sem tabela): mesmo
//   significado, mas não a mesma altura (diferença de cerca de -8% a +6% nas
//   fontes comuns). Sem medida, o múltiplo fica como está (múltiplo do tamanho);
// - exata: a mesma altura em pt;
// - pelo menos: a altura pedida ou a linha simples, a que for maior.
function applyWordSpacing(
  el: HTMLElement,
  s: WordSpacing,
  measure: PasteOptions['measureLineHeight'],
  fallbackFamily: string | null,
) {
  const set = (property: Parameters<typeof normalizeSpacing>[0], value?: number, zero = true) => {
    if (value === undefined || (!zero && value === 0)) return
    const normalized = normalizeSpacing(property, `${value}pt`)
    if (normalized) el.style.setProperty(property, normalized)
  }
  set('margin-top', s.marginTop)
  set('margin-bottom', s.marginBottom)
  set('margin-left', s.marginLeft, false)
  set('text-indent', s.textIndent, false)
  const lh = s.lineHeight
  if (!lh) return
  // Linha simples da fonte em que o navegador vai desenhar o parágrafo: a do texto
  // dele, a aplicada ao bloco, a do estilo do Word ou a da colagem
  const family = s.textFontFamily || el.style.fontFamily || s.fontFamily || fallbackFamily || ''
  const single = measure?.(family) ?? null
  if (lh.kind === 'multiple') {
    const value = single ? lh.value * single : lh.value
    const [low, high] = LINE_HEIGHT_NUMBER
    el.style.lineHeight = String(Number(Math.min(high, Math.max(low, value)).toFixed(3)))
  } else {
    const minimum = lh.kind === 'atLeast' && single ? single * (s.fontSizePt ?? 12) : 0
    const [low, high] = LINE_HEIGHT_PT
    el.style.lineHeight = formatPt(Math.min(high, Math.max(low, lh.pt, minimum)))
  }
}

// Parágrafo vazio do Word: uma linha em branco, com o tamanho de fonte dela
function keepEmptyParagraph(block: HTMLElement) {
  const sized = block.querySelector<HTMLElement>('[style*="font-size"]')
  const br = block.ownerDocument.createElement('br')
  if (sized) {
    const span = block.ownerDocument.createElement('span')
    span.style.fontSize = sized.style.fontSize
    span.appendChild(br)
    block.replaceChildren(span)
  } else {
    block.replaceChildren(br)
  }
}

// HTML a inserir na colagem: o conteúdo rico do clipboard, quando houver texto
// nele; senão o texto simples (com o tamanho e a fonte de origem, se conhecidos)
export function buildPasteHtml(
  clipboardHtml: string,
  clipboardText: string,
  singleLineBreaks: boolean,
  fontFamilies: FontFamilyOption[],
  options: PasteOptions = DEFAULT_PASTE_OPTIONS,
): { html: string; fontSizePt: number | null; fontFamily: string | null } {
  const pastedText = singleLineBreaks ? clipboardText.replace(/\n{2,}/g, '\n') : clipboardText
  const richHtml = sanitizeRichPaste(clipboardHtml, fontFamilies, options)
  const hasRichText =
    Boolean(richHtml.replace(/<[^>]*>/g, '').trim()) || /<(img|hr|table)\b/i.test(richHtml)
  const pastedFontSizePt = clipboardFontSizePoints(clipboardHtml)
  const pastedFontFamily = clipboardFontFamily(clipboardHtml, fontFamilies)
  const safeHtml = pastedText
    .split('\n')
    .map((line) =>
      line.replace(
        /[&<>"']/g,
        (char) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[char]!,
      ),
    )
    .join('<br>')
  const pastedStyles = [
    pastedFontSizePt ? `font-size:${pastedFontSizePt}pt` : '',
    pastedFontFamily ? `font-family:${pastedFontFamily}` : '',
  ].filter(Boolean)
  const formattedPlainText = pastedStyles.length
    ? `<span style="${pastedStyles.join(';')}">${safeHtml}</span>`
    : safeHtml
  return {
    html: hasRichText ? richHtml : formattedPlainText,
    fontSizePt: pastedFontSizePt,
    fontFamily: pastedFontFamily,
  }
}

export function applyPendingStyleToFragment(
  fragment: DocumentFragment,
  style: PendingTypingStyle,
): HTMLSpanElement | null {
  fragment.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    if (style.fontSize) element.style.removeProperty('font-size')
    if (style.color) element.style.removeProperty('color')
    if (style.fontFamily) element.style.removeProperty('font-family')
    if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
  })

  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    if (textNode.textContent) textNodes.push(textNode)
  }

  let lastStyledSpan: HTMLSpanElement | null = null
  textNodes.forEach((textNode) => {
    const span = document.createElement('span')
    if (style.fontSize) span.style.fontSize = style.fontSize
    if (style.color) span.style.color = style.color
    if (style.fontFamily) span.style.fontFamily = style.fontFamily
    textNode.parentNode?.replaceChild(span, textNode)
    span.appendChild(textNode)
    lastStyledSpan = span
  })
  return lastStyledSpan
}
