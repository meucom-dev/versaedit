# Homologação do desfazer/refazer (undo/redo)

Registro da homologação que tirou o desfazer/refazer do VersaEdit da condição de
experimental: o que está comprovado por testes automáticos, o que foi verificado à mão
nos menus dos navegadores, as limitações dos navegadores e os critérios da decisão.

**Situação: estável.** Aprovado pelo mantenedor em 21/10/2026, com base nos testes
automáticos (Chromium, Firefox e WebKit; React 18 e 19) e na homologação manual dos
menus no Chrome e no Firefox (Windows 11). Versão homologada: commit `d035855` (lotes
D1 a D7), com a suíte permanente de `cf035bd`.

**Pendência conhecida: composição de caracteres (IME).** Teclados de composição
(japonês, chinês, coreano) e acentos compostos por tecla morta: a correção P1 faz da
composição um passo só, comprovado por composição real no Chromium e por eventos
sintéticos nos três motores; a verificação com teclados IME reais do sistema (caso M9)
ainda não foi feita. Até lá, não há cobertura completa de IME declarada.

**Safari: não homologado manualmente.** O motor WebKit está coberto pelos testes
automáticos, mas o Safari real (macOS) não teve os menus verificados. O roteiro da
seção 3 continua disponível para essa execução.

## 1. Comprovado automaticamente

Testes de navegador (Playwright) em Chromium, Firefox e WebKit, com React 18 e 19.
"Real" quer dizer entrada do próprio navegador (teclado, mouse, toque ou comando de
edição, eventos `isTrusted`); "sintético" quer dizer um evento montado pelo teste,
que prova o tratamento no editor, não o comportamento do navegador.

| Comportamento | Tipo | Onde |
| --- | --- | --- |
| Ctrl+Z / Ctrl+Y (e Ctrl+Shift+Z) desfazem e refazem pelo histórico do editor | real | `cursor-selection.spec.ts`, `integration.spec.ts` |
| Botões Desfazer/Refazer da barra | real | `cursor-selection.spec.ts`, `integration.spec.ts` |
| API pública: `ref.undo()`, `ref.redo()`, métodos do núcleo | real | `cursor-selection.spec.ts`, `features.spec.ts` |
| Seleção de antes/depois de cada passo, com direção, e cursor à vista | real | `cursor-selection.spec.ts` |
| Operações distintas em passos separados, mesmo em menos de 400 ms; digitação contínua num passo | real | `cursor-selection.spec.ts` |
| Comando da API logo depois de um clique, barra externa, foco fora do editor | real | `cursor-selection.spec.ts`, `integration.spec.ts` (V1b) |
| Dois editores na mesma página: históricos e seleções independentes | real | `cursor-selection.spec.ts`, `integration.spec.ts` (III1, V2) |
| 10 operações seguidas num documento de 5.000 parágrafos: HTML e seleção exatos a cada desfazer/refazer | real | `integration.spec.ts` (V1) |
| Colagem de blocos e desfazer | **sintético** (ClipboardEvent do teste) | `paste-blocks.spec.ts`, `integration.spec.ts` |
| Toque (celular) e desfazer | real (toque emulado; não no Firefox) | `integration.spec.ts` (IV1) |
| Comando de edição do navegador `document.execCommand('undo'/'redo')` segue o histórico do editor, sem passos contraditórios | real | `cursor-selection.spec.ts` |
| `beforeinput` `historyUndo`/`historyRedo` cancelável é encaminhado ao histórico do editor | **sintético** | `cursor-selection.spec.ts` |
| Desfazer em campo fora do editor e em outro editor não mexe no editor | real | `cursor-selection.spec.ts` |
| Desfazer nativo com um passo ainda aberto (logo depois de digitar) | real | `cursor-selection.spec.ts` |
| Composição (IME) com pausas longas, digitação seguida de composição, composição cancelada e interrompida por clique: um passo, sem estados intermediários; outro editor e campo externo não afetados | real (CDP, só Chromium) | `composition.spec.ts` |
| Composição na ordem da especificação: texto final antes do `compositionend` (Chromium, Firefox) e depois dele (Safari: `deleteCompositionText` + `insertFromComposition`) | **sintético** (Safari: Firefox e WebKit; o Chromium não constrói esses `inputType`) | `composition.spec.ts` |
| Digitação com a página travada (teclas na fila): um passo; intervalos abaixo/acima de 400 ms; API e comando nativo depois de um travamento; dois editores | real (teclas sem espera: CDP no Chromium, paralelas no Firefox e WebKit) | `typing-timing.spec.ts` |
| Lógica temporal do agrupamento (temporizador atrasado, reabertura, fronteiras, composição) | determinístico (relógio e temporizadores controlados) | `tests/unit/history.test.ts` |
| Fronteira da API: `instanceof`, identidade, métodos extraídos, ouvintes, dois núcleos, métodos futuros | real (navegador) e jsdom | `features.spec.ts`, `tests/unit/core-api.test.ts` |
| Desempenho por tecla em 300, 1.500 e 5.000 parágrafos igual ao de antes do histórico com seleção | medição lado a lado (não versionada) | relatórios dos lotes D1 a D7 |

