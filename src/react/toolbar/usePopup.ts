import { useEffect, useLayoutEffect, type RefObject } from 'react'

// Distância mínima entre o menu e a borda da janela
const EDGE = 8

// No servidor (SSR) o useLayoutEffect não roda e o React 18 avisa; lá usa-se
// useEffect (que também não roda), como em VersaEdit.tsx
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Mantém o menu aberto inteiro dentro da janela: perto da borda (janela estreita,
 * celular, zoom alto) ele desliza na horizontal o necessário, sem mudar de tamanho
 * nem sair de baixo do botão. Usa a propriedade `translate`, que se soma ao
 * `transform` do próprio CSS do menu.
 */
export function useKeepInViewport(open: boolean, ref: RefObject<HTMLElement | null>) {
  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const fit = () => {
      el.style.removeProperty('translate')
      const r = el.getBoundingClientRect()
      const right = document.documentElement.clientWidth - EDGE
      let dx = r.right > right ? right - r.right : 0
      if (r.left + dx < EDGE) dx = EDGE - r.left
      if (Math.abs(dx) >= 0.5) el.style.setProperty('translate', `${Math.round(dx)}px 0`)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [open, ref])
}

/**
 * Esc fecha o menu aberto também com o foco no texto: os botões da barra devolvem
 * o foco ao editor para manter a seleção, então a tecla chega à área de edição e
 * não ao menu. Só reage a teclas dentro do mesmo editor (barra ou texto); não
 * cancela a tecla nem mexe na seleção.
 */
export function useEscapeToClose(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const root = ref.current?.closest('.ve-root')
      if (root && e.target instanceof Node && root.contains(e.target)) close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, ref, close])
}
