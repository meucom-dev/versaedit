# VersaEdit

Lightweight rich text editor for React applications.

> **Beta** (`0.5.0-beta.1`) — the API may change before 1.0; see [Known limitations](#known-limitations).

[versaedit.dev](https://versaedit.dev) · [Playground](https://versaedit.dev/playground/) ·
[Leia em português](README.pt-BR.md) · [Leer en español](README.es.md)

VersaEdit edits HTML with the browser's own `contentEditable`, adds a toolbar, a sanitizer
(DOMPurify), its own undo/redo, cleanup of content pasted from web pages and Word, images, text boxes, tables,
dictation and file save/open. It has no backend dependency: it gives you HTML and you store it
wherever you want (Supabase, Firebase, REST…).

- React 18.3+ or 19 · server rendering (tested with Next.js)
- One runtime dependency: [DOMPurify](https://github.com/cure53/DOMPurify) · ES modules only (no
  CommonJS build) · TypeScript types for bundlers and `moduleResolution: node16/nodenext`
- English, Brazilian Portuguese and Spanish interface (`locale`), every text replaceable (`labels`)

## Install

```bash
npm install versaedit@beta
```

## Quick start

```tsx
import { useRef } from 'react'
import { VersaEdit, type VersaEditHandle } from 'versaedit'

export function PostEditor({
  initialHtml,
  onSave,
}: {
  initialHtml: string
  onSave: (html: string) => void
}) {
  const editor = useRef<VersaEditHandle>(null)
  return (
    <>
      <VersaEdit
        ref={editor}
        initialContent={initialHtml}
        onChange={(html) => console.log('changed', html.length)}
        width="100%"
        height={480}
        locale="en"
      />
      <button onClick={() => onSave(editor.current!.getHTML())}>Save</button>
    </>
  )
}
```

`initialContent` is loaded (and sanitized) when it changes; the editor ignores the echo of its own
`onChange`, so you can use it as a controlled value.

## Props

| Prop                                                 | Type                                                | Default                   | Description                                                                                                           |
| ---------------------------------------------------- | --------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `initialContent`                                     | `string`                                            | `''`                      | HTML to load. External changes reload the editor (and reset undo).                                                    |
| `onChange`                                           | `(html) => void`                                    | —                         | Called when the HTML actually changes.                                                                                |
| `onOverflowChange`                                   | `(boolean) => void`                                 | —                         | Content does / doesn't fit the editor height.                                                                         |
| `onResize`                                           | `(size, phase) => void`                             | —                         | The person resized the editing area: `'start'`, `'move'`, `'end'` ([details](#resizable-editing-area)).               |
| `onFocus` / `onBlur`                                 | `() => void`                                        | —                         | Focus entered / left the editor (toolbar buttons keep focus).                                                         |
| `onError`                                            | `(VersaEditError) => void`                          | `alert()`                 | Errors and warnings with a stable `code` (see below).                                                                 |
| `onConfirm`                                          | `(VersaEditConfirm) => boolean \| Promise<boolean>` | `confirm()`               | Confirmations (e.g. replace content when opening a file).                                                             |
| `onSave`                                             | `(html) => void`                                    | download                  | Save button gives you the HTML instead of downloading a `.html` file.                                                 |
| `onImageUpload`                                      | `(file) => Promise<url>`                            | base64                    | Upload images and insert the returned URL (recommended).                                                              |
| `width`                                              | `number \| string`                                  | `'100%'`                  | Total width; a number is px, a string is CSS. Never wider than the container ([Size](#size)).                         |
| `height`                                             | `number`                                            | `500`                     | Height of the editing area in px (initial height with `resizable`).                                                   |
| `resizable`                                          | `boolean \| ResizableOptions`                       | `false`                   | Let people resize the editing area by dragging its edges ([Resizable editing area](#resizable-editing-area)).         |
| `sizeControls`                                       | `boolean`                                           | `false`                   | Width and height fields (px) below the editing area (with `resizable`).                                               |
| `settingsPanel`                                      | `ReactNode \| (close) => ReactNode`                 | —                         | Your own settings, in a panel opened by a gear at the end of the toolbar ([Settings panel](#settings-panel)).         |
| `toolbarWidth`                                       | `number \| string`                                  | `width`                   | Toolbar width (numbers center it over the editor).                                                                    |
| `frame`                                              | `{ width, color, radius } \| false`                 | `1px #d0d7de, 8px`        | Border around the editing area.                                                                                       |
| `objectMargin`                                       | `{ text, outer, top, bottom }`                      | `16, 0, 4, 12`            | Space around images and text boxes, per side, in px ([Object margin](#object-margin)).                                |
| `accentColor`                                        | `string`                                            | `#2563eb`                 | Selection outlines, text boxes, handles.                                                                              |
| `fontFamily` / `headingFontFamily`                   | `string`                                            | system font               | Text and heading fonts.                                                                                               |
| `fontFamilies` / `fontSizes`                         | arrays                                              | defaults                  | Font menu (`{ label, value }`) and sizes (pt).                                                                        |
| `colorPalette` / `highlightColors`                   | `string[]`                                          | defaults                  | Text/paper colors and highlighter colors (`'transparent'` = none).                                                    |
| `loadGoogleFonts`                                    | `string[]`                                          | —                         | Families to load from Google Fonts (off by default).                                                                  |
| `toolbar`                                            | `ToolbarGroup[]`                                    | all                       | Toolbar groups to show (see below). `[]` hides the toolbar (with `settingsPanel`, only the gear stays).               |
| `showFileButtons`                                    | `boolean`                                           | `true`                    | Save/Open file buttons.                                                                                               |
| `showDictation` / `speechLang` / `speechRecognition` | —                                                   | `true` / locale / browser | Dictation (see below).                                                                                                |
| `pasteImages`                                        | `boolean`                                           | `true`                    | Keep images when pasting (see Security).                                                                              |
| `pasteSpacing`                                       | `'remove' \| 'preserve'`                            | `'remove'`                | Pasting from Word: keep its spacing, indents, blank lines and lists ([details](#pasting-from-word)).                  |
| `allowExternalMedia`                                 | `boolean`                                           | `false`                   | Let `<audio>`/`<video>` in loaded content load inside the editor.                                                     |
| `scrollable`                                         | `boolean`                                           | `true`                    | The editing area scrolls when content is taller. `false`: extra content is hidden, like a fixed-height block.         |
| `truncateOnOverflow`                                 | `boolean`                                           | `false`                   | Cut content that exceeds the editor height.                                                                           |
| `singleLineBreaks`                                   | `boolean`                                           | `false`                   | Paste: collapse consecutive blank lines.                                                                              |
| `injectStyles`                                       | `boolean`                                           | `true`                    | Inject the editor CSS; set `false` and import the CSS file instead.                                                   |
| `locale` / `labels`                                  | `'en' \| 'pt-BR' \| 'es'` / partial                 | `'en'`                    | Interface language and text overrides.                                                                                |
| `contentClassName` / `contentStyle` / `placeholder`  | —                                                   | —                         | Editing area class, style and placeholder.                                                                            |
| `layoutMirror`                                       | `boolean`                                           | `false`                   | Isolate the editing area from the page CSS, so published content can look the same ([Layout Mirror](#layout-mirror)). |

**Toolbar groups** (`TOOLBAR_GROUPS`, always shown in this order): `dictation`, `file`, `history`,
`font`, `block`, `format`, `highlight`, `color`, `align`, `list`, `indent`, `link`, `insert`,
`textbox`, `clear`. Without `format`, Ctrl+B/I/U (Cmd on macOS) don't format; without `link`, Ctrl+K doesn't open
the link form. Undo/redo shortcuts always work.

**Error codes** (`VersaEditError.code`): `file-wrong-type`, `file-too-large`, `file-read`,
`file-empty`, `file-truncated` (level `warning`), `image-upload` (with the original error in `cause`).

## Ref methods (`VersaEditHandle`)

`getHTML()` · `setHTML(html)` (resets undo) · `focus()` · `clear()` · `undo()` · `redo()` ·
`getSize()` · `setSize({ width?, height? })` ([Resizable editing area](#resizable-editing-area)) ·
`core` (the underlying `VersaEditCore`, **experimental**).

## CSS

The editor injects its CSS by default. For sites with a strict Content Security Policy, turn
injection off and import the file:

```tsx
import 'versaedit/versaedit.css'
;<VersaEdit injectStyles={false} />
```

To **display** saved content on your site, wrap it and include the content stylesheet (image
positions, text boxes with their drag handle hidden, tables, code, quotes):

```tsx
import 'versaedit/versaedit-content.css'
;<div className="versaedit-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

Floated objects side by side (images and text boxes) stay responsive only when
`versaedit-content.css` is loaded: it moves the later object below the earlier one when the text
column between them would be too narrow at the container's actual width (container query on
`.versaedit-content`). For this, `.versaedit-content` must get its width from the available layout,
like a block element, and not size itself to its content (for example, not as a shrink-to-fit flex
item or `inline-block`).

Formatting such as colors and font sizes is stored in inline `style` attributes; a CSP that blocks
inline style attributes (`style-src-attr`) will not render it.

### Size

Without `width` and `height`, the editor takes the full width of its container and the editing
area starts 500 px tall. Set either prop to fix it: a number is px, a string is any CSS width
(`'100%'`, `'40rem'`). The editing area never gets wider than its container (`max-width: 100%`),
so a fixed width shrinks on narrow screens instead of causing horizontal scrolling.

```tsx
<VersaEdit />                          {/* container width × 500 px */}
<VersaEdit width={800} height={500} /> {/* 800 × 500 px, narrower on small screens */}
```

### Object margin

Images and text boxes placed left, right or centered keep a margin from the text. `objectMargin`
sets it per side, in px:

| Side     | Where                                                                                                                              | Default |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `text`   | Between the object and the text: the text side of a left/right object; above and below a centered object or a text box in the flow | `16`    |
| `outer`  | The outer side of a left/right object (`0` = aligned with the text edge); the sides of a text box in the flow                      | `0`     |
| `top`    | Above a left/right object                                                                                                          | `4`     |
| `bottom` | Below a left/right object                                                                                                          | `12`    |

Sides you leave out keep the default; negative or invalid values are ignored, and values above
200 are limited to 200. The margin is not written into the HTML: give the published container the
same values with `objectMarginStyle()`, so objects sit where they were in the editor.

```tsx
import { objectMarginStyle, VersaEdit } from 'versaedit'

const margin = { text: 24, outer: 8 }

<VersaEdit objectMargin={margin} />

<div
  className="versaedit-content"
  style={objectMarginStyle(margin)}
  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
/>
```

`objectMarginStyle()` returns the CSS variables `--ve-object-text`, `--ve-object-outer`,
`--ve-object-top` and `--ve-object-bottom`; without React, set them on the editing element and on
the published container. Changing `objectMargin` while editing recalculates where objects side by
side must move down (`data-ve-stack`), without touching the undo history.

### Settings panel

`settingsPanel` adds a gear button at the end of the toolbar. It opens a panel with content
supplied by your application, such as the options your users may change. The editor does not
store or interpret that content: its controls change your own state, which you pass back as
props. Without the prop there is no gear and nothing changes.

```tsx
function Editor() {
  const [spacing, setSpacing] = useState<'remove' | 'preserve'>('remove')
  return (
    <VersaEdit
      pasteSpacing={spacing}
      settingsPanel={(close) => (
        <>
          <label>
            <input
              type="checkbox"
              checked={spacing === 'preserve'}
              onChange={(e) => setSpacing(e.target.checked ? 'preserve' : 'remove')}
            />
            Keep Word spacing when pasting
          </label>
          <button type="button" onClick={close}>
            Done
          </button>
        </>
      )}
    />
  )
}
```

- Content: any React node, or a function that receives `close()`, which closes the panel and
  returns focus to the gear.
- Position: the gear is the last item of the toolbar, aligned to the right of its last row. It joins
  that row when there is room for it; otherwise it starts a row of its own, still on the right. With
  `toolbar={[]}`, the toolbar shows only the gear. The panel opens below the gear, aligned to its
  right edge, 260 to 360 px wide (never wider than the screen minus 16 px), and scrolls when taller
  than 70% of the screen. On narrow screens it is kept inside the viewport.
- Keyboard and screen readers: the gear is a toolbar button (arrow keys, Home, End) named by
  `labels.settings` ("Settings"), with `aria-haspopup="dialog"` and `aria-expanded`. The panel is
  a non-modal dialog with the same name. Opening it moves focus to its first control; Tab and
  Shift+Tab move through its controls, and Shift+Tab on the first one returns to the gear.
- Closing: the gear, Esc, a click outside, Tab past the last control, starting to resize the
  editing area, or opening another toolbar menu. The gear and Esc return focus to the gear. Esc
  already handled by a control inside the panel (`event.preventDefault()`) does not close it.
- Server rendering outputs only the closed gear.

### Layout Mirror

Without it, published content takes your site's typography (fonts, sizes, spacing), which is
usually what a site wants. Turn on Layout Mirror when the published text must look exactly as it
did while editing: same font, size, line height, paragraph and heading spacing, lists, quotes,
alignments, images and text boxes.

```tsx
// Editing: the editing area ignores the page CSS
;<VersaEdit layoutMirror onChange={save} />

// Publishing: the content stylesheet, plus the ve-mirror class
import 'versaedit/versaedit-content.css'
;<div className="versaedit-content ve-mirror" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

- The saved HTML does not change: the mirror is CSS only, and it is optional on both sides.
- Lines break at the same points when the published container has the same usable width as the
  editing area: `width` minus the frame (1 px on each side by default) minus 32 px of padding
  (e.g. 800 → 766 px). In narrower columns the text reflows, and images and text boxes shrink to fit.
- A custom `fontFamily` / `headingFontFamily` is passed with CSS variables:
  `style={{ '--ve-font': 'Georgia, serif', '--ve-heading-font': 'Inter, sans-serif' }}`.
- Your site's element rules (`p {}`, `h2 {}`, `ul {}`…) do not reach mirrored content. Rules
  that target it through a class (e.g. `.post p {}`) are more specific and still apply, as do
  `!important` rules: keep them away from the `ve-mirror` container.
- Without React, add the `ve-mirror` class to the editing element yourself.

### Resizable editing area

Off by default. With `resizable`, handles on the right edge, the bottom edge and the corner
between them resize the editing area with a mouse, a finger or the arrow keys (focused handle;
Shift: 1 px). `sizeControls` adds width and height fields below the area.

```tsx
<VersaEdit
  width={720}
  height={400}
  resizable={{ handles: ['e', 's', 'se', 'w'], minWidth: 320, maxHeight: 900 }}
  sizeControls
  onResize={(size, phase) => phase === 'end' && saveEditorSize(size)}
/>
```

- Only the visible area changes: the HTML, undo history, selection and `onChange` are not
  affected, and nothing is written into the document.
- `handles`: any of `'e'`, `'s'`, `'se'` (default), `'w'`, `'n'`, `'nw'`, `'ne'`, `'sw'`. The
  left and top handles also grow the area when pulled outwards; with the editor aligned to the
  left of the page, the opposite edge is the one that moves. A side handle without room beside
  the editor (full-width editor) is hidden, and the corner keeps working.
- Limits in px, frame included: `minWidth` (160), `maxWidth` (the available width; the area
  never goes past its container), `minHeight` (80), `maxHeight` (none). If the container gets
  narrower than the chosen width, the area shrinks to fit and reports `'end'`.
- `onResize(size, phase)`, sizes in px with the frame: dragging calls `'start'`, then `'move'`
  once per frame in which the size changed, then `'end'`. The arrow keys, the size fields and
  the container shrinking call only `'end'`, and only when the size changed. `setSize()` and new
  `width`/`height` props do not call it, so saving the size and restoring it with `setSize()`
  never loops.
- `getSize()` returns the visible size (`null` before mounting); `setSize()` applies one within
  the limits and returns it (only with `resizable`). New `width`/`height` props replace the
  chosen size.
- `truncateOnOverflow` and `onOverflowChange` keep using the configured `width`/`height`:
  resizing never cuts content, also on the next keystroke, paste or load, and a larger area does
  not allow more content. Content beyond a smaller area scrolls (even with `scrollable={false}`).
- To keep the size between visits, store it from `onResize` and pass it back as `width` and
  `height` (or call `setSize()`). With [Layout Mirror](#layout-mirror), give the published
  container the usable width of the chosen size (`width` − frame − 32 px).
- Without React: `createFrameResizer({ frame, content, handles, limits, onResize })` adds the
  handles to any frame, and `core.setContentLimit({ width, height })` keeps the content limit at
  the configured size.

### Pasting from Word

By default (`pasteSpacing="remove"`), text pasted from Microsoft Word follows your site's spacing:
paragraph and line spacing, indents and blank lines are dropped, as before. With
`pasteSpacing="preserve"`, VersaEdit keeps Word's layout in the HTML:

```tsx
<VersaEdit pasteSpacing="preserve" />
```

- Space before and after paragraphs, left and first-line indents and line spacing are read from
  Word's styles (including the class rules Word sends, such as `MsoNormal`) and written as inline
  styles in pt, within safe limits: spacing 0–72 pt, left indent 0–144 pt, first-line indent −72
  to 144 pt. Blank lines (empty paragraphs) are kept.
- Word lists become real `ul`/`ol` lists: levels; bullets, numbers, letters and Roman numerals;
  numbering continued after a paragraph (`<ol start="4">`) or restarted; mixed lists (items that
  came from a web page plus Word paragraphs of the same list); and the indent of each level, as
  inline style of the list. Word's drawn bullet is removed; the item text is kept as it is.
- Line spacing: Word's "Multiple" (1.15, 1.5…) is applied to the browser's single line height for
  that font, measured when pasting. Word and browsers take "single" from different metrics of the
  same font (from about −8% to +6%; Aptos −7.7%), so a long document drifts by about one line in
  thirteen. "Exactly" and "At least" keep their value.
- Saved documents keep this spacing when reopened, whatever `pasteSpacing` says: it only decides
  what happens when pasting. It is plain inline CSS, shown the same on your site, with or without
  [Layout Mirror](#layout-mirror). "Clear formatting" removes it from the selected paragraphs.
- Only HTML from Microsoft Word is affected; pasting from web pages and other sources works as
  before. See [Known limitations](#known-limitations) for what still differs from Word.

## Examples and guides

- [Integration guide](docs/integration.md): server sanitization, saving, Supabase (public key + RLS),
  image upload, Next.js, CSP, displaying content.
- [`examples/vite-react`](examples/vite-react): one tab per use case (basic, integration callbacks,
  customized toolbar, strict CSP, display, external dictation).
- [`examples/nextjs`](examples/nextjs): Next.js 16 App Router with server rendering.
- Playground (`npm run dev`): open **Show HTML → Properties** to change props live, load sample
  content, watch events and copy the equivalent JSX.

Both examples run against the packed package (`npm pack`), installed outside the repository, in CI.

## Dictation

A microphone button converts speech to text using the browser's Web Speech API (Chrome, Edge,
Safari; hidden in Firefox), in the interface language (`en-US`, `pt-BR` or `es-ES`; `speechLang`
changes it). Spoken punctuation works ("comma", "period", "new line"…; in pt-BR "vírgula", "ponto
final", "nova linha"…; in Spanish "coma", "punto final", "nueva línea"…; Spanish gets only the
closing ? and !, not ¿ and ¡). **Privacy:** these browsers process the audio on the
vendor's servers (Google, Microsoft, Apple). Pass `speechRecognition` to use another engine with the
same interface, or `showDictation={false}` to remove it. `VersaEditDictation` renders the microphone
anywhere on the page (`<VersaEditDictation editor={ref} />`).

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md) (support@versaedit.dev).

- Every HTML input (initial content, opened files, paste) goes through DOMPurify plus the editor's
  own allow-lists; scripts, event handlers, `javascript:` links and SVG are removed. A battery of 42
  XSS vectors runs in CI.
- **Sanitize again on your server** before storing or publishing: the editor runs in the user's
  browser and can be bypassed. The [integration guide](docs/integration.md#sanitization-browser-and-server)
  has a tested server recipe.
- `pasteImages` (default `true`): pasted images keep pointing to the original site — readers'
  browsers will request them from there, and that site may change or remove them. Use
  `onImageUpload`, or `pasteImages={false}`.
- External audio/video in loaded content does not load inside the editor (`allowExternalMedia`),
  and the HTML you get back is unchanged.

## Keyboard

| Keys                            | Action                                            |
| ------------------------------- | ------------------------------------------------- |
| Ctrl+B / I / U (Windows, Linux) | Bold / italic / underline                         |
| Cmd+B / I / U (macOS)           | Bold / italic / underline                         |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z)   | Undo, redo                                        |
| Ctrl+K                          | Link form (Enter applies, Esc cancels)            |
| Tab                             | Insert spaces                                     |
| Delete / Backspace              | Delete the selected image                         |
| Ctrl+arrows (Shift: 10px)       | Nudge the selected image or text box              |
| Alt+↑/↓, Alt+←/→                | Move it in the text flow / float it left or right |
| ←/→, Home/End, Esc (toolbar)    | Move between toolbar controls, close palettes     |

## Browser support

Automated tests run on every push in Chromium (Chrome/Edge). Firefox and WebKit (Safari) are run as a
diagnostic (`VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit`):

| Browser         | Status                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Chrome, Edge    | Full suite passing.                                                                                                             |
| Firefox         | Works; HTML differs in details (e.g. images inserted inside the paragraph). Paste is not covered by automated tests in Firefox. |
| Safari (WebKit) | Works; lists get extra `<span style="font-size">` wrappers; other differences are cosmetic.                                     |

Moving a floated object below another when the text column between them would be too narrow
(`data-ve-stack`, in the editor and in `versaedit-content.css`) needs `:has()` and container
queries: Chrome/Edge 105+, Safari 16+, Firefox 121+. In older browsers the objects stay side by
side, as before; nothing else changes.

## Known limitations

- Built on `document.execCommand` (legacy but supported by all browsers); output HTML varies slightly
  between browsers.
- Undo/redo: after undoing in the editor, the browser's own Redo (Edit or context menu) may be
  unavailable; Ctrl+Y and the Redo button work. Typing with system IME keyboards (Japanese, Chinese,
  Korean) and Safari's menus have not been checked by hand yet.
- After the highlighter or a custom color, bold is written as `<span style="font-weight: bold">`
  instead of `<b>` (works the same).
- Pasting from Microsoft Word (`pasteSpacing="preserve"`), compared with Word at the same width,
  font and size: line spacing differs by the font metrics (see [Pasting from Word](#pasting-from-word));
  a paragraph may wrap into one line more or less; a horizontal line takes about 17 pt more
  height in Word; table cells get the site's (or editor's) padding; paragraphs and list items
  that Word spaces automatically (content that came from a web page, `mso-margin-*-alt: auto`)
  lose those 14 pt; multi-level numbering such as 1.1 and 1.2 shows as a nested list numbered 1,
  2; Word's bullet glyphs become the browser's disc and circle; and the pasted text uses a single
  font from the editor's font list (the first one found in the document). Pasting is not covered
  by automated tests in Firefox.
- Only HTML output (no JSON or Markdown export).
- WebKit (Safari), with `truncateOnOverflow` and a resized editing area: spaces typed after the
  content limit may be saved as a different mix of spaces and `&nbsp;` than in an area that was
  never resized. The text and the cut point are the same.

## Development

```bash
npm install
npm run dev        # playground at http://localhost:5180
npm run build      # library build (dist/)
npm run lint
npm run typecheck
npm test           # unit tests (Vitest) + browser tests (Playwright)
npm run test:package  # npm pack → install in examples/ copies → type check, build, browser tests
npm run test:site     # public site (versaedit.dev + /playground/) built into site/ and tested
```

Browser tests use `playground/harness.html`. Locally they run in the installed Microsoft Edge; in CI,
in Playwright's Chromium (with React 19 and React 18). Reference results live in
`tests/e2e/__snapshots__/` — after an intentional behavior change, run
`npm run test:e2e -- --update-snapshots` and review the diff.

## License

[MIT](LICENSE)
