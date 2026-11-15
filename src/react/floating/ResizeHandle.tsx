import type { Point, VersaEditCore } from '../../core/editor'

// Alça de redimensionamento no canto do objeto selecionado que se move: o inferior
// direito; no objeto flutuando à direita, o inferior esquerdo
export function ResizeHandle({
  position,
  title,
  core,
}: {
  position: Point & { corner?: 'left' | 'right' }
  title: string
  core: () => VersaEditCore | null
}) {
  return (
    <div
      className="ve-resize-handle"
      title={title}
      data-corner={position.corner ?? 'right'}
      style={{
        top: position.top,
        left: position.left,
        ...(position.corner === 'left' ? { cursor: 'nesw-resize' } : {}),
      }}
      // Pointer Events: mouse, toque e caneta
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        core()?.startResize(e.clientX, e.clientY, e.pointerId)
      }}
      onMouseDown={(e) => e.preventDefault()}
    />
  )
}
