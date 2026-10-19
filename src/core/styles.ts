// ─── ESTILOS DO EDITOR ────────────────────────────────────────────
// EDITOR_CSS: injetado uma única vez no <head> (prop injectStyles) ou importado
// de dist/versaedit.css. CONTENT_CSS (dist/versaedit-content.css): para
// exibir o conteúdo salvo fora do editor (o site que publica o texto). A interface usa o prefixo ve-; as classes
// dentro do conteúdo (pos-left, rich-textbox…) fazem parte do HTML salvo e
// ficam restritas a .ve-content.
// Variáveis definidas no elemento raiz pelas props:
//   --ve-accent         cor de destaque (seleção, caixas de texto, alças)
//   --ve-heading-font   fonte dos títulos (padrão: a mesma do texto)

const STYLE_ID = 'versaedit-styles'

const accent = (percent: number) => `color-mix(in srgb, var(--ve-accent) ${percent}%, transparent)`

export const EDITOR_CSS = `
.ve-root { position: relative; --ve-accent: #2563eb; }
.ve-icon { display: block; }

/* Barra de ferramentas */
.ve-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 8px; padding: 8px; box-sizing: border-box; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; }
.ve-btn { border: none; background: none; cursor: pointer; padding: 4px 6px; border-radius: 4px; color: #555; font: inherit; font-size: 13px; line-height: 1; min-width: 28px; min-height: 28px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
.ve-btn:hover { background: #e8e8e8; }
.ve-btn:focus-visible, .ve-select:focus-visible { outline: 2px solid var(--ve-accent); outline-offset: 1px; }
.ve-sep { width: 1px; background: #ddd; margin: 0 4px; align-self: stretch; }
.ve-select { border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; font: inherit; font-size: 12px; color: #555; background: #fff; cursor: pointer; min-height: 28px; }
.ve-select:hover { background: #f0f0f0; }
.ve-select:disabled, .ve-disabled { opacity: 0.45; }
.ve-inline { display: inline-flex; align-items: center; gap: 4px; }
.ve-group { display: inline-flex; align-items: center; gap: 4px; border: 1px dashed var(--ve-accent); border-radius: 6px; padding: 2px 6px; background: ${accent(6)}; }

/* Menus suspensos */
.ve-font-picker { position: relative; display: inline-flex; }
.ve-font-button { min-width: 158px; display: flex; justify-content: space-between; gap: 8px; }
.ve-font-options { position: absolute; top: calc(100% + 2px); left: 0; z-index: 130; min-width: 220px; max-height: 300px; overflow-y: auto; padding: 4px; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
.ve-font-option { display: block; width: 100%; padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; color: #333; text-align: left; cursor: pointer; }
.ve-font-option:hover, .ve-font-option[aria-selected="true"] { background: #f0f0f0; }
.ve-color-picker { position: relative; display: inline-flex; align-items: center; }
.ve-color-picker input[type="color"] { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.ve-color-indicator { display: block; width: 10px; height: 10px; margin-top: 1px; border-radius: 50%; border: 1px solid #bbb; box-sizing: border-box; }
.ve-palette { position: absolute; top: 100%; left: 0; z-index: 120; display: grid; grid-template-columns: repeat(6, 22px); gap: 6px; padding: 8px; margin-top: 4px; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
.ve-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #bbb; padding: 0; cursor: pointer; position: relative; overflow: hidden; }
.ve-swatch:hover { box-shadow: 0 0 0 2px var(--ve-accent); }
.ve-color-picker .ve-swatch--custom { background: conic-gradient(#e74c3c, #f1c40f, #27ae60, #2980b9, #8e44ad, #e74c3c); }
.ve-color-picker .ve-swatch--custom input[type="color"] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: auto; cursor: pointer; }
.ve-highlight-wrap { position: relative; display: inline-flex; }
.ve-highlight-palette { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 200; display: flex; gap: 6px; padding: 8px 10px; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
.ve-highlight-swatch { width: 24px; height: 24px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; padding: 0; }
.ve-highlight-sample { font-weight: 600; background: #ffff00; padding: 0 3px; border-radius: 2px; }
.ve-highlight-remove { font-weight: 600; opacity: 0.5; text-decoration: line-through; }

/* Ditado */
.ve-dictation { position: relative; display: inline-flex; }
.ve-btn.ve-recording { color: #fff; background: #d92d20; animation: ve-pulse 1.4s ease-in-out infinite; }
.ve-btn.ve-recording:hover { background: #b42318; }
@keyframes ve-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(217,45,32,0.45); } 50% { box-shadow: 0 0 0 5px rgba(217,45,32,0); } }
@media (prefers-reduced-motion: reduce) { .ve-btn.ve-recording { animation: none; } }
.ve-dictation-bubble { position: absolute; top: calc(100% + 6px); left: 0; z-index: 205; max-width: 320px; min-width: 120px; padding: 6px 10px; background: #1f2328; color: #fff; border-radius: 6px; font-size: 12px; line-height: 1.4; box-shadow: 0 4px 12px rgba(0,0,0,0.2); white-space: normal; }
.ve-dictation-bubble.ve-dictation-error { background: #b42318; }
.ve-dictation-standalone .ve-btn { gap: 6px; padding: 6px 12px; min-height: 32px; border: 1px solid #ccc; border-radius: 999px; background: #fff; color: #333; font-size: 14px; font-weight: 600; }
.ve-dictation-standalone .ve-btn:hover { background: #f0f0f0; }
.ve-dictation-standalone .ve-btn.ve-recording { color: #fff; background: #d92d20; border-color: #d92d20; }

/* Formulário de link */
.ve-link-wrap { position: relative; display: inline-flex; }
.ve-link-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 210; display: grid; gap: 6px; width: 260px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.18); font-size: 12px; color: #333; }
.ve-link-popover label { display: grid; gap: 2px; }
.ve-link-popover input { font: inherit; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; }
.ve-link-popover input:focus { outline: 2px solid var(--ve-accent); outline-offset: 0; }
.ve-link-error { color: #b42318; }
.ve-link-actions { display: flex; justify-content: flex-end; gap: 6px; }
.ve-link-actions button { font: inherit; padding: 4px 10px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
.ve-link-actions button[type="submit"] { background: var(--ve-accent); border-color: var(--ve-accent); color: #fff; }

/* Moldura e área de edição */
.ve-frame { position: relative; max-width: 100%; margin: 0; box-sizing: border-box; }
.ve-content { display: block; max-width: 100%; box-sizing: border-box; padding: 8px 16px; border: none; overflow: hidden; resize: none; line-height: 1.6; font-size: 12pt; color: #1f2328; background-color: #fff; caret-color: currentColor; outline: none; }
.ve-content.ve-scroll { overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
.ve-content:empty::before { content: attr(data-placeholder); color: #999; pointer-events: none; font-style: italic; }
.ve-content p { margin: 0; padding: 0; line-height: 1.3; }
.ve-content div, .ve-content span { margin: 0; padding: 0; }
.ve-content h1, .ve-content h2, .ve-content h3, .ve-content h4, .ve-content h5, .ve-content h6 { font-family: var(--ve-heading-font, inherit); margin: 0; padding: 0; line-height: 1.2; }
.ve-content blockquote { border-left: 3px solid var(--ve-accent); margin: 0; padding: 8px 16px; background: ${accent(5)}; color: #555; font-style: italic; clear: both; }
/* Recuo (Chromium e WebKit recuam com um blockquote de margem 0 0 0 40px):
   só a margem, sem a aparência de citação (itálico, fundo, cor) */
.ve-content blockquote[style*="margin: 0 0 0 40px"] { font-style: normal; background: none; color: inherit; }

/* Tabelas e código (colados ou carregados) */
.ve-content table { border-collapse: collapse; max-width: 100%; margin: 4px 0; }
.ve-content th, .ve-content td { border: 1px solid #c8ccd0; padding: 4px 8px; vertical-align: top; min-width: 2em; }
.ve-content th { background-color: #f3f4f6; font-weight: 600; text-align: left; }
.ve-content caption { caption-side: top; padding: 4px 0; font-weight: 600; text-align: left; }
.ve-content pre { margin: 4px 0; padding: 8px 12px; background: #f6f8fa; border-radius: 4px; white-space: pre-wrap; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 0.9em; }
.ve-content code { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 0.9em; }

/* Áudio e vídeo externos suspensos no editor (core/media.ts) */
.ve-content video[data-ve-media], .ve-content audio[data-ve-media] { outline: 1px dashed #999; outline-offset: 2px; }

/* Imagens */
.ve-content img { touch-action: none; -webkit-touch-callout: none; cursor: pointer; transition: outline 0.15s; outline: 2px solid transparent; outline-offset: 2px; display: block; -webkit-user-drag: none; }
.ve-content img:hover { outline-color: ${accent(50)}; }
.ve-content img.selected { outline-color: var(--ve-accent); outline-width: 3px; cursor: grab; }
.ve-content img.selected:active { cursor: grabbing; }
.ve-content img.pos-left { float: left; margin: 40px; max-width: 50%; }
.ve-content img.pos-right { float: right; margin: 40px; max-width: 50%; }
.ve-content img.pos-center { display: block; margin: 40px auto; max-width: 100%; clear: both; }
.ve-content img.dragging, .ve-content .rich-textbox.dragging { opacity: 0.7; outline: 2px dashed var(--ve-accent); position: relative; z-index: 60; cursor: grabbing; }

/* Caixas de texto */
.ve-content .rich-textbox { border: 1px dashed var(--ve-accent); padding: 10px; margin: 40px; min-height: 40px; min-width: 100px; position: relative; cursor: text; user-select: text; overflow: auto; outline: 2px solid transparent; outline-offset: 2px; transition: outline 0.15s; background: ${accent(3)}; clear: both; }
.ve-content .rich-textbox:hover { outline-color: ${accent(30)}; }
.ve-content .rich-textbox.selected { outline-color: var(--ve-accent); outline-width: 3px; cursor: text; }
.ve-content .rich-textbox.tb-float-left { float: left; margin: 40px; max-width: 50%; }
.ve-content .rich-textbox.tb-float-right { float: right; margin: 40px; max-width: 50%; }
.ve-content .textbox-handle { touch-action: none; display: inline-flex; align-items: center; justify-content: center; cursor: grab; color: var(--ve-accent); background: ${accent(15)}; border: 1px solid ${accent(40)}; border-radius: 4px; font-size: 14px; line-height: 1; user-select: none; -webkit-user-drag: none; padding: 4px 8px; margin-right: 6px; vertical-align: middle; }
.ve-content .textbox-handle:active { cursor: grabbing; }

/* Menus flutuantes de imagem e caixa de texto */
.ve-float-toolbar { position: absolute; display: flex; width: max-content; white-space: nowrap; gap: 4px; background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 4px 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 100; }
.ve-float-toolbar button { border: none; background: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; font: inherit; font-size: 13px; color: #555; display: inline-flex; align-items: center; gap: 4px; }
.ve-float-toolbar button:hover { background: #f0f0f0; }
.ve-float-toolbar button.ve-danger { color: #dc3545; }
.ve-float-sep { width: 1px; background: #ddd; }
.ve-resize-handle { touch-action: none; position: absolute; width: 14px; height: 14px; background: var(--ve-accent); border: 2px solid #fff; border-radius: 3px; cursor: nwse-resize; z-index: 110; box-shadow: 0 1px 4px rgba(0,0,0,0.3); user-select: none; -webkit-user-drag: none; }
.ve-resize-handle:hover { filter: brightness(0.85); }
`

