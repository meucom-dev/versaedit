# Changelog

All notable changes to VersaEdit. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions will follow [Semantic Versioning](https://semver.org/). The package has not been published
yet (version `0.0.0`); work is grouped by the internal stabilization batches.

## [Unreleased]

To be released as **`0.5.0-beta.1`** (first public beta). At release time this heading becomes
`## [0.5.0-beta.1] - YYYY-MM-DD` (see `RELEASING.md`).

### Release preparation (0.5.0-beta.1)

#### Changed

- Experimental undo/redo: distinct operations are separate undo steps even when they happen less
  than 400 ms apart (typing then formatting, pasting, inserting a link, image or text box, moving
  or dragging an object, clicking elsewhere or moving the cursor with the keys). Continuous typing,
  including Backspace, Enter and Shift, is still grouped into one step.
- Playground: the sample contents (formatted text, table, image, text box, long content) load in
  the selected language, with the same HTML structure; content being edited is not changed by
  switching the language, only by loading a sample again.
- Drag and drop of images and text boxes: the element stays where it is dropped (it used to
  snap to the left or right edge). It floats to the nearer side with a horizontal margin to keep its
  position; text wraps on the free side (CSS floats wrap on one side only) and the 40px margin is
  kept. The Left/Right/Center buttons reset that offset.
- Playground: no horizontal scrolling on phones (a fixed width that does not fit becomes 100%;
  desktop unchanged).
- The toolbar's text box group wraps onto two lines on screens narrower than about 340px (and at
  375px in WebKit), instead of causing horizontal scrolling; desktop unchanged.
- The image/text box menu fits small screens: it never gets wider than the editing area and wraps
  onto two lines when needed (desktop unchanged).
- The image/text box menu stays inside the editing area: near the right edge it aligns with the
  object's right side, and with no room above it moves below the object; it no longer wraps onto
  two lines. `ObjectState.box` (optional) carries the object's rectangle.

#### Added

- Experimental: undo restores the selection from before the undone step, and redo the selection
  after the redone step, keeping its direction (it used to put the cursor at the start of the
  editor). The selection is stored as linear positions that survive the HTML being reloaded and do
  not depend on object types; the history keeps its grouping and its previous API.
