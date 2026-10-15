// ============================================================
// Histórico de desfazer / refazer do RichEditor.
// Guarda o HTML do editor a cada alteração agrupada (digitação, formatação,
// imagens, caixas de texto, cor do papel, limpar). Fica fora do estado do React.
// ============================================================

export interface EditorHistory {
  /** Reinicia o histórico a partir do conteúdo inicial */
  reset(html: string): void
  /** Agenda o registro do estado atual (agrupa a digitação por ~400 ms) */
  schedule(getHtml: () => string): void
  /** Desfaz: devolve o HTML anterior, ou null se não houver */
  undo(getHtml: () => string): string | null
  /** Refaz: devolve o HTML seguinte, ou null se não houver */
  redo(getHtml: () => string): string | null
  /** Cancela registros pendentes (ao desmontar o editor) */
  dispose(): void
}

const GROUP_DELAY_MS = 400

export function createEditorHistory(limit = 100): EditorHistory {
  let stack: string[] = []
  let index = -1
  let timer: number | null = null
  // Enquanto o editor é restaurado pelo histórico, as mutações não são registradas
  let restoring = false

  const cancelPending = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  const commit = (html: string) => {
    if (index >= 0 && stack[index] === html) return
    stack = [...stack.slice(0, index + 1), html]
    if (stack.length > limit) stack.shift()
    index = stack.length - 1
  }

  const flush = (getHtml: () => string) => {
    cancelPending()
    commit(getHtml())
  }

  const move = (delta: number): string | null => {
    const target = index + delta
    if (target < 0 || target >= stack.length) return null
    index = target
    restoring = true
    window.setTimeout(() => {
      restoring = false
    }, 0)
    return stack[index]
  }

  return {
    reset(html) {
      cancelPending()
      stack = [html]
      index = 0
    },
    schedule(getHtml) {
      if (restoring) return
      cancelPending()
      timer = window.setTimeout(() => {
        timer = null
        commit(getHtml())
      }, GROUP_DELAY_MS)
    },
    undo(getHtml) {
      flush(getHtml)
      return move(-1)
    },
    redo(getHtml) {
      flush(getHtml)
      return move(1)
    },
    dispose() {
      cancelPending()
    },
  }
}
