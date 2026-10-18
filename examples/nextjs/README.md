# VersaEdit — Next.js (App Router) example

- `app/page.tsx` — Server Component: renders the page and published content (with
  `versaedit-content.css`, imported in `app/layout.tsx`).
- `app/Editor.tsx` — Client Component (`'use client'`) with `VersaEdit`. Next.js renders it on the
  server, then hydrates it in the browser.

Covered by `tests/package/nextjs.spec.ts` (production build served by `next start`). Run it from
the repository root with `npm run test:package -- nextjs`; the script copies this folder to a
temporary directory and installs the packed `.tgz` there.
