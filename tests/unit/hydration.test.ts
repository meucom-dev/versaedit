// Hidratação (Next.js, Remix…): o HTML do servidor é gerado sem reconhecimento
// de voz; o navegador que tem reconhecimento não pode renderizar diferente na
// hidratação (React #418), e o microfone aparece logo depois.
import { act, createElement, type ReactElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { VersaEdit, VersaEditDictation } from '../../src'

class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult = null
  onerror = null
  onend = null
  start() {}
  stop() {}
  abort() {}
}

const w = window as unknown as Record<string, unknown>
;(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

async function hydrate(element: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  // "Servidor": sem reconhecimento de voz
  container.innerHTML = renderToString(element)
  const serverHtml = container.innerHTML
  // "Navegador": com reconhecimento de voz
  w.webkitSpeechRecognition = FakeRecognition
  const recoverable: unknown[] = []
  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: (e) => recoverable.push(e) })
  })
  return { container, serverHtml, recoverable }
}

describe('hidratação com reconhecimento de voz no navegador', () => {
  afterEach(() => {
    delete w.webkitSpeechRecognition
    document.body.innerHTML = ''
  })

  it('VersaEdit: sem erro de hidratação; o microfone aparece depois', async () => {
    const { container, serverHtml, recoverable } = await hydrate(
      createElement(VersaEdit, { initialContent: '<p>olá</p>' }),
    )
    expect(serverHtml).not.toContain('Dictate')
    expect(recoverable).toEqual([])
    expect(container.querySelector('[aria-label^="Dictate"], [title^="Dictate"]')).not.toBeNull()
  })

  it('VersaEditDictation: sem erro de hidratação; o botão aparece depois', async () => {
    const { container, serverHtml, recoverable } = await hydrate(
      createElement(VersaEditDictation, { editor: { current: null } }),
    )
    expect(serverHtml).toBe('')
    expect(recoverable).toEqual([])
    expect(container.querySelector('button')).not.toBeNull()
  })
})