Eventos que os navegadores emitem, medidos com eventos reais:

| Caminho | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| Ctrl+Z / Ctrl+Y nativos num `contenteditable` comum | `beforeinput` cancelável | `beforeinput` cancelável | `beforeinput` cancelável (Ctrl+Y não refaz; Ctrl+Shift+Z sim) |
| `execCommand('undo'/'redo')` chamado por script | só `input`, depois (não cancelável) | só `input`, depois (não cancelável) | `beforeinput` cancelável |
| Menu Editar / menu de contexto (verificação manual, seção 2) | `beforeinput` cancelável (Chrome) | `beforeinput` cancelável | não verificado (Safari) |

No VersaEdit, Ctrl+Z e Ctrl+Y são tratados no `keydown`, antes de o navegador agir:
o caminho nativo do teclado não chega a acontecer.

## 2. Verificação manual dos menus (resultado)

A automação não abre os menus do navegador; eles foram acionados com o mouse e
observados por uma pessoa, com o trecho de console da seção 3 registrando os eventos,
o HTML e a seleção antes e depois de cada ação.

Ambiente: Windows 11 Pro; playground local (`npm run dev`); Chrome 155; Firefox (janela
privativa). Texto: três linhas ("Teste", "fazer", "desfazer").

| Caminho | Chrome 155 (Windows) | Firefox (Windows) | Safari (macOS) |
| --- | --- | --- | --- |
| Menu Editar → Desfazer | não existe no Chrome para Windows | **aprovado** (M1, M3–M8) | não verificado |
| Menu Editar → Refazer | não existe | acinzentado (L1) | não verificado |
| Menu de contexto → Desfazer | **aprovado** (M1, M3–M8) | **aprovado** (M1) | não verificado |
| Menu de contexto → Refazer | não aparece (L1) | não existe nesse menu | não verificado |
| Campo fora do editor (M6) | **aprovado** | **aprovado** | não verificado |
| Dois editores (M7) | **aprovado** | **aprovado** | não verificado |
| Conferência: botões da barra, Ctrl+Z/Ctrl+Y | **aprovado** | **aprovado** | não verificado |

O que se observou em todos os menus acionados, nos dois navegadores:

- o navegador emite `beforeinput` `historyUndo` **real e cancelável** antes de agir; o
  editor o cancela e desfaz pelo próprio histórico; o conteúdo anda exatamente um passo
  e a seleção do passo volta com a direção original;
- a sequência seguinte (Ctrl+Z, Ctrl+Y, botões, menu de novo) continua coerente:
  nenhum estado fora da sequência, nenhuma formatação reaplicada fora de ordem;
- num campo fora do editor (M6), o evento vai para o campo e o editor não o cancela
  nem muda; em dois editores (M7), só o editor com o foco muda.

**Defeitos do VersaEdit encontrados: nenhum.** Dois relatos durante a execução foram
investigados e esclarecidos (ordem das linhas e contagem de cliques; uma palavra que já
tinha sido desfeita antes, não sobrescrita).

## 3. Roteiro manual (para nova execução, por exemplo no Safari)

### Preparação

1. No repositório: `npm run dev` e abrir `http://localhost:5180` (playground local, com
   a versão avaliada; o playground público só muda depois da publicação). De preferência
   numa janela anônima/privativa: extensões (corretores, tradutores) podem alterar o
   conteúdo editável.
