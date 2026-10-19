# VersaEdit — Vite + React example

One tab per use case. Each tab is covered by `tests/package/vite-react.spec.ts`.

| Tab                | File                                 | Shows                                                                                                        |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Basic              | `src/examples/Basic.tsx`             | Controlled value (`onChange`), `getHTML()` / `clear()` through the ref, display with `versaedit-content.css` |
| Integration        | `src/examples/Integration.tsx`       | `onImageUpload` (simulated), `onError` and `onConfirm` with your own UI, `onSave`                            |
| Customized         | `src/examples/Customized.tsx`        | `toolbar` groups, `locale="pt-BR"`, brand color, font, palette and frame, `width="100%"`                     |
| Strict CSP         | `src/examples/StrictCsp.tsx`         | `injectStyles={false}` + `import 'versaedit/versaedit.css'`                                                  |
| Display content    | `src/examples/DisplayContent.tsx`    | Saved HTML on a site with `versaedit-content.css`                                                            |
| External dictation | `src/examples/ExternalDictation.tsx` | `VersaEditDictation` outside the toolbar                                                                     |

## Run

From the repository root, `npm run test:package` builds the
package with `npm pack`, copies this folder to a temporary directory, installs the `.tgz` there
(`npm ci`, then `npm install <file>.tgz`), builds it and runs the browser tests.

To try it by hand, inside that temporary copy (path printed by the script):

```bash
npm run dev
```

In your own project: `npm install versaedit@beta` (beta). Try it online: <https://versaedit.dev/playground/>.
