# Publicação — roteiro da `0.5.0-beta.1`

Estado atual: **não publicado**. `package.json` com `"private": true` e versão `0.0.0`; repositório
GitHub privado. Cada passo marcado **(mantenedor)** é feito por você, na sua conta; os demais são
preparados no repositório. Nada é publicado sem a sua confirmação expressa.

## 1. Repositório público

1. ✅ Auditoria do histórico concluída: sem segredos; e-mail do autor trocado pelo `noreply` do
   GitHub; repositório recriado só com o histórico corrigido.
2. **(mantenedor)** Settings → General → Danger Zone → **Change visibility → Public**.
3. **(mantenedor)** Settings → Security → **Private vulnerability reporting → Enable** (é o canal do
   `SECURITY.md`). Ativar também Dependabot alerts.

## 2. Domínio `versaedit.dev` e e-mail

1. **(mantenedor)** E-mail `support@versaedit.dev` recebendo de verdade (caixa ou encaminhamento
   no provedor do domínio) **antes** de aparecer no npm e no site.
2. **(mantenedor)** Verificar o domínio no GitHub (perfil/organização → Settings → Pages → **Add a
   verified domain**): registro TXT `_github-pages-challenge-meucom-dev` no DNS. Impede que outra
   conta use o domínio.
3. **(mantenedor)** DNS do domínio (hoje nos servidores da Spaceship):
   - `A` @ → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA` @ → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `CNAME` www → `meucom-dev.github.io`
4. **(mantenedor)** Repositório → Settings → Pages → Source: **GitHub Actions**; Custom domain:
   `versaedit.dev`; **Enforce HTTPS** (depois que o certificado for emitido).
5. O workflow `pages.yml` passa a rodar sozinho (só roda com o repositório público). Conferir
   `https://versaedit.dev` e `https://versaedit.dev/playground/`.

## 3. Conta no npm

1. **(mantenedor)** Conta no npm com **2FA para login e publicação**.
2. Conferir que o nome continua livre: `npm view versaedit` deve responder 404.

## 4. Commit da versão (preparado no repositório, após autorização)

1. `npm version 0.5.0-beta.1 --no-git-tag-version`
2. Retirar `"private": true` do `package.json`.
3. READMEs: apagar o trecho `<!-- release:pending -->…<!-- /release:pending -->`.
4. `CHANGELOG.md`: `## [Unreleased]` vira `## [0.5.0-beta.1] - AAAA-MM-DD`.
5. Commit, push, **CI verde** (jobs `check`, `e2e`, `react18`, `package`, `site`) e diagnóstico
   Firefox/WebKit só com as diferenças conhecidas.

## 5. Primeira publicação (manual)

A configuração de Trusted Publishing fica nas configurações **do pacote** no npmjs.com — ou seja,
o pacote precisa existir. Por isso a primeira versão sai da sua máquina, com 2FA:

```bash
git clone https://github.com/meucom-dev/versaedit.git versaedit-release && cd versaedit-release
git checkout <commit da versão>
npm ci
npm run test:package          # build + pacote + exemplos (precisa do Microsoft Edge ou Chromium)
npm pack --dry-run            # conferir a lista de arquivos (47)
npm publish --tag beta        # pede o código do 2FA
npm view versaedit dist-tags
```

- Esta primeira versão **não terá proveniência** (só é gerada em CI, com repositório público).
- Tags: `--tag beta` cria `beta → 0.5.0-beta.1`. A documentação do npm diz que `--tag` não move
  `latest`; na primeira versão de um pacote o registro costuma apontar `latest` para ela também —
  **conferir** com `npm view versaedit dist-tags`. Enquanto só houver betas, `npm install versaedit`
  instala a beta, e o README já a apresenta como beta.
- **(mantenedor)** Tag no git: `git tag v0.5.0-beta.1 && git push origin v0.5.0-beta.1`.

## 6. Trusted Publishing para as próximas versões

1. **(mantenedor)** npmjs.com → pacote `versaedit` → Settings → **Trusted publisher** → GitHub
   Actions: Organization or user `meucom-dev` · Repository `versaedit` · Workflow filename
   `release.yml` · Environment name `npm-publish` (tudo exatamente assim; o npm só valida na hora
   de publicar). A primeira publicação com essa configuração tem de ocorrer em até 2 dias.
2. **(mantenedor)** Mesma página → Publishing access → **Require two-factor authentication and
   disallow tokens** (não afeta o OIDC).
3. **(mantenedor)** GitHub → Settings → Environments → **npm-publish**: Required reviewers = você;
   Deployment branches = `main`.
4. Próximas betas: commit da versão (passo 4) → Actions → **Publicação no npm (beta)** → Run
   workflow com a versão → aprovar. O workflow recusa se `private` continuar, se a versão não for
   `x.y.z-beta.n`, se não bater com o `package.json`, se faltar a seção no CHANGELOG ou se o README
   ainda disser "não publicado"; roda todos os testes, `publint` e `attw`, publica com
   `--tag beta` e a proveniência sai automática.

## 7. Depois de publicar

```bash
npm run test:package -- --from-registry=versaedit@0.5.0-beta.1   # exemplos com o pacote do npm
```

Num projeto vazio: `npm install versaedit@beta` e `npm audit signatures` (assinaturas e, a partir da
segunda versão, proveniência). Conferir `https://unpkg.com/versaedit@beta/` (arquivos) e a página
`https://www.npmjs.com/package/versaedit` (README e links).

## 8. Defeitos durante a beta

- Cada correção sai como `0.5.0-beta.N+1`, com teste que falhava antes, regressão completa e linha
  no CHANGELOG.
- **Crítico** (XSS, perda de conteúdo): correção imediata e
  `npm deprecate versaedit@"<versões afetadas>" "<motivo e versão corrigida>"`.
- **Alto** (integração, tipos, SSR): próxima beta. **Médio/baixo**: agrupados.
- Nunca `npm unpublish` (o npm só permite em 72 h e quebra quem instalou).
- Relatos: GitHub Issues (modelo de defeito); segurança só pelo canal privado do `SECURITY.md`.
- Sair da beta (versão estável) é decisão do mantenedor.

## O que vai no pacote

`dist/` (JS ESM minificado, mapa de código com o fonte embutido, `.d.ts`, os dois CSS), `README.md`,
`README.pt-BR.md`, `CHANGELOG.md`, `LICENSE` e `package.json` — 47 arquivos. O `test:package` falha
se faltar algum, se entrar qualquer outro, ou se houver caminhos locais ou padrões de chaves.
