import { en, type VersaEditLabels } from './en'
import { ptBR } from './pt-BR'

export type { VersaEditLabels }
export type VersaEditLocale = 'en' | 'pt-BR'

const DICTIONARIES: Record<VersaEditLocale, VersaEditLabels> = { en, 'pt-BR': ptBR }

// Dicionário do idioma escolhido, com os textos trocados pela prop `labels`
export function resolveLabels(
  locale: VersaEditLocale,
  overrides?: Partial<VersaEditLabels>,
): VersaEditLabels {
  return { ...(DICTIONARIES[locale] ?? en), ...overrides }
}

// Preenche marcadores como {color} e {n}
export function format(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}
