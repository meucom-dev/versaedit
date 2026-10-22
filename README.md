# VersaEdit

Lightweight rich text editor for React applications.

> **Beta** (`0.5.0-beta.1`) — the API may change before 1.0; see [Known limitations](#known-limitations).
> <!-- release:pending -->**Not yet published on npm.**<!-- /release:pending -->

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

| Prop                                                 | Type                                                | Default                   | Description                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `initialContent`                                     | `string`                                            | `''`                      | HTML to load. External changes reload the editor (and reset undo).                                            |
| `onChange`                                           | `(html) => void`                                    | —                         | Called when the HTML actually changes.                                                                        |
| `onOverflowChange`                                   | `(boolean) => void`                                 | —                         | Content does / doesn't fit the editor height.                                                                 |
| `onFocus` / `onBlur`                                 | `() => void`                                        | —                         | Focus entered / left the editor (toolbar buttons keep focus).                                                 |
| `onError`                                            | `(VersaEditError) => void`                          | `alert()`                 | Errors and warnings with a stable `code` (see below).                                                         |
| `onConfirm`                                          | `(VersaEditConfirm) => boolean \| Promise<boolean>` | `confirm()`               | Confirmations (e.g. replace content when opening a file).                                                     |
| `onSave`                                             | `(html) => void`                                    | download                  | Save button gives you the HTML instead of downloading a `.html` file.                                         |
| `onImageUpload`                                      | `(file) => Promise<url>`                            | base64                    | Upload images and insert the returned URL (recommended).                                                      |
| `width`                                              | `number \| string`                                  | `640`                     | Total width; a number is px, a string is CSS (`'100%'`).                                                      |
| `height`                                             | `number`                                            | `480`                     | Total height in px.                                                                                           |
| `toolbarWidth`                                       | `number \| string`                                  | `width`                   | Toolbar width (numbers center it over the editor).                                                            |
| `frame`                                              | `{ width, color, radius } \| false`                 | `1px #d0d7de, 8px`        | Border around the editing area.                                                                               |
| `accentColor`                                        | `string`                                            | `#2563eb`                 | Selection outlines, text boxes, handles.                                                                      |
| `fontFamily` / `headingFontFamily`                   | `string`                                            | system font               | Text and heading fonts.                                                                                       |
| `fontFamilies` / `fontSizes`                         | arrays                                              | defaults                  | Font menu (`{ label, value }`) and sizes (pt).                                                                |
| `colorPalette` / `highlightColors`                   | `string[]`                                          | defaults                  | Text/paper colors and highlighter colors (`'transparent'` = none).                                            |
| `loadGoogleFonts`                                    | `string[]`                                          | —                         | Families to load from Google Fonts (off by default).                                                          |
| `toolbar`                                            | `ToolbarGroup[]`                                    | all                       | Toolbar groups to show (see below). `[]` hides the toolbar.                                                   |
| `showFileButtons`                                    | `boolean`                                           | `true`                    | Save/Open file buttons.                                                                                       |
| `showDictation` / `speechLang` / `speechRecognition` | —                                                   | `true` / locale / browser | Dictation (see below).                                                                                        |
| `pasteImages`                                        | `boolean`                                           | `true`                    | Keep images when pasting (see Security).                                                                      |
| `allowExternalMedia`                                 | `boolean`                                           | `false`                   | Let `<audio>`/`<video>` in loaded content load inside the editor.                                             |
| `scrollable`                                         | `boolean`                                           | `true`                    | The editing area scrolls when content is taller. `false`: extra content is hidden, like a fixed-height block. |
| `truncateOnOverflow`                                 | `boolean`                                           | `false`                   | Cut content that exceeds the editor height.                                                                   |
| `singleLineBreaks`                                   | `boolean`                                           | `false`                   | Paste: collapse consecutive blank lines.                                                                      |
| `injectStyles`                                       | `boolean`                                           | `true`                    | Inject the editor CSS; set `false` and import the CSS file instead.                                           |
| `locale` / `labels`                                  | `'en' \| 'pt-BR' \| 'es'` / partial                 | `'en'`                    | Interface language and text overrides.                                                                        |
| `contentClassName` / `contentStyle` / `placeholder`  | —                                                   | —                         | Editing area class, style and placeholder.                                                                    |

**Toolbar groups** (`TOOLBAR_GROUPS`, always shown in this order): `dictation`, `file`, `history`,
`font`, `block`, `format`, `highlight`, `color`, `align`, `list`, `indent`, `link`, `insert`,
`textbox`, `clear`. Without `format`, Ctrl+B/I/U don't format; without `link`, Ctrl+K doesn't open
the link form. Undo/redo shortcuts always work.

**Error codes** (`VersaEditError.code`): `file-wrong-type`, `file-too-large`, `file-read`,
`file-empty`, `file-truncated` (level `warning`), `image-upload` (with the original error in `cause`).

## Ref methods (`VersaEditHandle`)

`getHTML()` · `setHTML(html)` (resets undo) · `focus()` · `clear()` · `undo()` · `redo()` ·
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

Formatting such as colors and font sizes is stored in inline `style` attributes; a CSP that blocks
inline style attributes (`style-src-attr`) will not render it.

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

| Keys                          | Action                                            |
| ----------------------------- | ------------------------------------------------- |
| Ctrl+B / I / U                | Bold / italic / underline                         |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z) | Undo, redo                                        |
| Ctrl+K                        | Link form (Enter applies, Esc cancels)            |
| Tab                           | Insert spaces                                     |
| Delete / Backspace            | Delete the selected image                         |
| Ctrl+arrows (Shift: 10px)     | Nudge the selected image or text box              |
| Alt+↑/↓, Alt+←/→              | Move it in the text flow / float it left or right |
| ←/→, Home/End, Esc (toolbar)  | Move between toolbar controls, close palettes     |

## Browser support

Automated tests run on every push in Chromium (Chrome/Edge). Firefox and WebKit (Safari) are run as a
diagnostic (`VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit`):

| Browser         | Status                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Chrome, Edge    | Full suite passing.                                                                                                             |
| Firefox         | Works; HTML differs in details (e.g. images inserted inside the paragraph). Paste is not covered by automated tests in Firefox. |
| Safari (WebKit) | Works; lists get extra `<span style="font-size">` wrappers; other differences are cosmetic.                                     |

## Known limitations

- Built on `document.execCommand` (legacy but supported by all browsers); output HTML varies slightly
  between browsers.
- Undo/redo: after undoing in the editor, the browser's own Redo (Edit or context menu) may be
  unavailable; Ctrl+Y and the Redo button work. Typing with system IME keyboards (Japanese, Chinese,
  Korean) and Safari's menus have not been checked by hand yet.
- After the highlighter or a custom color, bold is written as `<span style="font-weight: bold">`
  instead of `<b>` (works the same).
- Pasting from Microsoft Word has not been validated with real documents yet.
- Only HTML output (no JSON or Markdown export).

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
