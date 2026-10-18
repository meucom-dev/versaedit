import React, { Fragment, useEffect, useRef, useState } from 'react'
import type { FontFamilyOption } from '../../core/defaults'
import type { LinkDraft, TextboxBorder, VersaEditCore } from '../../core/editor'
import type { SpeechRecognitionConstructor } from '../../core/speech'
import type { VersaEditLabels } from '../../core/i18n'
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconBulletList,
  IconClearFormat,
  IconHr,
  IconImage,
  IconIndent,
  IconItalic,
  IconLink,
  IconOpen,
  IconOutdent,
  IconRedo,
  IconSave,
  IconTrash,
  IconUnderline,
  IconUndo,
  IconUnlink,
} from '../icons'
import { ColorPicker, type ColorKind } from './ColorPicker'
import { FontPicker } from './FontPicker'
import { DictationButton } from './DictationButton'
import { HighlightPicker } from './HighlightPicker'
import { LinkPopover } from './LinkPopover'
import { TextboxControls } from './TextboxControls'
import { ToolbarBtn, ToolbarSep } from './ToolbarButton'

const HEADING_BLOCKS: { label: keyof VersaEditLabels; tag: string }[] = [
  { label: 'paragraph', tag: 'p' },
  { label: 'heading2', tag: 'h2' },
  { label: 'heading3', tag: 'h3' },
  { label: 'heading4', tag: 'h4' },
  { label: 'quote', tag: 'blockquote' },
]

/** Grupos de ferramentas da barra, na ordem em que aparecem */
export const TOOLBAR_GROUPS = [
  'dictation',
  'file',
  'history',
  'font',
  'block',
  'format',
  'highlight',
  'color',
  'align',
  'list',
  'indent',
  'link',
  'insert',
  'textbox',
  'clear',
] as const
export type ToolbarGroup = (typeof TOOLBAR_GROUPS)[number]

// Seções com o conteúdo ligado, separadas por um traço só entre elas
function renderSections(sections: React.ReactNode[][]): React.ReactNode {
  const visible = sections.map((items) => items.filter(Boolean)).filter((items) => items.length > 0)
  return visible.map((items, i) => (
    <Fragment key={i}>
      {i > 0 && <ToolbarSep />}
      {items}
    </Fragment>
  ))
}

export interface ToolbarState {
  currentFont: string
  currentFontSize: string
  textColor: string
  bgColor: string
  textboxBorder: TextboxBorder
}

