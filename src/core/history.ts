// ============================================================
// Histórico de desfazer / refazer do VersaEdit.
// Guarda o HTML do editor a cada alteração agrupada (digitação, formatação,
// imagens, caixas de texto, cor do papel, limpar). Fica fora do estado do React.
//
// Imagens embutidas (data:…;base64) são guardadas uma única vez: cada passo
// guarda o HTML com um marcador no lugar da imagem, e a imagem fica numa tabela
// com contador de uso. Desfazer/refazer devolve o HTML original, idêntico. O
// marcador usa o caractere nulo, que nunca aparece em HTML serializado pelo
// navegador (o parser troca U+0000 por U+FFFD).
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
  /** Números internos, para testes e diagnóstico */
  stats(): HistoryStats
}

export interface HistoryStats {
  /** Passos guardados */
  entries: number
  /** Posição atual (0 = primeiro passo) */
  index: number
  /** Imagens embutidas guardadas (cada uma uma vez) */
  blobs: number
  /** Tamanho total dessas imagens, em caracteres */
  blobChars: number
}

const GROUP_DELAY_MS = 400
// Imagens embutidas menores que isto ficam no próprio passo (não compensa)
const MIN_BLOB_CHARS = 1024
const DATA_URI = /data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g
const NUL = String.fromCharCode(0)
const TOKEN = new RegExp(`${NUL}(\\d+)${NUL}`, 'g')

interface Entry {
  /** HTML com marcadores no lugar das imagens grandes */
  text: string
  /** Imagens usadas por este passo (uma vez por ocorrência) */
  ids: number[]
}

export function createEditorHistory(limit = 100): EditorHistory {
  let stack: Entry[] = []
  let index = -1
  let timer: number | null = null
  // Enquanto o editor é restaurado pelo histórico, as mutações não são registradas
  let restoring = false

  // Tabela de imagens: chave curta → ids, e id → conteúdo + contador de uso.
  // A chave curta (tamanho + começo + fim) evita calcular o hash de strings de
  // vários MB a cada passo; a igualdade completa é conferida só no candidato.
  let nextId = 1
  const idsByKey = new Map<string, number[]>()
  const shortKey = (data: string) => `${data.length}:${data.slice(0, 96)}:${data.slice(-96)}`
  const findId = (data: string): number | undefined =>
    idsByKey.get(shortKey(data))?.find((id) => blobs.get(id)?.data === data)
  const forget = (id: number, data: string) => {
    blobs.delete(id)
    const key = shortKey(data)
    const rest = (idsByKey.get(key) ?? []).filter((other) => other !== id)
    if (rest.length) idsByKey.set(key, rest)
    else idsByKey.delete(key)
  }
  const blobs = new Map<number, { data: string; refs: number }>()

  const encode = (html: string): Entry => {
    const ids: number[] = []
    const text = html.replace(DATA_URI, (data) => {
      if (data.length < MIN_BLOB_CHARS) return data
      let id = findId(data)
      if (id === undefined) {
        id = nextId++
        // Cópia independente: um pedaço de string pode manter viva a string
        // inteira de onde saiu (o HTML completo do passo)
        const copy = JSON.parse(JSON.stringify(data)) as string
        const key = shortKey(copy)
        idsByKey.set(key, [...(idsByKey.get(key) ?? []), id])
        blobs.set(id, { data: copy, refs: 0 })
      }
      ids.push(id)
      return `${NUL}${id}${NUL}`
    })
    return { text, ids }
  }

  const decode = (entry: Entry): string =>
    entry.ids.length
      ? entry.text.replace(TOKEN, (_m, id: string) => blobs.get(Number(id))?.data ?? '')
      : entry.text

  const retain = (entry: Entry) => {
    for (const id of entry.ids) blobs.get(id)!.refs++
  }

  // Solta as imagens do passo; as que ficam sem uso saem da tabela
  const release = (entry: Entry) => {
    for (const id of entry.ids) {
      const blob = blobs.get(id)
      if (!blob) continue
      blob.refs--
      if (blob.refs <= 0) forget(id, blob.data)
    }
  }

  // Imagens criadas por um encode que não virou passo (estado repetido)
  const discardUnused = (entry: Entry) => {
    for (const id of entry.ids) {
      const blob = blobs.get(id)
      if (blob && blob.refs <= 0) forget(id, blob.data)
    }
  }

  const cancelPending = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  const commit = (html: string) => {
    const entry = encode(html)
    if (index >= 0 && stack[index].text === entry.text) {
      discardUnused(entry)
      return
    }
    // Nova edição depois de desfazer: os passos de refazer saem
    for (const dropped of stack.slice(index + 1)) release(dropped)
    stack = [...stack.slice(0, index + 1), entry]
    retain(entry)
    if (stack.length > limit) release(stack.shift()!)
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
    return decode(stack[index])
  }

  return {
    reset(html) {
      cancelPending()
      for (const entry of stack) release(entry)
      const entry = encode(html)
      stack = [entry]
      retain(entry)
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
    stats() {
      let blobChars = 0
      for (const blob of blobs.values()) blobChars += blob.data.length
      return { entries: stack.length, index, blobs: blobs.size, blobChars }
    },
  }
}
