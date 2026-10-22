# VersaEdit

Editor de texto enriquecido ligero para aplicaciones React.

> **Beta** (`0.5.0-beta.1`) — la API puede cambiar antes de la 1.0; consulte las [Limitaciones conocidas](#limitaciones-conocidas).
> <!-- release:pending -->**Aún no publicado en npm.**<!-- /release:pending -->

[versaedit.dev](https://versaedit.dev/es/) · [Playground](https://versaedit.dev/playground/) ·
[Read in English](README.md) · [Leia em português](README.pt-BR.md)

VersaEdit edita HTML con el `contentEditable` del propio navegador y añade una barra de herramientas,
saneamiento (DOMPurify), deshacer/rehacer propio, limpieza del contenido pegado desde páginas web y
Word, imágenes, cuadros de texto, tablas, dictado y abrir/guardar archivo. No depende de un backend:
entrega HTML y usted lo guarda donde quiera (Supabase, Firebase, REST…).

- React 18.3+ o 19 · renderizado en el servidor (probado con Next.js)
- Una sola dependencia en tiempo de ejecución: [DOMPurify](https://github.com/cure53/DOMPurify) ·
  solo módulos ES (sin versión CommonJS) · tipos TypeScript para bundlers y
  `moduleResolution: node16/nodenext`
- Interfaz en inglés, portugués de Brasil y español (`locale`), con todos los textos reemplazables
  (`labels`)

## Instalación

```bash
npm install versaedit@beta
```

## Inicio rápido

```tsx
import { useRef } from 'react'
import { VersaEdit, type VersaEditHandle } from 'versaedit'

export function PostEditor({
  initialHtml,
  onSave,
}: {
  initialHtml: string
  onSave: (html: string) => void
}) {
  const editor = useRef<VersaEditHandle>(null)
  return (
    <>
      <VersaEdit
        ref={editor}
        initialContent={initialHtml}
        onChange={(html) => console.log('changed', html.length)}
        width="100%"
        height={480}
        locale="es"
      />
      <button onClick={() => onSave(editor.current!.getHTML())}>Guardar</button>
    </>
  )
}
```

`initialContent` se carga (y se sanea) cuando cambia; el editor ignora el eco de su propio
`onChange`, así que puede usarlo como valor controlado.

## Props

| Prop                                                 | Tipo                                                | Valor predeterminado      | Descripción                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `initialContent`                                     | `string`                                            | `''`                      | HTML que se carga. Los cambios externos recargan el editor (y reinician el deshacer).                                    |
| `onChange`                                           | `(html) => void`                                    | —                         | Se llama cuando el HTML cambia de verdad.                                                                                |
| `onOverflowChange`                                   | `(boolean) => void`                                 | —                         | El contenido cabe / no cabe en la altura del editor.                                                                     |
| `onFocus` / `onBlur`                                 | `() => void`                                        | —                         | El foco entró en el editor / salió de él (los botones de la barra mantienen el foco).                                    |
| `onError`                                            | `(VersaEditError) => void`                          | `alert()`                 | Errores y avisos con un `code` estable (ver abajo).                                                                      |
| `onConfirm`                                          | `(VersaEditConfirm) => boolean \| Promise<boolean>` | `confirm()`               | Confirmaciones (p. ej., reemplazar el contenido al abrir un archivo).                                                    |
| `onSave`                                             | `(html) => void`                                    | descarga                  | El botón Guardar entrega el HTML en lugar de descargar un archivo `.html`.                                               |
| `onImageUpload`                                      | `(file) => Promise<url>`                            | base64                    | Sube las imágenes e inserta la URL devuelta (recomendado).                                                               |
| `width`                                              | `number \| string`                                  | `640`                     | Ancho total; un número son px, una cadena es CSS (`'100%'`).                                                             |
| `height`                                             | `number`                                            | `480`                     | Altura total en px.                                                                                                      |
| `toolbarWidth`                                       | `number \| string`                                  | `width`                   | Ancho de la barra (los números la centran sobre el editor).                                                              |
| `frame`                                              | `{ width, color, radius } \| false`                 | `1px #d0d7de, 8px`        | Borde alrededor del área de edición.                                                                                     |
| `accentColor`                                        | `string`                                            | `#2563eb`                 | Contornos de selección, cuadros de texto, controladores.                                                                 |
| `fontFamily` / `headingFontFamily`                   | `string`                                            | fuente del sistema        | Fuentes del texto y de los títulos.                                                                                      |
| `fontFamilies` / `fontSizes`                         | arrays                                              | predeterminados           | Menú de fuentes (`{ label, value }`) y tamaños (pt).                                                                     |
| `colorPalette` / `highlightColors`                   | `string[]`                                          | predeterminados           | Colores de texto/papel y del resaltador (`'transparent'` = ninguno).                                                     |
| `loadGoogleFonts`                                    | `string[]`                                          | —                         | Familias que se cargan desde Google Fonts (desactivado por defecto).                                                     |
| `toolbar`                                            | `ToolbarGroup[]`                                    | todos                     | Grupos de la barra que se muestran (ver abajo). `[]` oculta la barra.                                                    |
| `showFileButtons`                                    | `boolean`                                           | `true`                    | Botones Guardar/Abrir archivo.                                                                                           |
| `showDictation` / `speechLang` / `speechRecognition` | —                                                   | `true` / locale / navegador | Dictado (ver abajo).                                                                                                   |
| `pasteImages`                                        | `boolean`                                           | `true`                    | Conserva las imágenes al pegar (ver Seguridad).                                                                          |
| `allowExternalMedia`                                 | `boolean`                                           | `false`                   | Permite que `<audio>`/`<video>` del contenido cargado se carguen dentro del editor.                                      |
| `scrollable`                                         | `boolean`                                           | `true`                    | El área de edición se desplaza cuando el contenido es más alto. `false`: lo que sobra se oculta, como un bloque de altura fija. |
| `truncateOnOverflow`                                 | `boolean`                                           | `false`                   | Recorta el contenido que supera la altura del editor.                                                                    |
| `singleLineBreaks`                                   | `boolean`                                           | `false`                   | Pegado: reduce las líneas en blanco consecutivas.                                                                        |
| `injectStyles`                                       | `boolean`                                           | `true`                    | Inyecta el CSS del editor; use `false` e importe el archivo CSS en su lugar.                                             |
| `locale` / `labels`                                  | `'en' \| 'pt-BR' \| 'es'` / parcial                 | `'en'`                    | Idioma de la interfaz y textos reemplazados.                                                                             |
| `contentClassName` / `contentStyle` / `placeholder`  | —                                                   | —                         | Clase, estilo y texto de ejemplo del área de edición.                                                                    |

**Grupos de la barra** (`TOOLBAR_GROUPS`, siempre en este orden): `dictation`, `file`, `history`,
`font`, `block`, `format`, `highlight`, `color`, `align`, `list`, `indent`, `link`, `insert`,
`textbox`, `clear`. Sin `format`, Ctrl+B/I/U no formatean; sin `link`, Ctrl+K no abre el
formulario de enlace. Los atajos de deshacer/rehacer siempre funcionan.

**Códigos de error** (`VersaEditError.code`): `file-wrong-type`, `file-too-large`, `file-read`,
`file-empty`, `file-truncated` (nivel `warning`), `image-upload` (con el error original en `cause`).

## Métodos del ref (`VersaEditHandle`)

`getHTML()` · `setHTML(html)` (reinicia el deshacer) · `focus()` · `clear()` · `undo()` · `redo()` ·
`core` (el `VersaEditCore` subyacente, **experimental**).

## CSS

El editor inyecta su CSS por defecto. En sitios con una política de seguridad de contenido (CSP)
estricta, desactive la inyección e importe el archivo:

```tsx
import 'versaedit/versaedit.css'
;<VersaEdit injectStyles={false} />
```

Para **mostrar** el contenido guardado en su sitio, envuélvalo e incluya la hoja de estilos de
contenido (posiciones de imágenes, cuadros de texto con el controlador de arrastre oculto, tablas,
código, citas):

```tsx
import 'versaedit/versaedit-content.css'
;<div className="versaedit-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

El formato, como colores y tamaños de fuente, se guarda en atributos `style` en línea; una CSP que
bloquee los atributos de estilo en línea (`style-src-attr`) no lo mostrará.

## Ejemplos y guías

- [Guía de integración](docs/integration.md) (en inglés): saneamiento en el servidor, guardado,
  Supabase (clave pública + RLS), subida de imágenes, Next.js, CSP, visualización del contenido.
- [`examples/vite-react`](examples/vite-react): una pestaña por caso de uso (básico, callbacks de
  integración, barra personalizada, CSP estricta, visualización, dictado externo).
- [`examples/nextjs`](examples/nextjs): Next.js 16 App Router con renderizado en el servidor.
- Playground (`npm run dev`): abra **Show HTML → Properties** para cambiar las props en vivo, cargar
  contenido de ejemplo, ver los eventos y copiar el JSX equivalente.

Los dos ejemplos se ejecutan en CI con el paquete empaquetado (`npm pack`), instalado fuera del
repositorio.

## Dictado

Un botón de micrófono convierte la voz en texto con la Web Speech API del navegador (Chrome, Edge,
Safari; oculto en Firefox), en el idioma de la interfaz (`en-US`, `pt-BR` o `es-ES`; `speechLang`
lo cambia). La puntuación hablada funciona ("comma", "period", "new line"… en inglés; "vírgula",
"ponto final", "nova linha"… en pt-BR; "coma", "punto final", "nueva línea"… en español; en español
solo se escriben los signos de cierre ? y !, no ¿ ni ¡). **Privacidad:** estos navegadores procesan
el audio en los servidores del fabricante (Google, Microsoft, Apple). Pase `speechRecognition` para
usar otro motor con la misma interfaz, o `showDictation={false}` para quitarlo. `VersaEditDictation`
muestra el micrófono en cualquier lugar de la página (`<VersaEditDictation editor={ref} />`).

## Seguridad

Informe de vulnerabilidades de forma privada — consulte [SECURITY.md](SECURITY.md)
(support@versaedit.dev).

- Toda entrada de HTML (contenido inicial, archivos abiertos, pegado) pasa por DOMPurify y por las
  listas de permitidos del propio editor; se eliminan scripts, manejadores de eventos, enlaces
  `javascript:` y SVG. Una batería de 42 vectores de XSS se ejecuta en CI.
- **Vuelva a sanear en su servidor** antes de guardar o publicar: el editor se ejecuta en el
  navegador del usuario y puede eludirse. La
  [guía de integración](docs/integration.md#sanitization-browser-and-server) tiene una receta de
  servidor probada.
- `pasteImages` (por defecto `true`): las imágenes pegadas siguen apuntando al sitio original — los
  navegadores de los lectores las pedirán allí, y ese sitio puede cambiarlas o eliminarlas. Use
  `onImageUpload`, o `pasteImages={false}`.
- El audio y el vídeo externos del contenido cargado no se cargan dentro del editor
  (`allowExternalMedia`), y el HTML que recibe no cambia.

## Teclado

| Teclas                          | Acción                                                   |
| ------------------------------- | -------------------------------------------------------- |
| Ctrl+B / I / U                  | Negrita / cursiva / subrayado                            |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z)   | Deshacer, rehacer                                        |
| Ctrl+K                          | Formulario de enlace (Enter aplica, Esc cancela)         |
| Tab                             | Inserta espacios                                         |
| Supr / Retroceso                | Elimina la imagen seleccionada                           |
| Ctrl+flechas (Mayús: 10px)      | Desplaza la imagen o el cuadro de texto seleccionado     |
| Alt+↑/↓, Alt+←/→                | Lo mueve en el flujo del texto / lo hace flotar a la izquierda o a la derecha |
| ←/→, Inicio/Fin, Esc (barra)    | Recorre los controles de la barra, cierra las paletas    |

## Compatibilidad con navegadores

Las pruebas automáticas se ejecutan en cada push en Chromium (Chrome/Edge). Firefox y WebKit
(Safari) se ejecutan como diagnóstico
(`VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit`):

| Navegador       | Estado                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome, Edge    | Todas las pruebas pasan.                                                                                                                |
| Firefox         | Funciona; el HTML difiere en detalles (p. ej., imágenes insertadas dentro del párrafo). El pegado no está cubierto por pruebas automáticas en Firefox. |
| Safari (WebKit) | Funciona; las listas reciben `<span style="font-size">` adicionales; las demás diferencias son estéticas.                               |

## Limitaciones conocidas

- Se basa en `document.execCommand` (antiguo, pero compatible con todos los navegadores); el HTML
  generado varía ligeramente entre navegadores.
- Deshacer/rehacer: después de deshacer en el editor, el Rehacer del propio navegador (menú
  Edición o contextual) puede no estar disponible; Ctrl+Y y el botón Rehacer funcionan. La
  escritura con teclados IME del sistema (japonés, chino, coreano) y los menús de Safari aún no se
  han verificado manualmente.
- Después del resaltador o de un color personalizado, la negrita se guarda como
  `<span style="font-weight: bold">` en lugar de `<b>` (funciona igual).
- El pegado desde Microsoft Word aún no se ha validado con documentos reales.
- Solo exporta HTML (sin JSON ni Markdown).

## Desarrollo

```bash
npm install
npm run dev        # playground en http://localhost:5180
npm run build      # build de la biblioteca (dist/)
npm run lint
npm run typecheck
npm test           # pruebas unitarias (Vitest) + pruebas de navegador (Playwright)
npm run test:package  # npm pack → instalación en copias de examples/ → tipos, build, pruebas de navegador
npm run test:site     # sitio público (versaedit.dev + /playground/) generado en site/ y probado
```

Las pruebas de navegador usan `playground/harness.html`. En local se ejecutan en el Microsoft Edge
instalado; en CI, en el Chromium de Playwright (con React 19 y React 18). Los resultados de
referencia están en `tests/e2e/__snapshots__/` — después de un cambio de comportamiento
intencionado, ejecute `npm run test:e2e -- --update-snapshots` y revise las diferencias.

## Licencia

[MIT](LICENSE)
