# VersaEdit — Quick Start example

The code of the Quick Start guide (<https://versaedit.dev/quick-start/>): a React + TypeScript +
Vite app that renders the editor, keeps its HTML in a React state (`onChange`), captures it with
`getHTML()` through the ref when **Save content** is clicked and shows it as text.
`injectStyles={false}` with `import 'versaedit/versaedit.css'` loads the editor styles from the
package file.

| File                 | Shows                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| `src/App.tsx`        | Imports, styles, initial HTML, `onChange` state, ref and the Save button     |
| `src/saveContent.ts` | Sending the HTML to an API with `fetch` (optional; the app does not call it) |

The site shows these files as they are (in Portuguese and Spanish only comments, interface texts
and `locale` change): `npm run build:site` reads them from here. `tests/package/quick-start.spec.ts`
checks the app in a browser.

## Run

From the repository root, `npm run test:package` builds the package with `npm pack`, copies this
folder to a temporary directory, installs the `.tgz` there, builds it and runs the browser test.
With the published package instead:

```bash
npm run test:package -- quick-start --from-registry=versaedit@0.5.0-beta.1
```

In your own project: `npm install versaedit@beta`, then copy `src/App.tsx`.