export function Toolbar({
  core,
  labels: L,
  width,
  editorWidth,
  showFileButtons,
  fontFamilies,
  fontSizes,
  colorPalette,
  highlightColors,
  isTextboxSelected,
  state,
  setState,
  linkDraft,
  openLink,
  closeLink,
  dictation,
  groups,
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  width: number | string
  editorWidth: number | string
  showFileButtons: boolean
  fontFamilies: FontFamilyOption[]
  fontSizes: number[]
  colorPalette: string[]
  highlightColors: string[]
  isTextboxSelected: boolean
  state: ToolbarState
  setState: (patch: Partial<ToolbarState>) => void
  /** Formulário de link aberto (com os dados da seleção) ou null */
  linkDraft: LinkDraft | null
  openLink: () => void
  closeLink: () => void
  /** Ditado: mecanismo de reconhecimento e idioma; null esconde o botão */
  dictation: { recognition: SpeechRecognitionConstructor; lang: string } | null
  /** Grupos ligados (os outros não aparecem) */
  groups: ReadonlySet<ToolbarGroup>
}) {
  const on = (group: ToolbarGroup) => groups.has(group)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const activeIndex = useRef(0)
  // Paleta aberta ('text' | 'bg')
  const [openPalette, setOpenPalette] = useState<ColorKind | null>(null)
  const colorPanelRef = useRef<HTMLDivElement>(null)

  // Fecha a paleta ao clicar fora dela
  useEffect(() => {
    if (!openPalette) return
    const onDown = (e: MouseEvent) => {
      if (colorPanelRef.current && !colorPanelRef.current.contains(e.target as Node)) {
        setOpenPalette(null)
        core()?.restorePreview()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openPalette, core])

  const setColor = (kind: ColorKind, color: string) =>
    setState(kind === 'text' ? { textColor: color } : { bgColor: color })

  // Escolha na paleta: aplica de imediato e fecha
  const pickColor = (kind: ColorKind, color: string) => {
    setColor(kind, color)
    if (kind === 'text') core()?.pickTextColor(color)
    else core()?.applyColor('hiliteColor', color)
    setOpenPalette(null)
  }

  // Cor personalizada: aplica ao vivo e mantém a paleta aberta
  const pickCustomColor = (kind: ColorKind, color: string) => {
    setColor(kind, color)
    core()?.applyColor(kind === 'text' ? 'foreColor' : 'hiliteColor', color)
  }

  const run = (command: string) => () => core()?.execCommand(command)

  // ─── TECLADO (padrão WAI-ARIA de toolbar) ─────────────────────────
  // Só um controle da barra entra na ordem do Tab; as setas ← → (Home/End)
  // passam de um controle para outro. Os menus abertos não entram nessa conta.
  const navItems = (): HTMLElement[] =>
    Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>('button, select') ?? []).filter(
      (el) =>
        !(el as HTMLButtonElement).disabled &&
        !el.closest(
          '.ve-palette, .ve-font-options, .ve-highlight-palette, .ve-link-popover, .ve-dictation-bubble',
        ),
    )

  useEffect(() => {
    const items = navItems()
    if (activeIndex.current >= items.length) activeIndex.current = 0
    items.forEach((el, i) => (el.tabIndex = i === activeIndex.current ? 0 : -1))
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && openPalette) {
      setOpenPalette(null)
      core()?.restorePreview()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    const items = navItems()
    const current = items.indexOf(e.target as HTMLElement)
    if (current < 0) return
    e.preventDefault()
    const last = items.length - 1
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? last
          : e.key === 'ArrowRight'
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length
    items.forEach((el, i) => (el.tabIndex = i === next ? 0 : -1))
    activeIndex.current = next
    items[next].focus()
  }

  // Foco por clique ou Tab também atualiza o controle ativo
  const handleFocus = (e: React.FocusEvent) => {
    const index = navItems().indexOf(e.target as HTMLElement)
    if (index >= 0) activeIndex.current = index
  }

  return (
    <div
      ref={toolbarRef}
      className="ve-toolbar"
      role="toolbar"
      aria-label={L.toolbar}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      style={{
        // Barra centralizada sobre o bloco de edição (pode ser mais larga que ele);
        // com medida CSS (ex.: '100%') não há centralização
        width,
        marginLeft:
          typeof width === 'number' && typeof editorWidth === 'number'
            ? -(width - editorWidth) / 2
            : 0,
      }}
    >
      {renderSections([
        [
          dictation && on('dictation') && (
            <DictationButton
              key="dictation"
              core={core}
              labels={L}
              lang={dictation.lang}
              recognition={dictation.recognition}
            />
          ),
        ],
        [
          showFileButtons && on('file') && (
            <Fragment key="file">
              <ToolbarBtn onClick={() => core()?.saveToFile()} title={L.saveFile}>
                <IconSave />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => core()?.openFile()} title={L.openFile}>
                <IconOpen />
              </ToolbarBtn>
            </Fragment>
          ),
        ],
        [
          on('history') && (
            <Fragment key="history">
              <ToolbarBtn onClick={() => core()?.undo()} title={L.undo}>
                <IconUndo />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => core()?.redo()} title={L.redo}>
                <IconRedo />
              </ToolbarBtn>
            </Fragment>
          ),
        ],
        [
          on('font') && (
            <Fragment key="font">
              <FontPicker
                core={core}
                labels={L}
                fontFamilies={fontFamilies}
                currentFont={state.currentFont}
                onChoose={(font) => {
                  setState({ currentFont: font })
                  core()?.chooseFontFamily(font)
                }}
              />
              <select
                className="ve-select"
                value={state.currentFontSize}
                onMouseDown={() => core()?.saveSelection()}
                onChange={(e) => {
                  const pt = e.target.value
                  setState({ currentFontSize: pt })
                  core()?.applyFontSizePt(pt)
                }}
                title={L.fontSize}
                aria-label={L.fontSize}
              >
                {fontSizes.map((pt) => (
                  <option key={pt} value={String(pt)}>
                    {pt} pt
                  </option>
                ))}
              </select>
            </Fragment>
          ),
        ],
        [
          on('block') && (
            <Fragment key="block">
              {HEADING_BLOCKS.map((h) => (
                <ToolbarBtn
                  key={h.tag}
                  onClick={() => core()?.formatBlock(h.tag)}
                  title={L[h.label]}
                >
                  {h.tag === 'p' ? '¶' : h.tag === 'blockquote' ? '❝' : h.tag.toUpperCase()}
                </ToolbarBtn>
              ))}
            </Fragment>
          ),
        ],
        [
          on('format') && (
            <Fragment key="format">
              <ToolbarBtn onClick={run('bold')} title={L.bold}>
                <IconBold />
              </ToolbarBtn>
              <ToolbarBtn onClick={run('italic')} title={L.italic}>
                <IconItalic />
              </ToolbarBtn>
              <ToolbarBtn onClick={run('underline')} title={L.underline}>
                <IconUnderline />
              </ToolbarBtn>
            </Fragment>
          ),
          on('highlight') && (
            <Fragment key="highlight">
              <HighlightPicker core={core} labels={L} colors={highlightColors} />
              <ToolbarBtn onClick={() => core()?.removeHighlight()} title={L.removeHighlight}>
                <span className="ve-highlight-remove">S</span>
              </ToolbarBtn>
            </Fragment>
          ),
        ],
        [
          on('color') && (
            <div key="color" ref={colorPanelRef} className="ve-inline">
              {(['text', 'bg'] as const).map((kind) => (
                <ColorPicker
                  key={kind}
                  kind={kind}
                  core={core}
                  labels={L}
                  color={kind === 'text' ? state.textColor : state.bgColor}
                  palette={colorPalette}
                  openPalette={openPalette}
                  setOpenPalette={setOpenPalette}
                  onPick={pickColor}
                  onPickCustom={pickCustomColor}
                />
              ))}
            </div>
          ),
        ],
        [
          on('align') && (
            <Fragment key="align">
              <ToolbarBtn onClick={run('justifyLeft')} title={L.alignLeft}>
                <IconAlignLeft />
              </ToolbarBtn>
              <ToolbarBtn onClick={run('justifyCenter')} title={L.alignCenter}>
                <IconAlignCenter />
              </ToolbarBtn>
              <ToolbarBtn onClick={run('justifyRight')} title={L.alignRight}>
                <IconAlignRight />
              </ToolbarBtn>
            </Fragment>
          ),
        ],
        [
          on('list') && (
            <Fragment key="list">
              <ToolbarBtn onClick={run('insertUnorderedList')} title={L.bulletList}>
                <IconBulletList />
              </ToolbarBtn>
              <ToolbarBtn onClick={run('insertOrderedList')} title={L.numberedList}>
                <span style={{ fontWeight: 600 }}>1.</span>
              </ToolbarBtn>
            </Fragment>
          ),
        ],
        [
          on('indent') && (
            <Fragment key="indent">
              <ToolbarBtn onClick={run('indent')} title={L.indent}>
                <IconIndent />
              </ToolbarBtn>
              <ToolbarBtn onClick={run('outdent')} title={L.outdent}>
                <IconOutdent />
              </ToolbarBtn>
            </Fragment>
          ),
        ],
        [
          on('link') && (
            <Fragment key="link">
              <div className="ve-link-wrap">
                <ToolbarBtn
                  onClick={() => {
                    if (linkDraft) {
                      core()?.cancelLink()
                      closeLink()
                    } else openLink()
                  }}
                  title={L.insertLink}
                >
                  <IconLink />
                </ToolbarBtn>
                {linkDraft && (
                  <LinkPopover core={core} labels={L} draft={linkDraft} onClose={closeLink} />
                )}
              </div>
              <ToolbarBtn onClick={() => core()?.removeLink()} title={L.removeLink}>
                <IconUnlink />
              </ToolbarBtn>
            </Fragment>
          ),
        ],
        [
          on('insert') && (
            <Fragment key="insert">
              <ToolbarBtn onClick={() => core()?.insertHorizontalRule()} title={L.insertHr}>
                <IconHr />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => core()?.insertImage()} title={L.insertImage}>
                <IconImage />
              </ToolbarBtn>
            </Fragment>
          ),
          on('textbox') && (
            <TextboxControls
              key="textbox"
              core={core}
              labels={L}
              border={state.textboxBorder}
              setBorder={(textboxBorder) => setState({ textboxBorder })}
              isSelected={isTextboxSelected}
            />
          ),
        ],
        [
          on('clear') && (
            <Fragment key="clear">
              <ToolbarBtn onClick={() => core()?.clearAll()} title={L.clearAll}>
                <IconTrash /> {L.clearAllButton}
              </ToolbarBtn>
              <ToolbarBtn onClick={() => core()?.clearFormatting()} title={L.clearFormatting}>
                <IconClearFormat />
              </ToolbarBtn>
            </Fragment>
          ),
        ],
      ])}
    </div>
  )
}
