import type { Point, VersaEditCore } from '../../core/editor'

// Alça de redimensionamento livre no canto inferior direito do objeto selecionado
export function ResizeHandle({
  position,
  title,
  core,
}: {
  position: Point
  title: string
  core: () => VersaEditCore | null
}) {
  return (
    <div
      className="ve-resize-handle"
      title={title}
      style={{ top: position.top, left: position.left }}
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
