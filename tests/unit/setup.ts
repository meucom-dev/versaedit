// O jsdom não tem CSS.supports: aproximação pelo próprio parser de estilos dele
// (um valor inválido não é aceito por style.setProperty)
if (typeof globalThis.CSS === 'undefined' || typeof globalThis.CSS.supports !== 'function') {
  const supports = (property: string, value?: string): boolean => {
    if (value === undefined) return false
    const el = document.createElement('div')
    el.style.setProperty(property, value)
    return el.style.getPropertyValue(property) !== ''
  }
  Object.defineProperty(globalThis, 'CSS', { value: { supports }, configurable: true })
}
