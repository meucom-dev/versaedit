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

  it('VersaEdit com resizable renderiza sem erro (as alças só existem no navegador)', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = renderToString(
      createElement(VersaEdit, {
        initialContent: '<p>olá</p>',
        resizable: { minWidth: 300, maxHeight: 600 },
        sizeControls: true,
        truncateOnOverflow: true,
        width: 500,
        height: 300,
        onResize: () => {},
      }),
    )
    expect(html).toContain('ve-frame')
    expect(html).not.toContain('ve-frame-handle')
    // Campos com o tamanho configurado já no HTML do servidor
    expect(html).toContain('ve-size-controls')
    expect(html).toMatch(/value="500"/)
    expect(errors).not.toHaveBeenCalled()
    expect(warns).not.toHaveBeenCalled()
  })

  it('VersaEdit com settingsPanel: a engrenagem no HTML do servidor, painel fechado', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = renderToString(
      createElement(VersaEdit, {
        initialContent: '<p>olá</p>',
        locale: 'pt-BR',
        toolbar: [],
        settingsPanel: (close: () => void) =>
          createElement('button', { type: 'button', onClick: close }, 'Fechar'),
      }),
    )
    expect(html).toContain('aria-label="Configurações"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('role="dialog"')
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
