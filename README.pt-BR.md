# VersaEdit

Editor de texto rico leve para aplicações React — **em desenvolvimento (ainda não publicado)**.

[Read in English](README.md)

O VersaEdit edita HTML com o `contentEditable` do próprio navegador e acrescenta barra de
ferramentas, sanitização (DOMPurify), desfazer/refazer próprio, colagem inteligente (Word e páginas
da web), imagens, caixas de texto, tabelas, ditado e abrir/salvar arquivo. Não depende de backend:
entrega HTML e você guarda onde quiser (Supabase, Firebase, REST…).

- React 18.3+ ou 19 · funciona com renderização no servidor (Next.js, Remix)
- Uma dependência: [DOMPurify](https://github.com/cure53/DOMPurify)
- Interface em inglês e português do Brasil (`locale`), com todos os textos trocáveis (`labels`)

## Instalação

```bash
npm install versaedit
```

## Exemplo

```tsx
import { useRef } from 'react'
import { VersaEdit, type VersaEditHandle } from 'versaedit'

export function EditorDePost({
  htmlInicial,
  aoSalvar,
}: {
  htmlInicial: string
  aoSalvar: (html: string) => void
}) {
  const editor = useRef<VersaEditHandle>(null)
  return (
    <>
      <VersaEdit
        ref={editor}
        initialContent={htmlInicial}
        onChange={(html) => console.log('mudou', html.length)}
        width="100%"
        height={480}
        locale="pt-BR"
      />
      <button onClick={() => aoSalvar(editor.current!.getHTML())}>Salvar</button>
    </>
  )
}
```

O `initialContent` é carregado (e sanitizado) quando muda; o editor ignora o eco do próprio
`onChange`, então dá para usá-lo como valor controlado.

## Props

| Prop                                                 | Tipo                                                | Padrão                            | Descrição                                                                              |
| ---------------------------------------------------- | --------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `initialContent`                                     | `string`                                            | `''`                              | HTML a carregar. Mudanças vindas de fora recarregam o editor (e reiniciam o desfazer). |
| `onChange`                                           | `(html) => void`                                    | —                                 | Chamado quando o HTML muda de fato.                                                    |
| `onOverflowChange`                                   | `(boolean) => void`                                 | —                                 | O conteúdo cabe / não cabe na altura do editor.                                        |
| `onFocus` / `onBlur`                                 | `() => void`                                        | —                                 | O foco entrou / saiu do editor (botões da barra não tiram o foco).                     |
| `onError`                                            | `(VersaEditError) => void`                          | `alert()`                         | Erros e avisos com `code` estável (abaixo).                                            |
| `onConfirm`                                          | `(VersaEditConfirm) => boolean \| Promise<boolean>` | `confirm()`                       | Confirmações (ex.: substituir o conteúdo ao abrir arquivo).                            |
| `onSave`                                             | `(html) => void`                                    | download                          | O botão Salvar entrega o HTML em vez de baixar um `.html`.                             |
| `onImageUpload`                                      | `(file) => Promise<url>`                            | base64                            | Envia a imagem e insere a URL devolvida (recomendado).                                 |
| `width`                                              | `number \| string`                                  | `640`                             | Largura total; número em px, texto é medida CSS (`'100%'`).                            |
| `height`                                             | `number`                                            | `480`                             | Altura total em px.                                                                    |
| `toolbarWidth`                                       | `number \| string`                                  | `width`                           | Largura da barra (com números, centralizada sobre o editor).                           |
| `frame`                                              | `{ width, color, radius } \| false`                 | `1px #d0d7de, 8px`                | Moldura da área de edição.                                                             |
| `accentColor`                                        | `string`                                            | `#2563eb`                         | Contorno de seleção, caixas de texto, alças.                                           |
| `fontFamily` / `headingFontFamily`                   | `string`                                            | fonte do sistema                  | Fonte do texto e dos títulos.                                                          |
| `fontFamilies` / `fontSizes`                         | listas                                              | padrões                           | Menu de fontes (`{ label, value }`) e tamanhos (pt).                                   |
| `colorPalette` / `highlightColors`                   | `string[]`                                          | padrões                           | Cores do texto/papel e do marca-texto (`'transparent'` = sem cor).                     |
| `loadGoogleFonts`                                    | `string[]`                                          | —                                 | Famílias a carregar do Google Fonts (desligado por padrão).                            |
| `toolbar`                                            | `ToolbarGroup[]`                                    | todos                             | Grupos da barra (abaixo). `[]` esconde a barra.                                        |
| `showFileButtons`                                    | `boolean`                                           | `true`                            | Botões Salvar/Abrir arquivo.                                                           |
| `showDictation` / `speechLang` / `speechRecognition` | —                                                   | `true` / do locale / do navegador | Ditado (abaixo).                                                                       |
| `pasteImages`                                        | `boolean`                                           | `true`                            | Mantém imagens na colagem (ver Segurança).                                             |
| `allowExternalMedia`                                 | `boolean`                                           | `false`                           | Deixa `<audio>`/`<video>` do conteúdo carregarem dentro do editor.                     |
| `truncateOnOverflow`                                 | `boolean`                                           | `false`                           | Corta o que passar da altura do editor.                                                |
| `singleLineBreaks`                                   | `boolean`                                           | `false`                           | Colagem: junta linhas em branco seguidas.                                              |
| `injectStyles`                                       | `boolean`                                           | `true`                            | Injeta o CSS do editor; com `false`, importe o arquivo de CSS.                         |
| `locale` / `labels`                                  | `'en' \| 'pt-BR'` / parcial                         | `'en'`                            | Idioma da interface e troca de textos.                                                 |
| `contentClassName` / `contentStyle` / `placeholder`  | —                                                   | —                                 | Classe, estilo e texto de vazio da área de edição.                                     |

**Grupos da barra** (`TOOLBAR_GROUPS`, sempre nesta ordem): `dictation`, `file`, `history`, `font`,
`block`, `format`, `highlight`, `color`, `align`, `list`, `indent`, `link`, `insert`, `textbox`,
`clear`. Sem `format`, Ctrl+B/I/U não formatam; sem `link`, Ctrl+K não abre o link. Desfazer e refazer
pelo teclado funcionam sempre.

**Códigos de erro** (`VersaEditError.code`): `file-wrong-type`, `file-too-large`, `file-read`,
`file-empty`, `file-truncated` (nível `warning`), `image-upload` (com o erro original em `cause`).

## Métodos da ref (`VersaEditHandle`)

`getHTML()` · `setHTML(html)` (reinicia o desfazer) · `focus()` · `clear()` · `undo()` · `redo()` ·
`core` (o `VersaEditCore` por trás, **experimental**).

## CSS

O editor injeta o próprio CSS. Em sites com Content Security Policy restrita, desligue a injeção e
importe o arquivo:

```tsx
import 'versaedit/versaedit.css'
;<VersaEdit injectStyles={false} />
```

Para **exibir** o conteúdo salvo no site, envolva o HTML e inclua o CSS de exibição (posição de
imagens, caixas de texto com a alça de arrasto escondida, tabelas, código, citações):

```tsx
import 'versaedit/versaedit-content.css'
;<div className="versaedit-content" dangerouslySetInnerHTML={{ __html: htmlSanitizado }} />
```

Cores e tamanhos de fonte ficam em atributos `style` no próprio HTML; uma CSP que bloqueie estilos
em atributos (`style-src-attr`) não vai mostrá-los.

## Exemplos e guias

- [Guia de integração](docs/integration.pt-BR.md): sanitização no servidor, salvar, Supabase (chave
  pública + RLS), envio de imagens, Next.js, CSP, exibir o conteúdo.
- [`examples/vite-react`](examples/vite-react): uma aba por caso de uso (básico, callbacks de
  integração, barra personalizada, CSP restrita, exibição, ditado externo).
- [`examples/nextjs`](examples/nextjs): Next.js 16 App Router com renderização no servidor.
- Playground (`npm run dev`): abra **Ver HTML → Propriedades** para mudar props ao vivo, carregar
  conteúdos de exemplo, ver os eventos e copiar o JSX equivalente.

Os dois exemplos rodam no CI com o pacote gerado (`npm pack`), instalado fora do repositório.

## Ditado

O botão de microfone transforma fala em texto com a Web Speech API do navegador (Chrome, Edge,
Safari; no Firefox o botão não aparece). Pontuação falada funciona ("vírgula", "ponto final",
"nova linha"…; em inglês "comma", "period", "new line"…). **Privacidade:** nesses navegadores o áudio
é processado nos servidores do fabricante (Google, Microsoft, Apple). Use `speechRecognition` para
outro mecanismo com a mesma interface, ou `showDictation={false}` para tirar o botão.
`VersaEditDictation` coloca o microfone em qualquer lugar da página
(`<VersaEditDictation editor={ref} />`).

## Segurança

- Toda entrada de HTML (conteúdo inicial, arquivo aberto, colagem) passa pelo DOMPurify e pelas listas
  do próprio editor; scripts, eventos, links `javascript:` e SVG são removidos. Uma bateria de 42
  vetores de XSS roda no CI.
- **Sanitize de novo no servidor** antes de gravar ou publicar: o editor roda no navegador do usuário
  e pode ser contornado. O [guia de integração](docs/integration.pt-BR.md#sanitização-navegador-e-servidor)
  tem uma receita testada para o servidor.
- `pasteImages` (padrão `true`): imagens coladas continuam apontando para o site de origem — o
  navegador de quem lê vai buscá-las lá, e esse site pode trocá-las ou tirá-las. Use `onImageUpload`
  ou `pasteImages={false}`.
- Áudio e vídeo externos do conteúdo carregado não baixam dentro do editor (`allowExternalMedia`), e o
  HTML devolvido fica igual ao recebido.

## Teclado

| Teclas                        | Ação                                                    |
| ----------------------------- | ------------------------------------------------------- |
| Ctrl+B / I / U                | Negrito / itálico / sublinhado                          |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z) | Desfazer, refazer                                       |
| Ctrl+K                        | Formulário de link (Enter aplica, Esc cancela)          |
| Tab                           | Insere espaços                                          |
| Delete / Backspace            | Apaga a imagem selecionada                              |
| Ctrl+setas (Shift: 10px)      | Move de leve a imagem ou caixa de texto selecionada     |
| Alt+↑/↓, Alt+←/→              | Move no fluxo do texto / flutua à esquerda ou à direita |
| ←/→, Home/End, Esc (barra)    | Passa entre os controles da barra, fecha paletas        |

## Navegadores

Os testes automáticos rodam a cada push no Chromium (Chrome/Edge). Firefox e WebKit (Safari) rodam
como diagnóstico (`VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit`):

| Navegador       | Situação                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome, Edge    | Suíte completa passando.                                                                                                                     |
| Firefox         | Funciona; o HTML difere em detalhes (ex.: imagem inserida dentro do parágrafo). A colagem não é coberta pelos testes automáticos no Firefox. |
| Safari (WebKit) | Funciona; listas ganham `<span style="font-size">` extras; as outras diferenças são de forma.                                                |

## Limitações conhecidas

- Usa `document.execCommand` (antigo, mas suportado por todos os navegadores); o HTML gerado varia um
  pouco entre navegadores.
- Desfazer/refazer põe o cursor no início do editor.
- Depois do marca-texto ou de uma cor personalizada, o negrito é gravado como
  `<span style="font-weight: bold">` em vez de `<b>` (funciona igual).
- A colagem do Microsoft Word ainda não foi validada com documentos reais.
- Só exporta HTML (sem JSON nem Markdown).

## Desenvolvimento

```bash
npm install
npm run dev        # playground em http://localhost:5180
npm run build      # biblioteca (dist/)
npm run lint
npm run typecheck
npm test           # testes do núcleo (Vitest) + navegador (Playwright)
npm run test:package  # npm pack → instala em cópias de examples/ → tipos, build, navegador
```

Os testes de navegador usam `playground/harness.html`. Localmente rodam no Microsoft Edge instalado; no
CI, no Chromium do Playwright (com React 19 e React 18). Os resultados de referência ficam em
`tests/e2e/__snapshots__/` — depois de uma mudança intencional de comportamento, rode
`npm run test:e2e -- --update-snapshots` e revise a diferença.

## Licença

[MIT](LICENSE)