- Spanish interface (`locale="es"`): every toolbar, menu, tooltip, form, message and accessibility
  text, plus dictation in `es-ES` with spoken punctuation ("coma", "punto final", "nueva línea"…;
  closing ? and ! only, no ¿ and ¡). English and Brazilian Portuguese are unchanged. The Playground
  language selector offers Español, and the Playground's own texts follow the selected language
  (the frame fields' accessible names, previously always in English, are now translated too).
- Site `versaedit.dev`: home page in an encyclopedia-article layout in English (`/`), Portuguese
  (`/pt/`) and Spanish (`/es/`) generated from one template and one text dictionary per language; system fonts and
  no requests to other servers; contents rail, article, fact box, references; responsive (tablet:
  collapsible contents; phone: one column, stacked browser table). No search box and no npm links
  until the package is published.
- `scrollable` prop (default `true`): the editing area scrolls when the content is taller than
  `height`; the image/text box menu and resize handle follow the scroll and hide when the object
  leaves the visible area. `scrollable={false}` keeps the previous fixed-block behavior (content
  beyond the height hidden — for layouts with a fixed-size content block).
- Public site for `https://versaedit.dev` with the playground at `/playground/` (`npm run build:site`,
  `npm run test:site`, CI job `site`, GitHub Pages workflow that only runs once the repository is
  public). The public playground shows a beta/privacy note; nothing is sent to any VersaEdit server.
- `release.yml`: manual npm publication with Trusted Publishing (OIDC, no stored token), approval
  environment `npm-publish`, full test suite and guards (no `private`, beta versions only, matching
  version and CHANGELOG section, README without the "not published" notice).
- `SECURITY.md` (private vulnerability reporting, support@versaedit.dev), issue templates.
- `npm run test:package -- --from-registry=<spec>` to test the published package.

#### Changed

- Package metadata: author `meucom-dev`, homepage `https://versaedit.dev`, support e-mail,
  `publishConfig` (`access: public`, `tag: beta`); `CHANGELOG.md` included in the package.
- README: beta notice, `npm install versaedit@beta`, links to the site and playground.
- Playground (local and public): Montserrat for text, Playfair Display for headings and a
  15-font menu, loaded from Google Fonts (stated in the
  public playground's privacy note). The package defaults are unchanged: no Google Fonts request
  unless `loadGoogleFonts` is set.

#### Fixed

- Indentation survives saving and reopening, and no longer turns into a quote. In Chromium and
  WebKit an indented paragraph (a `<blockquote>` with a left margin and no border) lost its style
  when the content was loaded again and was shown as a quote (italic, border, background); in
  Firefox (`margin-left` on the paragraph) the indentation disappeared. Indentation is now
  recognized from the style values the browser reads, not from the text of the `style` attribute:
  the indentation `<blockquote>` gets the standard ARIA `role="presentation"` (it is not a
  quotation, and screen readers no longer announce it as one), and the left margin of indented
  blocks is kept when it is a multiple of 40px. Quotes are unchanged. Documents saved by earlier
  versions are recognized when loaded; for HTML published without passing through the editor
  again, `versaedit-content.css` keeps a compatibility rule, limited to indentation blockquotes
  without `role` saved in the exact form those browsers wrote (left margin and `border: none`), so
  it never affects a quote.
- Loading content no longer moves the `class` and `style` attributes to the end of the element
  (`<span class="textbox-handle" contenteditable="false">` came back as
  `<span contenteditable="false" class="textbox-handle">`): they are filtered in place, so saving
  and reopening a document gives the same HTML. The filtering itself is unchanged; only the text
  inside `style` can be rewritten by the browser (`margin:0` becomes `margin: 0px;`), with the same
  meaning.
- Links that open in a new tab keep `target="_blank"` when the content is loaded again
  (`setHTML`, `initialContent`/`value`, opening a `.html` file); it used to be removed, so a link
  created in the editor changed after saving and reopening. `target` is kept only on links and only
  with `_blank` (other values are still removed), always with `rel` containing
  `noopener noreferrer` (`opener` is removed; other values such as `nofollow` are kept). This also
  applies to `purifyHtml`. Pasted links are unchanged (`href` only).
- Pasting HTML blocks (paragraphs, headings, lists, tables…) in the middle of a block no longer
  nests blocks (`<p>ola <p>um</p>…</p>`, invalid HTML that changed when saved and reopened). The
  paste is planned first and then applied to the DOM: a text block is split at the cursor (inline
  elements around it too), loose text and a plain paragraph at either end join the halves (as in
  Word), headings, lists, tables and rules go in whole, empty halves are dropped, and paragraphs
  pasted into a list item become items. In table cells, text boxes and the editing area itself the
  blocks go in at the cursor; in a code block only the text does. The cursor ends after the pasted
  content. Pastes without blocks are unchanged.
- Joining blocks with Backspace/Delete (paragraphs, heading, list items) no longer leaves the
  styles that Chromium and WebKit copy onto the moved text (`<span style="font-size: 12pt;
caret-color: …">`, or the same declarations added to the user's own elements). Only what the
  operation itself added and that changes nothing on screen is removed; the user's formatting
  stays, even when it matches the inherited style.
- Delete at the end of a paragraph right before a text box selects the box instead of merging it;
  a second Delete removes it (undoable).
- Experimental undo/redo: the restored cursor is scrolled into view with the smallest movement
  (editing area, scrollable containers, then the page; a fixed-height area is not scrolled), and
  selections inside editable parts of non-editable objects (such as a caption) are restored there.
- Links are inserted through the DOM when the selection is within one block: the browser no longer
  turns the surrounding spaces into `&nbsp;`, no longer copies styles onto the link (WebKit), and
  the cursor ends right after the link, so typing no longer extends it (Firefox). Selections across
  blocks keep the previous behavior.
- Delete removes a text box selected as an object (the state Backspace leaves it in); the removal
  is undoable. With the cursor inside the box, Delete still deletes text.
- Keyboard trap: Tab still inserts spaces, but Shift+Tab now moves focus back to the toolbar and
  Esc followed by Tab moves it to the next element on the page. The editing area describes this to
  screen readers (new `keyboardHint` label, in English, Portuguese and Spanish).
- Backspace at the start of a paragraph right after a text box selects the box (selection outline,
  menu and a screen reader announcement; new `imageSelected`/`textboxSelected` labels) instead of
  merging the paragraph into it; nothing is deleted. Esc deselects any selected object.
- Cursor after selecting an image: typing now writes right after the image (and deselects it, so
  the next Backspace deletes the letter, not the image); Delete/Backspace or the menu's delete
  button leaves the cursor where the image was. Before, the cursor stayed wherever it had been, or
  at the start of the content, and the text went there.
- Enter (and Shift+Enter in WebKit) inside a text box no longer splits it into a second box without
  the drag handle; it inserts a line break in the same box.
- "Remove link" with the cursor inside a link (no selection) removes the whole link and keeps the
  cursor in place; before, it did nothing.
- Tapping an image on a phone no longer scrolls the page or leaves the image unselected. Before
  measuring, the image/text box menu was drawn at a provisional position that could overflow the
  right edge of the screen; mobile browsers briefly widened the page and scrolled it, and the tap's
  click then landed outside the image (at 320px, on the text, which deselected it). The menu is now
  measured from the left edge of the editing area; its final position is unchanged.
- Playground: switching the language no longer reloads the second editor (`onSave`), which erased
  what had been typed in it.

### Batch v0.4.x — playground, independent integration, distribution

#### Added

- `npm run test:package`: the packed package (`npm pack`) is installed in copies of the examples
  outside the repository, type-checked (also with `moduleResolution: nodenext`), built and tested in
  the browser. Checks the package contents (CSS, types, license, no local paths or keys in source
  maps). New CI job `package`.
- `examples/vite-react` (six use cases) and `examples/nextjs` (Next.js 16 App Router, server
  rendering).
- Playground: "Properties" panel inside "Show HTML" (toolbar groups, size, colors, frame, options,
  sample content, event log, equivalent JSX). Initial view unchanged.
- Integration guide (`docs/integration.md`, pt-BR too) with a server sanitization recipe tested in CI.
- Package metadata (repository, homepage, bugs, keywords), `exports["./package.json"]`,
  `RELEASING.md`.

#### Fixed

- Server rendering: hydration error (React #418) in browsers with speech recognition — the dictation
  button now appears right after hydration.
- Type declarations failed with `moduleResolution: node16/nodenext` (imports without extension).

### Batch v0.3.x — library preparation

#### Added

- `onFocus` / `onBlur` (only when focus enters or leaves the editor as a whole).
- `onError({ code, message, level, cause })` and `onConfirm({ code, message })` (sync or Promise);
  without them the editor keeps using `alert()` / `confirm()`.
- `toolbar` prop: choose toolbar groups (`TOOLBAR_GROUPS`); shortcuts follow the choice.
- `width` / `toolbarWidth` accept CSS sizes such as `'100%'` (numbers behave as before).
- `injectStyles` prop; `dist/versaedit.css` and `dist/versaedit-content.css` (for displaying saved
  content, with `.versaedit-content`).
- React 18.3 support (`peerDependencies: ^18.3.0 || ^19.0.0`), tested in CI.
- English and Portuguese READMEs, this changelog.

#### Fixed

- Importing VersaEdit during server rendering crashed (`purifier.addHook is not a function`).
- React 18 `useLayoutEffect` warning during server rendering.
- Text boxes were published with `contenteditable="true"` (editable by site visitors).

#### Changed

- Fully minified bundle (103 kB → 85 kB; 28.4 → 25.6 kB gzip).

### Batch v0.2.x — paste, media, memory

#### Added

- Paste keeps tables (caption, header/body, merged cells, cell shading), images (`pasteImages`),
  horizontal rules and code blocks.
- External audio/video does not load inside the editor (`allowExternalMedia`); returned HTML is
  identical to the input.

#### Fixed

- Clicking an image without focusing the text first left keyboard actions (Delete, arrows, undo)
  without effect.
- A plain click on an image moved it (into the paragraph); in Firefox it also lost the selection.
- Firefox: alignment produced `align=""` and indent looked like a quote.
- Indented text looked like a quote (italic, background) in Chromium/WebKit.
- `selected` / `dragging` classes leaked into `onChange` / `getHTML` / saved files.

#### Changed

- Undo history stores each base64 image once: retained memory with a 3 MB image over 100 steps
  went from ~395 MB to ~1.2 MB.

### Batch v0.1.x — stability and security

#### Added

- 42-vector XSS battery (unit + real browser).
- Firefox and WebKit diagnostic runs.

#### Fixed

- `onChange` fired without changes (e.g. on blur).
- Empty `style=""` attributes in pasted HTML.
- Intermittent test failures (fixed wait in the test page).

### Earlier phases

- Extraction from an existing application into a standalone library, decoupling (no
  CoreUI/Bootstrap), English/Portuguese
  interface, framework-free core (`VersaEditCore`), touch support, link form, toolbar keyboard
  navigation, ref API, image upload, dictation, test suites and CI.

## Future improvements (not scheduled)

- Restore the cursor position after undo/redo.
- Keep `<b>` for bold after the highlighter / custom color (CSS mode left on).
- Manual validation in Firefox of paste and of Ctrl+B/I/U (the editor relies on the browser;
  Playwright's Firefox does not apply them even in a plain `contenteditable`).
- Validation of paste with real Microsoft Word documents.
- WebKit: avoid the extra `<span style="font-size">` in lists.

## Pending investigation

- Firefox diagnostic: image drag tests (`tests/e2e/drop-position.spec.ts`) can time out in
  `mouse.move` when run in parallel (4 of 5 once, 1 of 5 on rerun); 15/15 when run one at a time.
- Firefox diagnostic: `injectStyles={false}` test (`tests/e2e/css.spec.ts`) failed once in the full
  Firefox + WebKit run and passed 15/15 when repeated alone; suspected timing under parallel load.
- Firefox diagnostic: `onConfirm "async-yes"` (`tests/e2e/dialogs.spec.ts`) failed once in the full
  run (v0.4.x) and passed 40/40 when repeated alone — same pattern as above.
