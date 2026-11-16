# Guia de integração

[Read in English](integration.md)

Receitas para usar o VersaEdit numa aplicação real. Cada receita diz como foi verificada.

- [Sanitização: navegador e servidor](#sanitização-navegador-e-servidor)
- [Salvar o conteúdo](#salvar-o-conteúdo)
- [Manter o tamanho da área de edição](#manter-o-tamanho-da-área-de-edição)
- [Painel de configurações: suas opções na barra](#painel-de-configurações-suas-opções-na-barra)
- [Supabase](#supabase)
- [Envio de imagens](#envio-de-imagens)
- [Next.js](#nextjs)
- [Content Security Policy](#content-security-policy)
- [Exibir o conteúdo salvo](#exibir-o-conteúdo-salvo)

## Sanitização: navegador e servidor

O VersaEdit sanitiza **no navegador** — e isso sozinho não basta.

|                    | No navegador (VersaEdit)                                                                                 | No seu servidor (você)                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| O quê              | Conteúdo inicial, `setHTML`, arquivos abertos e colagens passam pelo DOMPurify e pelas listas do editor. | O HTML que sua API recebe, antes de gravar ou publicar. |
| Protege            | Quem edita: nada colado ou aberto executa script no editor.                                              | Quem lê: o que chega ao banco é seguro para exibir.     |
| Dá para contornar? | Sim — qualquer pessoa pode chamar sua API diretamente, sem o editor.                                     | Não, se toda gravação passar por ele.                   |

**Receita para o servidor** — [`docs/recipes/sanitize-on-server.ts`](recipes/sanitize-on-server.ts),
para Node.js (`npm install dompurify jsdom`; o jsdom 29 exige Node.js 20.19+, 22.13+ ou 24+):

```ts
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const purify = createDOMPurify(new JSDOM('').window)

purify.addHook('afterSanitizeAttributes', (node) => {
  // Links salvos pelo editor abrem em nova aba: mantém target, sempre com rel seguro
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
  // Só contenteditable="false" (a alça da caixa de texto) é mantido
  if (node.hasAttribute('contenteditable') && node.getAttribute('contenteditable') !== 'false') {
    node.removeAttribute('contenteditable')
  }
})

export function sanitizeOnServer(html: string): string {
  return purify.sanitize(html, {
    ADD_ATTR: ['target', 'contenteditable'],
    FORBID_TAGS: [
      'svg',
      'math',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'option',
      'template',
      'noscript',
      'iframe',
      'object',
      'embed',
      'style',
    ],
    FORBID_ATTR: ['action', 'formaction', 'background', 'poster', 'srcset'],
  })
}
```

_Verificado no CI_ (`tests/unit/recipes.test.ts`): todo HTML gravado pelos testes de navegador passa
sem mudança (só reinterpretado pelo parser), e os 42 vetores de XSS saem sem scripts, eventos ou
links `javascript:`/`data:`. Mantenha os atributos `style` e `class`: formatação, posição de imagens e
caixas de texto dependem deles. A receita proíbe os mesmos elementos e atributos que o editor, mas,
ao contrário dele, não limita quais propriedades CSS o `style` pode ter.

**Colado do Word com `pasteSpacing="preserve"`.** O conteúdo traz o espaço entre parágrafos, os
recuos e a entrelinha como estilo inline em pt (`margin-top`, `margin-bottom`, `margin-left`,
`text-indent`, `line-height`), e as listas do Word como `ul`/`ol` com `start`, `type`,
`list-style-type`, `padding-left` e margens. A receita acima mantém tudo isso (ela mantém o atributo
`style` e os atributos de lista); um sanitizador mais restrito precisa permitir essas propriedades,
senão o layout do Word se perde ao salvar. O editor as aceita ao carregar, com os mesmos limites,
qualquer que seja `pasteSpacing`. _Verificado:_ `tests/unit/word-spacing.test.ts`,
`tests/unit/word-lists.test.ts` e `tests/unit/word-clipboard.test.ts` (HTML copiado da área de
transferência do Word).

## Salvar o conteúdo

Leia o HTML pelo `onChange` (a cada mudança) ou pela ref (`getHTML()`, na hora de salvar):

```tsx
const editor = useRef<VersaEditHandle>(null)

async function salvar() {
  const html = editor.current!.getHTML()
  await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  // O servidor chama sanitizeOnServer(html) antes de gravar
}
```

Os botões de arquivo (Salvar/Abrir `.html`) são para arquivos do próprio usuário. Para o Salvar da
barra enviar ao seu backend em vez de baixar, passe `onSave={(html) => …}`.
_Verificado:_ `getHTML`, `onChange` e `onSave` nos testes do exemplo (`examples/vite-react`).

## Manter o tamanho da área de edição

Com `resizable`, a pessoa pode redimensionar a área de edição (veja
[Área de edição redimensionável](../README.pt-BR.md#área-de-edição-redimensionável)). O tamanho não
faz parte do HTML: guarde-o quando o redimensionamento terminar e devolva-o na próxima visita.

```tsx
const [tamanho, setTamanho] = useState(() => lerTamanhoSalvo() ?? { width: 720, height: 400 })

<VersaEdit
  width={tamanho.width}
  height={tamanho.height}
  resizable={{ minWidth: 320 }}
  sizeControls
  onResize={(novo, phase) => {
    if (phase === 'end') salvarTamanho(novo) // localStorage, perfil da pessoa...
  }}
/>
```

Passar o tamanho salvo como `width` e `height` também o torna o limite de conteúdo do
`truncateOnOverflow`. Para manter um limite de conteúdo fixo e restaurar só o tamanho visível,
mantenha `width`/`height` fixos e chame `editor.current!.setSize(salvo)` depois de montar (ele não
chama `onResize`). O `onResize` é chamado uma vez com `'end'` a cada mudança feita pelas setas,
pelos campos de tamanho ou pelo editor encolhendo com o contêiner, e com `'start'`/`'move'`/`'end'` durante o arraste. _Verificado:_
`tests/e2e/editor-resize.spec.ts` e `tests/e2e/editor-resize-api.spec.ts`.

## Painel de configurações: suas opções na barra

`settingsPanel` põe uma engrenagem no fim da barra que abre o seu próprio conteúdo (veja
[Painel de configurações](../README.pt-BR.md#painel-de-configurações)). Um uso comum é deixar cada
pessoa escolher preferências do editor que a sua aplicação guarda:

```tsx
type Prefs = { pasteSpacing: 'remove' | 'preserve'; height: number }

function EditorDoPost({ prefs, salvarPrefs }: { prefs: Prefs; salvarPrefs: (p: Prefs) => void }) {
  return (
    <VersaEdit
      // Sem width, o editor ocupa o contêiner; a altura vem das preferências
      height={prefs.height}
      pasteSpacing={prefs.pasteSpacing}
      settingsPanel={(close) => (
        <>
          <label>
            <input
              type="checkbox"
              checked={prefs.pasteSpacing === 'preserve'}
              onChange={(e) =>
                salvarPrefs({ ...prefs, pasteSpacing: e.target.checked ? 'preserve' : 'remove' })
              }
            />
            Manter o espaçamento do Word ao colar
          </label>
          <label>
            Altura{' '}
            <select
              value={prefs.height}
              onChange={(e) => salvarPrefs({ ...prefs, height: Number(e.target.value) })}
            >
              <option value={500}>500 px</option>
              <option value={700}>700 px</option>
            </select>
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

O conteúdo do painel é React comum: o editor não o salva, não o lê e não o coloca no HTML. Use seus
próprios rótulos e controles com nomes acessíveis; o painel é anunciado como um diálogo com o nome
de `labels.settings`. _Verificado:_ `tests/e2e/settings-panel.spec.ts` (posição, fechamento,
teclado, ARIA, tamanho padrão) e `tests/unit/ssr.test.ts` (renderização no servidor).

## Supabase

No navegador, use só a chave **pública** (`anon` ou `sb_publishable_…`), com **Row Level Security**
em todas as tabelas e buckets. A chave `service_role` (ou `sb_secret_…`) ignora o RLS: nunca no
código do front-end, em variáveis `VITE_`/`NEXT_PUBLIC_` ou no repositório.

```sql
create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references auth.users (id),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

create policy "Anyone can read posts" on public.posts
  for select to anon, authenticated using (true);
create policy "Authors insert their posts" on public.posts
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors update their posts" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
```

**Sanitização com Supabase:** mesmo com RLS, um usuário autenticado consegue gravar qualquer HTML
direto pela API, sem o editor. Ou as gravações passam por uma função no servidor (Edge Function ou rota
da sua API) que sanitiza antes de inserir, ou o conteúdo é sanitizado no servidor ao renderizar
(`sanitizeOnServer` antes do `dangerouslySetInnerHTML`).

_Não verificado num projeto real_ — o SQL segue a documentação do Supabase; as partes do VersaEdit
usadas (`getHTML`, `onImageUpload`) são testadas.

## Envio de imagens

Sem `onImageUpload`, a imagem inserida fica dentro do HTML em base64 (conteúdo grande). Com ele, o
arquivo vai para o seu storage e só a URL entra no HTML:

```tsx
<VersaEdit
  onImageUpload={async (file) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const ext = file.type.split('/')[1] ?? 'png'
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('post-images').upload(path, file)
    if (error) throw error // o editor avisa pelo onError (código "image-upload")
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }}
  onError={(e) => toast(e.message)}
/>
```

```sql
-- Bucket "post-images" (leitura pública). Cada usuário grava só na própria pasta.
create policy "Users upload to their folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

_Verificado:_ sucesso e falha do `onImageUpload` (`onError` com `image-upload`) nos testes do exemplo,
com envio simulado. As chamadas ao Supabase não rodam no CI.

## Next.js

O VersaEdit usa o navegador: renderize-o num Client Component. O Next.js ainda o renderiza no servidor
e depois hidrata.

```tsx
// app/Editor.tsx
'use client'
import { VersaEdit } from 'versaedit'

export function Editor({ initialContent }: { initialContent: string }) {
  return <VersaEdit initialContent={initialContent} width="100%" height={400} />
}
```

Importe os arquivos de CSS em qualquer componente ou layout
(`import 'versaedit/versaedit-content.css'`). _Verificado:_ [`examples/nextjs`](../examples/nextjs)
(Next.js 16, App Router) — HTML do servidor, hidratação sem erros (com e sem reconhecimento de voz),
edição.

## Content Security Policy

Por padrão o editor acrescenta um elemento `<style>`. Com uma CSP que o bloqueie, importe o arquivo e
desligue a injeção:

```tsx
import 'versaedit/versaedit.css'
;<VersaEdit injectStyles={false} />
```

A formatação fica em atributos `style` dentro do conteúdo, então a CSP precisa permiti-los
(`style-src-attr 'unsafe-inline'`, ou sem restrição em `style-src-attr`) nas páginas que o editam
ou exibem. _Verificado:_ aba "Strict CSP" de `examples/vite-react`: sem elemento `<style>`, e a
barra recebe o estilo do arquivo importado (o próprio exemplo não envia um cabeçalho de CSP).

## Exibir o conteúdo salvo

```tsx
import 'versaedit/versaedit-content.css'

;<div className="versaedit-content" dangerouslySetInnerHTML={{ __html: sanitizeOnServer(html) }} />
```

O `versaedit-content.css` posiciona imagens, desenha caixas de texto (escondendo a alça de arrasto) e
estiliza tabelas, citações e código. _Verificado:_ aba "Display content" de `examples/vite-react` e o
exemplo Next.js.

Objetos flutuantes lado a lado (imagens e caixas de texto) só são responsivos com o
`versaedit-content.css` carregado: ele faz o objeto seguinte descer para baixo do anterior quando a
coluna de texto entre eles ficaria estreita demais na largura real do contêiner (consulta de
contêiner no `.versaedit-content`). Para isso, o `.versaedit-content` precisa receber a largura do
layout disponível, como um elemento de bloco, e não se dimensionar pelo próprio conteúdo (por
exemplo, não como item flex que encolhe ao conteúdo nem como `inline-block`).

**Margem dos objetos.** Se o editor usar `objectMargin`, dê ao contêiner os mesmos valores:
`style={objectMarginStyle(margem)}` (veja
[Margem dos objetos](../README.pt-BR.md#margem-dos-objetos)). Sem isso, o conteúdo publicado usa a
margem padrão (16 px do lado do texto, 0 do lado de fora), a mesma de um editor sem a prop.
_Verificado:_ `tests/e2e/object-margin.spec.ts`.

**Mesma aparência da edição (Layout Mirror).** Acrescente `layoutMirror` ao editor e a classe
`ve-mirror` ao contêiner: `<div className="versaedit-content ve-mirror">`. O texto fica isolado das
regras de elemento do site nas duas pontas, e as linhas quebram nos mesmos pontos quando o contêiner
tem a largura útil da área de edição (`width` − 2 × largura da moldura − 32 px). O HTML salvo é o mesmo com ou sem
o espelho. Veja [Layout Mirror](../README.pt-BR.md#layout-mirror). _Verificado:_
`tests/e2e/layout-mirror.spec.ts` (estilos calculados e posições reais comparados elemento a
elemento, com e sem um CSS de site agressivo; Chromium no CI, Firefox e WebKit em execuções locais
de diagnóstico).
