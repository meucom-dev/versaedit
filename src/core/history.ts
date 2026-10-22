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

// Seleção (opcional): cada passo guarda a seleção de antes da mudança (para o
// desfazer) e a de depois (para o refazer). O formato é de quem usa o histórico.
export interface EditorHistory<S = unknown> {
  /** Reinicia o histórico a partir do conteúdo inicial */
  reset(html: string): void
  /**
   * Seleção no começo de uma interação do usuário. Vale como "antes" da próxima
   * mudança; ignorada enquanto um grupo de mudanças está em aberto. Pode ser uma
   * função: ela só é chamada quando a seleção vai ser guardada (codificar a
   * seleção custa, e na digitação contínua quase toda marcação é ignorada).
   */
  markBefore(selection: S | undefined | (() => S | undefined)): void
  /**
   * Seleção atual no começo de um comando que não veio de uma interação (a API
   * chamada pelo app): substitui o "antes" guardado, que pode ser de antes de um
   * clique ter movido o cursor. Ignorada enquanto um grupo está em aberto; um
   * grupo parado há mais de 400 ms (o temporizador atrasou) é gravado antes.
   */
  markCurrent(selection: () => S | undefined, getHtml?: () => string): void
  /**
   * Digitação no instante `at` (o timeStamp do evento, quando confiável). Se o
   * passo anterior acabou de ser gravado pelo temporizador, mas esta tecla prova
   * que pertencia a ele (chegou a menos de 400 ms da anterior, ou esperava na fila
   * atrás de um temporizador atrasado), o passo é reaberto: um travamento da
   * página não parte a digitação. Nunca divide um passo.
   */
  typing(at: number | null): void
  /**
   * Fecha o grupo de mudanças em aberto, gravando o estado atual: a próxima
   * mudança começa um passo novo (operações distintas não se juntam, mesmo em
   * menos de 400 ms). Chamado antes da mudança seguinte.
   */
  close(getHtml: () => string): void
  /**
   * Composição de caracteres (IME, acentos compostos) começando (true) ou
   * terminando (false). Durante ela, o grupo aberto não fecha por tempo nem por
   * pedido: a composição inteira é um passo. No fim, o grupo segue aberto por um
   * instante, porque o texto final pode chegar depois do compositionend (Safari).
   */
  compose(active: boolean, getHtml: () => string): void
  /** Agenda o registro do estado atual (agrupa a digitação por ~400 ms) */
  schedule(getHtml: () => string, getSelection?: () => S | undefined): void
  /** Desfaz: devolve o HTML anterior, ou null se não houver */
  undo(getHtml: () => string): string | null
  /** Refaz: devolve o HTML seguinte, ou null se não houver */
  redo(getHtml: () => string): string | null
  /**
   * O navegador já desfez (-1) ou refez (+1) por conta própria, sem um evento que
   * pudesse ser cancelado: devolve o HTML a mostrar, segundo este histórico (o
   * passo anterior ou seguinte; sem ele, o estado atual), e nada disso vira um
   * passo novo. Com um passo ainda aberto, o desfazer do navegador desfez essa
   * edição: ela sai. `current` é a seleção a manter quando não há passo para ir.
   * null: nada a fazer (refazer com um passo aberto).
   */
  external(delta: -1 | 1, current?: S): string | null
  /** Seleção a restaurar depois do último desfazer/refazer (undefined: nenhuma) */
  restoredSelection(): S | undefined
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

interface Entry<S> {
  /** HTML com marcadores no lugar das imagens grandes */
  text: string
  /** Imagens usadas por este passo (uma vez por ocorrência) */
  ids: number[]
  /** Seleção antes da primeira mudança do passo (o desfazer volta a ela) */
  before?: S
  /** Seleção depois da última mudança do passo (o refazer volta a ela) */
  after?: S
}

// Temporizador que dispara mais atrasado que isto: a página estava travada
const LATE_MS = 50
// Tecla tratada até este tempo depois de um temporizador atrasado: estava na fila
const QUEUED_MS = 50

export function createEditorHistory<S = unknown>(
  limit = 100,
  // Relógio da página (o mesmo do timeStamp dos eventos); trocável nos testes
  clock: () => number = () => performance.now(),
): EditorHistory<S> {
  type Item = Entry<S>
  let stack: Item[] = []
  let index = -1
  let timer: number | null = null
  // Grupo de mudanças em aberto (sem temporizador durante uma composição)
  let open = false
  // Composição de caracteres em andamento, e um fechamento pedido durante ela
  let composing = false
  let closeAfterComposition = false
  // Quando o temporizador deveria disparar, a última mudança e a última tecla
  let dueAt = 0
  let changedAt = 0
  let typedAt: number | null = null
  // Passo gravado pelo temporizador que ainda pode ser reaberto pela próxima tecla
  let idle: { entry: Entry<S>; typedAt: number | null; at: number; late: boolean } | null = null
  // Enquanto o editor é restaurado pelo histórico, as mutações não são registradas
  let restoring = false
  // Seleção do começo da interação atual, e as do grupo de mudanças em aberto
  let candidate: S | undefined
  let groupBefore: S | undefined
  let groupAfter: S | undefined
  let moved: S | undefined

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

  const encode = (html: string): Item => {
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

  const decode = (entry: Item): string =>
    entry.ids.length
      ? entry.text.replace(TOKEN, (_m, id: string) => blobs.get(Number(id))?.data ?? '')
      : entry.text

  const retain = (entry: Item) => {
    for (const id of entry.ids) blobs.get(id)!.refs++
  }

  // Solta as imagens do passo; as que ficam sem uso saem da tabela
  const release = (entry: Item) => {
    for (const id of entry.ids) {
      const blob = blobs.get(id)
      if (!blob) continue
      blob.refs--
      if (blob.refs <= 0) forget(id, blob.data)
    }
  }

  // Imagens criadas por um encode que não virou passo (estado repetido)
  const discardUnused = (entry: Item) => {
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

  // Grava o grupo aberto; devolve o passo criado (null: estado igual ao anterior)
  const commit = (html: string): Item | null => {
    open = false
    closeAfterComposition = false
    idle = null
    const entry = encode(html)
    entry.before = groupBefore
    entry.after = groupAfter
    groupBefore = groupAfter = candidate = undefined
    if (index >= 0 && stack[index].text === entry.text) {
      discardUnused(entry)
      return null
    }
    // Nova edição depois de desfazer: os passos de refazer saem
    for (const dropped of stack.slice(index + 1)) release(dropped)
    stack = [...stack.slice(0, index + 1), entry]
    retain(entry)
    if (stack.length > limit) release(stack.shift()!)
    index = stack.length - 1
    return entry
  }

  const flush = (getHtml: () => string) => {
    cancelPending()
    commit(getHtml())
  }

  const closeLater = (getHtml: () => string, delay: number) => {
    cancelPending()
    dueAt = clock() + delay
    timer = window.setTimeout(() => {
      timer = null
      const now = clock()
      const late = now - dueAt > LATE_MS
      const entry = commit(getHtml())
      // Gravado pelo tempo: a próxima tecla ainda pode provar que era deste passo
      if (entry) idle = { entry, typedAt, at: now, late }
    }, delay)
  }

  // A tecla pertence ao passo que o temporizador acabou de gravar?
  const belongsToIdle = (at: number | null) => {
    if (!idle || open || stack[index] !== idle.entry) return false
    if (at !== null && idle.typedAt !== null && at - idle.typedAt <= GROUP_DELAY_MS) return true
    return idle.late && clock() - idle.at <= QUEUED_MS
  }

  // Volta o último passo a ser o grupo aberto (a digitação continua nele)
  const reopen = () => {
    const entry = stack[index]
    stack = stack.slice(0, index)
    index -= 1
    release(entry)
    groupBefore = entry.before
    groupAfter = entry.after
    open = true
    idle = null
  }

  // Mostra um estado do histórico: as mudanças que isso causa não são registradas
  const show = (selection: S | undefined): string => {
    moved = selection
    restoring = true
    window.setTimeout(() => {
      restoring = false
    }, 0)
    return decode(stack[index])
  }

  const move = (delta: number): string | null => {
    const target = index + delta
    if (target < 0 || target >= stack.length) return null
    // Desfazer volta à seleção de antes do passo desfeito; refazer, à de depois
    const selection = delta < 0 ? stack[index].before : stack[target].after
    index = target
    return show(selection)
  }

  return {
    reset(html) {
      cancelPending()
      candidate = groupBefore = groupAfter = moved = undefined
      open = composing = closeAfterComposition = false
      idle = null
      typedAt = null
      for (const entry of stack) release(entry)
      const entry = encode(html)
      stack = [entry]
      retain(entry)
      index = 0
    },
    markBefore(selection) {
      if (restoring) return
      const read = () =>
        typeof selection === 'function' ? (selection as () => S | undefined)() : selection
      if (!open) candidate = read()
      // Grupo aberto sem seleção de antes (aberto por uma mudança que não veio de
      // uma interação): a primeira interação dentro dele a fornece
      else if (groupBefore === undefined) groupBefore = read()
    },
    markCurrent(selection, getHtml) {
      if (restoring) return
      // Grupo parado há mais de 400 ms cujo temporizador atrasou: ele já terminou
      if (open && getHtml && !composing && clock() - changedAt > GROUP_DELAY_MS) {
        cancelPending()
        commit(getHtml())
      }
      if (open) return
      candidate = selection()
    },
    typing(at) {
      if (restoring || composing) return
      if (belongsToIdle(at)) reopen()
      typedAt = at ?? clock()
    },
    close(getHtml) {
      // Fronteira explícita: o passo anterior não pode mais ser reaberto
      idle = null
      if (!open || restoring) return
      // No meio de uma composição, o passo só fecha quando ela termina
      if (composing) {
        closeAfterComposition = true
        return
      }
      flush(getHtml)
    },
    compose(active, getHtml) {
      composing = active
      if (active || !open) {
        closeAfterComposition = false
        return
      }
      // Fim da composição: o texto final ainda pode chegar (Safari); um fechamento
      // pedido durante ela acontece logo em seguida
      closeLater(getHtml, closeAfterComposition ? 0 : GROUP_DELAY_MS)
      closeAfterComposition = false
    },
    schedule(getHtml, getSelection) {
      if (restoring) return
      // Primeira mudança de um grupo: a seleção "antes" é a do começo da interação
      if (!open) {
        groupBefore = candidate
        open = true
        idle = null
      }
      changedAt = clock()
      if (getSelection) groupAfter = getSelection()
      // Durante uma composição, nada fecha o grupo por tempo
      if (composing) cancelPending()
      else closeLater(getHtml, GROUP_DELAY_MS)
    },
    undo(getHtml) {
      idle = null
      flush(getHtml)
      return move(-1)
    },
    redo(getHtml) {
      idle = null
      flush(getHtml)
      return move(1)
    },
    external(delta, current) {
      idle = null
      if (open) {
        if (delta > 0) return null
        cancelPending()
        const before = groupBefore
        groupBefore = groupAfter = candidate = undefined
        open = closeAfterComposition = false
        return show(before)
      }
      return move(delta) ?? show(current)
    },
    restoredSelection() {
      return moved
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