export function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = EDITOR_CSS
  document.head.appendChild(style)
}

// Conteúdo publicado: envolva o HTML salvo em <div class="versaedit-content">.
// Reproduz o que o editor mostra para as classes que o próprio editor grava
// (posição de imagens, caixas de texto, tabelas, código, citação e recuo) e
// esconde a alça de arrasto das caixas de texto. Cores e fontes do texto vêm
// do estilo gravado em cada trecho; o resto fica com o CSS do site.
export const CONTENT_CSS = `
.versaedit-content { --ve-accent: #2563eb; }
.versaedit-content::after { content: ''; display: block; clear: both; }
.versaedit-content img { display: block; max-width: 100%; height: auto; }
.versaedit-content img.pos-left { float: left; margin: 40px; max-width: 50%; }
.versaedit-content img.pos-right { float: right; margin: 40px; max-width: 50%; }
.versaedit-content img.pos-center { margin: 40px auto; clear: both; }
.versaedit-content .rich-textbox { border: 1px dashed var(--ve-accent); padding: 10px; margin: 40px; min-height: 40px; min-width: 100px; box-sizing: border-box; overflow: auto; clear: both; }
.versaedit-content .rich-textbox.tb-float-left { float: left; max-width: 50%; }
.versaedit-content .rich-textbox.tb-float-right { float: right; max-width: 50%; }
.versaedit-content .textbox-handle { display: none; }
.versaedit-content table { border-collapse: collapse; max-width: 100%; margin: 4px 0; }
.versaedit-content th, .versaedit-content td { border: 1px solid #c8ccd0; padding: 4px 8px; vertical-align: top; }
.versaedit-content th { background-color: #f3f4f6; font-weight: 600; text-align: left; }
.versaedit-content caption { caption-side: top; padding: 4px 0; font-weight: 600; text-align: left; }
.versaedit-content pre { margin: 4px 0; padding: 8px 12px; background: #f6f8fa; border-radius: 4px; white-space: pre-wrap; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 0.9em; }
.versaedit-content code { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 0.9em; }
.versaedit-content blockquote { border-left: 3px solid var(--ve-accent); margin: 0; padding: 8px 16px; font-style: italic; }
.versaedit-content blockquote[style*="margin: 0 0 0 40px"] { font-style: normal; }
`
