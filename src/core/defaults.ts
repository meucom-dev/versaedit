// ─── VALORES PADRÃO DAS PROPS ─────────────────────────────────────

export interface FontFamilyOption {
  /** Nome exibido no menu */
  label: string
  /** Valor CSS de font-family (com as fontes de reserva) */
  value: string
}

export interface FrameOptions {
  /** Espessura da moldura em px */
  width: number
  color: string
  /** Raio dos cantos em px */
  radius: number
}

// Largura: a do contêiner (medida CSS), para a área nunca passar dele em telas
// estreitas; altura inicial em px. A aplicação pode fixar as duas (props width e height)
export const DEFAULT_WIDTH: number | string = '100%'
export const DEFAULT_HEIGHT = 500
export const DEFAULT_ACCENT = '#2563eb'
export const DEFAULT_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const DEFAULT_FRAME: FrameOptions = { width: 1, color: '#d0d7de', radius: 8 }

/**
 * Margem em torno de imagens e caixas de texto, em px, por lado:
 * - text: entre o objeto e o texto (o lado do texto num objeto à esquerda ou à
 *   direita; em cima e embaixo num objeto centralizado ou na caixa no fluxo);
 * - outer: o lado de fora de um objeto à esquerda ou à direita (0 = alinhado à
 *   margem do texto); nas laterais da caixa de texto no fluxo;
 * - top / bottom: em cima e embaixo de um objeto à esquerda ou à direita.
 */
export interface ObjectMargin {
  text?: number
  outer?: number
  top?: number
  bottom?: number
}

/** Padrão, como nos editores de referência (Word, Google Docs, WordPress) */
export const DEFAULT_OBJECT_MARGIN: Required<ObjectMargin> = {
  text: 16,
  outer: 0,
  top: 4,
  bottom: 12,
}

/** Maior margem aceita por lado (px) */
export const MAX_OBJECT_MARGIN = 200

const OBJECT_MARGIN_SIDES = ['text', 'outer', 'top', 'bottom'] as const

/**
 * Variáveis CSS da margem dos objetos (--ve-object-text, --ve-object-outer,
 * --ve-object-top, --ve-object-bottom), só dos lados informados. O editor as
 * aplica com a prop objectMargin; no site, aplique o mesmo objeto ao contêiner do
 * conteúdo publicado (style), para os objetos ficarem onde estavam no editor.
 * Valores inválidos ou negativos são ignorados; acima de 200 px, ficam em 200.
 */
export function objectMarginStyle(margin?: ObjectMargin): Record<string, string> {
  const style: Record<string, string> = {}
  for (const side of OBJECT_MARGIN_SIDES) {
    const value = margin?.[side]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue
    style[`--ve-object-${side}`] = `${Math.round(Math.min(value, MAX_OBJECT_MARGIN))}px`
  }
  return style
}

export const DEFAULT_FONT_FAMILIES: FontFamilyOption[] = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Arial, sans-serif' },
  { label: 'System UI', value: DEFAULT_FONT },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'sans-serif', value: 'sans-serif' },
  { label: 'serif', value: 'serif' },
  { label: 'monospace', value: 'monospace' },
]

// Tamanhos em pontos tipográficos, como no Word (1pt = 4/3 CSS px)
export const DEFAULT_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]

export const DEFAULT_COLOR_PALETTE = [
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
  '#6D4C41',
  '#37474F',
]

// 'transparent' aparece como "sem cor"
export const DEFAULT_HIGHLIGHT_COLORS = [
  '#FFFF00',
  '#FF6B6B',
  '#51CF66',
  '#339AF0',
  '#FF922B',
  '#CC5DE8',
  'transparent',
]

// URL do Google Fonts para as famílias pedidas em `loadGoogleFonts`.
// Aceita o nome simples ("Inter") ou a especificação completa ("Inter:wght@400;700").
export function googleFontsUrl(families: string[]): string {
  const params = families
    .map((family) => {
      const spec = family.includes(':') ? family : `${family}:wght@400;700`
      return `family=${spec.trim().replace(/ /g, '+')}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}
