// ─── COLAGEM (Word, Google Docs, texto simples) ──────────────────
import type { FontFamilyOption } from './defaults'
import { cssFontSizeToPoints } from './fonts'
import { isSafeUrl, purifyHtml } from './sanitize'
import type { PendingTypingStyle } from './selection'

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
function keptAttributes(element: Element): [string, string][] {
  const tag = element.tagName
  const kept: [string, string][] = []
  const get = (name: string) => element.getAttribute(name)
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

    const kept = keptAttributes(element)
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
      // Imagem colada sem largura definida não passa da largura do editor
      if (element.tagName === 'IMG' && !element.getAttribute('width')) style.maxWidth = '100%'
      // Nenhum estilo permitido: tira o atributo vazio (style="")
      if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
    }

    if (element.tagName === 'A') {
      const href = (element as HTMLAnchorElement).getAttribute('href') ?? ''
      if (!/^(https?:|mailto:|#)/i.test(href)) element.removeAttribute('href')
    }
  }

  // Blocos vazios saem — mas não os que só contêm imagem, linha ou tabela
  pasted.body.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li').forEach((block) => {
    if (!(block.textContent ?? '').trim() && !block.querySelector('img,hr,table')) block.remove()
  })
  return pasted.body.innerHTML
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
