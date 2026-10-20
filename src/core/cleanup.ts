// ─── ESTILOS ACRESCENTADOS PELO NAVEGADOR AO APAGAR ─────────────────
// Ao juntar blocos (Backspace/Delete), o Chromium e o WebKit "preservam" a
// aparência copiando estilos calculados (font-size, caret-color…) para o texto
// movido: criam spans ou acrescentam declarações ao style de elementos que já
// existiam. Aqui sai só o que a própria operação acrescentou e que não muda
// nada na tela. A formatação do usuário fica, mesmo quando coincide com a
// herdada (ela já existia antes da operação).

const declarations = (style: string | null | undefined): Set<string> => {
  const out = new Set<string>()
  if (!style) return out
  const probe = document.createElement('span')
  probe.setAttribute('style', style)
  for (let i = 0; i < probe.style.length; i++) {
    const property = probe.style[i]
    out.add(`${property}:${probe.style.getPropertyValue(property)}`)
  }
  return out
}

const styledElements = (node: Node): HTMLElement[] => {
  if (!(node instanceof HTMLElement)) return []
  const out = node.hasAttribute('style') ? [node] : []
  node.querySelectorAll<HTMLElement>('[style]').forEach((el) => out.push(el))
  return out
}

/**
 * Remove as declarações de estilo que a operação acrescentou (segundo os
 * registros do MutationObserver da operação) e que não mudam o estilo
 * calculado; desembrulha os spans que ficam sem atributos. Devolve se mudou algo.
 */
export function removeAddedRedundantStyles(
  records: MutationRecord[],
  editor: HTMLElement,
): boolean {
  // Declarações que existiam antes nos nós que a operação tirou do lugar
  // (para elementos recriados, que não têm "valor anterior")
  const existedBefore = new Set<string>()
  // Elemento → declarações que ele já tinha (null: criado pela operação)
  const touched = new Map<HTMLElement, Set<string> | null>()
  for (const record of records) {
    if (record.type === 'childList') {
      record.removedNodes.forEach((node) =>
        styledElements(node).forEach((el) =>
          declarations(el.getAttribute('style')).forEach((d) =>
            existedBefore.add(`${el.tagName}|${d}`),
          ),
        ),
      )
      record.addedNodes.forEach((node) =>
        styledElements(node).forEach((el) => {
          if (!touched.has(el)) touched.set(el, null)
        }),
      )
    } else if (
      record.type === 'attributes' &&
      record.attributeName === 'style' &&
      record.target instanceof HTMLElement &&
      !touched.has(record.target)
    ) {
      touched.set(record.target, declarations(record.oldValue))
    }
  }

  let changed = false
  const unwrappedIn = new Set<Node>()
  for (const [el, before] of touched) {
    if (el === editor || !el.isConnected || !editor.contains(el)) continue
    const properties = Array.from({ length: el.style.length }, (_, i) => el.style[i])
    for (const property of properties) {
      const value = el.style.getPropertyValue(property)
      const key = `${property}:${value}`
      const existed = before ? before.has(key) : existedBefore.has(`${el.tagName}|${key}`)
      if (existed) continue
      const priority = el.style.getPropertyPriority(property)
      const computed = getComputedStyle(el).getPropertyValue(property)
      el.style.removeProperty(property)
      if (getComputedStyle(el).getPropertyValue(property) !== computed) {
        el.style.setProperty(property, value, priority)
      } else {
        changed = true
      }
    }
    if (el.hasAttribute('style') && !el.getAttribute('style')?.trim()) {
      el.removeAttribute('style')
      changed = true
    }
    if (el.tagName === 'SPAN' && el.attributes.length === 0 && el.parentNode) {
      unwrappedIn.add(el.parentNode)
      el.replaceWith(...el.childNodes)
      changed = true
    }
  }
  // Junta os nós de texto que ficaram lado a lado
  unwrappedIn.forEach((parent) => parent.normalize())
  return changed
}
