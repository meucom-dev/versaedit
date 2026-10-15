import React from 'react'
import type { VersaEditCore } from '../../core/editor'
import { format, type VersaEditLabels } from '../../core/i18n'
import { IconPaper, IconTextColor } from '../icons'

export type ColorKind = 'text' | 'bg'

// Seletor de cor do texto ou do papel: o ícone abre a paleta; o círculo aplica
// a cor atual à seleção e fecha o seletor
export function ColorPicker({
  kind,
  core,
  labels: L,
  color,
  palette,
  openPalette,
  setOpenPalette,
  onPick,
  onPickCustom,
}: {
  kind: ColorKind
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  color: string
  palette: string[]
  openPalette: ColorKind | null
  setOpenPalette: (kind: ColorKind | null) => void
  onPick: (kind: ColorKind, color: string) => void
  onPickCustom: (kind: ColorKind, color: string) => void
}) {
  const command = kind === 'text' ? 'foreColor' : 'hiliteColor'
  const label = kind === 'text' ? L.textColor : L.paperColor
  const applyLabel = format(L.applyColor, { label, color })
  const keepSelection = (e: React.MouseEvent) => {
    e.preventDefault()
    core()?.saveSelection()
  }
  return (
    <div className="ve-color-picker">
      <button
        type="button"
        className="ve-btn"
        title={label}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={openPalette === kind}
        onMouseDown={keepSelection}
        onClick={() => setOpenPalette(openPalette === kind ? null : kind)}
      >
        {kind === 'text' ? <IconTextColor /> : <IconPaper />}
      </button>
      <button
        type="button"
        className="ve-btn"
        title={applyLabel}
        aria-label={applyLabel}
        onMouseDown={keepSelection}
        onClick={() => {
          core()?.applyColor(command, color)
          setOpenPalette(null)
        }}
      >
        <span className="ve-color-indicator" style={{ backgroundColor: color }} />
      </button>
      {openPalette === kind && (
        <div className="ve-palette" onMouseLeave={() => core()?.restorePreview()}>
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              className="ve-swatch"
              title={c}
              aria-label={c}
              style={{ backgroundColor: c }}
              onMouseDown={keepSelection}
              onMouseEnter={() => {
                if (kind === 'text') core()?.previewStyle('color', c)
              }}
              onClick={() => onPick(kind, c)}
            />
          ))}
          <label
            className="ve-swatch ve-swatch--custom"
            title={L.customColor}
            onMouseDown={() => core()?.saveSelection()}
          >
            <input
              type="color"
              aria-label={L.customColor}
              value={color}
              onChange={(e) => onPickCustom(kind, e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
