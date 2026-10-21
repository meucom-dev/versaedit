# Homologação do desfazer/refazer (undo/redo)

Situação do desfazer/refazer do VersaEdit antes de decidir se ele deixa de ser
experimental: o que já está comprovado por testes automáticos, o que depende de
verificação manual, o roteiro dessa verificação e os critérios da decisão.

Versão avaliada: commit `d035855` (lotes D1 a D7). **O status continua experimental**
até a decisão do mantenedor.

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
| Fronteira da API: `instanceof`, identidade, métodos extraídos, ouvintes, dois núcleos, métodos futuros | real (navegador) e jsdom | `features.spec.ts`, `tests/unit/core-api.test.ts` |
| Desempenho por tecla em 300, 1.500 e 5.000 parágrafos igual ao de antes do histórico com seleção | medição lado a lado (não versionada) | relatórios dos lotes D1 a D7 |

Eventos que os navegadores emitem, medidos com eventos reais:

| Caminho | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| Ctrl+Z / Ctrl+Y nativos num `contenteditable` comum | `beforeinput` cancelável | `beforeinput` cancelável | `beforeinput` cancelável (Ctrl+Y não refaz; Ctrl+Shift+Z sim) |
| `execCommand('undo'/'redo')` | só `input`, depois (não cancelável) | só `input`, depois (não cancelável) | `beforeinput` cancelável |

No VersaEdit, Ctrl+Z e Ctrl+Y são tratados no `keydown`, antes de o navegador agir:
o caminho nativo do teclado não chega a acontecer.

## 2. Depende de verificação manual

A automação não abre os menus do navegador. Até serem acionados e observados por uma
pessoa, estes caminhos **não estão validados**:

- menu **Editar → Desfazer / Refazer** (barra de menus);
- **menu de contexto** (botão direito) → Desfazer / Refazer, onde existir;
- em macOS, os mesmos itens do menu Editar escolhidos com o mouse (não pelo atalho).

O que se espera, mas não está provado: que o menu produza um `beforeinput`
cancelável (como o teclado nativo) ou, ao menos, um `input` depois (como o
`execCommand`). Em ambos os casos o editor já reage corretamente nos testes.

## 3. Roteiro manual

### Preparação

1. No repositório: `npm run dev` e abrir `http://localhost:5180` (playground local, com
   a versão avaliada; o playground público só muda depois da publicação).
2. Abrir as ferramentas do desenvolvedor (F12; no Safari, ativar antes em Ajustes →
   Avançado → "Mostrar recursos para desenvolvedores web") e colar no console:

   ```js
   for (const type of ['beforeinput', 'input'])
     window.addEventListener(type, (e) => {
       if (!/^history/.test(e.inputType)) return
       console.log(type, e.inputType, 'isTrusted=' + e.isTrusted,
         'cancelable=' + e.cancelable, 'cancelado pelo editor=' + e.defaultPrevented)
     })
   ```

   Cada item de menu acionado mostra no console quais eventos chegaram e se o editor
   os cancelou. Sem nenhuma linha no console, o navegador não avisou nada. Numa linha
   `input`, `cancelado pelo editor=false` é o esperado: esse evento chega depois e não
   pode ser cancelado (o editor então corrige o conteúdo pelo próprio histórico). Numa
   linha `beforeinput` com `cancelable=true`, o esperado é `cancelado pelo editor=true`.
3. Usar **o mouse** para abrir os menus. O atalho de teclado não serve para este
   roteiro: ele é tratado pelo editor antes e já está comprovado automaticamente.
4. Anotar navegador, versão e sistema. Onde o menu não existir, anotar "não existe".

Onde ficam os menus: Chrome e Safari no macOS têm Editar na barra de menus; Chrome no
Windows e no Linux não tem barra de menus (só o menu de contexto). Firefox tem Editar
na barra de menus (no Windows, tecla Alt para mostrá-la) e no menu de contexto. O menu
de contexto do Safari pode não ter Desfazer.

### Casos (repetir em Chrome, Firefox e Safari; menu Editar e menu de contexto)

Em cada caso: resultado esperado, e o que anotar do console.

**M1. Desfazer pelo menu depois de uma formatação.** Selecionar uma palavra, clicar em
Negrito na barra do editor, esperar 1 s, menu → Desfazer.
Esperado: o negrito sai, a palavra continua selecionada. Depois, Ctrl+Z não reaplica
o negrito (nada mais a desfazer).

**M2. Refazer pelo menu.** Logo depois de M1, menu → Refazer.
Esperado: o negrito volta, ou nada acontece se o item estiver indisponível. Nunca outro
conteúdo. Depois, Ctrl+Y e Ctrl+Z seguem a mesma sequência.

**M3. Alternância editor ↔ navegador.** Aplicar Negrito, Itálico e Sublinhado em três
palavras diferentes (um de cada vez). Depois, em ordem: menu Desfazer, Ctrl+Z, botão
Desfazer da barra, menu Desfazer, botão Refazer, menu Refazer, Ctrl+Y.
Esperado: cada passo do editor anda exatamente um estado; cada item de menu anda um
estado **ou** não faz nada. Nunca aparece um estado que não existiu nessa sequência
(por exemplo, um negrito reaplicado depois de desfeito).

**M4. Passo aberto.** Clicar no fim de um parágrafo, digitar uma palavra e ir direto ao
menu → Desfazer, sem pausa.
Esperado: a palavra digitada sai inteira; nenhum outro texto muda. (Levar o mouse ao
menu costuma levar mais de 0,4 s; aí o passo já fechou e o caso equivale a M1.)

