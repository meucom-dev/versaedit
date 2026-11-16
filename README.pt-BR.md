# VersaEdit

Editor de texto rico leve para aplicações React.

> **Beta** (`0.5.0-beta.2`) — a API pode mudar antes da 1.0; veja as [Limitações conhecidas](#limitações-conhecidas).

[versaedit.dev](https://versaedit.dev) · [Playground](https://versaedit.dev/playground/) ·
[Read in English](README.md) · [Leer en español](README.es.md)

O VersaEdit edita HTML com o `contentEditable` do próprio navegador e acrescenta barra de
ferramentas, sanitização (DOMPurify), desfazer/refazer próprio, limpeza do conteúdo colado (Word e páginas
da web), imagens, caixas de texto, tabelas, ditado e abrir/salvar arquivo. Não depende de backend:
entrega HTML e você guarda onde quiser (Supabase, Firebase, REST…).

- React 18.3+ ou 19 · renderização no servidor (testada com Next.js)
- Uma dependência: [DOMPurify](https://github.com/cure53/DOMPurify) · só módulos ES (sem versão
  CommonJS) · tipos TypeScript para bundlers e `moduleResolution: node16/nodenext`
- Interface em inglês, português do Brasil e espanhol (`locale`), com todos os textos trocáveis (`labels`)

## Instalação

```bash
npm install versaedit@beta
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

| Prop                                                 | Tipo                                                | Padrão                            | Descrição                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `initialContent`                                     | `string`                                            | `''`                              | HTML a carregar. Mudanças vindas de fora recarregam o editor (e reiniciam o desfazer).                                          |
| `onChange`                                           | `(html) => void`                                    | —                                 | Chamado quando o HTML muda de fato.                                                                                             |
| `onOverflowChange`                                   | `(boolean) => void`                                 | —                                 | O conteúdo cabe / não cabe na altura do editor.                                                                                 |
| `onResize`                                           | `(size, phase) => void`                             | —                                 | A pessoa redimensionou a área de edição: `'start'`, `'move'`, `'end'` ([detalhes](#área-de-edição-redimensionável)).            |
| `onFocus` / `onBlur`                                 | `() => void`                                        | —                                 | O foco entrou / saiu do editor (botões da barra não tiram o foco).                                                              |
| `onError`                                            | `(VersaEditError) => void`                          | `alert()`                         | Erros e avisos com `code` estável (abaixo).                                                                                     |
| `onConfirm`                                          | `(VersaEditConfirm) => boolean \| Promise<boolean>` | `confirm()`                       | Confirmações (ex.: substituir o conteúdo ao abrir arquivo).                                                                     |
| `onSave`                                             | `(html) => void`                                    | download                          | O botão Salvar entrega o HTML em vez de baixar um `.html`.                                                                      |
| `onImageUpload`                                      | `(file) => Promise<url>`                            | base64                            | Envia a imagem e insere a URL devolvida (recomendado).                                                                          |
| `width`                                              | `number \| string`                                  | `'100%'`                          | Largura total; número em px, texto é medida CSS. Nunca passa do contêiner ([Tamanho](#tamanho)).                                |
| `height`                                             | `number`                                            | `500`                             | Altura da área de edição em px (altura inicial com `resizable`).                                                                |
| `resizable`                                          | `boolean \| ResizableOptions`                       | `false`                           | Alças para redimensionar a área de edição ([detalhes](#área-de-edição-redimensionável)).                                        |
| `sizeControls`                                       | `boolean`                                           | `false`                           | Campos de largura e altura (px) abaixo da área de edição (com `resizable`).                                                     |
| `settingsPanel`                                      | `ReactNode \| (close) => ReactNode`                 | —                                 | Suas configurações, num painel aberto por uma engrenagem no fim da barra ([Painel de configurações](#painel-de-configurações)). |
| `toolbarWidth`                                       | `number \| string`                                  | `width`                           | Largura da barra (com números, centralizada sobre o editor).                                                                    |
| `frame`                                              | `{ width, color, radius } \| false`                 | `1px #d0d7de, 8px`                | Moldura da área de edição.                                                                                                      |
| `objectMargin`                                       | `{ text, outer, top, bottom }`                      | `16, 0, 4, 12`                    | Espaço em torno de imagens e caixas de texto, por lado, em px ([Margem dos objetos](#margem-dos-objetos)).                      |
| `accentColor`                                        | `string`                                            | `#2563eb`                         | Contorno de seleção, caixas de texto, alças.                                                                                    |
| `fontFamily` / `headingFontFamily`                   | `string`                                            | fonte do sistema                  | Fonte do texto e dos títulos.                                                                                                   |
| `fontFamilies` / `fontSizes`                         | listas                                              | padrões                           | Menu de fontes (`{ label, value }`) e tamanhos (pt).                                                                            |
| `colorPalette` / `highlightColors`                   | `string[]`                                          | padrões                           | Cores do texto/papel e do marca-texto (`'transparent'` = sem cor).                                                              |
| `loadGoogleFonts`                                    | `string[]`                                          | —                                 | Famílias a carregar do Google Fonts (desligado por padrão).                                                                     |
| `toolbar`                                            | `ToolbarGroup[]`                                    | todos                             | Grupos da barra (abaixo). `[]` esconde a barra (com `settingsPanel`, fica só a engrenagem).                                     |
| `showFileButtons`                                    | `boolean`                                           | `true`                            | Botões Salvar/Abrir arquivo.                                                                                                    |
| `showDictation` / `speechLang` / `speechRecognition` | —                                                   | `true` / do locale / do navegador | Ditado (abaixo).                                                                                                                |
| `pasteImages`                                        | `boolean`                                           | `true`                            | Mantém imagens na colagem (ver Segurança).                                                                                      |
| `pasteSpacing`                                       | `'remove' \| 'preserve'`                            | `'remove'`                        | Colar do Word: mantém espaçamento, recuos, linhas em branco e listas ([detalhes](#colar-do-word)).                              |
| `allowExternalMedia`                                 | `boolean`                                           | `false`                           | Deixa `<audio>`/`<video>` do conteúdo carregarem dentro do editor.                                                              |
| `scrollable`                                         | `boolean`                                           | `true`                            | A área de edição rola quando o conteúdo passa da altura. `false`: o que passa fica escondido, como num bloco de altura fixa.    |
| `truncateOnOverflow`                                 | `boolean`                                           | `false`                           | Corta o que passar da altura do editor.                                                                                         |
| `singleLineBreaks`                                   | `boolean`                                           | `false`                           | Colagem: junta linhas em branco seguidas.                                                                                       |
| `injectStyles`                                       | `boolean`                                           | `true`                            | Injeta o CSS do editor; com `false`, importe o arquivo de CSS.                                                                  |
| `locale` / `labels`                                  | `'en' \| 'pt-BR' \| 'es'` / parcial                 | `'en'`                            | Idioma da interface e troca de textos.                                                                                          |
| `contentClassName` / `contentStyle` / `placeholder`  | —                                                   | —                                 | Classe, estilo e texto de vazio da área de edição.                                                                              |
| `layoutMirror`                                       | `boolean`                                           | `false`                           | Isola a área de edição do CSS da página, para o conteúdo publicado ficar igual ([Layout Mirror](#layout-mirror)).               |

**Grupos da barra** (`TOOLBAR_GROUPS`, sempre nesta ordem): `dictation`, `file`, `history`, `font`,
`block`, `format`, `highlight`, `color`, `align`, `list`, `indent`, `link`, `insert`, `textbox`,
`clear`. Sem `format`, Ctrl+B/I/U (Cmd no macOS) não formatam; sem `link`, Ctrl+K não abre o link. Desfazer e refazer
pelo teclado funcionam sempre.

**Códigos de erro** (`VersaEditError.code`): `file-wrong-type`, `file-too-large`, `file-read`,
`file-empty`, `file-truncated` (nível `warning`), `image-upload` (com o erro original em `cause`).

## Métodos da ref (`VersaEditHandle`)

`getHTML()` · `setHTML(html)` (reinicia o desfazer) · `focus()` · `clear()` · `undo()` · `redo()` ·
`getSize()` · `setSize({ width?, height? })` ([Área de edição redimensionável](#área-de-edição-redimensionável)) ·
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

Objetos flutuantes lado a lado (imagens e caixas de texto) só são responsivos com o
`versaedit-content.css` carregado: ele faz o objeto seguinte descer para baixo do anterior quando a
coluna de texto entre eles ficaria estreita demais na largura real do contêiner (consulta de
contêiner no `.versaedit-content`). Para isso, o `.versaedit-content` precisa receber a largura do
layout disponível, como um elemento de bloco, e não se dimensionar pelo próprio conteúdo (por
exemplo, não como item flex que encolhe ao conteúdo nem como `inline-block`).

Cores e tamanhos de fonte ficam em atributos `style` no próprio HTML; uma CSP que bloqueie estilos
em atributos (`style-src-attr`) não vai mostrá-los.

### Tamanho

Sem `width` e `height`, o editor ocupa toda a largura do contêiner e a área de edição começa com
500 px de altura. Para fixar, use as props: número é px, texto é qualquer medida CSS (`'100%'`,
`'40rem'`). A área de edição nunca fica mais larga que o contêiner (`max-width: 100%`); assim, uma
largura fixa encolhe em telas estreitas em vez de criar rolagem horizontal.

```tsx
<VersaEdit />                          {/* largura do contêiner × 500 px */}
<VersaEdit width={800} height={500} /> {/* 800 × 500 px, mais estreito em telas pequenas */}
```

### Margem dos objetos

Imagens e caixas de texto à esquerda, à direita ou centralizadas mantêm uma margem em relação ao
texto. `objectMargin` a define por lado, em px:

| Lado     | Onde                                                                                                                                                    | Padrão |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `text`   | Entre o objeto e o texto: o lado do texto num objeto à esquerda ou à direita; em cima e embaixo num objeto centralizado ou numa caixa de texto no fluxo | `16`   |
| `outer`  | O lado de fora de um objeto à esquerda ou à direita (`0` = alinhado à margem do texto); as laterais de uma caixa de texto no fluxo                      | `0`    |
| `top`    | Em cima de um objeto à esquerda ou à direita                                                                                                            | `4`    |
| `bottom` | Embaixo de um objeto à esquerda ou à direita                                                                                                            | `12`   |

Os lados não informados ficam no padrão; valores negativos ou inválidos são ignorados, e valores
acima de 200 ficam em 200. A margem não é gravada no HTML: dê ao contêiner publicado os mesmos
valores com `objectMarginStyle()`, para os objetos ficarem onde estavam no editor.

```tsx
import { objectMarginStyle, VersaEdit } from 'versaedit'

const margem = { text: 24, outer: 8 }

<VersaEdit objectMargin={margem} />

<div
  className="versaedit-content"
  style={objectMarginStyle(margem)}
  dangerouslySetInnerHTML={{ __html: htmlSanitizado }}
/>
```

`objectMarginStyle()` devolve as variáveis CSS `--ve-object-text`, `--ve-object-outer`,
`--ve-object-top` e `--ve-object-bottom`; sem React, aplique-as ao elemento de edição e ao
contêiner publicado. Mudar `objectMargin` durante a edição refaz o ponto em que objetos lado a
lado precisam descer (`data-ve-stack`), sem mexer no histórico de desfazer.

### Painel de configurações

`settingsPanel` acrescenta um botão de engrenagem no fim da barra de ferramentas. Ele abre um
painel com o conteúdo fornecido pela sua aplicação, como as opções que seus usuários podem mudar.
O editor não guarda nem interpreta esse conteúdo: os controles mudam o estado da sua aplicação, que
volta ao editor como props. Sem a prop não há engrenagem e nada muda.

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
            Manter o espaçamento do Word ao colar
          </label>
          <button type="button" onClick={close}>
            Concluir
          </button>
        </>
      )}
    />
  )
}
```

- Conteúdo: qualquer nó React, ou uma função que recebe `close()`, que fecha o painel e devolve o
  foco à engrenagem.
- Posição: a engrenagem é o último item da barra, alinhada à direita da última linha. Ela entra
  nessa linha quando há espaço; senão, fica numa linha própria, também à direita. Com
  `toolbar={[]}`, a barra mostra só a engrenagem. O painel abre abaixo da engrenagem, alinhado à
  borda direita dela, com 260 a 360 px de largura (nunca mais que a tela menos 16 px), e rola quando
  passa de 70% da altura da tela. Em telas estreitas, fica dentro da área visível.
- Teclado e leitores de tela: a engrenagem é um botão da barra (setas, Home, End) com o nome de
  `labels.settings` ("Configurações"), `aria-haspopup="dialog"` e `aria-expanded`. O painel é um
  diálogo não modal com o mesmo nome. Ao abrir, o foco vai para o primeiro controle; Tab e
  Shift+Tab percorrem os controles, e Shift+Tab no primeiro volta à engrenagem.
- Fechamento: a engrenagem, Esc, um clique fora, Tab depois do último controle, o início de um
  redimensionamento da área ou a abertura de outro menu da barra. A engrenagem e o Esc devolvem o
  foco à engrenagem. Um Esc já tratado por um controle do painel (`event.preventDefault()`) não o
  fecha.
- Na renderização no servidor, sai só a engrenagem fechada.

### Layout Mirror

Sem ele, o conteúdo publicado assume a tipografia do site (fontes, tamanhos, espaçamentos), que é o
que um site costuma querer. Ligue o Layout Mirror quando o texto publicado precisar ficar exatamente
como estava na edição: mesma fonte, tamanho, altura da linha, espaço de parágrafos e títulos, listas,
citações, alinhamentos, imagens e caixas de texto.

```tsx
// Edição: a área de edição ignora o CSS da página
;<VersaEdit layoutMirror onChange={salvar} />

// Publicação: o mesmo CSS de exibição, mais a classe ve-mirror
import 'versaedit/versaedit-content.css'
;<div
  className="versaedit-content ve-mirror"
  dangerouslySetInnerHTML={{ __html: htmlSanitizado }}
/>
```

- O HTML salvo não muda: o espelho é só CSS, e é opcional nas duas pontas.
- As linhas quebram nos mesmos pontos quando o contêiner publicado tem a mesma largura útil da área
  de edição: `width` menos a moldura (1 px de cada lado, por padrão) menos 32 px de padding
  (por exemplo, 800 → 766 px). Em colunas mais estreitas o texto se reacomoda, e imagens e caixas de texto
  encolhem para caber.
- `fontFamily` / `headingFontFamily` próprios vão por variáveis CSS:
  `style={{ '--ve-font': 'Georgia, serif', '--ve-heading-font': 'Inter, sans-serif' }}`.
- As regras de elemento do site (`p {}`, `h2 {}`, `ul {}`…) não alcançam o conteúdo espelhado.
  Regras que o alcançam por uma classe (ex.: `.post p {}`) são mais específicas e continuam valendo,
  assim como as com `!important`: mantenha-as longe do contêiner `ve-mirror`.
- Sem React, coloque você mesmo a classe `ve-mirror` no elemento de edição.

### Área de edição redimensionável

Desligada por padrão. Com `resizable`, alças na borda direita, na borda de baixo e no canto entre
elas redimensionam a área de edição com o mouse, o dedo ou as setas (com a alça focada; Shift:
1 px). `sizeControls` acrescenta campos de largura e altura abaixo da área.

```tsx
<VersaEdit
  width={720}
  height={400}
  resizable={{ handles: ['e', 's', 'se', 'w'], minWidth: 320, maxHeight: 900 }}
  sizeControls
  onResize={(size, phase) => phase === 'end' && salvarTamanho(size)}
/>
```

- Muda só a área visível: o HTML, o histórico de desfazer, a seleção e o `onChange` não são
  afetados, e nada é gravado no documento.
- `handles`: qualquer combinação de `'e'`, `'s'`, `'se'` (padrão), `'w'`, `'n'`, `'nw'`, `'ne'`,
  `'sw'`. As alças da esquerda e de cima também aumentam a área quando puxadas para fora; com o
  editor alinhado à esquerda na página, quem se move é a borda oposta. Uma alça lateral sem
  espaço ao lado do editor (editor na largura toda) fica oculta, e o canto continua funcionando.
- Limites em px, moldura incluída: `minWidth` (160), `maxWidth` (a largura disponível; a área
  nunca passa do contêiner), `minHeight` (80), `maxHeight` (sem limite). Se o contêiner ficar
  mais estreito que a largura escolhida, a área encolhe para caber e avisa com `'end'`.
- `onResize(size, phase)`, tamanhos em px com a moldura: o arraste chama `'start'`, depois
  `'move'` uma vez por quadro em que o tamanho mudou, depois `'end'`. As setas, os campos de
  tamanho e o contêiner que encolhe chamam só `'end'`, e só quando o tamanho mudou. `setSize()` e
  novas props `width`/`height` não chamam; assim, guardar o tamanho e restaurá-lo com `setSize()`
  nunca entra em laço.
- `getSize()` devolve o tamanho visível (`null` antes de montar); `setSize()` aplica um tamanho
  dentro dos limites e o devolve (só com `resizable`). Novas props `width`/`height` substituem o
  tamanho escolhido.
- `truncateOnOverflow` e `onOverflowChange` continuam usando o `width`/`height` configurado:
  redimensionar nunca corta conteúdo, nem na próxima digitação, colagem ou carregamento, e uma
  área maior não permite mais conteúdo. O que passa de uma área menor rola (mesmo com
  `scrollable={false}`).
- Para manter o tamanho entre visitas, guarde-o no `onResize` e devolva-o como `width` e `height`
  (ou chame `setSize()`). Com o [Layout Mirror](#layout-mirror), dê ao contêiner publicado a
  largura útil do tamanho escolhido (`width` − moldura − 32 px).
- Sem React: `createFrameResizer({ frame, content, handles, limits, onResize })` coloca as alças em
  qualquer moldura, e `core.setContentLimit({ width, height })` mantém o limite de conteúdo no
  tamanho configurado.

### Colar do Word

Por padrão (`pasteSpacing="remove"`), o texto colado do Microsoft Word segue o espaçamento do site:
espaço entre parágrafos, entrelinha, recuos e linhas em branco são descartados, como sempre. Com
`pasteSpacing="preserve"`, o VersaEdit mantém o layout do Word no HTML:

```tsx
<VersaEdit pasteSpacing="preserve" />
```

- Espaço antes e depois dos parágrafos, recuo esquerdo e da primeira linha e entrelinha são lidos
  dos estilos do Word (inclusive as regras de classe que o Word envia, como `MsoNormal`) e gravados
  como estilo inline em pt, dentro de limites seguros: espaçamento de 0 a 72 pt, recuo esquerdo de
  0 a 144 pt, recuo da primeira linha de −72 a 144 pt. Linhas em branco (parágrafos vazios) ficam.
- As listas do Word viram listas `ul`/`ol` de verdade: níveis; marcadores, números, letras e
  romanos; numeração continuada depois de um parágrafo (`<ol start="4">`) ou reiniciada; listas
  mistas (itens vindos de uma página da web mais parágrafos do Word da mesma lista); e o recuo de
  cada nível, como estilo inline da lista. O marcador desenhado pelo Word sai; o texto do item fica
  como está.
- Entrelinha: o "Múltiplo" do Word (1,15, 1,5…) é aplicado sobre a linha simples do navegador para
  a fonte, medida na colagem. O Word e os navegadores tiram a linha simples de métricas diferentes
  da mesma fonte (de cerca de −8% a +6%; Aptos −7,7%), então um documento longo se desloca cerca de
  uma linha a cada treze. "Exatamente" e "Pelo menos" mantêm o valor.
- Documentos salvos mantêm esse espaçamento ao serem reabertos, qualquer que seja `pasteSpacing`:
  a opção só decide o que acontece na colagem. É CSS inline comum, mostrado igual no site, com ou
  sem o [Layout Mirror](#layout-mirror). "Limpar formatação" o remove dos parágrafos selecionados.
- Só o HTML do Microsoft Word é afetado; colar de páginas da web e de outras origens funciona como
  antes. Veja em [Limitações conhecidas](#limitações-conhecidas) o que ainda difere do Word.

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
Safari; no Firefox o botão não aparece), no idioma da interface (`en-US`, `pt-BR` ou `es-ES`;
`speechLang` muda). Pontuação falada funciona ("vírgula", "ponto final", "nova linha"…; em inglês
"comma", "period", "new line"…; em espanhol "coma", "punto final", "nueva línea"…; em espanhol só
entram o ? e o ! de fechamento, sem ¿ e ¡). **Privacidade:** nesses navegadores o áudio
é processado nos servidores do fabricante (Google, Microsoft, Apple). Use `speechRecognition` para
outro mecanismo com a mesma interface, ou `showDictation={false}` para tirar o botão.
`VersaEditDictation` coloca o microfone em qualquer lugar da página
(`<VersaEditDictation editor={ref} />`).

## Segurança

Relate vulnerabilidades em privado — veja o [SECURITY.md](SECURITY.md) (support@versaedit.dev).

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

| Teclas                          | Ação                                                    |
| ------------------------------- | ------------------------------------------------------- |
| Ctrl+B / I / U (Windows, Linux) | Negrito / itálico / sublinhado                          |
| Cmd+B / I / U (macOS)           | Negrito / itálico / sublinhado                          |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z)   | Desfazer, refazer                                       |
| Ctrl+K                          | Formulário de link (Enter aplica, Esc cancela)          |
| Tab                             | Insere espaços                                          |
| Delete / Backspace              | Apaga a imagem selecionada                              |
| Ctrl+setas (Shift: 10px)        | Move de leve a imagem ou caixa de texto selecionada     |
| Alt+↑/↓, Alt+←/→                | Move no fluxo do texto / flutua à esquerda ou à direita |
| ←/→, Home/End, Esc (barra)      | Passa entre os controles da barra, fecha paletas        |

## Navegadores

Os testes automáticos rodam a cada push no Chromium (Chrome/Edge). Firefox e WebKit (Safari) rodam
como diagnóstico (`VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit`):

| Navegador       | Situação                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome, Edge    | Suíte completa passando.                                                                                                                     |
| Firefox         | Funciona; o HTML difere em detalhes (ex.: imagem inserida dentro do parágrafo). A colagem não é coberta pelos testes automáticos no Firefox. |
| Safari (WebKit) | Funciona; listas ganham `<span style="font-size">` extras; as outras diferenças são de forma.                                                |

Descer um objeto flutuante para baixo de outro quando a coluna de texto entre eles ficaria estreita
demais (`data-ve-stack`, no editor e no `versaedit-content.css`) precisa de `:has()` e consultas de
contêiner: Chrome/Edge 105+, Safari 16+, Firefox 121+. Em navegadores mais antigos os objetos ficam
lado a lado, como antes; nada mais muda.

## Limitações conhecidas

- Usa `document.execCommand` (antigo, mas suportado por todos os navegadores); o HTML gerado varia um
  pouco entre navegadores.
- Desfazer/refazer: depois de desfazer no editor, o Refazer do próprio navegador (menu Editar ou de
  contexto) pode ficar indisponível; Ctrl+Y e o botão Refazer funcionam. A digitação com teclados IME
  do sistema e os menus do Safari ainda não foram verificados à mão.
- Depois do marca-texto ou de uma cor personalizada, o negrito é gravado como
  `<span style="font-weight: bold">` em vez de `<b>` (funciona igual).
- Colagem do Microsoft Word (`pasteSpacing="preserve"`), comparada com o Word na mesma largura,
  fonte e tamanho: a entrelinha difere pela métrica da fonte (ver [Colar do Word](#colar-do-word));
  um parágrafo pode quebrar em uma linha a mais ou a menos; a linha horizontal ocupa cerca de 17 pt
  a mais no Word; as células de tabela recebem o espaço interno do site (ou do editor); parágrafos e
  itens que o Word espaça automaticamente (conteúdo vindo de uma página da web,
  `mso-margin-*-alt: auto`) perdem esses 14 pt; a numeração em vários níveis como 1.1 e 1.2 aparece
  como lista aninhada numerada 1, 2; os marcadores gráficos do Word viram o disco e o círculo do
  navegador; e o texto colado usa uma única fonte da lista de fontes do editor (a primeira
  encontrada no documento). A colagem não é coberta por testes automáticos no Firefox.
- Só exporta HTML (sem JSON nem Markdown).
- WebKit (Safari), com `truncateOnOverflow` e a área de edição redimensionada: os espaços
  digitados depois do limite de conteúdo podem ser gravados com uma mistura diferente de espaços e
  `&nbsp;` da de uma área nunca redimensionada. O texto e o ponto de corte são os mesmos.

## Desenvolvimento

```bash
npm install
npm run dev        # playground em http://localhost:5180
npm run build      # biblioteca (dist/)
npm run lint
npm run typecheck
npm test           # testes do núcleo (Vitest) + navegador (Playwright)
npm run test:package  # npm pack → instala em cópias de examples/ → tipos, build, navegador
npm run test:site     # site público (versaedit.dev + /playground/) gerado em site/ e testado
```

Os testes de navegador usam `playground/harness.html`. Localmente rodam no Microsoft Edge instalado; no
CI, no Chromium do Playwright (com React 19 e React 18). Os resultados de referência ficam em
`tests/e2e/__snapshots__/` — depois de uma mudança intencional de comportamento, rode
`npm run test:e2e -- --update-snapshots` e revise a diferença.

## Licença

[MIT](LICENSE)
