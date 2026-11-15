import { useState } from 'react'
import type { FrameLimits, FrameSize } from '../core/frame-resize'
import type { VersaEditLabels } from '../core/i18n'

// Campos de largura e altura da área de edição (prop sizeControls), abaixo dela.
// Mostram o tamanho visível, também durante o arraste das alças. O que se digita
// fica pendente até Enter ou sair do campo (aplica, dentro dos limites) ou Esc
// (desfaz). Ficam fora da área editável: o conteúdo e o histórico não mudam.
export function SizeControls({
  size,
  limits,
  labels: L,
  onCommit,
}: {
  size: FrameSize | null
  limits: Required<FrameLimits> | null
  labels: VersaEditLabels
  onCommit: (size: Partial<FrameSize>) => void
}) {
  return (
    <div className="ve-size-controls" role="group" aria-label={L.sizeControls}>
      <SizeField
        label={L.sizeWidth}
        value={size?.width}
        min={limits?.minWidth}
        max={limits?.maxWidth}
        onCommit={(width) => onCommit({ width })}
      />
      <SizeField
        label={L.sizeHeight}
        value={size?.height}
        min={limits?.minHeight}
        max={limits?.maxHeight}
        onCommit={(height) => onCommit({ height })}
      />
    </div>
  )
}

function SizeField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string
  value: number | undefined
  min: number | undefined
  max: number | undefined
  onCommit: (value: number) => void
}) {
  // null: sem edição pendente (o campo mostra o tamanho atual)
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    setDraft(null)
    const n = Math.round(Number(draft))
    if (draft.trim() !== '' && Number.isFinite(n)) onCommit(n)
  }
  return (
    <label className="ve-size-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max !== undefined && Number.isFinite(max) ? max : undefined}
        value={draft ?? (value === undefined ? '' : String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape' && draft !== null) {
            e.preventDefault()
            e.stopPropagation()
            setDraft(null)
          }
        }}
        onBlur={commit}
      />
      <span aria-hidden="true">px</span>
    </label>
  )
}
