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

export const DEFAULT_WIDTH = 640
export const DEFAULT_HEIGHT = 480
export const DEFAULT_ACCENT = '#2563eb'
export const DEFAULT_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const DEFAULT_FRAME: FrameOptions = { width: 1, color: '#d0d7de', radius: 8 }

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
