// Tipos de quickstart.mjs para os testes do site (tests/site/site.spec.ts)
export function localizeCode(lang: 'en' | 'pt' | 'es', file: string, source: string): string
export const QUICKSTART: Record<'en' | 'pt' | 'es', { path: string; title: string }>
export const COMMANDS: Record<'latest' | 'pinned' | 'newProject' | 'usage', string>
