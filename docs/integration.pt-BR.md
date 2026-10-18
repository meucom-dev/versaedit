# Guia de integração

[Read in English](integration.md)

Receitas para usar o VersaEdit numa aplicação real. Cada receita diz como foi verificada.

- [Sanitização: navegador e servidor](#sanitização-navegador-e-servidor)
- [Salvar o conteúdo](#salvar-o-conteúdo)
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
para Node.js (`npm install dompurify jsdom`):

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
      'iframe',
      'object',
      'embed',
      'style',
    ],
  })
}
```

_Verificado no CI_ (`tests/unit/recipes.test.ts`): todo HTML gravado pelos testes de navegador passa
sem mudança (só reinterpretado pelo parser), e os 42 vetores de XSS saem sem scripts, eventos ou
links `javascript:`/`data:`. Mantenha os atributos `style` e `class`: formatação, posição de imagens e
caixas de texto dependem deles.

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
(`style-src-attr 'unsafe-inline'`, ou sem restrição em `style-src-attr`) nas páginas que o exibem.
_Verificado:_ aba "Strict CSP" de `examples/vite-react` (sem elemento `<style>`, mesma aparência).

## Exibir o conteúdo salvo

```tsx
import 'versaedit/versaedit-content.css'

;<div className="versaedit-content" dangerouslySetInnerHTML={{ __html: sanitizeOnServer(html) }} />
```

O `versaedit-content.css` posiciona imagens, desenha caixas de texto (escondendo a alça de arrasto) e
estiliza tabelas, citações e código. _Verificado:_ aba "Display content" de `examples/vite-react` e o
exemplo Next.js.
