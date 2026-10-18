# Integration guide

[Leia em português](integration.pt-BR.md)

Recipes for using VersaEdit in a real application. Each recipe says how it was verified.

- [Sanitization: browser and server](#sanitization-browser-and-server)
- [Saving content](#saving-content)
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