2. Abrir as ferramentas do desenvolvedor (F12; no Safari, ativar antes em Ajustes →
   Avançado → "Mostrar recursos para desenvolvedores web") e colar no console o trecho
   abaixo. Chrome e Firefox bloqueiam a primeira colagem: digitar `allow pasting`
   (Firefox em português: `permitir colar`, **sem Enter**) e colar de novo.

   ```js
   ;(() => {
     const editors = () => Array.from(document.querySelectorAll('.ve-content'))
     const where = () => {
       const s = getSelection()
       if (!s || !s.rangeCount || !s.anchorNode) return '(sem seleção)'
       const i = editors().findIndex((ed) => ed.contains(s.anchorNode))
       const ctx = i < 0 ? 'fora dos editores' : `editor ${i + 1}`
       const dir = s.anchorNode === s.focusNode && s.anchorOffset > s.focusOffset ? ' (←)' : ''
       return `${ctx}: "${s.toString()}"${dir} em "${(s.anchorNode.textContent || '').slice(0, 30)}" @${s.anchorOffset}`
     }
     const state = () => editors().map((ed, i) => `editor ${i + 1}: ${ed.innerHTML}`).join('\n')
     let last = { html: state(), sel: where() }
     const remember = () => (last = { html: state(), sel: where() })
     document.addEventListener('selectionchange', () => setTimeout(remember, 0))
     let n = 0
     for (const type of ['beforeinput', 'input'])
       window.addEventListener(type, (e) => {
         if (!/^history/.test(e.inputType)) return setTimeout(remember, 0)
         const id = ++n
         const target = e.target instanceof Element && e.target.closest('.ve-content') ? 'editor' : e.target.tagName
         const before = last
         setTimeout(() => {
           const after = { html: state(), sel: where() }
           console.log(`#${id} ${type} ${e.inputType} | alvo=${target} isTrusted=${e.isTrusted} cancelable=${e.cancelable} cancelado pelo editor=${e.defaultPrevented}` +
             `\n  ANTES  seleção: ${before.sel}\n  ${before.html}\n  DEPOIS seleção: ${after.sel}\n  ${after.html}\n  conteúdo mudou: ${before.html !== after.html}`)
           remember()
         }, 50)
       })
     window.ve = () => console.log(`seleção: ${where()}\n${state()}`)
     console.log('Homologação ativa. ve() mostra o estado atual.')
   })()
   ```

   Cada item de menu acionado gera uma linha `#n` com o evento, o HTML e a seleção
   antes e depois. Sem linha `#n`, o navegador não avisou nada. `ve()` mostra o estado
   atual a qualquer momento (útil depois de Ctrl+Z/Ctrl+Y e dos botões, que não geram
   `#n`). Numa linha `input`, `cancelado pelo editor=false` é o esperado (o evento chega
   depois e não pode ser cancelado); numa linha `beforeinput` com `cancelable=true`
   dentro do editor, o esperado é `cancelado pelo editor=true`.
3. Usar **o mouse** para abrir os menus. O atalho de teclado não serve para este
   roteiro: ele é tratado pelo editor antes e já está comprovado automaticamente.
4. Rodar `ve()` depois de **cada** ação; sem isso, sequências longas ficam
   inconclusivas.
5. Anotar navegador, versão e sistema. Onde o menu não existir, anotar "não existe".

Onde ficam os menus: Chrome e Safari no macOS têm Editar na barra de menus; Chrome no
Windows e no Linux não tem barra de menus (só o menu de contexto). Firefox tem Editar
na barra de menus (no Windows, tecla Alt para mostrá-la) e Desfazer (sem Refazer) no
menu de contexto. O menu de contexto do Safari pode não ter Desfazer.

### Casos (em cada navegador; menu Editar e menu de contexto, onde existirem)

Texto: digitar "Teste", Enter, "fazer", Enter, "desfazer" no primeiro editor e esperar
1 s. Recarregar a página antes de cada caso. O desfazer segue a ordem do tempo, não a
palavra selecionada.

**M1. Desfazer pelo menu depois de uma formatação.** Selecionar "Teste", clicar em
Negrito na barra do editor, esperar 1 s, menu → Desfazer.
Esperado: o negrito sai e a seleção volta para "Teste". Depois, Ctrl+Z desfaz a
digitação (não reaplica o negrito); Ctrl+Y duas vezes devolve o texto e o negrito.

**M2. Refazer pelo menu.** Logo depois de M1, menu → Refazer.
Esperado: o negrito volta, ou o item não existe/está acinzentado (L1). Nunca outro
conteúdo. Depois, Ctrl+Y e Ctrl+Z seguem a mesma sequência.

