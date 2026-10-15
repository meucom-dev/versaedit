import { useEffect, useRef, useState } from 'react'
import type { FontFamilyOption } from '../../core/defaults'
import type { VersaEditCore } from '../../core/editor'
import type { VersaEditLabels } from '../../core/i18n'

// Menu de famílias de fonte: pré-visualiza a fonte no trecho selecionado ao
// passar o mouse e grava ao clicar
export function FontPicker({
  core,
  labels: L,
  fontFamilies,
  currentFont,
  onChoose,
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  fontFamilies: FontFamilyOption[]
  currentFont: string
  onChoose: (font: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora do menu
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
        core()?.restorePreview()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, core])

  return (
    <div className="ve-font-picker" ref={menuRef}>
      <button
        type="button"
        className="ve-select ve-font-button"
        title={L.fontFamily}
        aria-label={L.fontFamily}
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(e) => {
          e.preventDefault()
          core()?.saveSelection()
        }}
        onClick={() => {
          if (open) {
            setOpen(false)
            core()?.restorePreview()
          } else {
            setOpen(true)
          }
        }}
      >
        <span>
          {fontFamilies.find((font) => font.value === currentFont)?.label ?? L.fontFallback}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          className="ve-font-options"
          role="listbox"
          aria-label={L.fontFamily}
          onMouseLeave={() => core()?.restorePreview()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              core()?.restorePreview()
            }
          }}
        >
          {fontFamilies.map((font) => (
            <button
              key={font.value}
              type="button"
              className="ve-font-option"
              role="option"
              aria-selected={currentFont === font.value}
              style={{ fontFamily: font.value }}
              onMouseDown={(e) => {
                e.preventDefault()
                core()?.saveSelection()
              }}
              onMouseEnter={() => core()?.previewStyle('fontFamily', font.value)}
              onClick={() => {
                onChoose(font.value)
                setOpen(false)
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
