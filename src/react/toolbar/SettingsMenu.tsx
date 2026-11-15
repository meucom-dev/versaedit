import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { VersaEditCore } from '../../core/editor'
import type { VersaEditLabels } from '../../core/i18n'
import { IconSettings } from '../icons'
import { useCloseOnSignal, useKeepInViewport } from './usePopup'

/** Conteúdo do painel de configurações (prop settingsPanel do VersaEdit) */
export type SettingsPanel = React.ReactNode | ((close: () => void) => React.ReactNode)

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

// Engrenagem no fim da barra (encostada à direita da última linha) e o painel que
// ela abre, com o conteúdo dado pela aplicação. Abrir leva o foco ao primeiro
// controle do painel (ou ao próprio painel); Esc, clique fora e o começo de um
// redimensionamento da área fecham. Esc e close() devolvem o foco ao botão; o
// clique fora deixa o foco onde a pessoa clicou. A seleção do texto fica guardada
// pelo núcleo enquanto o foco está no painel (ref.focus() a devolve).
export function SettingsMenu({
  core,
  labels: L,
  panel,
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  panel: SettingsPanel
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = `${useId()}-settings`

  // Pedido de foco no botão, atendido depois de o painel sair (efeito abaixo)
  const [focusButton, setFocusButton] = useState(0)
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) setFocusButton((n) => n + 1)
  }, [])
  const closeAndFocus = useCallback(() => close(true), [close])
  useEffect(() => {
    if (focusButton) buttonRef.current?.focus()
  }, [focusButton])

  useKeepInViewport(open, panelRef)
  // Redimensionar a área de edição fecha o painel, como os outros menus
  useCloseOnSignal(open, () => close(false))

  // Ao abrir: foco no primeiro controle do painel (ou no próprio painel)
  // (a engrenagem vira antes o item ativo da barra: Shift+Tab no painel volta a ela)
  useEffect(() => {
    if (!open) return
    buttonRef.current?.focus({ preventScroll: true })
    const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current
    target?.focus()
  }, [open])

  // Clique fora fecha; dentro (inclusive em controles nativos do painel), não
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, close])

  return (
    <div
      className="ve-settings-wrap"
      ref={wrapRef}
      // Foco saindo da engrenagem e do painel (Tab depois do último controle, ou o
      // foco levado ao texto): fecha, sem mover o foco, para o painel não ficar
      // aberto sobre o conteúdo longe do teclado
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null
        if (open && next && !wrapRef.current?.contains(next)) close(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`ve-btn${open ? ' ve-btn-active' : ''}`}
        title={L.settings}
        aria-label={L.settings}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // Guarda a seleção do texto antes de o foco sair do editor
        onMouseDown={(e) => {
          e.preventDefault()
          core()?.saveSelection()
        }}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <IconSettings />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="ve-settings-panel"
          role="dialog"
          aria-label={L.settings}
          tabIndex={-1}
          onKeyDown={(e) => {
            // Esc fecha só o painel (não chega aos outros menus nem ao editor), a
            // menos que um controle do painel já o tenha usado (ex.: um campo que
            // desfaz o que foi digitado)
            if (e.key === 'Escape' && !e.defaultPrevented) {
              e.preventDefault()
              e.stopPropagation()
              close(true)
            }
            // Setas e Home/End são dos controles do painel, não da barra
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.stopPropagation()
          }}
        >
          {typeof panel === 'function' ? panel(closeAndFocus) : panel}
        </div>
      )}
    </div>
  )
}
