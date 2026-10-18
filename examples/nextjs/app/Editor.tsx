'use client'
// VersaEdit uses the browser (state, events, contentEditable): render it from a
// Client Component. Next.js still renders it on the server first, then hydrates.
import { useState } from 'react'
import { VersaEdit } from 'versaedit'

export function Editor({ initialContent }: { initialContent: string }) {
  const [html, setHtml] = useState(initialContent)
  return (
    <>
      <VersaEdit initialContent={html} onChange={setHtml} width="100%" height={300} />
      <p data-testid="length">{html.length} characters</p>
    </>
  )
}
