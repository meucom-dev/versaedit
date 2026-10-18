// @vitest-environment node
// Renderização no servidor (Next.js, Remix…): sem window/document, o editor
// precisa renderizar o HTML inicial sem erro e sem avisos do React.
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VersaEdit, VersaEditDictation } from '../../src'

describe('renderização no servidor', () => {
  afterEach(() => vi.restoreAllMocks())

  it('roda sem window/document', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
  })

  it('VersaEdit renderiza sem erro e sem avisos', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = renderToString(
      createElement(VersaEdit, {
        initialContent: '<p>olá</p>',
        locale: 'pt-BR',
        onChange: () => {},
      }),
    )
    expect(html).toContain('ve-root')
    expect(html).toContain('role="toolbar"')
    expect(html).toContain('Negrito (Ctrl+B)')
    expect(errors).not.toHaveBeenCalled()
    expect(warns).not.toHaveBeenCalled()
  })

  it('VersaEditDictation não renderiza nada sem reconhecimento de voz', () => {
    const html = renderToString(createElement(VersaEditDictation, { editor: { current: null } }))
    expect(html).toBe('')
  })
})

describe('sanitização sem DOM', () => {
  it('falha com erro claro em vez de devolver HTML sem sanitização', async () => {
    const { purifyHtml } = await import('../../src/core/sanitize')
    expect(() => purifyHtml('<img src=x onerror=alert(1)>')).toThrow(/precisa de um DOM/)
  })
})