**M5. Menu depois de desfazer pelo editor.** Aplicar Negrito, Ctrl+Z, menu → Refazer;
depois Ctrl+Y, menu → Desfazer.
Esperado: o menu refaz/desfaz um passo **ou** não faz nada (item indisponível ou sem
efeito). Ver limitações L1 e L2 abaixo.

**M6. Campo fora do editor.** Digitar números no campo de altura do painel de
propriedades do playground, menu → Desfazer.
Esperado: só o campo muda; o conteúdo do editor não muda e o console não mostra nada
vindo do editor.

**M7. Dois editores.** Clicar em "Show HTML" e depois em "Show editor with onSave"
(ou os equivalentes no idioma escolhido; abre o segundo editor).
Formatar algo no primeiro; clicar no segundo, formatar algo nele; menu → Desfazer.
Esperado: só o segundo editor muda.

**M8. Caixa de texto.** Inserir uma caixa de texto, digitar dentro dela, esperar 1 s,
menu → Desfazer.
Esperado: a digitação dentro da caixa sai; o resto do documento não muda.

### Registro

| Caso | Chrome (menu Editar / contexto) | Firefox (Editar / contexto) | Safari (Editar / contexto) |
| --- | --- | --- | --- |
| M1 | | | |
| M2 | | | |
| M3 | | | |
| M4 | | | |
| M5 | | | |
| M6 | | | |
| M7 | | | |
| M8 | | | |

Para cada célula: OK, "sem efeito", "não existe" ou a descrição do problema, e as
linhas do console (`beforeinput`/`input`, `cancelable`, `cancelado pelo editor`).

## 4. Limitações dos navegadores (não são defeitos do VersaEdit)

- **L1.** Os navegadores só guardam na pilha nativa as edições feitas por eles. Depois
  de um desfazer/refazer feito pelo editor, o Refazer do menu costuma ficar
  indisponível (Chromium, Firefox e WebKit, medido com `execCommand`).
- **L2.** No Firefox, depois de um desfazer/refazer do editor, o Desfazer do menu pode
  não fazer nada e não emite evento: não há o que o editor intercepte. Nada muda e
  nenhum passo é criado.
- **L3.** Sem evento nenhum do navegador (L2), o editor não tem como reagir; isso não
  pode ser corrigido com segurança pelo editor.

Comportamentos do próprio editor que são escolhas de projeto (não defeitos):

- a digitação é agrupada por tempo: uma pausa de mais de 400 ms entre teclas começa
  um passo novo (inclusive quando a página trava por esse tempo);
- um comando chamado pela API sem nenhuma interação, menos de 400 ms depois da
  digitação, entra no mesmo passo dela (para não partir a digitação de apps que leem
  `getHTML` a cada tecla);
- o histórico fica na memória da página (não sobrevive a recarregar a página).

## 5. Critérios para retirar o status experimental

| # | Critério | Situação | Natureza |
| --- | --- | --- | --- |
| C1 | Ctrl+Z/Ctrl+Y, barra e API desfazem/refazem com HTML e seleção exatos, nos três motores e React 18 e 19 | ✅ comprovado (automático) | VersaEdit |
| C2 | Operações distintas em passos separados; digitação contínua num passo | ✅ comprovado | VersaEdit |
| C3 | Documento grande, dois editores, toque, documentos antigos | ✅ comprovado (toque: Chromium e WebKit) | VersaEdit |
| C4 | Desempenho por tecla equivalente ao de antes do histórico com seleção | ✅ medido (lado a lado, sem regressão) | VersaEdit |
| C5 | Nenhum passo contraditório entre o histórico do navegador e o do editor | ✅ comprovado pelo comando de edição (`execCommand`); ⏳ menus | VersaEdit |
| C6 | Menu Editar → Desfazer/Refazer segue o histórico do editor (Chrome, Firefox, Safari) | ⏳ verificação manual (M1–M8) | a definir pelo resultado |
| C7 | Menu de contexto → Desfazer/Refazer, onde existir | ⏳ verificação manual | a definir pelo resultado |
| C8 | Undo/redo fora do editor (campos, outros editores) não afetado | ✅ comprovado; ⏳ menus (M6, M7) | VersaEdit |
| C9 | Limitações L1–L3 documentadas para quem integra | ✅ CHANGELOG e este documento | navegador |
| C10 | Suíte permanente cobre os casos acima e é estável | ✅ `integration.spec.ts` (3 repetições sem falha em cada motor) | VersaEdit |

Como ler o resultado manual:

- **Defeito do VersaEdit (impede retirar o status):** um item de menu leva a um estado
  que não existiu na sequência (passo contraditório), muda o conteúdo de outro editor
  ou campo, perde conteúdo, ou o console mostra `beforeinput` cancelável que o editor
  não cancelou (`cancelado pelo editor=false`) dentro do editor.
- **Limitação do navegador (não impede, se documentada):** o item de menu fica
  indisponível ou não faz nada, sem evento no console e sem mudar o conteúdo (L1–L3);
  ou o menu não existe naquele navegador.
- **Inconclusivo:** o caso não pôde ser executado (anotar o motivo).

Proposta: retirar o status quando C6 e C7 tiverem sido executados nos três
navegadores sem nenhum defeito do VersaEdit, e as limitações observadas estiverem
entre L1–L3 ou forem acrescentadas a elas.
