import { VersaEdit, type ToolbarGroup } from 'versaedit'

// Only some toolbar groups (shown in the library's fixed order)
const TOOLBAR: ToolbarGroup[] = ['history', 'format', 'color', 'list', 'link', 'clear']

// Brand colors, fonts and frame, Portuguese interface, fluid width
export function Customized() {
  return (
    <VersaEdit
      initialContent="<p>Barra reduzida, cores e fontes da marca.</p>"
      locale="pt-BR"
      toolbar={TOOLBAR}
      width="100%"
      height={260}
      accentColor="#0f766e"
      fontFamily="Georgia, serif"
      colorPalette={['#000000', '#0f766e', '#b45309', '#be123c', '#ffffff']}
      frame={{ width: 2, color: '#0f766e', radius: 4 }}
      placeholder="Escreva aqui…"
    />
  )
}
