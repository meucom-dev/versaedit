import { describe, expect, it } from 'vitest'
import { serializeEditorContent, snapshotEditor } from '../../src/core/file'
import { restoreMedia, suspendMedia } from '../../src/core/media'
import { sanitizeHtml } from '../../src/core/sanitize'

const el = (html: string) => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

const MEDIA =
  '<p>a</p><video controls="" src="https://media.example/v.mp4" autoplay="" width="320"><source src="https://media.example/v.webm" type="video/webm"><track kind="captions" src="https://media.example/c.vtt"></video><audio src="https://media.example/a.mp3" controls=""></audio>'

describe('mídia externa suspensa no editor', () => {
  it('tira src e autoplay do editor', () => {
    const root = el(MEDIA)
    suspendMedia(root)
    expect(root.querySelectorAll('[src]')).toHaveLength(0)
    expect(root.querySelector('[autoplay]')).toBeNull()
    expect(root.querySelectorAll('[data-ve-media]')).toHaveLength(4)
  })

  it('HTML entregue é idêntico ao original (mesma ordem de atributos)', () => {
    const root = el(MEDIA)
    const original = root.innerHTML
    suspendMedia(root)
    expect(serializeEditorContent(root, '')).toBe(original)
    expect(snapshotEditor(root, '')).toBe(original)
    expect(serializeEditorContent(root, '#fff')).toContain(original)
  })

  it('suspender duas vezes não muda nada (idempotente)', () => {
    const root = el(MEDIA)
    suspendMedia(root)
    const once = root.innerHTML
    suspendMedia(root)
    expect(root.innerHTML).toBe(once)
  })

  it('mídia sem src/autoplay não é marcada', () => {
    const root = el('<video controls=""></video>')
    suspendMedia(root)
    expect(root.innerHTML).toBe('<video controls=""></video>')
  })

  it('serializar sem mídia não copia o conteúdo (mesmo innerHTML)', () => {
    const root = el('<p>só texto</p>')
    expect(serializeEditorContent(root, '')).toBe('<p>só texto</p>')
  })
})

describe('marcador forjado nunca vira atributo perigoso', () => {
  it('carregar: o marcador vindo de fora é removido', () => {
    const forged = `<video data-ve-media='[["onerror","alert(1)"],["src","javascript:alert(1)"]]'></video>`
    const clean = sanitizeHtml(forged)
    expect(clean).not.toContain('data-ve-media')
    const root = el(clean)
    suspendMedia(root)
    expect(serializeEditorContent(root, '')).not.toMatch(/onerror|javascript/)
  })

  it('restaurar: ignora eventos, endereços inseguros e JSON inválido', () => {
    const root = el(
      `<video data-ve-media='[["onerror","x()"],["src","javascript:x()"],["controls",""]]'></video><audio data-ve-media="{nao json"></audio>`,
    )
    restoreMedia(root)
    expect(root.innerHTML).toBe('<video controls=""></video><audio></audio>')
  })
})
