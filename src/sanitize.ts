import DOMPurify from 'dompurify'

// ─── SEGURANÇA ────────────────────────────────────────────────────
// Primeira camada de toda entrada de HTML (carregar, abrir arquivo, colar):
// o DOMPurify remove o que executa código ou carrega conteúdo externo.
// A formatação permitida é decidida depois, pelas limpezas do editor.

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
