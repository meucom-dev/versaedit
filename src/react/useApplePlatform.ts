import { useSyncExternalStore } from 'react'
import { isApplePlatform } from '../core/platform'

const noSubscription = () => () => {}
const onServer = () => false

/**
 * Mac/iOS (atalhos com Cmd). No servidor e na hidratação vale "não Apple" (o HTML
 * tem de ser igual ao do servidor); logo depois o React renderiza de novo com a
 * plataforma do navegador. Sem SSR, já vem no 1º render.
 */
export function useApplePlatform(): boolean {
  return useSyncExternalStore(noSubscription, isApplePlatform, onServer)
}
