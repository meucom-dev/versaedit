import type { ReactNode } from 'react'
// Stylesheet for displaying saved content (wrap it in .versaedit-content)
import 'versaedit/versaedit-content.css'

export const metadata = { title: 'VersaEdit — Next.js example', icons: 'data:,' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  )
}
