import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { ObjectState, VersaEditCore } from '../../core/editor'
import type { VersaEditLabels } from '../../core/i18n'
import { IconTrash } from '../icons'

const RESIZE_STEPS = [25, 50, 75, 100]
// Distância entre o menu e o objeto, e folga mínima até a borda da área
const GAP = 6
const EDGE = 4

// Posição do menu dentro da área: acima do objeto, a partir da borda esquerda
// dele; perto da borda direita, alinha pela direita do objeto (cresce para a
// esquerda); sem espaço acima, vai para baixo do objeto
export function placeObjectToolbar(
  box: NonNullable<ObjectState['box']>,
  menu: { width: number; height: number },
  area: { width: number; height: number },
): { top: number; left: number } {
  let left = box.left
  if (left + menu.width > area.width - EDGE) left = box.right - menu.width
  left = Math.max(EDGE, Math.min(left, area.width - menu.width - EDGE))
  let top = box.top - menu.height - GAP
  if (top < EDGE) top = box.bottom + GAP
  return { top, left }
}

// Menu flutuante sobre a imagem ou a caixa de texto selecionada:
// tamanho, alinhamento e exclusão
export const ObjectToolbar = forwardRef<
  HTMLDivElement,
  { object: ObjectState; core: () => VersaEditCore | null; labels: VersaEditLabels }
>(function ObjectToolbar({ object, core, labels: L }, ref) {
  // Medido antes de pintar: o menu já aparece na posição final (sem salto)
  const own = useRef<HTMLDivElement | null>(null)
  const [placed, setPlaced] = useState<{ top: number; left: number } | null>(null)
  const { box } = object
  useLayoutEffect(() => {
    const menu = own.current
    const area = menu?.offsetParent as HTMLElement | null
    if (!menu || !area || !box) {
      setPlaced(null)
      return
    }
    setPlaced(
      placeObjectToolbar(
        box,
        { width: menu.offsetWidth, height: menu.offsetHeight },
        { width: area.clientWidth, height: area.clientHeight },
      ),
    )
  }, [box?.top, box?.left, box?.right, box?.bottom]) // eslint-disable-line react-hooks/exhaustive-deps
  // Antes de medir, o menu fica na borda esquerda da área: na posição do núcleo
  // (borda esquerda do objeto) ele podia passar da borda direita da tela, e no
  // celular a página ficava mais larga por um instante e rolava; o clique do
  // toque caía fora do objeto e o desmarcava. Sem box, vale a posição do núcleo.
  const position: CSSProperties = placed ?? {
    top: object.toolbar.top,
    left: box ? 0 : object.toolbar.left,
  }

  const isImage = object.type === 'image'
  const resize = (pct: number) =>
    isImage ? core()?.resizeSelectedImage(pct) : core()?.resizeSelectedTextbox(pct)
  const remove = () => (isImage ? core()?.deleteSelectedImage() : core()?.deleteSelectedTextbox())

  return (
    <div
      ref={(node) => {
        own.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      className="ve-float-toolbar"
      // Não rouba o foco do editor ao usar os botões flutuantes
      onMouseDown={(e) => e.preventDefault()}
      style={position}
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
