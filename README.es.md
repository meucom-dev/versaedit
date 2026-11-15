# VersaEdit

Editor de texto enriquecido ligero para aplicaciones React.

> **Beta** (`0.5.0-beta.1`) — la API puede cambiar antes de la 1.0; consulte las [Limitaciones conocidas](#limitaciones-conocidas).

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

| Prop                                                 | Tipo                                                | Valor predeterminado        | Descripción                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `initialContent`                                     | `string`                                            | `''`                        | HTML que se carga. Los cambios externos recargan el editor (y reinician el deshacer).                                                |
| `onChange`                                           | `(html) => void`                                    | —                           | Se llama cuando el HTML cambia de verdad.                                                                                            |
| `onOverflowChange`                                   | `(boolean) => void`                                 | —                           | El contenido cabe / no cabe en la altura del editor.                                                                                 |
| `onResize`                                           | `(size, phase) => void`                             | —                           | La persona redimensionó el área de edición: `'start'`, `'move'`, `'end'` ([detalles](#área-de-edición-redimensionable)).             |
| `onFocus` / `onBlur`                                 | `() => void`                                        | —                           | El foco entró en el editor / salió de él (los botones de la barra mantienen el foco).                                                |
| `onError`                                            | `(VersaEditError) => void`                          | `alert()`                   | Errores y avisos con un `code` estable (ver abajo).                                                                                  |
| `onConfirm`                                          | `(VersaEditConfirm) => boolean \| Promise<boolean>` | `confirm()`                 | Confirmaciones (p. ej., reemplazar el contenido al abrir un archivo).                                                                |
| `onSave`                                             | `(html) => void`                                    | descarga                    | El botón Guardar entrega el HTML en lugar de descargar un archivo `.html`.                                                           |
| `onImageUpload`                                      | `(file) => Promise<url>`                            | base64                      | Sube las imágenes e inserta la URL devuelta (recomendado).                                                                           |
| `width`                                              | `number \| string`                                  | `'100%'`                    | Ancho total; un número son px, una cadena es CSS. Nunca supera el contenedor ([Tamaño](#tamaño)).                                    |
| `height`                                             | `number`                                            | `500`                       | Altura del área de edición en px (altura inicial con `resizable`).                                                                   |
| `resizable`                                          | `boolean \| ResizableOptions`                       | `false`                     | Controladores para redimensionar el área de edición ([detalles](#área-de-edición-redimensionable)).                                  |
| `sizeControls`                                       | `boolean`                                           | `false`                     | Campos de ancho y alto (px) debajo del área de edición (con `resizable`).                                                            |
| `settingsPanel`                                      | `ReactNode \| (close) => ReactNode`                 | —                           | Su propia configuración, en un panel que abre un engranaje al final de la barra ([Panel de configuración](#panel-de-configuración)). |
| `toolbarWidth`                                       | `number \| string`                                  | `width`                     | Ancho de la barra (los números la centran sobre el editor).                                                                          |
| `frame`                                              | `{ width, color, radius } \| false`                 | `1px #d0d7de, 8px`          | Borde alrededor del área de edición.                                                                                                 |
| `objectMargin`                                       | `{ text, outer, top, bottom }`                      | `16, 0, 4, 12`              | Espacio alrededor de imágenes y cuadros de texto, por lado, en px ([Margen de los objetos](#margen-de-los-objetos)).                 |
| `accentColor`                                        | `string`                                            | `#2563eb`                   | Contornos de selección, cuadros de texto, controladores.                                                                             |
| `fontFamily` / `headingFontFamily`                   | `string`                                            | fuente del sistema          | Fuentes del texto y de los títulos.                                                                                                  |
| `fontFamilies` / `fontSizes`                         | arrays                                              | predeterminados             | Menú de fuentes (`{ label, value }`) y tamaños (pt).                                                                                 |
| `colorPalette` / `highlightColors`                   | `string[]`                                          | predeterminados             | Colores de texto/papel y del resaltador (`'transparent'` = ninguno).                                                                 |
| `loadGoogleFonts`                                    | `string[]`                                          | —                           | Familias que se cargan desde Google Fonts (desactivado por defecto).                                                                 |
| `toolbar`                                            | `ToolbarGroup[]`                                    | todos                       | Grupos de la barra que se muestran (ver abajo). `[]` oculta la barra (con `settingsPanel`, queda solo el engranaje).                 |
| `showFileButtons`                                    | `boolean`                                           | `true`                      | Botones Guardar/Abrir archivo.                                                                                                       |
| `showDictation` / `speechLang` / `speechRecognition` | —                                                   | `true` / locale / navegador | Dictado (ver abajo).                                                                                                                 |
| `pasteImages`                                        | `boolean`                                           | `true`                      | Conserva las imágenes al pegar (ver Seguridad).                                                                                      |
| `pasteSpacing`                                       | `'remove' \| 'preserve'`                            | `'remove'`                  | Pegar desde Word: conserva espaciado, sangrías, líneas en blanco y listas ([detalles](#pegar-desde-word)).                           |
| `allowExternalMedia`                                 | `boolean`                                           | `false`                     | Permite que `<audio>`/`<video>` del contenido cargado se carguen dentro del editor.                                                  |
| `scrollable`                                         | `boolean`                                           | `true`                      | El área de edición se desplaza cuando el contenido es más alto. `false`: lo que sobra se oculta, como un bloque de altura fija.      |
| `truncateOnOverflow`                                 | `boolean`                                           | `false`                     | Recorta el contenido que supera la altura del editor.                                                                                |
| `singleLineBreaks`                                   | `boolean`                                           | `false`                     | Pegado: reduce las líneas en blanco consecutivas.                                                                                    |
| `injectStyles`                                       | `boolean`                                           | `true`                      | Inyecta el CSS del editor; use `false` e importe el archivo CSS en su lugar.                                                         |
| `locale` / `labels`                                  | `'en' \| 'pt-BR' \| 'es'` / parcial                 | `'en'`                      | Idioma de la interfaz y textos reemplazados.                                                                                         |
| `contentClassName` / `contentStyle` / `placeholder`  | —                                                   | —                           | Clase, estilo y texto de ejemplo del área de edición.                                                                                |
| `layoutMirror`                                       | `boolean`                                           | `false`                     | Aísla el área de edición del CSS de la página, para que el contenido publicado se vea igual ([Layout Mirror](#layout-mirror)).       |

**Grupos de la barra** (`TOOLBAR_GROUPS`, siempre en este orden): `dictation`, `file`, `history`,
`font`, `block`, `format`, `highlight`, `color`, `align`, `list`, `indent`, `link`, `insert`,
`textbox`, `clear`. Sin `format`, Ctrl+B/I/U no formatean; sin `link`, Ctrl+K no abre el
formulario de enlace. Los atajos de deshacer/rehacer siempre funcionan.

**Códigos de error** (`VersaEditError.code`): `file-wrong-type`, `file-too-large`, `file-read`,
`file-empty`, `file-truncated` (nivel `warning`), `image-upload` (con el error original en `cause`).

## Métodos del ref (`VersaEditHandle`)

`getHTML()` · `setHTML(html)` (reinicia el deshacer) · `focus()` · `clear()` · `undo()` · `redo()` ·
`getSize()` · `setSize({ width?, height? })` ([Área de edición redimensionable](#área-de-edición-redimensionable)) ·
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

Los objetos flotantes lado a lado (imágenes y cuadros de texto) solo son responsivos con
`versaedit-content.css` cargado: hace que el objeto siguiente baje debajo del anterior cuando la
columna de texto entre ellos quedaría demasiado estrecha en el ancho real del contenedor (consulta
de contenedor en `.versaedit-content`). Para ello, `.versaedit-content` debe recibir su ancho del
diseño disponible, como un elemento de bloque, y no dimensionarse según su propio contenido (por
ejemplo, no como elemento flex que se ajusta al contenido ni como `inline-block`).

El formato, como colores y tamaños de fuente, se guarda en atributos `style` en línea; una CSP que
bloquee los atributos de estilo en línea (`style-src-attr`) no lo mostrará.

### Tamaño

Sin `width` ni `height`, el editor ocupa todo el ancho de su contenedor y el área de edición
empieza con 500 px de alto. Para fijarlo, use las props: un número son px, una cadena es cualquier
medida CSS (`'100%'`, `'40rem'`). El área de edición nunca es más ancha que su contenedor
(`max-width: 100%`); así, un ancho fijo se reduce en pantallas estrechas en lugar de crear
desplazamiento horizontal.

```tsx
<VersaEdit />                          {/* ancho del contenedor × 500 px */}
<VersaEdit width={800} height={500} /> {/* 800 × 500 px, más estrecho en pantallas pequeñas */}
```

### Margen de los objetos

Las imágenes y los cuadros de texto a la izquierda, a la derecha o centrados mantienen un margen
respecto al texto. `objectMargin` lo define por lado, en px:

| Lado     | Dónde                                                                                                                                                              | Predeterminado |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `text`   | Entre el objeto y el texto: el lado del texto en un objeto a la izquierda o a la derecha; arriba y abajo en un objeto centrado o en un cuadro de texto en el flujo | `16`           |
| `outer`  | El lado exterior de un objeto a la izquierda o a la derecha (`0` = alineado con el margen del texto); los laterales de un cuadro de texto en el flujo              | `0`            |
| `top`    | Arriba de un objeto a la izquierda o a la derecha                                                                                                                  | `4`            |
| `bottom` | Debajo de un objeto a la izquierda o a la derecha                                                                                                                  | `12`           |

Los lados que no indique quedan con el valor predeterminado; los valores negativos o inválidos se
ignoran, y los mayores de 200 quedan en 200. El margen no se guarda en el HTML: dé al contenedor
publicado los mismos valores con `objectMarginStyle()`, para que los objetos queden donde
estaban en el editor.

```tsx
import { objectMarginStyle, VersaEdit } from 'versaedit'

const margen = { text: 24, outer: 8 }

<VersaEdit objectMargin={margen} />

<div
  className="versaedit-content"
  style={objectMarginStyle(margen)}
  dangerouslySetInnerHTML={{ __html: htmlSanitizado }}
/>
```

`objectMarginStyle()` devuelve las variables CSS `--ve-object-text`, `--ve-object-outer`,
`--ve-object-top` y `--ve-object-bottom`; sin React, aplíquelas al elemento de edición y al
contenedor publicado. Cambiar `objectMargin` durante la edición rehace el punto en que los
objetos lado a lado deben bajar (`data-ve-stack`), sin tocar el historial de deshacer.

### Panel de configuración

`settingsPanel` agrega un botón de engranaje al final de la barra de herramientas. Abre un panel
con el contenido que proporciona su aplicación, como las opciones que sus usuarios pueden cambiar.
El editor no guarda ni interpreta ese contenido: los controles cambian el estado de su aplicación,
que vuelve al editor como props. Sin la prop no hay engranaje y nada cambia.

```tsx
function Editor() {
  const [spacing, setSpacing] = useState<'remove' | 'preserve'>('remove')
  return (
    <VersaEdit
      pasteSpacing={spacing}
      settingsPanel={(close) => (
        <>
          <label>
            <input
              type="checkbox"
              checked={spacing === 'preserve'}
              onChange={(e) => setSpacing(e.target.checked ? 'preserve' : 'remove')}
            />
            Conservar el espaciado de Word al pegar
          </label>
          <button type="button" onClick={close}>
            Listo
          </button>
        </>
      )}
    />
  )
}
```

- Contenido: cualquier nodo de React, o una función que recibe `close()`, que cierra el panel y
  devuelve el foco al engranaje.
- Posición: el engranaje es el último elemento de la barra, alineado a la derecha de su última
  fila. Nunca agrega una fila: la barra se divide exactamente igual que sin él. Con
  `toolbar={[]}`, la barra muestra solo el engranaje. El panel se abre debajo del engranaje,
  alineado con su borde derecho, con 260 a 360 px de ancho (nunca más que la pantalla menos
  16 px), y se desplaza cuando supera el 70% del alto de la pantalla. En pantallas estrechas se
  mantiene dentro del área visible.
- Teclado y lectores de pantalla: el engranaje es un botón de la barra (flechas, Inicio, Fin) con
  el nombre de `labels.settings` ("Configuración"), `aria-haspopup="dialog"` y `aria-expanded`. El
  panel es un diálogo no modal con el mismo nombre. Al abrirlo, el foco pasa al primer control;
  Tab y Shift+Tab recorren los controles, y Shift+Tab en el primero vuelve al engranaje.
- Cierre: el engranaje, Esc, un clic fuera, Tab después del último control, el inicio de un
  redimensionamiento del área o la apertura de otro menú de la barra. El engranaje y Esc devuelven
  el foco al engranaje. Un Esc ya gestionado por un control del panel (`event.preventDefault()`)
  no lo cierra.
- En el renderizado en el servidor solo sale el engranaje cerrado.

### Layout Mirror

Sin él, el contenido publicado adopta la tipografía de su sitio (fuentes, tamaños, espaciados), que
es lo que un sitio suele querer. Active Layout Mirror cuando el texto publicado deba verse
exactamente como durante la edición: misma fuente, tamaño, altura de línea, espacio de párrafos y
títulos, listas, citas, alineaciones, imágenes y cuadros de texto.

```tsx
// Edición: el área de edición ignora el CSS de la página
;<VersaEdit layoutMirror onChange={guardar} />

// Publicación: la misma hoja de contenido, más la clase ve-mirror
import 'versaedit/versaedit-content.css'
;<div className="versaedit-content ve-mirror" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

- El HTML guardado no cambia: el espejo es solo CSS y es opcional en ambos lados.
- Las líneas se cortan en los mismos puntos cuando el contenedor publicado tiene el mismo ancho útil
  que el área de edición: `width` menos el marco (1 px por lado, por defecto) menos 32 px de
  relleno (por ejemplo, 800 → 766 px). En columnas más estrechas el texto se reacomoda, y las imágenes y los
  cuadros de texto se reducen para caber.
- Un `fontFamily` / `headingFontFamily` propio se pasa con variables CSS:
  `style={{ '--ve-font': 'Georgia, serif', '--ve-heading-font': 'Inter, sans-serif' }}`.
- Las reglas de elemento de su sitio (`p {}`, `h2 {}`, `ul {}`…) no alcanzan el contenido
  reflejado. Las reglas que lo alcanzan mediante una clase (p. ej. `.post p {}`) son más
  específicas y siguen aplicándose, igual que las que usan `!important`: manténgalas lejos del
  contenedor `ve-mirror`.
- Sin React, agregue usted mismo la clase `ve-mirror` al elemento de edición.

### Área de edición redimensionable

Desactivada por defecto. Con `resizable`, los controladores en el borde derecho, el borde inferior y
la esquina entre ellos redimensionan el área de edición con el ratón, el dedo o las flechas (con el
controlador enfocado; Shift: 1 px). `sizeControls` agrega campos de ancho y alto debajo del área.

```tsx
<VersaEdit
  width={720}
  height={400}
  resizable={{ handles: ['e', 's', 'se', 'w'], minWidth: 320, maxHeight: 900 }}
  sizeControls
  onResize={(size, phase) => phase === 'end' && guardarTamano(size)}
/>
```

- Solo cambia el área visible: el HTML, el historial de deshacer, la selección y `onChange` no se
  ven afectados, y no se escribe nada en el documento.
- `handles`: cualquier combinación de `'e'`, `'s'`, `'se'` (por defecto), `'w'`, `'n'`, `'nw'`,
  `'ne'`, `'sw'`. Los controladores izquierdo y superior también agrandan el área al tirar hacia
  afuera; con el editor alineado a la izquierda en la página, el borde que se mueve es el opuesto.
  Un controlador lateral sin espacio junto al editor (editor a todo el ancho) se oculta, y la
  esquina sigue funcionando.
- Límites en px, marco incluido: `minWidth` (160), `maxWidth` (el ancho disponible; el área nunca
  sobrepasa su contenedor), `minHeight` (80), `maxHeight` (sin límite). Si el contenedor se vuelve
  más estrecho que el ancho elegido, el área se reduce para caber y avisa con `'end'`.
- `onResize(size, phase)`, tamaños en px con el marco: el arrastre llama `'start'`, luego `'move'`
  una vez por fotograma en que cambió el tamaño, luego `'end'`. Las flechas, los campos de tamaño
  y el contenedor que se reduce llaman solo `'end'`, y solo cuando el tamaño cambió. `setSize()` y
  nuevas props `width`/`height` no lo llaman; así, guardar el tamaño y restaurarlo con `setSize()`
  nunca entra en bucle.
- `getSize()` devuelve el tamaño visible (`null` antes de montar); `setSize()` aplica un tamaño
  dentro de los límites y lo devuelve (solo con `resizable`). Nuevas props `width`/`height`
  reemplazan el tamaño elegido.
- `truncateOnOverflow` y `onOverflowChange` siguen usando el `width`/`height` configurado:
  redimensionar nunca corta contenido, tampoco en la siguiente pulsación, pegado o carga, y un área
  más grande no permite más contenido. Lo que excede un área más pequeña se desplaza (incluso con
  `scrollable={false}`).
- Para conservar el tamaño entre visitas, guárdelo en `onResize` y devuélvalo como `width` y
  `height` (o llame a `setSize()`). Con [Layout Mirror](#layout-mirror), dé al contenedor publicado
  el ancho útil del tamaño elegido (`width` − marco − 32 px).
- Sin React: `createFrameResizer({ frame, content, handles, limits, onResize })` agrega los
  controladores a cualquier marco, y `core.setContentLimit({ width, height })` mantiene el límite de
  contenido en el tamaño configurado.

### Pegar desde Word

Por defecto (`pasteSpacing="remove"`), el texto pegado desde Microsoft Word sigue el espaciado del
sitio: el espacio entre párrafos, el interlineado, las sangrías y las líneas en blanco se
descartan, como siempre. Con `pasteSpacing="preserve"`, VersaEdit conserva el diseño de Word en el
HTML:

```tsx
<VersaEdit pasteSpacing="preserve" />
```

- El espacio antes y después de los párrafos, las sangrías izquierda y de primera línea y el
  interlineado se leen de los estilos de Word (incluidas las reglas de clase que Word envía, como
  `MsoNormal`) y se guardan como estilo en línea en pt, dentro de límites seguros: espaciado de 0 a
  72 pt, sangría izquierda de 0 a 144 pt, sangría de primera línea de −72 a 144 pt. Las líneas en
  blanco (párrafos vacíos) se conservan.
- Las listas de Word se convierten en listas `ul`/`ol` reales: niveles; viñetas, números, letras y
  romanos; numeración continuada tras un párrafo (`<ol start="4">`) o reiniciada; listas mixtas
  (elementos que vinieron de una página web más párrafos de Word de la misma lista); y la sangría de
  cada nivel, como estilo en línea de la lista. La viñeta dibujada por Word se quita; el texto del
  elemento queda como está.
- Interlineado: el "Múltiple" de Word (1,15, 1,5…) se aplica sobre la línea sencilla del navegador
  para la fuente, medida al pegar. Word y los navegadores toman la línea sencilla de métricas
  distintas de la misma fuente (de cerca de −8% a +6%; Aptos −7,7%), así que un documento largo se
  desplaza cerca de una línea cada trece. "Exacto" y "Mínimo" conservan su valor.
- Los documentos guardados conservan este espaciado al reabrirse, sea cual sea `pasteSpacing`: la
  opción solo decide lo que ocurre al pegar. Es CSS en línea común, mostrado igual en el sitio, con o
  sin [Layout Mirror](#layout-mirror). "Borrar formato" lo quita de los párrafos seleccionados.
- Solo afecta al HTML de Microsoft Word; pegar desde páginas web y otros orígenes funciona como
  antes. Vea en [Limitaciones conocidas](#limitaciones-conocidas) lo que aún difiere de Word.

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

| Teclas                        | Acción                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Ctrl+B / I / U                | Negrita / cursiva / subrayado                                                 |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z) | Deshacer, rehacer                                                             |
| Ctrl+K                        | Formulario de enlace (Enter aplica, Esc cancela)                              |
| Tab                           | Inserta espacios                                                              |
| Supr / Retroceso              | Elimina la imagen seleccionada                                                |
| Ctrl+flechas (Mayús: 10px)    | Desplaza la imagen o el cuadro de texto seleccionado                          |
| Alt+↑/↓, Alt+←/→              | Lo mueve en el flujo del texto / lo hace flotar a la izquierda o a la derecha |
| ←/→, Inicio/Fin, Esc (barra)  | Recorre los controles de la barra, cierra las paletas                         |

## Compatibilidad con navegadores

Las pruebas automáticas se ejecutan en cada push en Chromium (Chrome/Edge). Firefox y WebKit
(Safari) se ejecutan como diagnóstico
(`VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit`):

| Navegador       | Estado                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chrome, Edge    | Todas las pruebas pasan.                                                                                                                               |
| Firefox         | Funciona; el HTML difiere en detalles (p. ej., imágenes insertadas dentro del párrafo). El pegado no está cubierto por pruebas automáticas en Firefox. |
| Safari (WebKit) | Funciona; las listas reciben `<span style="font-size">` adicionales; las demás diferencias son estéticas.                                              |

Bajar un objeto flotante debajo de otro cuando la columna de texto entre ellos quedaría demasiado
estrecha (`data-ve-stack`, en el editor y en `versaedit-content.css`) requiere `:has()` y consultas
de contenedor: Chrome/Edge 105+, Safari 16+, Firefox 121+. En navegadores más antiguos los objetos
quedan uno al lado del otro, como antes; nada más cambia.

## Limitaciones conocidas

- Se basa en `document.execCommand` (antiguo, pero compatible con todos los navegadores); el HTML
  generado varía ligeramente entre navegadores.
- Deshacer/rehacer: después de deshacer en el editor, el Rehacer del propio navegador (menú
  Edición o contextual) puede no estar disponible; Ctrl+Y y el botón Rehacer funcionan. La
  escritura con teclados IME del sistema (japonés, chino, coreano) y los menús de Safari aún no se
  han verificado manualmente.
- Después del resaltador o de un color personalizado, la negrita se guarda como
  `<span style="font-weight: bold">` en lugar de `<b>` (funciona igual).
- Pegado desde Microsoft Word (`pasteSpacing="preserve"`), comparado con Word con el mismo ancho,
  fuente y tamaño: el interlineado difiere por la métrica de la fuente (ver
  [Pegar desde Word](#pegar-desde-word)); un párrafo puede ocupar una línea más o menos; la línea
  horizontal ocupa cerca de 17 pt más en Word; las celdas de tabla reciben el relleno del sitio (o
  del editor); los párrafos y elementos que Word espacia automáticamente (contenido que vino de una
  página web, `mso-margin-*-alt: auto`) pierden esos 14 pt; la numeración de varios niveles como
  1.1 y 1.2 aparece como lista anidada numerada 1, 2; las viñetas gráficas de Word pasan a ser el
  disco y el círculo del navegador; y el texto pegado usa una sola fuente de la lista de fuentes del
  editor (la primera encontrada en el documento). El pegado no está cubierto por pruebas
  automáticas en Firefox.
- Solo exporta HTML (sin JSON ni Markdown).
- WebKit (Safari), con `truncateOnOverflow` y el área de edición redimensionada: los espacios
  escritos después del límite de contenido pueden guardarse con una mezcla distinta de espacios y
  `&nbsp;` que en un área nunca redimensionada. El texto y el punto de corte son los mismos.

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
