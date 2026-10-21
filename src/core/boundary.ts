// ─── FRONTEIRA DA API ────────────────────────────────────────────
// Toda chamada que vem de fora do núcleo (barra, ref do React, o app) passa por
// aqui: `enter` roda antes do método e `exit` depois, só na chamada mais externa.
// Chamadas internas (this.x() dentro do núcleo) não passam pela fronteira, e uma
// chamada do app feita dentro de um callback do núcleo (onChange durante um
// comando) também não: ela já está dentro de uma chamada.
// Vale para qualquer método, atual ou futuro: não há lista a manter.

export interface CallBoundary {
  enter(): void
  exit(): void
}

export function withCallBoundary<T extends object>(target: T, boundary: CallBoundary): T {
  let depth = 0
  const wrapped = new WeakMap<object, unknown>()
  const run = (method: (...args: unknown[]) => unknown, args: unknown[]): unknown => {
    if (depth === 0) safely(boundary.enter)
    depth++
    try {
      // O próprio núcleo como `this`: as chamadas internas ficam fora da fronteira
      return method.apply(target, args)
    } finally {
      depth--
      if (depth === 0) safely(boundary.exit)
    }
  }
  return new Proxy(target, {
    get(obj, key) {
      // Propriedades e getters lidos no próprio núcleo (sem passar pela fronteira)
      const value: unknown = Reflect.get(obj, key, obj)
      if (typeof value !== 'function' || key === 'constructor') return value
      let wrapper = wrapped.get(value)
      if (!wrapper) {
        const method = value as (...args: unknown[]) => unknown
        wrapper = (...args: unknown[]) => run(method, args)
        wrapped.set(value, wrapper)
      }
      return wrapper
    },
  })
}

// A fronteira nunca impede o comando de rodar
function safely(fn: () => void): void {
  try {
    fn()
  } catch {
    // Sem efeito no comando: no pior caso, o "antes" do passo é o já guardado
  }
}
