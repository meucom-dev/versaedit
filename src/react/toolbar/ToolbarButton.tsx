import React from 'react'

export const ToolbarSep = () => <div className="ve-sep" role="separator" />

export const ToolbarBtn = ({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) => (
  <button
    type="button"
    className="ve-btn"
    title={title}
    aria-label={title}
    // Mantém o foco e o cursor no editor ao usar a barra de ferramentas
    onMouseDown={(e) => e.preventDefault()}
    onClick={(e) => {
      e.preventDefault()
      onClick()
    }}
  >
    {children}
  </button>
)
