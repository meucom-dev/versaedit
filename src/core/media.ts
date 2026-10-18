// ─── ÁUDIO E VÍDEO EXTERNOS ───────────────────────────────────────
// Por padrão, mídia externa não é baixada enquanto se edita: os atributos que
// carregam ou tocam algo (src, autoplay) saem do elemento dentro do editor e
// ficam guardados, na ordem original, em data-ve-media. Ao serializar
// (onChange, getHTML, histórico, arquivo), os atributos voltam exatamente como
// estavam — o documento não perde nada.
import { isSafeUrl } from './sanitize'

const MEDIA_SELECTOR = 'video, audio, source, track'
const MARK = 'data-ve-media'
const SUSPENDED = ['src', 'autoplay']

/** Desativa o carregamento da mídia externa no editor (idempotente) */
export function suspendMedia(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(MEDIA_SELECTOR).forEach((el) => {
    if (el.hasAttribute(MARK)) return
    if (!SUSPENDED.some((name) => el.hasAttribute(name))) return
    const original = Array.from(el.attributes).map((a) => [a.name, a.value])
    el.setAttribute(MARK, JSON.stringify(original))
    for (const name of SUSPENDED) el.removeAttribute(name)
  })
}

/** Devolve os atributos originais (usado numa cópia, na hora de serializar) */
export function restoreMedia(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(`[${MARK}]`).forEach((el) => {
    let original: unknown
    try {
      original = JSON.parse(el.getAttribute(MARK) ?? '')
    } catch {
      original = null
    }
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name)
    if (!Array.isArray(original)) return
    for (const pair of original) {
      if (!Array.isArray(pair) || typeof pair[0] !== 'string' || typeof pair[1] !== 'string') {
        continue
      }
      const [name, value] = pair as [string, string]
      // Defesa extra: nada de eventos nem endereços inseguros na restauração
      if (name.toLowerCase().startsWith('on') || name === MARK) continue
      if ((name === 'src' || name === 'href') && !isSafeUrl(name, value)) continue
      try {
        el.setAttribute(name, value)
      } catch {
        // nome de atributo inválido: ignora
      }
    }
  })
}

/** Há mídia suspensa no editor? (evita copiar o conteúdo à toa) */
export const hasSuspendedMedia = (root: ParentNode): boolean =>
  root.querySelector(`[${MARK}]`) !== null

// Um <video> com src começa a baixar mesmo fora da página: a troca é feita num
// <template>, cujo conteúdo é inerte (nada carrega lá dentro).
const MEDIA_TAG = /<(video|audio|source|track)\b/i
const MARK_ATTR = /\bdata-ve-media=/

/** HTML pronto para entrar no editor, com a mídia externa suspensa */
export function suspendMediaInHtml(html: string): string {
  if (!MEDIA_TAG.test(html)) return html
  const template = document.createElement('template')
  template.innerHTML = html
  suspendMedia(template.content)
  return template.innerHTML
}

/** HTML com os atributos originais da mídia de volta (para entregar ou salvar) */
export function restoreMediaInHtml(html: string): string {
  if (!MARK_ATTR.test(html)) return html
  const template = document.createElement('template')
  template.innerHTML = html
  restoreMedia(template.content)
  return template.innerHTML
}
