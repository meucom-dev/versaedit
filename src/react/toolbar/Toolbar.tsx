import React, { useEffect, useRef, useState } from 'react'
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
}: {
  core: () => VersaEditCore | null
  labels: VersaEditLabels
  width: number
  editorWidth: number
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
}) {
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
        // Barra centralizada sobre o bloco de edição (pode ser mais larga que ele)
        width,
        marginLeft: -(width - editorWidth) / 2,
      }}
    >
      {showFileButtons && (
        <>
          <ToolbarBtn onClick={() => core()?.saveToFile()} title={L.saveFile}>
            <IconSave />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => core()?.openFile()} title={L.openFile}>
            <IconOpen />
          </ToolbarBtn>
          <ToolbarSep />
        </>
      )}
      <ToolbarBtn onClick={() => core()?.undo()} title={L.undo}>
        <IconUndo />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => core()?.redo()} title={L.redo}>
        <IconRedo />
      </ToolbarBtn>
      <ToolbarSep />
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
      <ToolbarSep />
      {HEADING_BLOCKS.map((h) => (
        <ToolbarBtn key={h.tag} onClick={() => core()?.formatBlock(h.tag)} title={L[h.label]}>
          {h.tag === 'p' ? '¶' : h.tag === 'blockquote' ? '❝' : h.tag.toUpperCase()}
        </ToolbarBtn>
      ))}
      <ToolbarSep />
      <ToolbarBtn onClick={run('bold')} title={L.bold}>
        <IconBold />
      </ToolbarBtn>
      <ToolbarBtn onClick={run('italic')} title={L.italic}>
        <IconItalic />
      </ToolbarBtn>
      <ToolbarBtn onClick={run('underline')} title={L.underline}>
        <IconUnderline />
      </ToolbarBtn>
      <HighlightPicker core={core} labels={L} colors={highlightColors} />
      <ToolbarBtn onClick={() => core()?.removeHighlight()} title={L.removeHighlight}>
        <span className="ve-highlight-remove">S</span>
      </ToolbarBtn>
      <ToolbarSep />
      <div ref={colorPanelRef} className="ve-inline">
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
      <ToolbarSep />
      <ToolbarBtn onClick={run('justifyLeft')} title={L.alignLeft}>
        <IconAlignLeft />
      </ToolbarBtn>
      <ToolbarBtn onClick={run('justifyCenter')} title={L.alignCenter}>
        <IconAlignCenter />
      </ToolbarBtn>
      <ToolbarBtn onClick={run('justifyRight')} title={L.alignRight}>
        <IconAlignRight />
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn onClick={run('insertUnorderedList')} title={L.bulletList}>
        <IconBulletList />
      </ToolbarBtn>
      <ToolbarBtn onClick={run('insertOrderedList')} title={L.numberedList}>
        <span style={{ fontWeight: 600 }}>1.</span>
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn onClick={run('indent')} title={L.indent}>
        <IconIndent />
      </ToolbarBtn>
      <ToolbarBtn onClick={run('outdent')} title={L.outdent}>
        <IconOutdent />
      </ToolbarBtn>
      <ToolbarSep />
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
        {linkDraft && <LinkPopover core={core} labels={L} draft={linkDraft} onClose={closeLink} />}
      </div>
      <ToolbarBtn onClick={() => core()?.removeLink()} title={L.removeLink}>
        <IconUnlink />
      </ToolbarBtn>
      {dictation && (
        <>
          <ToolbarSep />
          <DictationButton
            core={core}
            labels={L}
            lang={dictation.lang}
            recognition={dictation.recognition}
          />
        </>
      )}
      <ToolbarSep />
      <ToolbarBtn onClick={() => core()?.insertHorizontalRule()} title={L.insertHr}>
        <IconHr />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => core()?.insertImage()} title={L.insertImage}>
        <IconImage />
      </ToolbarBtn>
      <TextboxControls
        core={core}
        labels={L}
        border={state.textboxBorder}
        setBorder={(textboxBorder) => setState({ textboxBorder })}
        isSelected={isTextboxSelected}
      />
      <ToolbarSep />
      <ToolbarBtn onClick={() => core()?.clearAll()} title={L.clearAll}>
        <IconTrash /> {L.clearAllButton}
      </ToolbarBtn>
      <ToolbarBtn onClick={() => core()?.clearFormatting()} title={L.clearFormatting}>
        <IconClearFormat />
      </ToolbarBtn>
    </div>
  )
}
