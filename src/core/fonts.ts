// ─── TAMANHOS E FAMÍLIAS DE FONTE ─────────────────────────────────
import type { FontFamilyOption } from './defaults'

// Tamanho CSS (pt ou px) → pontos tipográficos (6 a 72), ou null
export function cssFontSizeToPoints(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*(pt|px)?$/i)
  if (!match) return null
  const rawSize = Number(match[1])
  const points = match[2]?.toLowerCase() === 'pt' ? rawSize : rawSize * 0.75
  return Number.isFinite(points) && points >= 6 && points <= 72 ? points : null
}

// Opção do menu de tamanhos mais próxima de um valor em pontos
export function closestFontSizeOption(points: number, sizes: number[]): string {
  return String(
    sizes.reduce(
      (closest, size) => (Math.abs(size - points) < Math.abs(closest - points) ? size : closest),
      sizes[0],
    ),
  )
}

// Primeira família de um valor CSS de font-family, sem aspas e em minúsculas
export const firstFamily = (value: string): string =>
  value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()

// Opção do menu que corresponde à família resolvida pelo navegador
export function matchFontFamily(
  computedFamily: string,
  fontFamilies: FontFamilyOption[],
): FontFamilyOption | undefined {
  const family = firstFamily(computedFamily)
  return (
    fontFamilies.find((font) => firstFamily(font.value) === family) ||
    fontFamilies.find((font) => font.value.toLowerCase().includes(family)) ||
    fontFamilies.find((font) => family.includes(firstFamily(font.value)))
  )
}
