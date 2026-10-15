// ─── COMANDOS DE FORMATAÇÃO E HTML INSERIDO ──────────────────────
import { escapeHtml } from './sanitize'

// Camada única sobre execCommand (API do navegador usada pela formatação)
export function exec(command: string, value?: string): void {
  document.execCommand(command, false, value)
}

export function insertHtml(html: string): void {
  document.execCommand('insertHTML', false, html)
}

// Aceita apenas links http(s), e-mail e âncoras; "www.site.com" vira "https://www.site.com"
export function normalizeLinkUrl(value: string): string | null {
  const url = value.trim()
  if (!url) return null
  if (/^(https?:\/\/|mailto:|#)/i.test(url)) return url
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null
  return `https://${url}`
}

export const linkHtml = (url: string, text: string): string =>
  `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`

export const HR_HTML =
  '<hr style="border:none;border-top:1px solid #ccc;margin:12px 0;clear:both;" />'

export const textboxHtml = (handleTitle: string, text: string): string =>
  `<div class="rich-textbox" contenteditable="true"><span class="textbox-handle" contenteditable="false" title="${escapeHtml(handleTitle)}">⠿</span>${escapeHtml(text)}</div>`

export const imageHtml = (src: string, alt: string): string =>
  `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="pos-left" draggable="false" style="max-width:50%;height:auto;border-radius:4px;" />`

export const TAB_HTML = '&nbsp;&nbsp;&nbsp;&nbsp;'
