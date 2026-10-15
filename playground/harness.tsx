// Página usada pelos testes de navegador (tests/e2e): monta um VersaEdit com as
// props pedidas e guarda o que ele emite em window.__out.
import { createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { VersaEdit, type VersaEditHandle, type VersaEditProps } from '../src'

export interface HarnessOptions {
  /** onImageUpload: 'ok' devolve https://cdn.example.com/<nome>; 'fail' rejeita */
  upload?: 'ok' | 'fail'
  /** Liga o onSave (o botão Salvar entrega o HTML em vez de baixar) */
  onSave?: boolean
  /** Liga o onOverflowChange */
  overflow?: boolean
}

export interface HarnessOutput {
  html: string | null
  overflow: boolean | null
  saved: string | null
  changes: number
}

declare global {
  interface Window {
    __mount: (props: Partial<VersaEditProps>, options?: HarnessOptions) => Promise<void>
    __out: HarnessOutput
    __ref: { current: VersaEditHandle | null }
  }
}

let root: Root | null = null

window.__mount = async (props, options = {}) => {
  root?.unmount()
  const out: HarnessOutput = { html: null, overflow: null, saved: null, changes: 0 }
  window.__out = out
  const ref = createRef<VersaEditHandle>()
  window.__ref = ref
  root = createRoot(document.getElementById('host')!)
  root.render(
    <VersaEdit
      ref={ref}
      width={900}
      height={420}
      {...props}
      onChange={(html) => {
        out.html = html
        out.changes++
      }}
      onOverflowChange={options.overflow !== false ? (value) => (out.overflow = value) : undefined}
      onSave={options.onSave ? (html) => (out.saved = html) : undefined}
      onImageUpload={
        options.upload === 'ok'
          ? (file) => Promise.resolve(`https://cdn.example.com/${file.name}`)
          : options.upload === 'fail'
            ? () => Promise.reject(new Error('upload failed'))
            : undefined
      }
    />,
  )
  await new Promise((resolve) => setTimeout(resolve, 150))
}
