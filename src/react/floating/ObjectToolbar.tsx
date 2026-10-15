import { forwardRef } from 'react'
import type { ObjectState, VersaEditCore } from '../../core/editor'
import type { VersaEditLabels } from '../../core/i18n'
import { IconTrash } from '../icons'

const RESIZE_STEPS = [25, 50, 75, 100]

// Menu flutuante sobre a imagem ou a caixa de texto selecionada:
// tamanho, alinhamento e exclusão
export const ObjectToolbar = forwardRef<
  HTMLDivElement,
  { object: ObjectState; core: () => VersaEditCore | null; labels: VersaEditLabels }
>(function ObjectToolbar({ object, core, labels: L }, ref) {
  const isImage = object.type === 'image'
  const resize = (pct: number) =>
    isImage ? core()?.resizeSelectedImage(pct) : core()?.resizeSelectedTextbox(pct)
  const remove = () => (isImage ? core()?.deleteSelectedImage() : core()?.deleteSelectedTextbox())

  return (
    <div
      ref={ref}
      className="ve-float-toolbar"
      // Não rouba o foco do editor ao usar os botões flutuantes
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: object.toolbar.top, left: object.toolbar.left }}
    >
      {RESIZE_STEPS.map((pct) => (
        <button key={pct} type="button" onClick={() => resize(pct)} title={`${pct}%`}>
          {pct}%
        </button>
      ))}
      <div className="ve-float-sep" />
      {isImage ? (
        <>
          <button type="button" onClick={() => core()?.floatImage('left')} title={L.alignLeft}>
            ⬅ {L.left}
          </button>
          <button type="button" onClick={() => core()?.floatImage('right')} title={L.alignRight}>
            {L.right} ➡
          </button>
          <button type="button" onClick={() => core()?.floatImage('none')} title={L.alignCenter}>
            ⬛ {L.center}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => core()?.alignSelectedTextbox('left')}
            title={L.alignLeft}
          >
            ⬅ {L.left}
          </button>
          <button
            type="button"
            onClick={() => core()?.alignSelectedTextbox('center')}
            title={L.alignCenter}
          >
            ☰ {L.center}
          </button>
          <button
            type="button"
            onClick={() => core()?.alignSelectedTextbox('right')}
            title={L.alignRight}
          >
            {L.right} ➡
          </button>
        </>
      )}
      <div className="ve-float-sep" />
      <button
        type="button"
        className="ve-danger"
        onClick={remove}
        title={isImage ? L.deleteImage : L.deleteTextbox}
      >
        <IconTrash /> {L.deleteButton}
      </button>
    </div>
  )
})
