import { useState } from 'react'
import type { VersaEditCore } from '../../core/editor'
import type { VersaEditLabels } from '../../core/i18n'
import { ToolbarBtn } from './ToolbarButton'

// Marca-texto: paleta de cores de fundo para o trecho selecionado
export function HighlightPicker({
  core,
  labels: L,
  colors,
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  colors: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ve-highlight-wrap">
      <ToolbarBtn onClick={() => setOpen(!open)} title={L.highlight}>
        <span className="ve-highlight-sample">S</span>
      </ToolbarBtn>
      {open && (
        <div className="ve-highlight-palette">
          {colors.map((c) => {
            const title = c === 'transparent' ? L.highlightNone : c
            return (
              <button
                key={c}
                type="button"
                className="ve-highlight-swatch"
                style={{ background: c === 'transparent' ? '#fff' : c }}
                // Mantém a seleção do texto ao clicar na cor
                onMouseDown={(e) => {
                  e.preventDefault()
                  core()?.saveSelection()
                }}
                onClick={() => {
                  core()?.applyHighlight(c)
                  setOpen(false)
                }}
                title={title}
                aria-label={title}
              >
                {c === 'transparent' && '✕'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
