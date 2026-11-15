# Integration guide

[Leia em português](integration.pt-BR.md)

Recipes for using VersaEdit in a real application. Each recipe says how it was verified.

- [Sanitization: browser and server](#sanitization-browser-and-server)
- [Saving content](#saving-content)
- [Keeping the editing area size](#keeping-the-editing-area-size)
- [Settings panel: your options in the toolbar](#settings-panel-your-options-in-the-toolbar)
- [Supabase](#supabase)
- [Image upload](#image-upload)
- [Next.js](#nextjs)
- [Content Security Policy](#content-security-policy)
- [Displaying saved content](#displaying-saved-content)

## Sanitization: browser and server

VersaEdit sanitizes **in the browser**, and that is not enough on its own.

|                  | In the browser (VersaEdit)                                                                                      | On your server (you)                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| What             | Initial content, `setHTML`, opened files and pasted content go through DOMPurify plus the editor's allow-lists. | The HTML your API receives, before storing or publishing it.     |
| Protects         | The person editing: nothing pasted or opened runs scripts in the editor.                                        | Your readers: whatever reaches your database is safe to display. |
| Can be bypassed? | Yes — anyone can call your API directly, without the editor.                                                    | No, if every write goes through it.                              |

**Server recipe** — [`docs/recipes/sanitize-on-server.ts`](recipes/sanitize-on-server.ts), for
Node.js (`npm install dompurify jsdom`):

```ts
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const purify = createDOMPurify(new JSDOM('').window)

purify.addHook('afterSanitizeAttributes', (node) => {
  // Links saved by the editor open in a new tab: keep target, always with a safe rel
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
  // Only contenteditable="false" (the text box drag handle) is kept
  if (node.hasAttribute('contenteditable') && node.getAttribute('contenteditable') !== 'false') {
    node.removeAttribute('contenteditable')
  }
})

export function sanitizeOnServer(html: string): string {
  return purify.sanitize(html, {
    ADD_ATTR: ['target', 'contenteditable'],
    FORBID_TAGS: [
      'svg',
      'math',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'iframe',
      'object',
      'embed',
      'style',
    ],
  })
}
```

_Verified in CI_ (`tests/unit/recipes.test.ts`): every HTML output recorded by the browser tests
passes through unchanged (only re-parsed), and the 42 XSS vectors come out without scripts, event
handlers or `javascript:`/`data:` links. Keep `style` and `class` attributes: formatting, image
positions and text boxes depend on them.

**Pasted from Word with `pasteSpacing="preserve"`.** The content carries paragraph spacing,
indents and line spacing as inline styles in pt (`margin-top`, `margin-bottom`, `margin-left`,
`text-indent`, `line-height`), and Word lists as `ul`/`ol` with `start`, `type`,
`list-style-type`, `padding-left` and margins. The recipe above keeps all of it (it keeps the
`style` attribute and the list attributes); a stricter sanitizer must allow these properties, or
the layout from Word is lost on save. The editor accepts them on load with the same limits,
whatever `pasteSpacing` says. _Verified:_ `tests/unit/word-spacing.test.ts`,
`tests/unit/word-lists.test.ts` and `tests/unit/word-clipboard.test.ts` (HTML copied from the
Word clipboard).

## Saving content

Read the HTML from `onChange` (every change) or from the ref (`getHTML()`, when saving):

```tsx
const editor = useRef<VersaEditHandle>(null)

async function save() {
  const html = editor.current!.getHTML()
  await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  // The server calls sanitizeOnServer(html) before storing it
}
```

The file buttons (Save/Open `.html`) are for the end user's own files. To send the toolbar's Save
button to your backend instead of downloading, pass `onSave={(html) => …}`.
_Verified:_ `getHTML`, `onChange` and `onSave` in the example tests (`examples/vite-react`).

## Keeping the editing area size

With `resizable`, people can resize the editing area (see
[Resizable editing area](../README.md#resizable-editing-area)). The size is not part of the HTML:
store it yourself when the resize ends and pass it back on the next visit.

```tsx
const [size, setSize] = useState(() => readSavedSize() ?? { width: 720, height: 400 })

<VersaEdit
  width={size.width}
  height={size.height}
  resizable={{ minWidth: 320 }}
  sizeControls
  onResize={(next, phase) => {
    if (phase === 'end') saveSize(next) // localStorage, user profile...
  }}
/>
```

Passing the saved size as `width` and `height` also makes it the content limit of
`truncateOnOverflow`. To keep a fixed content limit and restore only the visible size, keep
`width`/`height` fixed and call `editor.current!.setSize(saved)` after mounting (it does not call
`onResize`). `onResize` is called once with `'end'` for each change made by the arrow keys or the
size fields, and `'start'`/`'move'`/`'end'` while dragging. _Verified:_
`tests/e2e/editor-resize.spec.ts` and `tests/e2e/editor-resize-api.spec.ts`.

## Settings panel: your options in the toolbar

`settingsPanel` puts a gear at the end of the toolbar that opens your own content (see
[Settings panel](../README.md#settings-panel)). A common use is letting each person choose editor
preferences that your application stores:

```tsx
type Prefs = { pasteSpacing: 'remove' | 'preserve'; height: number }

function PostEditor({ prefs, savePrefs }: { prefs: Prefs; savePrefs: (p: Prefs) => void }) {
  return (
    <VersaEdit
      // Without width, the editor fills its container; the height comes from the preferences
      height={prefs.height}
      pasteSpacing={prefs.pasteSpacing}
      settingsPanel={(close) => (
        <>
          <label>
            <input
              type="checkbox"
              checked={prefs.pasteSpacing === 'preserve'}
              onChange={(e) =>
                savePrefs({ ...prefs, pasteSpacing: e.target.checked ? 'preserve' : 'remove' })
              }
            />
            Keep Word spacing when pasting
          </label>
          <label>
            Height{' '}
            <select
              value={prefs.height}
              onChange={(e) => savePrefs({ ...prefs, height: Number(e.target.value) })}
            >
              <option value={500}>500 px</option>
              <option value={700}>700 px</option>
            </select>
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

The panel content is ordinary React: the editor does not save it, does not read it and does not put
it in the HTML. Use your own labels and controls with accessible names; the panel is announced as a
dialog named after `labels.settings`. _Verified:_ `tests/e2e/settings-panel.spec.ts` (position,
closing, keyboard, ARIA, default size) and `tests/unit/ssr.test.ts` (server rendering).

## Supabase

Use only the **public** key (`anon` or `sb_publishable_…`) in the browser, with **Row Level
Security** on every table and bucket. The `service_role` (or `sb_secret_…`) key bypasses RLS: it must
never be in front-end code, in `VITE_`/`NEXT_PUBLIC_` variables or in the repository.

```sql
create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references auth.users (id),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

create policy "Anyone can read posts" on public.posts
  for select to anon, authenticated using (true);
create policy "Authors insert their posts" on public.posts
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors update their posts" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
```

**Sanitization with Supabase:** with RLS, a signed-in user can still write any HTML directly
through the API, bypassing the editor. Either send writes through a server function (Edge Function or
your own API route) that sanitizes before inserting, or sanitize on the server when rendering
(`sanitizeOnServer` before `dangerouslySetInnerHTML`).

_Not verified against a live project_ — the SQL follows the Supabase documentation; the VersaEdit
parts it relies on (`getHTML`, `onImageUpload`) are tested.

## Image upload

Without `onImageUpload`, inserted images are stored inside the HTML as base64 (large content). With
it, the file goes to your storage and only the URL goes into the HTML:

```tsx
<VersaEdit
  onImageUpload={async (file) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const ext = file.type.split('/')[1] ?? 'png'
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('post-images').upload(path, file)
    if (error) throw error // the editor reports it through onError (code "image-upload")
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }}
  onError={(e) => toast(e.message)}
/>
```

```sql
-- Bucket "post-images" (public for reading). Each user writes only in their own folder.
create policy "Users upload to their folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

_Verified:_ `onImageUpload` success and failure (`onError` with `image-upload`) in the example tests,
with a simulated upload. The Supabase calls are not executed in CI.

## Next.js

VersaEdit uses the browser: render it inside a Client Component. Next.js still renders it on the
server and hydrates it.

```tsx
// app/Editor.tsx
'use client'
import { VersaEdit } from 'versaedit'

export function Editor({ initialContent }: { initialContent: string }) {
  return <VersaEdit initialContent={initialContent} width="100%" height={400} />
}
```

Import the CSS files from any component or layout (`import 'versaedit/versaedit-content.css'`).
_Verified:_ [`examples/nextjs`](../examples/nextjs) (Next.js 16, App Router) — server HTML, hydration
without errors (with and without speech recognition), editing.

## Content Security Policy

By default the editor adds one `<style>` element. With a CSP that blocks it, import the stylesheet
and turn injection off:

```tsx
import 'versaedit/versaedit.css'
;<VersaEdit injectStyles={false} />
```

Formatting is stored in `style` attributes inside the content, so the CSP must allow them
(`style-src-attr 'unsafe-inline'`, or no `style-src-attr` restriction) on pages that display it.
_Verified:_ "Strict CSP" tab of `examples/vite-react` (no `<style>` element, same appearance).

## Displaying saved content

```tsx
import 'versaedit/versaedit-content.css'

;<div className="versaedit-content" dangerouslySetInnerHTML={{ __html: sanitizeOnServer(html) }} />
```

`versaedit-content.css` positions images, draws text boxes (hiding their drag handle) and styles
tables, quotes and code. _Verified:_ "Display content" tab of `examples/vite-react` and the Next.js
example.

Floated objects side by side (images and text boxes) stay responsive only when
`versaedit-content.css` is loaded: it moves the later object below the earlier one when the text
column between them would be too narrow at the container's actual width (container query on
`.versaedit-content`). For this, `.versaedit-content` must get its width from the available layout,
like a block element, and not size itself to its content (for example, not as a shrink-to-fit flex
item or `inline-block`).

**Same appearance as the editor (Layout Mirror).** Add `layoutMirror` to the editor and the
`ve-mirror` class to the container: `<div className="versaedit-content ve-mirror">`. The text is
then isolated from the site's element rules on both sides, and lines break at the same points
when the container has the editing area's usable width (`width` − frame − 32 px). The saved HTML
is the same with or without it. See [Layout Mirror](../README.md#layout-mirror). _Verified:_
`tests/e2e/layout-mirror.spec.ts` (computed styles and real positions compared element by element,
in Chromium, Firefox and WebKit, with and without an aggressive site stylesheet).
