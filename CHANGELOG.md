# Changelog

All notable changes to VersaEdit. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions will follow [Semantic Versioning](https://semver.org/). The package has not been published
yet (version `0.0.0`); work is grouped by the internal stabilization batches.

## [Unreleased]

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

- Extraction from the À Mesa application, decoupling (no CoreUI/Bootstrap), English/Portuguese
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

- Firefox diagnostic: `injectStyles={false}` test (`tests/e2e/css.spec.ts`) failed once in the full
  Firefox + WebKit run and passed 15/15 when repeated alone; suspected timing under parallel load.
