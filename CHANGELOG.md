# Changelog

All notable changes to VersaEdit. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions will follow [Semantic Versioning](https://semver.org/). The package has not been published
yet (version `0.0.0`); work is grouped by the internal stabilization batches.

## [Unreleased]

To be released as **`0.5.0-beta.1`** (first public beta). At release time this heading becomes
`## [0.5.0-beta.1] - YYYY-MM-DD` (see `RELEASING.md`).

### Release preparation (0.5.0-beta.1)

#### Changed

- Drag and drop of images and text boxes: the element stays where it is dropped (it used to
  snap to the left or right edge). It floats to the nearer side with a horizontal margin to keep its
  position; text wraps on the free side (CSS floats wrap on one side only) and the 40px margin is
  kept. The Left/Right/Center buttons reset that offset.

#### Added

- `scrollable` prop (default `true`): the editing area scrolls when the content is taller than
  `height`; the image/text box menu and resize handle follow the scroll and hide when the object
  leaves the visible area. `scrollable={false}` keeps the previous fixed-block behavior (content
  beyond the height hidden — for À Mesa's fixed blog block).
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
- Playground (local and public): the fonts of the À Mesa blog editor — Montserrat for text,
  Playfair Display for headings, the same 15-font menu, loaded from Google Fonts (stated in the
  public playground's privacy note). The package defaults are unchanged: no Google Fonts request
  unless `loadGoogleFonts` is set.

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

- Firefox diagnostic: image drag tests (`tests/e2e/drop-position.spec.ts`) can time out in
  `mouse.move` when run in parallel (4 of 5 once, 1 of 5 on rerun); 15/15 when run one at a time.
- Firefox diagnostic: `injectStyles={false}` test (`tests/e2e/css.spec.ts`) failed once in the full
  Firefox + WebKit run and passed 15/15 when repeated alone; suspected timing under parallel load.
- Firefox diagnostic: `onConfirm "async-yes"` (`tests/e2e/dialogs.spec.ts`) failed once in the full
  run (v0.4.x) and passed 40/40 when repeated alone — same pattern as above.
