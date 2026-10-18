import { useEffect, useState, type ComponentType } from 'react'
import { Basic } from './examples/Basic'
import { Customized } from './examples/Customized'
import { DisplayContent } from './examples/DisplayContent'
import { ExternalDictation } from './examples/ExternalDictation'
import { Integration } from './examples/Integration'
import { StrictCsp } from './examples/StrictCsp'

// One tab per example; the address (#basic, #integration…) opens a tab directly
const EXAMPLES: { id: string; title: string; Component: ComponentType }[] = [
  { id: 'basic', title: 'Basic', Component: Basic },
  { id: 'integration', title: 'Integration', Component: Integration },
  { id: 'customized', title: 'Customized', Component: Customized },
  { id: 'csp', title: 'Strict CSP', Component: StrictCsp },
  { id: 'display', title: 'Display content', Component: DisplayContent },
  { id: 'dictation', title: 'External dictation', Component: ExternalDictation },
]

const current = () => EXAMPLES.find((e) => `#${e.id}` === location.hash) ?? EXAMPLES[0]

export function App() {
  const [example, setExample] = useState(current)
  useEffect(() => {
    const onHash = () => setExample(current())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <main>
      <h1>VersaEdit — Vite + React</h1>
      <nav className="tabs">
        {EXAMPLES.map((e) => (
          <a key={e.id} href={`#${e.id}`} aria-current={e.id === example.id ? 'page' : undefined}>
            {e.title}
          </a>
        ))}
      </nav>
      <example.Component key={example.id} />
    </main>
  )
}
