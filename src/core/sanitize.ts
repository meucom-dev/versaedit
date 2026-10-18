import DOMPurify from 'dompurify'
import { cssFontSizeToPoints } from './fonts'

// ─── SEGURANÇA ────────────────────────────────────────────────────
// Primeira camada de toda entrada de HTML (carregar, abrir arquivo, colar):
// o DOMPurify remove o que executa código ou carrega conteúdo externo.
// A formatação permitida é decidida depois, por sanitizeHtml e pela colagem.

// Elementos que o DOMPurify aceita por padrão, mas não cabem num editor de texto
const FORBID_TAGS = [
  'style',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'template',
  'noscript',
]
const FORBID_ATTR = ['action', 'formaction', 'background', 'poster', 'srcset']
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href'])

// Imagens embutidas só nos formatos raster; links nunca com javascript:/vbscript:/data:
export function isSafeUrl(attribute: string, value: string): boolean {
  // Remove controles e espaços que o navegador ignora (ex.: "java\tscript:")
  // eslint-disable-next-line no-control-regex
  const url = value.replace(/[\u0000- ]/g, '').toLowerCase()
  if (attribute === 'src' && url.startsWith('data:'))
    return /^data:image\/(png|jpe?g|gif|webp|bmp);/.test(url)
  return !/^(javascript|vbscript|data):/.test(url)
}

const purifier = DOMPurify()
// Regra própria de URLs, mais estrita que a padrão do DOMPurify (ex.: data:image/svg+xml)
purifier.addHook('uponSanitizeAttribute', (_node, data) => {
  if (URL_ATTRIBUTES.has(data.attrName) && !isSafeUrl(data.attrName, data.attrValue)) {
    data.keepAttr = false
  }
})

export function purifyHtml(html: string): string {
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true }, // sem SVG e MathML
    FORBID_TAGS,
    FORBID_ATTR,
    // Usados pelas caixas de texto (alça não editável) e pelas imagens do editor
    ADD_ATTR: ['contenteditable', 'draggable'],
  })
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}

// Aceita apenas valores de cor válidos (evita injeção de CSS pela cor do papel)
export function safeCssColor(value: string): string {
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
// Textos comuns continuam sem margens/espaçamentos.
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

// Conteúdo carregado (initialContent ou arquivo): remove código inseguro, estilos
// inline fora da lista, classes estranhas e atributos de cor antigos
export function sanitizeHtml(html: string): string {
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
    // Marcador interno da mídia suspensa (core/media.ts): nunca aceito de fora
    el.removeAttribute('data-ve-media')
    el.removeAttribute('color')
    el.removeAttribute('bgcolor')
    el.removeAttribute('face')
    el.removeAttribute('size')
    if (el instanceof HTMLElement) {
      if (fontSizePt !== null) el.style.fontSize = `${fontSizePt}pt`
      if (fontFamily) el.style.fontFamily = fontFamily
      if (color && CSS.supports('color', color)) el.style.color = color
      // Fundo só no marca-texto (spans) e no sombreamento de células de tabela
      if (
        (el.tagName === 'SPAN' || el.tagName === 'TD' || el.tagName === 'TH') &&
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
