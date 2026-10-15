import { useRef } from 'react'
import type { TextboxBorder, VersaEditCore } from '../../core/editor'
import { format, type VersaEditLabels } from '../../core/i18n'
import type { TbBorderStyle } from '../../core/objects'
import { IconBorderColor, IconTextbox, IconTrash } from '../icons'
import { ToolbarBtn } from './ToolbarButton'

const TB_BORDER_STYLES: { label: keyof VersaEditLabels; value: TbBorderStyle }[] = [
  { label: 'lineSolid', value: 'solid' },
  { label: 'lineDashed', value: 'dashed' },
  { label: 'lineDotted', value: 'dotted' },
  { label: 'lineDouble', value: 'double' },
]
const TB_BORDER_WIDTHS = ['1', '2', '3', '4', '6', '8']

// Todas as funções de caixa de texto reunidas em um único grupo
export function TextboxControls({
  core,
  labels: L,
  border,
  setBorder,
  isSelected,
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  border: TextboxBorder
  setBorder: (border: TextboxBorder) => void
  isSelected: boolean
}) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="ve-group" role="group" aria-label={L.textboxTools} title={L.textboxTools}>
      <ToolbarBtn onClick={() => core()?.insertTextbox()} title={L.insertTextbox}>
        <IconTextbox />
      </ToolbarBtn>
      <div className={`ve-color-picker ${isSelected ? '' : 've-disabled'}`.trim()}>
        <ToolbarBtn
          onClick={() => isSelected && colorInputRef.current?.click()}
          title={L.textboxBorderColor}
        >
          <IconBorderColor />
          <span className="ve-color-indicator" style={{ backgroundColor: border.color }} />
        </ToolbarBtn>
        <input
          ref={colorInputRef}
          type="color"
          tabIndex={-1}
          aria-label={L.textboxBorderColor}
          value={border.color}
          onChange={(e) => {
            const color = e.target.value
            const result = core()?.setTextboxBorderColor(color, border.style) ?? {}
            setBorder({ ...border, color, ...result })
          }}
        />
      </div>
      <select
        className="ve-select"
        value={border.width}
        onChange={(e) => {
          const width = e.target.value
          setBorder({ ...border, width })
          core()?.setTextboxBorderWidth(width, border.style)
        }}
        title={L.textboxBorderWidth}
        aria-label={L.textboxBorderWidth}
        disabled={!isSelected}
      >
        <option value="0">{L.borderNone}</option>
        {TB_BORDER_WIDTHS.map((w) => (
          <option key={w} value={w}>
            {format(L.borderPx, { n: w })}
          </option>
        ))}
      </select>
      <select
        className="ve-select"
        value={border.style}
        onChange={(e) => {
          const style = e.target.value as TbBorderStyle
          const result = core()?.setTextboxBorderStyle(style) ?? {}
          setBorder({ ...border, style, ...result })
        }}
        title={L.textboxBorderStyle}
        aria-label={L.textboxBorderStyle}
        disabled={!isSelected}
      >
        {TB_BORDER_STYLES.map((s) => (
          <option key={s.value} value={s.value}>
            {L[s.label]}
          </option>
        ))}
      </select>
      <ToolbarBtn onClick={() => core()?.deleteSelectedTextbox()} title={L.deleteTextbox}>
        <IconTrash />
      </ToolbarBtn>
    </div>
  )
}
