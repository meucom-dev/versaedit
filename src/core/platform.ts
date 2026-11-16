// Plataforma do usuário, para os atalhos de teclado: no Mac, a tecla de comando
// é Cmd (metaKey); nos outros sistemas, Ctrl. Fora do navegador (SSR), "não Apple".
export const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
