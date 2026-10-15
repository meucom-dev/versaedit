import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { CTooltip } from '@coreui/react'
import { createEditorHistory } from './editorHistory'
import { isSafeUrl, purifyHtml } from './sanitize'
import CIcon from '@coreui/icons-react'
import {
  cilImage,
  cilBold,
  cilItalic,
  cilList,
  cilAlignLeft,
  cilAlignCenter,
  cilAlignRight,
  cilActionUndo,
  cilActionRedo,
  cilLink,
  cilMinus,
  cilUnderline,
  cilIndentDecrease,
  cilIndentIncrease,
  cilCheckCircle,
  cilX,
} from '@coreui/icons'

// ─── HELPER COMPONENTS (outside render) ───────────────────────────
const ToolbarSep = () => <div className="editor-toolbar-sep" />

const ToolbarBtn = ({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) => (
  <CTooltip content={title}>
    <button
      type="button"
      className="editor-toolbar-btn"
      // Mantém o foco e o cursor no editor ao usar a barra de ferramentas
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </button>
  </CTooltip>
)

// ─── INJECTED STYLES ──────────────────────────────────────────────
const IMAGE_EDITOR_STYLE_ID = 'rich-editor-image-styles'
function injectImageEditorStyles() {
  if (document.getElementById(IMAGE_EDITOR_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = IMAGE_EDITOR_STYLE_ID
  style.textContent = `
    .editor-content img { cursor: pointer; transition: outline 0.15s; outline: 2px solid transparent; outline-offset: 2px; display: block; -webkit-user-drag: none; user-drag: none; }
    .editor-content img:hover { outline-color: rgba(125,140,106,0.5); }
    .editor-content img.selected { outline-color: #7D8C6A; outline-width: 3px; cursor: grab; }
    .editor-content img.selected:active { cursor: grabbing; }
    .editor-content img.pos-left { float: left; margin: 40px; max-width: 50%; }
    .editor-content img.pos-right { float: right; margin: 40px; max-width: 50%; }
    .editor-content img.pos-center { display: block; margin: 40px auto; max-width: 100%; clear: both; }
    .editor-content img.dragging,
    .editor-content .rich-textbox.dragging { opacity: 0.7; outline: 2px dashed #7D8C6A; position: relative; z-index: 60; cursor: grabbing; }
    .img-toolbar { position: absolute; display: flex; gap: 4px; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 4px 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 100; }
    .img-toolbar button { border: none; background: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #555; }
    .img-toolbar button:hover { background: #f0f0f0; }
    .img-toolbar button.danger { color: #dc3545; }
    .color-picker-wrapper { position: relative; display: inline-flex; align-items: center; }
    .color-picker-wrapper input[type="color"] { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
    .color-indicator { display: block; width: 10px; height: 10px; margin-top: 1px; border-radius: 50%; border: 1px solid #bbb; box-sizing: border-box; }
    .color-palette { position: absolute; top: 100%; left: 0; z-index: 120; display: grid; grid-template-columns: repeat(6, 22px); gap: 6px; padding: 8px; margin-top: 4px; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
    .color-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #bbb; padding: 0; cursor: pointer; position: relative; overflow: hidden; }
    .color-swatch:hover { box-shadow: 0 0 0 2px #7D8C6A; }
    .color-picker-wrapper .color-swatch--custom { background: conic-gradient(#e74c3c, #f1c40f, #27ae60, #2980b9, #8e44ad, #e74c3c); }
    .color-picker-wrapper .color-swatch--custom input[type="color"] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: auto; cursor: pointer; }
    .editor-content .rich-textbox {
      border: 1px dashed #7D8C6A;
      padding: 10px;
      margin: 40px;
      min-height: 40px;
      min-width: 100px;
      position: relative;
      cursor: text;
      user-select: text;
      overflow: auto;
      outline: 2px solid transparent;
      outline-offset: 2px;
      transition: outline 0.15s;
      background: rgba(125,140,106,0.03);
      clear: both;
    }
    .editor-content .rich-textbox:hover { outline-color: rgba(125,140,106,0.3); }
    .editor-content .rich-textbox.selected { outline-color: #7D8C6A; outline-width: 3px; cursor: text; }
    .editor-content .rich-textbox.tb-float-left { float: left; margin: 40px; max-width: 50%; }
    .editor-content .rich-textbox.tb-float-right { float: right; margin: 40px; max-width: 50%; }
    .textbox-handle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: #7D8C6A;
      background: rgba(125,140,106,0.15);
      border: 1px solid rgba(125,140,106,0.4);
      border-radius: 4px;
      font-size: 14px;
      line-height: 1;
      user-select: none;
      -webkit-user-drag: none;
      padding: 4px 8px;
      margin-right: 6px;
      vertical-align: middle;
    }
    .textbox-handle:active { cursor: grabbing; }
    .resize-handle {
      position: absolute;
      width: 14px;
      height: 14px;
      background: #7D8C6A;
      border: 2px solid #ffffff;
      border-radius: 3px;
      cursor: nwse-resize;
      z-index: 110;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      user-select: none;
      -webkit-user-drag: none;
    }
    .resize-handle:hover { background: #5f6f4d; }
    .editor-content:empty::before {
      content: attr(data-placeholder);
      color: #999;
      pointer-events: none;
      font-style: italic;
    }
    .editor-toolbar-btn { border: none !important; background: none !important; cursor: pointer !important; padding: 4px 6px !important; border-radius: 4px !important; color: #555 !important; font-size: 13px !important; line-height: 1 !important; min-width: 28px !important; min-height: 28px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
    .editor-toolbar-btn:hover { background: #e8e8e8 !important; }
    .editor-toolbar-sep { width: 1px; background: #ddd; margin: 0 4px; align-self: stretch; }
    .editor-select { border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; font-size: 12px; color: #555; background: #fff; cursor: pointer; min-height: 28px; }
    .editor-select:hover { background: #f0f0f0; }
    .font-family-picker { position: relative; display: inline-flex; }
    .font-family-options { position: absolute; top: calc(100% + 2px); left: 0; z-index: 130; min-width: 220px; max-height: 300px; overflow-y: auto; padding: 4px; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
    .font-family-option { display: block; width: 100%; padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; color: #333; text-align: left; cursor: pointer; }
    .font-family-option:hover, .font-family-option[aria-selected="true"] { background: #f0f0f0; }
    .editor-content blockquote { border-left: 3px solid #7D8C6A; margin: 0; padding: 8px 16px; background: rgba(125,140,106,0.05); color: #555; font-style: italic; clear: both; }
    .editor-content h1, .editor-content h2, .editor-content h3, .editor-content h4, .editor-content h5, .editor-content h6 { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; margin: 0; padding: 0; line-height: 1.2; }
    .editor-content p { margin: 0; padding: 0; line-height: 1.3; }
    .editor-content p:first-child { margin-top: 0; padding-top: 0; }
    .editor-content p:last-child { margin-bottom: 0; padding-bottom: 0; }
    .editor-content div { margin: 0; padding: 0; }
    .editor-content span { margin: 0; padding: 0; }
    .editor-content.banner-text-preview p { margin: 0 0 1rem; line-height: 1.6; color: #3F4A43; }
    .editor-content.banner-text-preview h1,
    .editor-content.banner-text-preview h2,
    .editor-content.banner-text-preview h3,
    .editor-content.banner-text-preview h4,
    .editor-content.banner-text-preview h5,
    .editor-content.banner-text-preview h6 {
      font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
      font-weight: 600;
      line-height: 1.2;
      color: #14201A;
      margin: 0 0 0.5rem;
    }
    .editor-content.banner-text-preview h1 { font-size: 3rem; }
    .editor-content.banner-text-preview h2 { font-size: 2.5rem; }
    .editor-content.banner-text-preview h3 { font-size: 2rem; }
    .editor-content.banner-text-preview h4 { font-size: 1.5rem; }
    .editor-content.banner-text-preview h5 { font-size: 1.25rem; }
    .editor-content.banner-text-preview h6 { font-size: 1.125rem; }
  `
  document.head.appendChild(style)
}

// ─── CONSTANTS ────────────────────────────────────────────────────
const FONT_FAMILIES = [
  { label: 'Aptos', value: 'Aptos, "Segoe UI", Arial, sans-serif' },
  { label: 'Aptos Display', value: '"Aptos Display", Aptos, "Segoe UI", Arial, sans-serif' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Fraunces', value: 'Fraunces, Georgia, "Times New Roman", serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Inter', value: 'Inter, Arial, sans-serif' },
  { label: 'Montserrat', value: "'Montserrat', Arial, sans-serif" },
  { label: 'Open Sans', value: "'Open Sans', Arial, sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', Georgia, 'Times New Roman', serif" },
  { label: 'Poppins', value: 'Poppins, Arial, sans-serif' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif' },
  { label: 'sans-serif', value: 'sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Arial, sans-serif' },
  { label: 'serif', value: 'serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
]

// Tamanhos em pontos tipográficos, como no Word (1pt = 4/3 CSS px).
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((pt) => ({
  label: `${pt} pt`,
  value: String(pt),
}))

function cssFontSizeToPoints(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*(pt|px)?$/i)
  if (!match) return null
  const rawSize = Number(match[1])
  const points = match[2]?.toLowerCase() === 'pt' ? rawSize : rawSize * 0.75
  return Number.isFinite(points) && points >= 6 && points <= 72 ? points : null
}

function closestFontSizeOption(points: number): string {
  return FONT_SIZES.reduce(
    (closest, option) =>
      Math.abs(Number(option.value) - points) < Math.abs(Number(closest) - points)
        ? option.value
        : closest,
    FONT_SIZES[0].value,
  )
}

function clipboardFontSizePoints(html: string): number | null {
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

function clipboardFontFamily(html: string): string | null {
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
    const matchingFont = FONT_FAMILIES.find(
      (font) => font.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase() === family,
    )
    if (matchingFont) return matchingFont.value
  }
  return null
}

function sanitizeRichPaste(html: string): string {
  const pasted = new DOMParser().parseFromString(purifyHtml(html), 'text/html')
  // Word costuma definir Aptos em regras CSS de classes Mso*, não inline.
  // Lemos a família antes de remover a folha de estilos do clipboard.
  const inheritedClipboardFamily = clipboardFontFamily(html)
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
      element.replaceWith(...Array.from(element.childNodes))
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

    for (const attribute of Array.from(element.attributes)) {
      if (element.tagName === 'A' && attribute.name === 'href') continue
      element.removeAttribute(attribute.name)
    }

    if (style) {
      style.cssText = ''
      if (fontSize !== null) style.fontSize = `${fontSize}pt`
      if (fontFamily) style.fontFamily = fontFamily
      if (color && CSS.supports('color', color)) style.color = color
      // Preserve marca-texto de spans, mas não fundos de containers copiados.
      if (
        element.tagName === 'SPAN' &&
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
    }

    if (element.tagName === 'A') {
      const href = (element as HTMLAnchorElement).getAttribute('href') ?? ''
      if (!/^(https?:|mailto:|#)/i.test(href)) element.removeAttribute('href')
    }
  }

  pasted.body.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li').forEach((block) => {
    if (!(block.textContent ?? '').trim()) block.remove()
  })
  return pasted.body.innerHTML
}

type TbBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'
const TB_BORDER_STYLES: { label: string; value: TbBorderStyle }[] = [
  { label: 'Linha sólida', value: 'solid' },
  { label: 'Linha tracejada', value: 'dashed' },
  { label: 'Linha pontilhada', value: 'dotted' },
  { label: 'Linha dupla', value: 'double' },
]

const HEADING_BLOCKS = [
  { label: 'Parágrafo', tag: 'p' },
  { label: 'Título H2', tag: 'h2' },
  { label: 'Título H3', tag: 'h3' },
  { label: 'Título H4', tag: 'h4' },
  { label: 'Citação', tag: 'blockquote' },
]

// ─── DIMENSÕES DA ÁREA DE BLOG DO SITE (WYSIWYG) ─────────────────
// Medidas reais do bloco de Blog do site (scripts/measure-blog-area.mjs):
// bloco de 564 × 704 px com moldura verde de 6px e cantos de 16px,
// superfície branca de 552 × 692 px com respiro de 32px → coluna de
// texto de 488 × 628 px. O editor reproduz o bloco exatamente, para
// que a formatação encaixe perfeitamente ao publicar.
const BLOG_BLOCK_W = 564 // largura padrão do bloco (moldura incluída)
const BLOG_BLOCK_H = 704 // altura padrão do bloco (moldura incluída)
const BLOCK_BORDER = 6 // moldura verde do bloco (6px em cada lado)
// Fontes do site (iguais às de SITE_A_MESA/src/scss/_tokens.scss)
const SITE_FONT_BODY =
  "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

// ─── POSITION HELPERS ─────────────────────────────────────────────
// Ponto de inserção do conteúdo sob o mouse (Blink/WebKit e Firefox)
function getCaretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (typeof doc.caretRangeFromPoint === 'function') return doc.caretRangeFromPoint(x, y)
  const pos =
    typeof doc.caretPositionFromPoint === 'function' ? doc.caretPositionFromPoint(x, y) : null
  if (pos) {
    const range = document.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    return range
  }
  return null
}

// ─── PROPS ────────────────────────────────────────────────────────
export interface VersaEditProps {
  initialContent?: string
  onChange?: (html: string) => void
  onOverflowChange?: (isOverflowing: boolean) => void
  contentClassName?: string
  contentStyle?: React.CSSProperties
  placeholder?: string
  singleLineBreaks?: boolean
  truncateOnOverflow?: boolean
  // Largura e altura totais do bloco (moldura incluída). Permite que o editor
  // assuma a mesma largura do cabeçalho e da área de exibição do site.
  width?: number
  height?: number
  // Largura das ferramentas (padrão: a mesma do bloco), centralizadas sobre o bloco
  toolbarWidth?: number
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}

// Aceita apenas valores de cor válidos (evita injeção de CSS pela cor do papel)
function safeCssColor(value: string): string {
  const color = value.trim()
  return color && /^[#a-z0-9(),.%\s]+$/i.test(color) && CSS.supports('color', color) ? color : ''
}

// Classes criadas pelo próprio editor — as únicas preservadas ao carregar conteúdo
const EDITOR_CLASSES = new Set([
  'pos-left',
  'pos-right',
  'pos-center',
  'rich-textbox',
  'tb-float-left',
  'tb-float-right',
  'textbox-handle',
])

// Propriedades de layout preservadas apenas em imagens, caixas de texto e linhas
// separadoras (posição, tamanho, deslocamento e borda definidos no editor).
// Textos comuns continuam sem margens/espaçamentos — inclusive os vindos da landing.
const LAYOUT_PROPERTIES = [
  'width',
  'max-width',
  'height',
  'transform',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-radius',
  'border-top',
  'border-style',
  'border-width',
  'border-color',
  'clear',
]

function isLayoutElement(el: Element): boolean {
  return el.tagName === 'IMG' || el.tagName === 'HR' || el.classList.contains('rich-textbox')
}

// Remove estilos inline, classes de layout e atributos de cor dos elementos HTML
function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(purifyHtml(html), 'text/html')
  doc.body.querySelectorAll('*').forEach((el) => {
    const inlineStyle = el instanceof HTMLElement ? el.style : null
    const keepLayout = isLayoutElement(el)
    const layout =
      keepLayout && inlineStyle
        ? LAYOUT_PROPERTIES.map((property) => [property, inlineStyle.getPropertyValue(property)])
        : []
    const editorClasses = Array.from(el.classList).filter((name) => EDITOR_CLASSES.has(name))
    const fontSizePt = inlineStyle ? cssFontSizeToPoints(inlineStyle.fontSize) : null
    const fontFamily = inlineStyle?.fontFamily
      ? inlineStyle.fontFamily.replace(/[^a-zA-Z0-9 ,"'_-]/g, '').trim()
      : ''
    const color = inlineStyle?.color || el.getAttribute('color') || ''
    const backgroundColor = inlineStyle?.backgroundColor || el.getAttribute('bgcolor') || ''
    const fontWeight = inlineStyle?.fontWeight || ''
    const fontStyle = inlineStyle?.fontStyle || ''
    const textDecoration = inlineStyle?.textDecoration || ''
    const textAlign = inlineStyle?.textAlign || ''
    const lineHeight = Number.parseFloat(inlineStyle?.lineHeight ?? '')
    el.removeAttribute('style')
    el.removeAttribute('class')
    el.removeAttribute('data-paper')
    el.removeAttribute('color')
    el.removeAttribute('bgcolor')
    el.removeAttribute('face')
    el.removeAttribute('size')
    if (el instanceof HTMLElement) {
      if (fontSizePt !== null) el.style.fontSize = `${fontSizePt}pt`
      if (fontFamily) el.style.fontFamily = fontFamily
      if (color && CSS.supports('color', color)) el.style.color = color
      if (
        el.tagName === 'SPAN' &&
        backgroundColor &&
        CSS.supports('background-color', backgroundColor)
      ) {
        el.style.backgroundColor = backgroundColor
      }
      if (/^(bold|bolder|[1-9]00)$/.test(fontWeight)) el.style.fontWeight = fontWeight
      if (fontStyle === 'italic' || fontStyle === 'oblique') el.style.fontStyle = fontStyle
      if (textDecoration && /underline|line-through/.test(textDecoration)) {
        el.style.textDecoration = textDecoration
      }
      if (['left', 'center', 'right', 'justify'].includes(textAlign)) {
        el.style.textAlign = textAlign
      }
      if (Number.isFinite(lineHeight) && lineHeight >= 0.8 && lineHeight <= 3) {
        el.style.lineHeight = String(lineHeight)
      }
      for (const [property, value] of layout) {
        if (value) el.style.setProperty(property, value)
      }
    }
    if (editorClasses.length) el.classList.add(...editorClasses)
    // Remove tags <font> antigas, mantendo o conteúdo
    if (el.tagName === 'FONT') {
      const parent = el.parentNode
      while (el.firstChild) parent?.insertBefore(el.firstChild, el)
      parent?.removeChild(el)
    }
  })
  return doc.body.innerHTML
}

// Arquivos .html salvos/abertos pelo botão de arquivo
const FILE_GENERATOR = 'AMesa RichEditor'
const MAX_OPEN_FILE_BYTES = 20 * 1024 * 1024

// Separa a cor do papel (fundo do editor) do HTML salvo
const PAPER_MARK = /^<div class="amesa-paper" data-paper="([^"]+)"[^>]*>([\s\S]*)<\/div>$/
function splitPaper(html: string): { paper: string; inner: string } {
  const m = PAPER_MARK.exec(html)
  return m ? { paper: safeCssColor(m[1]), inner: m[2] } : { paper: '', inner: html }
}

const isNodeWithinEditor = (editor: HTMLElement, node: Node): boolean =>
  node === editor || editor.contains(node)

const isRangeWithinEditor = (editor: HTMLElement, range: Range): boolean =>
  isNodeWithinEditor(editor, range.commonAncestorContainer)

// Ouvintes de mousemove/mouseup do documento durante um arrasto ou redimensionamento
type MouseListener = (e: MouseEvent) => void
function createPointerTracker() {
  let active: { move: MouseListener; up: MouseListener } | null = null
  const stop = () => {
    if (!active) return
    document.removeEventListener('mousemove', active.move)
    document.removeEventListener('mouseup', active.up)
    active = null
  }
  return {
    start(move: MouseListener, up: MouseListener) {
      stop()
      active = { move, up }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    },
    stop,
  }
}

// Aplica a fonte ou a cor de pré-visualização ao trecho selecionado
function setPreviewWrapperStyle(
  wrapper: HTMLSpanElement,
  property: 'fontFamily' | 'color',
  value: string,
) {
  wrapper.style.fontFamily = ''
  wrapper.style.color = ''
  if (property === 'fontFamily') wrapper.style.fontFamily = value
  else wrapper.style.color = value
}

// Conteúdo a salvar: envolve o HTML com a cor do papel, quando definida
function serializeEditorContent(el: HTMLElement, paper: string): string {
  return paper
    ? `<div class="amesa-paper" data-paper="${paper}" style="background-color:${paper};">${el.innerHTML}</div>`
    : el.innerHTML
}

// HTML do editor para o histórico: sem classes de seleção e com a cor do papel
function snapshotEditor(el: HTMLElement, paper: string): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.selected, .dragging').forEach((node) => {
    node.classList.remove('selected', 'dragging')
  })
  return paper
    ? `<div class="amesa-paper" data-paper="${paper}" style="background-color:${paper};">${clone.innerHTML}</div>`
    : clone.innerHTML
}

function measureEditorContentHeight(editor: HTMLElement): number {
  const measure = editor.cloneNode(true) as HTMLElement
  measure.style.setProperty('position', 'fixed', 'important')
  measure.style.setProperty('left', '-100000px', 'important')
  measure.style.setProperty('top', '0', 'important')
  measure.style.setProperty('visibility', 'hidden', 'important')
  measure.style.setProperty('height', 'auto', 'important')
  measure.style.setProperty('min-height', '0', 'important')
  measure.style.setProperty('max-height', 'none', 'important')
  measure.style.setProperty('overflow', 'visible', 'important')
  measure.style.setProperty('width', `${editor.clientWidth}px`, 'important')
  document.body.appendChild(measure)
  const naturalHeight = Math.max(measure.scrollHeight, measure.getBoundingClientRect().height)
  document.body.removeChild(measure)
  return naturalHeight
}

function editorContentExceedsHeight(editor: HTMLElement): boolean {
  return measureEditorContentHeight(editor) > editor.clientHeight + 1
}

// Remove apenas o conteúdo final que ultrapassa a altura física do editor.
// A busca binária corta um prefixo do último nó de texto e preserva formatação.
function truncateEditableToFit(editor: HTMLElement): boolean {
  let changed = false
  let guard = 0

  while (editorContentExceedsHeight(editor) && guard < 2000) {
    guard += 1
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    const nodes: Node[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode)

    const lastText = [...nodes]
      .reverse()
      .find(
        (node): node is Text =>
          node.nodeType === Node.TEXT_NODE && (node.textContent?.length ?? 0) > 0,
      )
    if (lastText) {
      const characters = Array.from(lastText.data)
      let low = 0
      let high = characters.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        lastText.data = characters.slice(0, middle).join('')
        if (!editorContentExceedsHeight(editor)) low = middle
        else high = middle - 1
      }
      lastText.data = characters.slice(0, low).join('')
      changed = true
      if (low === 0 && editorContentExceedsHeight(editor)) lastText.remove()
      continue
    }

    const lastBreak = [...nodes]
      .reverse()
      .find((node): node is HTMLBRElement => node instanceof HTMLBRElement)
    if (lastBreak) {
      lastBreak.remove()
      changed = true
      continue
    }

    const lastChild = editor.lastElementChild
    if (!lastChild) break
    lastChild.remove()
    changed = true
  }

  if (changed) {
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  return changed
}

type SelectionType = 'image' | 'textbox' | null
type PendingTypingStyle = { fontSize?: string; color?: string; fontFamily?: string }
type SelectionPreview = {
  wrapper: HTMLSpanElement
  originalNodes: Node[]
  property: 'fontFamily' | 'color'
}

// ─── COMPONENT ────────────────────────────────────────────────────
const VersaEdit: React.FC<VersaEditProps> = ({
  initialContent = '',
  onChange,
  onOverflowChange,
  contentClassName = '',
  contentStyle,
  placeholder = 'Digite o conteúdo aqui...',
  singleLineBreaks = false,
  truncateOnOverflow = false,
  width = BLOG_BLOCK_W,
  height = BLOG_BLOCK_H,
  toolbarWidth = width,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  // Callbacks sempre atualizados: a tela pode recriar onChange a cada renderização
  // sem que o editor recarregue o conteúdo nem chame uma versão antiga da função
  const onChangeRef = useRef(onChange)
  const onOverflowChangeRef = useRef(onOverflowChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
    onOverflowChangeRef.current = onOverflowChange
  })
  // Último HTML enviado pelo onChange — identifica quando initialContent é
  // apenas o eco do próprio editor (modo controlado, ex.: texto do banner)
  const lastEmittedRef = useRef<string | null>(null)
  const selectedImgRef = useRef<HTMLImageElement | null>(null)
  const selectedTextboxRef = useRef<HTMLDivElement | null>(null)
  const [selectionType, setSelectionType] = useState<SelectionType>(null)
  const [imgToolbarVisible, setImgToolbarVisible] = useState(false)
  const [imgToolbarPos, setImgToolbarPos] = useState({ top: 0, left: 0 })
  const [tbToolbarVisible, setTbToolbarVisible] = useState(false)
  const [tbToolbarPos, setTbToolbarPos] = useState({ top: 0, left: 0 })
  const imgToolbarRef = useRef<HTMLDivElement>(null)
  const tbToolbarRef = useRef<HTMLDivElement>(null)

  // Color state
  const [textColor, setTextColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#FFFF00')
  // Paleta aberta ('text' | 'bg') e seleção guardada para aplicar a cor
  const [colorPalette, setColorPalette] = useState<'text' | 'bg' | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const pendingTypingStyleRef = useRef<PendingTypingStyle>({})
  const selectionPreviewRef = useRef<SelectionPreview | null>(null)
  const [fontMenuOpen, setFontMenuOpen] = useState(false)
  const fontMenuRef = useRef<HTMLDivElement>(null)
  const colorPanelRef = useRef<HTMLDivElement>(null)
  // Cor do papel (fundo do editor, independente do texto), salva com o conteúdo
  const paperRef = useRef('')
  const serializeEditor = (): string =>
    editorRef.current ? serializeEditorContent(editorRef.current, paperRef.current) : ''

  // Cor do papel: colore a superfície do editor, sem afetar o texto
  const applyPaper = (color: string) => {
    const paper = safeCssColor(color)
    paperRef.current = paper
    if (editorRef.current) editorRef.current.style.backgroundColor = paper
    triggerChange()
  }
  const COLOR_PALETTE = [
    '#000000',
    '#434343',
    '#666666',
    '#999999',
    '#CCCCCC',
    '#FFFFFF',
    '#B00020',
    '#E74C3C',
    '#F39C12',
    '#F1C40F',
    '#27AE60',
    '#2E7D32',
    '#1ABC9C',
    '#2980B9',
    '#1B4F72',
    '#8E44AD',
    '#7D8C6A',
    '#B8924A', // Dourado da landing page ($amesa-gold)
    '#A68B4A',
    '#1E3D31', // Verde do banner da landing page ($amesa-olive-dark)
    '#2F5D4A', // Verde secundário ($amesa-olive)
  ]

  // Borda da caixa de texto (menu do editor)
  const [tbBorderColor, setTbBorderColor] = useState('#7D8C6A')
  const [tbBorderWidth, setTbBorderWidth] = useState('1')
  const [tbBorderStyle, setTbBorderStyle] = useState<TbBorderStyle>('dashed')
  const tbBorderColorInputRef = useRef<HTMLInputElement>(null)
  const isTextboxSelected = selectionType === 'textbox'

  // Font state
  const [currentFont, setCurrentFont] = useState('Arial, Helvetica, sans-serif')
  const [currentFontSize, setCurrentFontSize] = useState('12')
  // Paleta de cores do texto tarjado (marca-texto)
  const [highlightPalette, setHighlightPalette] = useState<boolean | null>(null)

  // Drag state
  const isDragging = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const dragType = useRef<'image' | 'textbox' | null>(null)

  // Free resize state (alça de redimensionamento livre)
  const isResizing = useRef(false)
  const resizeElRef = useRef<HTMLElement | null>(null)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const [resizeHandlePos, setResizeHandlePos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    injectImageEditorStyles()
    if (!document.getElementById('rich-editor-landing-fonts')) {
      const fontLink = document.createElement('link')
      fontLink.id = 'rich-editor-landing-fonts'
      fontLink.rel = 'stylesheet'
      fontLink.href =
        'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&family=Open+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;600;700&display=swap'
      document.head.appendChild(fontLink)
    }
  }, [])

  // Histórico próprio de desfazer/refazer (mantido fora do estado do React)
  const [history] = useState(() => createEditorHistory())
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || initialContent === undefined) return

    if (initialContent === lastEmittedRef.current) {
      // Eco do próprio editor (onChange → tela → initialContent): o DOM já está
      // atualizado — nada a recarregar (preserva cursor, seleção e histórico)
      onOverflowChangeRef.current?.(editorContentExceedsHeight(editor))
      return
    }

    // Mudança EXTERNA (carregamento do banco ou troca de item): sanitiza
    // (remove estilos inline da landing e código inseguro) e reinicia o histórico
    lastEmittedRef.current = null
    const { paper, inner } = splitPaper(initialContent)
    const cleanInner = sanitizeHtml(inner)
    paperRef.current = paper
    editor.style.backgroundColor = paper
    if (cleanInner !== editor.innerHTML) {
      editor.innerHTML = cleanInner
    }
    const wasTruncated = truncateOnOverflow && truncateEditableToFit(editor)
    history.reset(snapshotEditor(editor, paper))
    onOverflowChangeRef.current?.(editorContentExceedsHeight(editor))
    if (wasTruncated && onChangeRef.current) {
      const html = serializeEditorContent(editor, paper)
      lastEmittedRef.current = html
      onChangeRef.current(html)
    }
  }, [initialContent, history, truncateOnOverflow])

  // Registra no histórico toda alteração do editor (texto, formatação, imagens,
  // caixas e cor do papel), agrupando a digitação
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const observer = new MutationObserver(() => {
      if (selectionPreviewRef.current) return
      history.schedule(() => snapshotEditor(el, paperRef.current))
    })
    observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true })
    return () => {
      observer.disconnect()
      history.dispose()
    }
  }, [history])

  // Atualiza os seletores de fonte e tamanho conforme a seleção do usuário
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      if (selectionPreviewRef.current) return
      const editor = editorRef.current
      if (!editor) return
      const range = sel.getRangeAt(0)
      if (!isRangeWithinEditor(editor, range)) return
      savedRangeRef.current = range.cloneRange()
      if (!range.collapsed) pendingTypingStyleRef.current = {}
      // Usa o nó de início da seleção (funciona tanto com seleção quanto com cursor)
      const node = range.startContainer
      const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement)
      if (!el) return
      const computed = window.getComputedStyle(el)
      // CSS pixels → pontos tipográficos (mesma unidade e escala do Word).
      const sizePx = parseFloat(computed.fontSize)
      if (Number.isFinite(sizePx)) {
        setCurrentFontSize(closestFontSizeOption((sizePx * 72) / 96))
      }
      // Cor do texto selecionado → atualiza o círculo de cor do texto
      const rgb = computed.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (rgb) {
        const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')
        setTextColor(`#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`.toUpperCase())
      }
      // Família da fonte — pega a primeira família resolvida
      const family = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
      const firstFamily = (value: string) =>
        value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
      const match =
        FONT_FAMILIES.find((font) => firstFamily(font.value) === family) ||
        FONT_FAMILIES.find((font) => font.value.toLowerCase().includes(family)) ||
        FONT_FAMILIES.find((font) => family.includes(firstFamily(font.value)))
      if (match) setCurrentFont(match.value)
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  // ─── HELPERS ─────────────────────────────────────────────────────
  const triggerChange = () => {
    const editor = editorRef.current
    if (!editor) return
    onOverflowChangeRef.current?.(editorContentExceedsHeight(editor))
    if (onChangeRef.current) {
      const html = serializeEditor()
      lastEmittedRef.current = html
      onChangeRef.current(html)
    }
  }

  // As buscas ficam restritas a este editor: outros editores da mesma tela
  // mantêm suas próprias seleções
  const deselectImage = () => {
    editorRef.current?.querySelectorAll('img.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    selectedImgRef.current = null
    setSelectionType(null)
    setImgToolbarVisible(false)
    setResizeHandlePos(null)
  }

  const deselectTextbox = () => {
    editorRef.current?.querySelectorAll('.rich-textbox.selected').forEach((el) => {
      el.classList.remove('selected')
    })
    selectedTextboxRef.current = null
    setSelectionType(null)
    setTbToolbarVisible(false)
    setResizeHandlePos(null)
  }

  const updateToolbarPosition = (img: HTMLImageElement) => {
    const rect = img.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setImgToolbarPos({
        top: rect.top - editorRect.top - 40,
        left: rect.left - editorRect.left,
      })
    }
  }

  const updateTextboxToolbarPosition = (el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setTbToolbarPos({
        top: rect.top - editorRect.top - 40,
        left: rect.left - editorRect.left,
      })
    }
  }

  // Posiciona a alça de redimensionamento no canto inferior direito do elemento
  const updateResizeHandlePosition = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setResizeHandlePos({
        top: rect.bottom - editorRect.top - 7,
        left: rect.right - editorRect.left - 7,
      })
    }
  }

  // ─── REPOSICIONAMENTO POR ARRASTO ───────────────────────────────
  // Limpa os deslocamentos manuais: o espaçamento volta aos 40px do CSS
  const clearManualOffsets = (el: HTMLElement) => {
    el.style.transform = ''
    el.style.marginTop = ''
    el.style.marginLeft = ''
    el.style.marginRight = ''
  }

  // Deslocamento manual atual (translate aplicado pelo arrasto ou pelas setas)
  const getManualOffset = (el: HTMLElement): { x: number; y: number } => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || '')
    return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 }
  }

  // Deslocamento fino livre (setas + Ctrl): move o elemento alguns pixels,
  // por cima do texto, sem alterar o fluxo do conteúdo
  const nudgeElement = (el: HTMLElement, dx: number, dy: number) => {
    const { x, y } = getManualOffset(el)
    el.style.transform = `translate(${x + dx}px, ${y + dy}px)`
  }

  // Faz o elemento flutuar para o lado em que foi solto — assim o texto
  // sempre contorna o elemento com a margem de 40px definida no CSS
  const setFloatSide = (el: HTMLElement, side: 'left' | 'right') => {
    if (el.tagName === 'IMG') {
      el.classList.remove('pos-left', 'pos-right', 'pos-center')
      el.classList.add(side === 'left' ? 'pos-left' : 'pos-right')
    } else {
      el.classList.remove('tb-float-left', 'tb-float-right')
      el.classList.add(side === 'left' ? 'tb-float-left' : 'tb-float-right')
    }
  }

  // Move o elemento um bloco acima/abaixo no fluxo do conteúdo
  const moveElementInFlow = (el: HTMLElement, dir: -1 | 1) => {
    const parent = el.parentNode
    if (!parent) return
    if (dir === -1) {
      const ref = el.previousElementSibling ?? (parent as HTMLElement).previousElementSibling
      if (ref && ref.parentNode) ref.parentNode.insertBefore(el, ref)
    } else {
      const ref = el.nextElementSibling ?? (parent as HTMLElement).nextElementSibling
      if (ref && ref.parentNode) ref.parentNode.insertBefore(el, ref.nextSibling)
    }
    clearManualOffsets(el)
  }

  // Reposiciona o elemento no ponto de queda; se não houver um ponto de texto
  // (por exemplo, em um espaço vazio), encaixa no bloco mais próximo.
  const dropElementAtPoint = (el: HTMLElement, x: number, y: number): boolean => {
    const editor = editorRef.current
    if (!editor) return false

    // Retira temporariamente o elemento do fluxo para que o hit-test encontre
    // o texto que estava sob a imagem, sem deixar o espaço antigo reservado.
    const previousDisplay = el.style.display
    el.style.visibility = 'hidden'
    el.style.display = 'none'
    let range: Range | null = null
    let pointTarget: Element | null = null
    let fallbackBefore: Node | null = null
    let useFallback = false
    try {
      range = getCaretRangeFromPoint(x, y)
      pointTarget = document.elementFromPoint(x, y)

      const editorRect = editor.getBoundingClientRect()
      const pointIsInsideEditor =
        x >= editorRect.left &&
        x <= editorRect.right &&
        y >= editorRect.top &&
        y <= editorRect.bottom

      if (
        pointIsInsideEditor &&
        (!range || !editor.contains(range.startContainer) || el.contains(range.startContainer))
      ) {
        useFallback = true
        let targetBlock: Element | null =
          pointTarget && editor.contains(pointTarget) ? pointTarget : null

        while (targetBlock?.parentElement && targetBlock.parentElement !== editor) {
          targetBlock = targetBlock.parentElement
        }

        if (!targetBlock || targetBlock === editor || targetBlock === el) {
          const blocks = Array.from(editor.children).filter(
            (child): child is HTMLElement => child instanceof HTMLElement && child !== el,
          )
          targetBlock =
            blocks.find((block) => y <= block.getBoundingClientRect().bottom) ??
            (blocks.length ? blocks[blocks.length - 1] : null)
        }

        if (targetBlock && targetBlock !== editor && targetBlock !== el) {
          const rect = targetBlock.getBoundingClientRect()
          fallbackBefore = y < rect.top + rect.height / 2 ? targetBlock : targetBlock.nextSibling
        }
      }
    } finally {
      el.style.display = previousDisplay
      el.style.visibility = ''
    }

    if (useFallback) {
      editor.insertBefore(el, fallbackBefore)
    } else {
      if (!range || !editor.contains(range.startContainer)) return false
      const container = range.startContainer
      if (container === el || el.contains(container)) return false

      if (container.nodeType === Node.TEXT_NODE && container.parentNode) {
        const textNode = container as Text
        const after = textNode.splitText(range.startOffset)
        if (after.previousSibling !== el) container.parentNode.insertBefore(el, after)
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        const parent = container as HTMLElement
        const refNode = parent.childNodes[range.startOffset] ?? null
        if (refNode !== el) parent.insertBefore(el, refNode)
      } else {
        return false
      }
    }

    clearManualOffsets(el)
    const editorRect = editor.getBoundingClientRect()
    setFloatSide(el, x < editorRect.left + editorRect.width / 2 ? 'left' : 'right')
    return true
  }

  // ─── IMAGE POSITION ──────────────────────────────────────────────
  const setImagePosition = (
    img: HTMLImageElement,
    posClass: 'pos-left' | 'pos-right' | 'pos-center',
  ) => {
    img.classList.remove('pos-left', 'pos-right', 'pos-center')
    img.classList.add(posClass)
  }

  // ─── COMMANDS ────────────────────────────────────────────────────
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    triggerChange()
  }

  const getCurrentEditorRange = (editor: HTMLElement): Range | null => {
    const selection = window.getSelection()
    const currentRange = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (currentRange && isRangeWithinEditor(editor, currentRange)) return currentRange.cloneRange()
    const savedRange = savedRangeRef.current
    return savedRange && isRangeWithinEditor(editor, savedRange) ? savedRange.cloneRange() : null
  }

  const restoreEditorRange = (editor: HTMLElement, range: Range) => {
    editor.focus()
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
  }

  const restoreSelectionPreview = () => {
    const preview = selectionPreviewRef.current
    if (!preview) return
    const parent = preview.wrapper.parentNode
    if (!parent) {
      selectionPreviewRef.current = null
      return
    }

    const firstNode = preview.originalNodes[0]
    const lastNode = preview.originalNodes[preview.originalNodes.length - 1]
    preview.originalNodes.forEach((node) => parent.insertBefore(node, preview.wrapper))
    parent.removeChild(preview.wrapper)
    selectionPreviewRef.current = null

    if (firstNode && lastNode) {
      const range = document.createRange()
      range.setStartBefore(firstNode)
      range.setEndAfter(lastNode)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRangeRef.current = range.cloneRange()
    }
  }

  const previewSelectionStyle = (property: 'fontFamily' | 'color', value: string): boolean => {
    const editor = editorRef.current
    if (!editor) return false

    let preview = selectionPreviewRef.current
    if (preview && preview.property !== property) {
      restoreSelectionPreview()
      preview = null
    }

    if (!preview) {
      const range = getCurrentEditorRange(editor)
      if (!range || range.collapsed) return false
      restoreEditorRange(editor, range)
      const originalFragment = range.extractContents()
      const originalNodes = Array.from(originalFragment.childNodes)
      if (!originalNodes.length) return false

      const wrapper = document.createElement('span')
      wrapper.dataset.editorSelectionPreview = 'true'
      wrapper.append(...originalNodes.map((node) => node.cloneNode(true)))
      range.insertNode(wrapper)
      preview = { wrapper, originalNodes, property }
      selectionPreviewRef.current = preview
    }

    preview.wrapper.replaceChildren(...preview.originalNodes.map((node) => node.cloneNode(true)))
    const cssProperty = property === 'fontFamily' ? 'font-family' : 'color'
    preview.wrapper.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
      element.style.removeProperty(cssProperty)
      if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
    })
    setPreviewWrapperStyle(preview.wrapper, property, value)

    const range = document.createRange()
    range.selectNodeContents(preview.wrapper)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
    return true
  }

  const commitSelectionPreview = (property: 'fontFamily' | 'color', value: string): boolean => {
    if (!previewSelectionStyle(property, value)) return false
    const preview = selectionPreviewRef.current
    if (!preview) return false
    preview.wrapper.removeAttribute('data-editor-selection-preview')
    selectionPreviewRef.current = null
    pendingTypingStyleRef.current = {}
    const range = document.createRange()
    range.selectNodeContents(preview.wrapper)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
    triggerChange()
    return true
  }

  const applyFontFamily = (font: string) => {
    setCurrentFont(font)
    const editor = editorRef.current
    if (!editor) return
    const range = getCurrentEditorRange(editor)
    if (!range || range.collapsed) {
      pendingTypingStyleRef.current = { ...pendingTypingStyleRef.current, fontFamily: font }
      if (range) restoreEditorRange(editor, range)
      else editor.focus()
      return
    }

    restoreEditorRange(editor, range)
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('fontName', false, font)
    const updatedSelection = window.getSelection()
    if (updatedSelection?.rangeCount) {
      savedRangeRef.current = updatedSelection.getRangeAt(0).cloneRange()
    }
    triggerChange()
  }

  const chooseFontFamily = (font: string) => {
    setCurrentFont(font)
    if (!commitSelectionPreview('fontFamily', font)) applyFontFamily(font)
    setFontMenuOpen(false)
  }

  // Tamanho em pontos: aplica à seleção de texto no editor ou, sem seleção,
  // ao conteúdo inteiro da caixa de texto selecionada
  const applyFontSizePt = (pt: string) => {
    const editor = editorRef.current
    const range = editor ? getCurrentEditorRange(editor) : null
    if (editor && range?.collapsed) {
      pendingTypingStyleRef.current = { ...pendingTypingStyleRef.current, fontSize: `${pt}pt` }
      restoreEditorRange(editor, range)
      return
    }

    const selection = window.getSelection()
    if (editor && range && !range.collapsed) {
      restoreEditorRange(editor, range)
      const span = document.createElement('span')
      span.style.fontSize = `${pt}pt`
      const contents = range.extractContents()
      contents.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
        element.style.removeProperty('font-size')
        if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
      })
      span.appendChild(contents)
      range.insertNode(span)
      const next = document.createRange()
      next.selectNodeContents(span)
      selection?.removeAllRanges()
      selection?.addRange(next)
      savedRangeRef.current = next.cloneRange()
    } else if (selectedTextboxRef.current) {
      selectedTextboxRef.current.style.fontSize = `${pt}pt`
    }
    triggerChange()
  }

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pt = e.target.value
    setCurrentFontSize(pt)
    applyFontSizePt(pt)
  }

  const handleHeadingChange = (tag: string) => {
    execCommand('formatBlock', tag)
  }

  const handleInsertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const src = typeof ev.target?.result === 'string' ? ev.target.result : ''
        if (!isSafeUrl('src', src)) return
        const img = `<img src="${escapeHtml(src)}" alt="Imagem" class="pos-left" draggable="false" style="max-width:50%;height:auto;border-radius:4px;" />`
        editorRef.current?.focus()
        document.execCommand('insertHTML', false, img)
        triggerChange()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Guarda a seleção de texto antes de o foco sair do editor (clique na paleta)
  const saveSelection = () => {
    const sel = window.getSelection()
    const editor = editorRef.current
    if (sel && sel.rangeCount > 0 && editor) {
      const range = sel.getRangeAt(0)
      if (isRangeWithinEditor(editor, range)) {
        savedRangeRef.current = range.cloneRange()
        if (!range.collapsed) pendingTypingStyleRef.current = {}
      }
    }
  }

  // Aplica a cor de imediato à seleção guardada e devolve o foco ao editor
  const applyColor = (command: 'foreColor' | 'hiliteColor', color: string) => {
    const editor = editorRef.current
    if (!editor) return
    const range = getCurrentEditorRange(editor)
    if (command === 'foreColor' && range?.collapsed) {
      pendingTypingStyleRef.current = { ...pendingTypingStyleRef.current, color }
      restoreEditorRange(editor, range)
      return
    }

    if (range) restoreEditorRange(editor, range)
    if (command === 'hiliteColor') {
      // Cor de fundo = cor do papel do editor, independente do texto
      applyPaper(color)
    } else {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand(command, false, color)
    }
    // Mantém a seleção atualizada após a mudança no DOM
    const after = window.getSelection()
    if (after && after.rangeCount > 0) savedRangeRef.current = after.getRangeAt(0).cloneRange()
    triggerChange()
  }

  const setColorState = (kind: 'text' | 'bg', color: string) => {
    if (kind === 'text') setTextColor(color)
    else setBgColor(color)
  }

  // Escolha na paleta: aplica de imediato e fecha
  const pickColor = (kind: 'text' | 'bg', color: string) => {
    setColorState(kind, color)
    if (kind === 'text' && commitSelectionPreview('color', color)) {
      setColorPalette(null)
      return
    }
    applyColor(kind === 'text' ? 'foreColor' : 'hiliteColor', color)
    setColorPalette(null)
  }

  // Cor personalizada: aplica ao vivo e mantém a paleta aberta
  const pickCustomColor = (kind: 'text' | 'bg', color: string) => {
    setColorState(kind, color)
    applyColor(kind === 'text' ? 'foreColor' : 'hiliteColor', color)
  }

  // Fecha a paleta ao clicar fora dela
  useEffect(() => {
    if (!colorPalette) return
    const onDown = (e: MouseEvent) => {
      if (colorPanelRef.current && !colorPanelRef.current.contains(e.target as Node)) {
        setColorPalette(null)
        restoreSelectionPreview()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [colorPalette])

  useEffect(() => {
    if (!fontMenuOpen) return
    const onDown = (event: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setFontMenuOpen(false)
        restoreSelectionPreview()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [fontMenuOpen])

  // Ícone abre a paleta; círculo aplica a cor atual à seleção e fecha o seletor
  const renderColorPicker = (kind: 'text' | 'bg') => {
    const color = kind === 'text' ? textColor : bgColor
    const command = kind === 'text' ? 'foreColor' : 'hiliteColor'
    const label = kind === 'text' ? 'Cor do texto' : 'Cor do papel'
    const icon = kind === 'text' ? '🎨' : '🪣'
    const keepSelection = (e: React.MouseEvent) => {
      e.preventDefault()
      saveSelection()
    }
    return (
      <div className="color-picker-wrapper">
        <button
          type="button"
          className="editor-toolbar-btn"
          title={label}
          onMouseDown={keepSelection}
          onClick={() => setColorPalette(colorPalette === kind ? null : kind)}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
        </button>
        <button
          type="button"
          className="editor-toolbar-btn"
          title={`${label}: aplicar ${color} e fechar`}
          onMouseDown={keepSelection}
          onClick={() => {
            applyColor(command, color)
            setColorPalette(null)
          }}
        >
          <span className="color-indicator" style={{ backgroundColor: color }} />
        </button>
        {colorPalette === kind && (
          <div className="color-palette" onMouseLeave={restoreSelectionPreview}>
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className="color-swatch"
                title={c}
                style={{ backgroundColor: c }}
                onMouseDown={keepSelection}
                onMouseEnter={() => {
                  if (kind === 'text') previewSelectionStyle('color', c)
                }}
                onClick={() => pickColor(kind, c)}
              />
            ))}
            <label
              className="color-swatch color-swatch--custom"
              title="Cor personalizada"
              onMouseDown={saveSelection}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => pickCustomColor(kind, e.target.value)}
              />
            </label>
          </div>
        )}
      </div>
    )
  }

  // ─── BORDA DA CAIXA DE TEXTO ────────────────────────────────────
  const applyTbBorderColor = (color: string) => {
    setTbBorderColor(color)
    const tb = selectedTextboxRef.current
    if (!tb) return
    tb.style.borderColor = color
    if (tb.style.borderStyle === 'none') {
      tb.style.borderStyle = tbBorderStyle
      if (parseFloat(tb.style.borderWidth || '0') === 0) {
        tb.style.borderWidth = '1px'
        setTbBorderWidth('1')
      }
    }
    triggerChange()
    updateResizeHandlePosition(tb)
  }

  const applyTbBorderWidth = (w: string) => {
    setTbBorderWidth(w)
    const tb = selectedTextboxRef.current
    if (!tb) return
    if (w === '0') {
      tb.style.borderStyle = 'none'
      tb.style.borderWidth = '0px'
    } else {
      tb.style.borderStyle = tbBorderStyle
      tb.style.borderWidth = `${w}px`
    }
    triggerChange()
    updateResizeHandlePosition(tb)
  }

  // Tipo de linha da borda (sólida, tracejada, pontilhada, dupla)
  const applyTbBorderStyle = (style: TbBorderStyle) => {
    setTbBorderStyle(style)
    const tb = selectedTextboxRef.current
    if (!tb) return
    tb.style.borderStyle = style
    const current = parseFloat(tb.style.borderWidth || '0')
    // Sem espessura, ou espessura insuficiente para a linha dupla, ajusta a borda
    if (current === 0) {
      tb.style.borderWidth = '1px'
      setTbBorderWidth('1')
    } else if (style === 'double' && current < 3) {
      tb.style.borderWidth = '3px'
      setTbBorderWidth('3')
    }
    triggerChange()
    updateResizeHandlePosition(tb)
  }

  // Aceita apenas links http(s), e-mail e âncoras; "www.site.com" vira "https://www.site.com"
  const normalizeLinkUrl = (value: string): string | null => {
    const url = value.trim()
    if (!url) return null
    if (/^(https?:\/\/|mailto:|#)/i.test(url)) return url
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null
    return `https://${url}`
  }

  const handleInsertLink = () => {
    const editor = editorRef.current
    const range = editor ? getCurrentEditorRange(editor) : null
    const typedUrl = prompt('Digite a URL do link:', 'https://')
    if (!typedUrl) return
    const url = normalizeLinkUrl(typedUrl)
    if (!url) {
      alert('Link inválido. Use um endereço http://, https:// ou mailto:.')
      return
    }
    const selectedText = range?.toString() || ''
    const linkText = prompt('Texto do link:', selectedText || url) || url
    const html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`
    if (editor && range) restoreEditorRange(editor, range)
    else editor?.focus()
    document.execCommand('insertHTML', false, html)
    triggerChange()
  }

  const handleRemoveLink = () => {
    execCommand('unlink')
  }

  const handleInsertHR = () => {
    editorRef.current?.focus()
    document.execCommand(
      'insertHTML',
      false,
      '<hr style="border:none;border-top:1px solid #ccc;margin:12px 0;clear:both;" />',
    )
    triggerChange()
  }

  const handleInsertTextBox = () => {
    const html = `<div class="rich-textbox" contenteditable="true"><span class="textbox-handle" contenteditable="false" title="Arrastar caixa de texto">⠿</span>Caixa de texto</div>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    triggerChange()
  }

  // Zera a área de edição: apaga todo o conteúdo e volta o papel ao padrão
  // ─── ARQUIVO (.html) ─────────────────────────────────────────────
  // Salvar: baixa o conteúdo (texto, imagens, layout e cor do papel) como
  // uma página .html, que também pode ser aberta direto no navegador
  const handleSaveToFile = () => {
    const editor = editorRef.current
    if (!editor) return
    const page = [
      '<!doctype html>',
      '<html lang="pt-BR">',
      '<head>',
      '<meta charset="utf-8">',
      `<meta name="generator" content="${FILE_GENERATOR}">`,
      '<title>Conteúdo do editor</title>',
      '</head>',
      `<body>${snapshotEditor(editor, paperRef.current)}</body>`,
      '</html>',
    ].join('\n')
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fileName = `conteudo-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.html`
    const url = URL.createObjectURL(new Blob([page], { type: 'text/html;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    // Mantido para telas que queiram reagir ao salvar
    document.dispatchEvent(new CustomEvent('amesa-editor-save'))
  }

  // Abrir: carrega um arquivo .html no editor, com a mesma limpeza de segurança
  // do carregamento do banco. Pode ser desfeito com Ctrl+Z.
  const loadFileContent = (fileHtml: string) => {
    const editor = editorRef.current
    if (!editor) return
    const body = new DOMParser().parseFromString(fileHtml, 'text/html').body.innerHTML.trim()
    const { paper, inner } = splitPaper(body)
    const cleanInner = sanitizeHtml(inner)
    if (!cleanInner.replace(/<[^>]*>/g, '').trim() && !/<img\b/i.test(cleanInner)) {
      alert('O arquivo não tem conteúdo que possa ser aberto no editor.')
      return
    }
    deselectImage()
    deselectTextbox()
    paperRef.current = paper
    editor.style.backgroundColor = paper
    editor.innerHTML = cleanInner
    if (truncateOnOverflow && truncateEditableToFit(editor)) {
      alert('O conteúdo do arquivo era maior que a área do editor e foi cortado no limite.')
    }
    editor.focus()
    triggerChange()
  }

  const handleOpenFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm,text/html'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
        alert('Escolha um arquivo .html salvo pelo editor.')
        return
      }
      if (file.size > MAX_OPEN_FILE_BYTES) {
        alert('O arquivo é grande demais (máximo de 20 MB).')
        return
      }
      const editor = editorRef.current
      const hasContent = Boolean(editor?.textContent?.trim() || editor?.querySelector('img'))
      if (hasContent && !confirm('Substituir o conteúdo atual pelo arquivo? (Ctrl+Z desfaz)')) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') loadFileContent(reader.result)
      }
      reader.onerror = () => alert('Não foi possível ler o arquivo.')
      reader.readAsText(file, 'utf-8')
    }
    input.click()
  }

  const handleClearAll = () => {
    deselectImage()
    deselectTextbox()
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
      editorRef.current.style.backgroundColor = ''
    }
    paperRef.current = ''
    // Reseta os indicadores de cor: fundo branco e texto preto (padrão)
    setBgColor('#FFFFFF')
    setTextColor('#000000')
    triggerChange()
  }

  const handleClearFormatting = () => {
    execCommand('removeFormat')
  }

  // ─── TEXT BOX ────────────────────────────────────────────────────
  const selectTextbox = (el: HTMLDivElement) => {
    deselectImage()
    deselectTextbox()
    // Garante a edição de texto na caixa (digitação, não apenas colagem)
    el.setAttribute('contenteditable', 'true')
    // Sincroniza os controles de borda do menu com o estilo atual da caixa
    const wpx = Math.round(parseFloat(el.style.borderWidth || '0'))
    setTbBorderColor(el.style.borderColor || '#7D8C6A')
    setTbBorderWidth(Number.isFinite(wpx) ? String(wpx) : '1')
    const styleNow = el.style.borderStyle
    setTbBorderStyle(styleNow && styleNow !== 'none' ? (styleNow as TbBorderStyle) : 'dashed')
    el.classList.add('selected')
    selectedTextboxRef.current = el
    setSelectionType('textbox')
    setTbToolbarVisible(true)
    updateTextboxToolbarPosition(el)
    updateResizeHandlePosition(el)
  }

  const deleteSelectedTextbox = () => {
    if (selectedTextboxRef.current) {
      selectedTextboxRef.current.remove()
      selectedTextboxRef.current = null
      setSelectionType(null)
      setTbToolbarVisible(false)
      triggerChange()
    }
  }

  const resizeSelectedTextbox = (pct: number) => {
    if (!selectedTextboxRef.current) return
    const w = `${pct}%`
    selectedTextboxRef.current.style.maxWidth = w
    selectedTextboxRef.current.style.width = w
    updateResizeHandlePosition(selectedTextboxRef.current)
    triggerChange()
  }

  const alignSelectedTextbox = (align: 'left' | 'center' | 'right') => {
    if (!selectedTextboxRef.current) return
    selectedTextboxRef.current.style.textAlign = align
    triggerChange()
  }

  // ─── IMAGE ───────────────────────────────────────────────────────
  const selectImage = (img: HTMLImageElement) => {
    deselectTextbox()
    deselectImage()
    img.draggable = false
    img.classList.add('selected')
    selectedImgRef.current = img
    setSelectionType('image')
    setImgToolbarVisible(true)
    updateToolbarPosition(img)
    updateResizeHandlePosition(img)
  }

  const deleteSelectedImage = () => {
    if (selectedImgRef.current) {
      selectedImgRef.current.remove()
      selectedImgRef.current = null
      setSelectionType(null)
      setImgToolbarVisible(false)
      triggerChange()
    }
  }

  const resizeSelectedImage = (pct: number) => {
    if (!selectedImgRef.current) return
    const w = `${pct}%`
    selectedImgRef.current.style.width = w
    selectedImgRef.current.style.maxWidth = w
    updateResizeHandlePosition(selectedImgRef.current)
    triggerChange()
  }

  const floatImage = (direction: 'left' | 'right' | 'none') => {
    if (!selectedImgRef.current) return
    const img = selectedImgRef.current
    // Alinhamento explícito: limpa o deslocamento horizontal manual
    img.style.marginLeft = ''
    img.style.marginRight = ''
    const posClass =
      direction === 'left' ? 'pos-left' : direction === 'right' ? 'pos-right' : 'pos-center'
    setImagePosition(img, posClass)
    updateResizeHandlePosition(img)
    triggerChange()
  }

  // ─── RASTREAMENTO DO MOUSE (arrasto e redimensionamento) ────────
  // Os ouvintes ativos ficam registrados para serem removidos também quando
  // o editor sai da tela no meio de um arrasto
  const [pointerTracker] = useState(createPointerTracker)
  useEffect(() => () => pointerTracker.stop(), [pointerTracker])

  const startPointerTracking = (move: MouseListener, up: MouseListener) =>
    pointerTracker.start(move, up)

  const stopPointerTracking = () => pointerTracker.stop()

  // ─── DRAG HANDLERS ──────────────────────────────────────────────
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return
    const el = (
      dragType.current === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    if (!el) return
    // Movimento livre: o elemento acompanha o mouse passando por cima do texto
    const dx = e.clientX - dragStartPos.current.x + dragStartPos.current.ox
    const dy = e.clientY - dragStartPos.current.y + dragStartPos.current.oy
    el.style.transform = `translate(${dx}px, ${dy}px)`
    if (dragType.current === 'image') updateToolbarPosition(el as HTMLImageElement)
    else updateTextboxToolbarPosition(el as HTMLDivElement)
    updateResizeHandlePosition(el)
  }

  const handleGlobalMouseUp = (e: MouseEvent) => {
    const type = dragType.current
    const el = (
      type === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    isDragging.current = false
    dragType.current = null
    stopPointerTracking()
    if (!el) return
    el.classList.remove('dragging')
    // Reposiciona no ponto de queda — o texto passa a contornar o elemento
    // com a margem de 40px do CSS; se o ponto for inválido, restaura a posição
    if (!dropElementAtPoint(el, e.clientX, e.clientY)) {
      el.style.transform = ''
    }
    if (type === 'image') updateToolbarPosition(el as HTMLImageElement)
    else updateTextboxToolbarPosition(el as HTMLDivElement)
    updateResizeHandlePosition(el)
    triggerChange()
  }

  // ─── FREE RESIZE HANDLERS (alça no canto inferior direito) ──────
  const handleResizeMove = (e: MouseEvent) => {
    const el = resizeElRef.current
    if (!isResizing.current || !el) return
    const dx = e.clientX - resizeStart.current.x
    const dy = e.clientY - resizeStart.current.y
    const newW = Math.max(60, resizeStart.current.w + dx)
    const newH = Math.max(40, resizeStart.current.h + dy)
    // Redimensionamento livre: largura e altura seguem o movimento do mouse
    el.style.width = `${newW}px`
    el.style.maxWidth = `${newW}px`
    el.style.height = `${newH}px`
    updateResizeHandlePosition(el)
    if (el.tagName === 'IMG') updateToolbarPosition(el as HTMLImageElement)
    else updateTextboxToolbarPosition(el as HTMLDivElement)
  }

  const handleResizeEnd = () => {
    isResizing.current = false
    resizeElRef.current = null
    stopPointerTracking()
    triggerChange()
  }

  const startFreeResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = (
      selectionType === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    if (!el) return
    isResizing.current = true
    resizeElRef.current = el
    resizeStart.current = { x: e.clientX, y: e.clientY, w: el.offsetWidth, h: el.offsetHeight }
    startPointerTracking(handleResizeMove, handleResizeEnd)
  }

  // ─── MOUSE DOWN ──────────────────────────────────────────────────
  const handleEditorMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement

    if (target.tagName === 'IMG') {
      e.preventDefault()
      selectImage(target as HTMLImageElement)
      isDragging.current = true
      dragType.current = 'image'
      const img = selectedImgRef.current || (target as HTMLImageElement)
      const off = getManualOffset(img)
      dragStartPos.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
      img.classList.add('dragging')
      startPointerTracking(handleGlobalMouseMove, handleGlobalMouseUp)
      return
    }

    if (target.classList.contains('textbox-handle')) {
      e.preventDefault()
      const tb = target.closest('.rich-textbox') as HTMLDivElement
      if (tb) {
        selectTextbox(tb)
        isDragging.current = true
        dragType.current = 'textbox'
        const off = getManualOffset(tb)
        dragStartPos.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
        tb.classList.add('dragging')
        startPointerTracking(handleGlobalMouseMove, handleGlobalMouseUp)
      }
      return
    }

    const tbParent = target.closest('.rich-textbox') as HTMLDivElement | null
    if (tbParent && tbParent.classList.contains('rich-textbox')) {
      if (target.classList.contains('textbox-handle')) return
      selectTextbox(tbParent)
      return
    }

    if (!imgToolbarRef.current?.contains(target) && !tbToolbarRef.current?.contains(target)) {
      deselectImage()
      deselectTextbox()
    }
  }

  // ─── DESFAZER / REFAZER (histórico próprio — ver editorHistory.ts) ───
  // Cobre todas as ações do editor (imagens, caixas, cor do papel, limpar),
  // e não apenas a digitação como o desfazer nativo do navegador.
  const applyHistory = (html: string | null) => {
    if (html === null || !editorRef.current) return
    const { paper, inner } = splitPaper(html)
    paperRef.current = paper
    editorRef.current.style.backgroundColor = paper
    editorRef.current.innerHTML = inner
    deselectImage()
    deselectTextbox()
    triggerChange()
  }

  const currentHtml = (): string =>
    editorRef.current ? snapshotEditor(editorRef.current, paperRef.current) : ''

  const handleUndo = () => {
    applyHistory(history.undo(currentHtml))
    editorRef.current?.focus()
  }

  const handleRedo = () => {
    applyHistory(history.redo(currentHtml))
    editorRef.current?.focus()
  }

  const enforcePhysicalHeightOnInput = () => {
    const editor = editorRef.current
    if (!truncateOnOverflow || !editor) return false
    return truncateEditableToFit(editor)
  }

  const applyPendingStyleToFragment = (
    fragment: DocumentFragment,
    style: PendingTypingStyle,
  ): HTMLSpanElement | null => {
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

  const handleEditorBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (selectionPreviewRef.current) restoreSelectionPreview()
    const inputEvent = e.nativeEvent as InputEvent
    if (
      !['insertText', 'insertCompositionText'].includes(inputEvent.inputType) ||
      inputEvent.data === null
    ) {
      return
    }

    const style = pendingTypingStyleRef.current
    if (!style.fontSize && !style.color && !style.fontFamily) return
    const editor = editorRef.current
    if (!editor) return
    const range = getCurrentEditorRange(editor)
    if (!range?.collapsed) return

    e.preventDefault()
    restoreEditorRange(editor, range)
    const span = document.createElement('span')
    if (style.fontSize) span.style.fontSize = style.fontSize
    if (style.color) span.style.color = style.color
    if (style.fontFamily) span.style.fontFamily = style.fontFamily
    const textNode = document.createTextNode(inputEvent.data)
    span.appendChild(textNode)
    range.insertNode(span)

    const caret = document.createRange()
    caret.setStart(textNode, textNode.length)
    caret.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(caret)
    savedRangeRef.current = caret.cloneRange()
    pendingTypingStyleRef.current = {}
    enforcePhysicalHeightOnInput()
    triggerChange()
  }

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (selectionPreviewRef.current) restoreSelectionPreview()
    const editor = editorRef.current
    if (!editor) return

    const clipboardHtml = e.clipboardData.getData('text/html')
    const clipboardText = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
    const pastedText = singleLineBreaks ? clipboardText.replace(/\n{2,}/g, '\n') : clipboardText
    const richHtml = sanitizeRichPaste(clipboardHtml)
    const hasRichText = Boolean(richHtml.replace(/<[^>]*>/g, '').trim())
    const pastedFontSizePt = clipboardFontSizePoints(clipboardHtml)
    const pastedFontFamily = clipboardFontFamily(clipboardHtml)
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
    const htmlToInsert = hasRichText ? richHtml : formattedPlainText

    // Deixa colagens que não sejam texto (como imagem copiada) seguirem o
    // comportamento nativo do navegador.
    if (!htmlToInsert && !clipboardText) return
    e.preventDefault()

    const selection = window.getSelection()
    let range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    if (!range || !isRangeWithinEditor(editor, range)) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }

    range.deleteContents()
    const template = document.createElement('template')
    template.innerHTML = htmlToInsert
    const fragment = template.content
    const pendingStyle = pendingTypingStyleRef.current
    const hasPendingStyle = Boolean(
      pendingStyle.fontSize || pendingStyle.color || pendingStyle.fontFamily,
    )
    const lastStyledSpan = hasPendingStyle
      ? applyPendingStyleToFragment(fragment, pendingStyle)
      : null
    const lastInsertedNode = fragment.lastChild
    range.insertNode(fragment)
    if (lastStyledSpan?.lastChild) {
      range.setStart(lastStyledSpan.lastChild, lastStyledSpan.lastChild.textContent?.length ?? 0)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRangeRef.current = range.cloneRange()
      pendingTypingStyleRef.current = {}
    } else if (lastInsertedNode) {
      range.setStartAfter(lastInsertedNode)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRangeRef.current = range.cloneRange()
    }
    editor.focus()
    if (pastedFontSizePt && !pendingStyle.fontSize) {
      setCurrentFontSize(closestFontSizeOption(pastedFontSizePt))
    }
    if (pastedFontFamily && !pendingStyle.fontFamily) setCurrentFont(pastedFontFamily)
    enforcePhysicalHeightOnInput()
    triggerChange()
  }

  // ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Antes do Enter nativo (parágrafo Word), impeça a nova linha se ela
    // ultrapassaria a caixa física; não apague texto e mostre o aviso.
    if (truncateOnOverflow && e.key === 'Enter' && editorRef.current) {
      const editor = editorRef.current
      const selection = window.getSelection()
      const caretNode = selection?.anchorNode
      const caretElement = caretNode instanceof HTMLElement ? caretNode : caretNode?.parentElement
      const computed = window.getComputedStyle(caretElement ?? editor)
      const lineHeight =
        computed.lineHeight === 'normal'
          ? parseFloat(computed.fontSize) * 1.6
          : parseFloat(computed.lineHeight)
      if (
        editorContentExceedsHeight(editor) ||
        measureEditorContentHeight(editor) + lineHeight > editor.clientHeight + 1
      ) {
        e.preventDefault()
        onOverflowChange?.(true)
        return
      }
    }
    // Tab: insere espaços dentro do editor
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
      enforcePhysicalHeightOnInput()
      triggerChange()
      return
    }
    // Desfazer / refazer próprios: Ctrl+Z, Ctrl+Y e Ctrl+Shift+Z
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const tecla = e.key.toLowerCase()
      if (tecla === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
        e.preventDefault()
        handleRedo()
        return
      }
    }
    // Apaga a imagem selecionada (Delete/Backspace)
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImgRef.current) {
      e.preventDefault()
      deleteSelectedImage()
      return
    }
    const alvoMov = (
      selectionType === 'image' ? selectedImgRef.current : selectedTextboxRef.current
    ) as HTMLElement | null
    const setas = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    // Setas + Ctrl: deslocamento fino livre (1px; 10px com Shift) —
    // a imagem ou caixa de texto move por cima do texto
    if (e.ctrlKey && !e.altKey && alvoMov && setas.includes(e.key)) {
      e.preventDefault()
      const passo = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0
      const dy = e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0
      nudgeElement(alvoMov, dx, dy)
      if (selectionType === 'image') updateToolbarPosition(alvoMov as HTMLImageElement)
      else updateTextboxToolbarPosition(alvoMov as HTMLDivElement)
      updateResizeHandlePosition(alvoMov)
      triggerChange()
      return
    }
    // Setas + Alt: move no fluxo do conteúdo (↑/↓) ou flutua para os lados (←/→)
    if (e.altKey && alvoMov && setas.includes(e.key)) {
      e.preventDefault()
      if (e.key === 'ArrowUp') moveElementInFlow(alvoMov, -1)
      else if (e.key === 'ArrowDown') moveElementInFlow(alvoMov, 1)
      else setFloatSide(alvoMov, e.key === 'ArrowLeft' ? 'left' : 'right')
      if (selectionType === 'image') updateToolbarPosition(alvoMov as HTMLImageElement)
      else updateTextboxToolbarPosition(alvoMov as HTMLDivElement)
      updateResizeHandlePosition(alvoMov)
      triggerChange()
    }
  }

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      e.preventDefault()
      selectImage(target as HTMLImageElement)
    } else if (target.classList.contains('textbox-handle')) {
      // handled by mousedown
    } else if (target.closest('.rich-textbox')) {
      const tb = target.closest('.rich-textbox') as HTMLDivElement
      selectTextbox(tb)
    } else if (
      !imgToolbarRef.current?.contains(target) &&
      !tbToolbarRef.current?.contains(target)
    ) {
      deselectImage()
      deselectTextbox()
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }}>
      {/* ═══ FORMATTING TOOLBAR ═══ */}
      <div
        className="d-flex gap-1 mb-2 p-2 rounded"
        style={{
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          flexWrap: 'wrap',
          alignItems: 'center',
          // Ferramentas com a largura do cabeçalho, centralizadas sobre o bloco de edição
          width: toolbarWidth,
          marginLeft: -(toolbarWidth - width) / 2,
          boxSizing: 'border-box',
        }}
      >
        <ToolbarBtn onClick={handleSaveToFile} title="Salvar em arquivo (.html)">
          💾
        </ToolbarBtn>
        <ToolbarBtn onClick={handleOpenFile} title="Abrir arquivo (.html)">
          📂
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={handleUndo} title="Desfazer (Ctrl+Z)">
          <CIcon icon={cilActionUndo} />
        </ToolbarBtn>
        <ToolbarBtn onClick={handleRedo} title="Refazer (Ctrl+Y)">
          <CIcon icon={cilActionRedo} />
        </ToolbarBtn>
        <ToolbarSep />
        <div className="font-family-picker" ref={fontMenuRef}>
          <button
            type="button"
            className="editor-select"
            title="Família da fonte"
            aria-haspopup="listbox"
            aria-expanded={fontMenuOpen}
            onMouseDown={(e) => {
              e.preventDefault()
              saveSelection()
            }}
            onClick={() => {
              if (fontMenuOpen) {
                setFontMenuOpen(false)
                restoreSelectionPreview()
              } else {
                setFontMenuOpen(true)
              }
            }}
            style={{ minWidth: 158, display: 'flex', justifyContent: 'space-between', gap: 8 }}
          >
            <span>
              {FONT_FAMILIES.find((font) => font.value === currentFont)?.label ?? 'Fonte'}
            </span>
            <span aria-hidden="true">▾</span>
          </button>
          {fontMenuOpen && (
            <div
              className="font-family-options"
              role="listbox"
              aria-label="Família da fonte"
              onMouseLeave={restoreSelectionPreview}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFontMenuOpen(false)
                  restoreSelectionPreview()
                }
              }}
            >
              {FONT_FAMILIES.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  className="font-family-option"
                  role="option"
                  aria-selected={currentFont === font.value}
                  style={{ fontFamily: font.value }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    saveSelection()
                  }}
                  onMouseEnter={() => previewSelectionStyle('fontFamily', font.value)}
                  onClick={() => chooseFontFamily(font.value)}
                >
                  {font.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          className="editor-select"
          value={currentFontSize}
          onMouseDown={saveSelection}
          onChange={handleFontSizeChange}
          title="Tamanho da fonte"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ToolbarSep />
        {HEADING_BLOCKS.map((h) => (
          <ToolbarBtn key={h.tag} onClick={() => handleHeadingChange(h.tag)} title={h.label}>
            {h.tag === 'p' ? '¶' : h.tag === 'blockquote' ? '❝' : h.tag.toUpperCase()}
          </ToolbarBtn>
        ))}
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('bold')} title="Negrito (Ctrl+B)">
          <CIcon icon={cilBold} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('italic')} title="Itálico (Ctrl+I)">
          <CIcon icon={cilItalic} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('underline')} title="Sublinhado (Ctrl+U)">
          <CIcon icon={cilUnderline} />
        </ToolbarBtn>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <ToolbarBtn
            onClick={() => setHighlightPalette(highlightPalette ? null : true)}
            title="Texto tarjado (marca-texto)"
          >
            <span
              style={{ fontWeight: 600, background: '#FFFF00', padding: '0 3px', borderRadius: 2 }}
            >
              S
            </span>
          </ToolbarBtn>
          {highlightPalette && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 200,
                display: 'flex',
                gap: 6,
                padding: '8px 10px',
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              }}
            >
              {[
                '#FFFF00',
                '#FF6B6B',
                '#51CF66',
                '#339AF0',
                '#FF922B',
                '#CC5DE8',
                '#F8F9FA',
                '#CDD2CA',
                '#7A8279',
                '#14201A',
                'transparent',
              ].map((c) => (
                <button
                  key={c}
                  style={{
                    width: 24,
                    height: 24,
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    background: c === 'transparent' ? '#fff' : c,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                  }}
                  // Mantém a seleção do texto ao clicar na cor
                  onMouseDown={(e) => {
                    e.preventDefault()
                    saveSelection()
                  }}
                  onClick={() => {
                    const editor = editorRef.current
                    const range = editor ? getCurrentEditorRange(editor) : null
                    if (editor && range && !range.collapsed) {
                      restoreEditorRange(editor, range)
                      document.execCommand('styleWithCSS', false, 'true')
                      document.execCommand('hiliteColor', false, c)
                      triggerChange()
                    }
                    setHighlightPalette(null)
                    editor?.focus()
                  }}
                  title={c === 'transparent' ? 'Sem cor' : c}
                >
                  {c === 'transparent' && '✕'}
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolbarBtn
          onClick={() => {
            // Remove a cor de fundo do texto selecionado
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
              document.execCommand('hiliteColor', false, 'transparent')
              triggerChange()
            }
            editorRef.current?.focus()
          }}
          title="Remover tarja (Sem tarja)"
        >
          <span style={{ fontWeight: 600, opacity: 0.5, textDecoration: 'line-through' }}>S</span>
        </ToolbarBtn>
        <ToolbarSep />
        <div ref={colorPanelRef} className="d-inline-flex align-items-center gap-1">
          {renderColorPicker('text')}
          {renderColorPicker('bg')}
        </div>
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('justifyLeft')} title="Alinhar à esquerda">
          <CIcon icon={cilAlignLeft} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('justifyCenter')} title="Centralizar">
          <CIcon icon={cilAlignCenter} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('justifyRight')} title="Alinhar à direita">
          <CIcon icon={cilAlignRight} />
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('insertUnorderedList')} title="Lista com marcadores">
          <CIcon icon={cilList} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('insertOrderedList')} title="Lista numerada">
          <span style={{ fontWeight: 600 }}>1.</span>
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={() => execCommand('indent')} title="Aumentar recuo">
          <CIcon icon={cilIndentIncrease} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCommand('outdent')} title="Diminuir recuo">
          <CIcon icon={cilIndentDecrease} />
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={handleInsertLink} title="Inserir link">
          <CIcon icon={cilLink} />
        </ToolbarBtn>
        <ToolbarBtn onClick={handleRemoveLink} title="Remover link">
          <CIcon icon={cilX} />
        </ToolbarBtn>
        <ToolbarSep />
        <ToolbarBtn onClick={handleInsertHR} title="Inserir linha separadora">
          <CIcon icon={cilMinus} />
        </ToolbarBtn>
        <ToolbarBtn onClick={handleInsertImage} title="Inserir imagem">
          <CIcon icon={cilImage} />
        </ToolbarBtn>
        {/* Todas as funções de caixa de texto reunidas em um único grupo */}
        <div
          className="d-flex align-items-center gap-1"
          title="Funções da caixa de texto"
          style={{
            border: '1px dashed #7D8C6A',
            borderRadius: 6,
            padding: '2px 6px',
            backgroundColor: 'rgba(125,140,106,0.06)',
          }}
        >
          <ToolbarBtn onClick={handleInsertTextBox} title="Inserir caixa de texto">
            📝
          </ToolbarBtn>
          <div className="color-picker-wrapper" style={{ opacity: isTextboxSelected ? 1 : 0.45 }}>
            <ToolbarBtn
              onClick={() => isTextboxSelected && tbBorderColorInputRef.current?.click()}
              title="Cor da borda da caixa de texto"
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>🖊</span>
              <span className="color-indicator" style={{ backgroundColor: tbBorderColor }} />
            </ToolbarBtn>
            <input
              ref={tbBorderColorInputRef}
              type="color"
              value={tbBorderColor}
              onChange={(e) => applyTbBorderColor(e.target.value)}
            />
          </div>
          <select
            className="editor-select"
            value={tbBorderWidth}
            onChange={(e) => applyTbBorderWidth(e.target.value)}
            title="Espessura da borda da caixa de texto"
            disabled={!isTextboxSelected}
            style={{ opacity: isTextboxSelected ? 1 : 0.45 }}
          >
            <option value="0">Sem borda</option>
            <option value="1">Borda 1px</option>
            <option value="2">Borda 2px</option>
            <option value="3">Borda 3px</option>
            <option value="4">Borda 4px</option>
            <option value="6">Borda 6px</option>
            <option value="8">Borda 8px</option>
          </select>
          <select
            className="editor-select"
            value={tbBorderStyle}
            onChange={(e) => applyTbBorderStyle(e.target.value as TbBorderStyle)}
            title="Tipo de linha da borda da caixa de texto"
            disabled={!isTextboxSelected}
            style={{ opacity: isTextboxSelected ? 1 : 0.45 }}
          >
            {TB_BORDER_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ToolbarBtn onClick={deleteSelectedTextbox} title="Excluir caixa de texto">
            🗑
          </ToolbarBtn>
        </div>
        <ToolbarSep />
        <ToolbarBtn
          onClick={handleClearAll}
          title="Limpar a área de edição (apaga todo o conteúdo)"
        >
          🗑 Limpar
        </ToolbarBtn>
        <ToolbarBtn onClick={handleClearFormatting} title="Limpar formatação">
          <CIcon icon={cilCheckCircle} />
        </ToolbarBtn>
      </div>

      {/* ═══ CONTENT EDITOR — réplica do bloco do site (largura/altura configuráveis) ═══ */}
      <div
        style={{
          position: 'relative',
          width,
          maxWidth: '100%',
          margin: 0,
          boxSizing: 'border-box',
          border: `${BLOCK_BORDER}px solid #8fbc8f`,
          borderRadius: '1rem',
        }}
      >
        <div
          ref={editorRef}
          contentEditable
          draggable={false}
          suppressContentEditableWarning
          className={`form-control editor-content ${contentClassName}`.trim()}
          data-placeholder={placeholder}
          style={{
            width: width - BLOCK_BORDER * 2,
            height: height - BLOCK_BORDER * 2,
            maxWidth: '100%',
            boxSizing: 'border-box',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '10px',
            overflow: 'hidden',
            overflowX: 'hidden',
            overflowY: 'hidden',
            resize: 'none',
            lineHeight: 1.6,
            fontSize: '12pt',
            fontFamily: SITE_FONT_BODY,
            caretColor: 'currentColor',
            outline: 'none',
            ...contentStyle,
          }}
          onMouseDown={handleEditorMouseDown}
          onDragStart={(e) => e.preventDefault()}
          onKeyDown={handleKeyDown}
          onBeforeInput={handleEditorBeforeInput}
          onPaste={handleEditorPaste}
          onClick={handleEditorClick}
          onBlur={() => {
            if (selectionPreviewRef.current) restoreSelectionPreview()
            triggerChange()
          }}
          onInput={() => {
            enforcePhysicalHeightOnInput()
            triggerChange()
          }}
        />

        {/* ═══ IMAGE TOOLBAR ═══ */}
        {imgToolbarVisible && selectionType === 'image' && (
          <div
            ref={imgToolbarRef}
            className="img-toolbar"
            // Não rouba o foco do editor ao usar os botões flutuantes
            onMouseDown={(e) => e.preventDefault()}
            style={{ top: imgToolbarPos.top, left: imgToolbarPos.left }}
          >
            <button onClick={() => resizeSelectedImage(25)} title="25%">
              25%
            </button>
            <button onClick={() => resizeSelectedImage(50)} title="50%">
              50%
            </button>
            <button onClick={() => resizeSelectedImage(75)} title="75%">
              75%
            </button>
            <button onClick={() => resizeSelectedImage(100)} title="100%">
              100%
            </button>
            <div style={{ width: 1, backgroundColor: '#ddd' }} />
            <button onClick={() => floatImage('left')} title="Alinhar à esquerda">
              ⬅ Esq
            </button>
            <button onClick={() => floatImage('right')} title="Alinhar à direita">
              Dir ➡
            </button>
            <button onClick={() => floatImage('none')} title="Centralizar">
              ⬛ Centro
            </button>
            <div style={{ width: 1, backgroundColor: '#ddd' }} />
            <button className="danger" onClick={deleteSelectedImage} title="Excluir imagem">
              🗑 Excluir
            </button>
          </div>
        )}

        {/* ═══ TEXT BOX TOOLBAR ═══ */}
        {tbToolbarVisible && selectionType === 'textbox' && (
          <div
            ref={tbToolbarRef}
            className="img-toolbar"
            // Não rouba o foco do editor ao usar os botões flutuantes
            onMouseDown={(e) => e.preventDefault()}
            style={{ top: tbToolbarPos.top, left: tbToolbarPos.left }}
          >
            <button onClick={() => resizeSelectedTextbox(25)} title="25%">
              25%
            </button>
            <button onClick={() => resizeSelectedTextbox(50)} title="50%">
              50%
            </button>
            <button onClick={() => resizeSelectedTextbox(75)} title="75%">
              75%
            </button>
            <button onClick={() => resizeSelectedTextbox(100)} title="100%">
              100%
            </button>
            <div style={{ width: 1, backgroundColor: '#ddd' }} />
            <button onClick={() => alignSelectedTextbox('left')} title="Alinhar à esquerda">
              ⬅ Esq
            </button>
            <button onClick={() => alignSelectedTextbox('center')} title="Centralizar">
              ☰ Centro
            </button>
            <button onClick={() => alignSelectedTextbox('right')} title="Alinhar à direita">
              Dir ➡
            </button>
            <div style={{ width: 1, backgroundColor: '#ddd' }} />
            <button
              className="danger"
              onClick={deleteSelectedTextbox}
              title="Excluir caixa de texto"
            >
              🗑 Excluir
            </button>
          </div>
        )}

        {/* ═══ FREE RESIZE HANDLE ═══ */}
        {selectionType && resizeHandlePos && (
          <div
            className="resize-handle"
            title="Redimensionar livremente"
            style={{ top: resizeHandlePos.top, left: resizeHandlePos.left }}
            onMouseDown={startFreeResize}
          />
        )}
      </div>
    </div>
  )
}

export default VersaEdit