**M3. Alternância editor ↔ navegador.** Negrito em "Teste", Itálico em "fazer",
Sublinhado em "desfazer" (1 s entre eles). Depois, com `ve()` a cada passo: menu
Desfazer, botão Refazer, Ctrl+Z, Ctrl+Y, menu Desfazer.
Esperado: cada ação anda exatamente um estado; o sublinhado sai e volta alternadamente.

**M4. Passo aberto.** Clicar no fim de "desfazer", digitar " teste" e ir direto ao
menu → Desfazer.
Esperado: a palavra digitada sai inteira (ou em partes, se houve pausas de mais de
0,4 s entre as teclas: agrupamento por tempo); nenhum outro texto muda.

**M5. Menu depois de desfazer pelo editor.** Negrito em "fazer", Ctrl+Z, menu →
Refazer; depois Ctrl+Y, menu → Desfazer.
Esperado: o Refazer do menu ausente/acinzentado (L1) ou refaz um passo; o Desfazer do
menu desfaz um passo.

**M6. Campo fora do editor.** Criar um campo de texto temporário colando no console
`document.body.insertAdjacentHTML('afterbegin', '<input id="campo-externo" placeholder="campo externo">')`,
digitar "abc" nele e usar menu → Desfazer com o cursor no campo. (Campos numéricos,
como o de altura do playground, podem não ter Desfazer no menu de contexto.)
Esperado: só o campo muda; o editor não muda; a linha `#n`, se aparecer, mostra
`alvo=INPUT` e `conteúdo mudou: false`.

**M7. Dois editores.** Clicar em "Show HTML" e depois em "Show editor with onSave" (ou
os equivalentes no idioma escolhido; o segundo editor abre vazio). Negrito em "Teste"
no primeiro; no segundo, digitar "segundo", Negrito pela barra dele, esperar 1 s; com o
cursor no segundo, menu → Desfazer.
Esperado: só o segundo editor muda.

**M9. Composição de caracteres (IME real).** Com um teclado de composição do sistema
(Windows: IME japonês da Microsoft; macOS: Japonês – Romaji; e, em português, acentos
por tecla morta, como ´ + a), compor uma palavra com pausas de mais de 1 s entre as
teclas (inclusive escolhendo um candidato na lista), confirmar, esperar 1 s e desfazer
(Ctrl+Z, botão e menu). Repetir cancelando a composição (Esc) e clicando fora no meio.
Esperado: um desfazer tira a palavra composta inteira; nunca aparece o texto
intermediário (por exemplo, o romaji antes da conversão ou o acento sozinho); depois de
cancelar, o conteúdo e o cursor ficam como antes, sem passo novo.

**M8. Caixa de texto.** Inserir uma caixa de texto, digitar dentro dela (rápido),
esperar 1 s, menu → Desfazer com o cursor dentro da caixa.
Esperado: a digitação dentro da caixa sai; o resto do documento não muda.

### Registro (Windows 11, outubro de 2026)

| Caso | Chrome 155: menu de contexto | Firefox: menu Editar | Firefox: menu de contexto | Safari |
| --- | --- | --- | --- | --- |
| M1 | aprovado | aprovado | aprovado | não verificado |
| M2 | Refazer não aparece (L1) | Refazer acinzentado (L1) | Refazer não existe | não verificado |
| M3 | aprovado | aprovado | — | não verificado |
| M4 | aprovado | aprovado | — | não verificado |
| M5 | aprovado; Refazer ausente (L1) | aprovado; Refazer acinzentado (L1) | — | não verificado |
| M6 | aprovado (campo de texto) | aprovado | — | não verificado |
| M7 | aprovado | aprovado | — | não verificado |
| M8 | aprovado | aprovado | — | não verificado |
| M9 (IME real) | não executado | não executado | não executado | não verificado |

O menu Editar não existe no Chrome para Windows. "—": não executado nesse menu (o menu
Editar cobriu o caso no Firefox).

## 4. Limitações dos navegadores (não são defeitos do VersaEdit)

- **L1. Refazer dos menus nativos.** Os navegadores só oferecem o Refazer do menu
  quando a pilha nativa deles tem o que refazer. Como o editor cancela o desfazer do
  navegador e desfaz pelo próprio histórico, a pilha nativa não muda, e o Refazer do
  menu fica ausente (Chrome, menu de contexto) ou acinzentado (Firefox, menu Editar).
  O histórico do VersaEdit não é afetado: Ctrl+Y e o botão Refazer continuam refazendo.
