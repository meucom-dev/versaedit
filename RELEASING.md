# Publicação no npm — roteiro

O pacote **não está publicado**: `package.json` tem `"private": true` e versão `0.0.0`. Nada aqui
deve ser feito sem decisão explícita do mantenedor.

## Antes da primeira publicação

1. Conta no npm com **autenticação em dois fatores** obrigatória para publicar.
2. Conferir se o nome `versaedit` continua livre (`npm view versaedit`).
3. Decidir o campo `author` do `package.json` (nome/e-mail que ficarão públicos).
4. Publicar pelo GitHub Actions com **proveniência** (`npm publish --provenance`, com
   `permissions: id-token: write` e um token de automação do npm guardado nos Secrets do
   repositório) — assim o pacote fica ligado ao commit que o gerou.

## A cada versão

1. CI verde no commit (jobs `check`, `e2e`, `react18`, `package`).
2. Diagnóstico Firefox/WebKit (`VE_ALL_BROWSERS=1 npx playwright test --project=firefox --project=webkit`):
   só diferenças já conhecidas.
3. `npm run test:package` e os validadores (sem instalar nada no projeto):

   ```bash
   npm exec --yes --before=<data> -- publint@latest --strict
   npm exec --yes --before=<data> --package=@arethetypeswrong/cli@latest -- \
     attw --pack . --profile esm-only --exclude-entrypoints versaedit.css versaedit-content.css
   ```

4. `CHANGELOG.md`: mover "Unreleased" para a nova versão, com a data.
5. Versão: `npm version <patch|minor|major> --no-git-tag-version`, commit, tag `vX.Y.Z`.
6. Só então: retirar `"private": true` (primeira vez), conferir `npm pack --dry-run` e publicar.
7. README: tirar o aviso "não publicado" na primeira publicação.

## O que vai no pacote

`dist/` (JS ESM minificado, mapa de código com o fonte embutido, `.d.ts`, os dois CSS), `README.md`,
`README.pt-BR.md`, `LICENSE` e `package.json`. O `test:package` falha se faltar algum desses arquivos,
se entrar qualquer outro, ou se os arquivos tiverem caminhos locais (`C:\Users\…`, `/home/…`) ou
padrões de chaves (`service_role`, `sk-…`, tokens JWT).

O mapa de código traz o código-fonte (comentários em português incluídos) para depuração no
navegador de quem usa o pacote; os caminhos são relativos (`../src/...`).