- **L2. `document.execCommand('undo')` no Firefox.** Quando um script chama o comando
  de edição do navegador depois de um desfazer/refazer do editor, o Firefox pode não
  fazer nada e não emitir evento: não há o que o editor intercepte; nada muda e nenhum
  passo é criado. **Os menus reais não têm essa limitação:** na verificação manual, o
  menu Editar e o de contexto do Firefox sempre emitiram `beforeinput` cancelável, e o
  editor desfez pelo próprio histórico.
- **L3.** Sem nenhum evento do navegador (L2), o editor não tem como reagir; isso não
  pode ser corrigido com segurança pelo editor.

Comportamentos do próprio editor que são escolhas de projeto (não defeitos):

- a digitação é agrupada por tempo: uma pausa de mais de 400 ms entre teclas começa
  um passo novo; visto igual pelo botão, Ctrl+Z e menus. Um travamento da página não
  parte a digitação: o passo gravado pelo temporizador é reaberto quando a tecla
  seguinte prova que pertencia a ele (chegou a menos de 400 ms da anterior pelo
  `timeStamp` do `keydown`, que no Chromium e no WebKit é a chegada da tecla; ou
  esperava na fila atrás de um temporizador atrasado, caso do Firefox, cujo
  `timeStamp` é o momento do tratamento). A hora das teclas nunca divide um passo;
- um comando chamado pela API sem nenhuma interação, menos de 400 ms depois da
  digitação, entra no mesmo passo dela (para não partir a digitação de apps que leem
  `getHTML` a cada tecla);
- o histórico fica na memória da página (não sobrevive a recarregar a página).

Limitação conhecida fora do mecanismo de undo/redo: **F1** (ao juntar um parágrafo a
um título com Backspace, o `font-size` do parágrafo fica num `<span>` dentro do
título). Rastreada em `integration.spec.ts` (I2, `test.fixme`).

## 5. Critérios da estabilização

| # | Critério | Situação | Natureza |
| --- | --- | --- | --- |
| C1 | Ctrl+Z/Ctrl+Y, barra e API desfazem/refazem com HTML e seleção exatos, nos três motores e React 18 e 19 | ✅ comprovado (automático) | VersaEdit |
| C2 | Operações distintas em passos separados; digitação contínua num passo | ✅ comprovado | VersaEdit |
| C3 | Documento grande, dois editores, toque, documentos antigos | ✅ comprovado (toque: Chromium e WebKit) | VersaEdit |
| C4 | Desempenho por tecla equivalente ao de antes do histórico com seleção | ✅ medido (lado a lado, sem regressão) | VersaEdit |
| C5 | Nenhum passo contraditório entre o histórico do navegador e o do editor | ✅ comprovado (automático e manual: Chrome, Firefox) | VersaEdit |
| C6 | Menu Editar → Desfazer/Refazer segue o histórico do editor | ✅ Firefox; não existe no Chrome para Windows; Safari não verificado | VersaEdit (Refazer: L1, navegador) |
| C7 | Menu de contexto → Desfazer/Refazer, onde existir | ✅ Chrome e Firefox; Safari não verificado | VersaEdit (Refazer: L1, navegador) |
| C8 | Undo/redo fora do editor (campos, outros editores) não afetado | ✅ comprovado (automático e manual: M6, M7) | VersaEdit |
| C9 | Limitações L1–L3 documentadas para quem integra | ✅ CHANGELOG e este documento | navegador |
| C10 | Suíte permanente cobre os casos acima e é estável | ✅ `integration.spec.ts` (3 repetições sem falha em cada motor) | VersaEdit |
| C11 | Composição de caracteres (IME, acentos compostos) é um passo de desfazer/refazer, sem estados intermediários; cancelar ou interromper mantém conteúdo e seleção | ✅ automático (composição real no Chromium; sintético nos três motores); ⏳ **pendência conhecida**: teclados IME reais (M9) | VersaEdit |

Como ler um resultado manual (vale para novas execuções):

- **Defeito do VersaEdit:** um item de menu leva a um estado que não existiu na
  sequência (passo contraditório), muda o conteúdo de outro editor ou campo, perde
  conteúdo, ou o console mostra `beforeinput` cancelável dentro do editor que ele não
  cancelou (`cancelado pelo editor=false`).
- **Limitação do navegador (documentada):** o item de menu fica indisponível ou não faz
  nada, sem evento no console e sem mudar o conteúdo (L1–L3); ou o menu não existe
  naquele navegador.
- **Inconclusivo:** o caso não pôde ser executado (anotar o motivo).
