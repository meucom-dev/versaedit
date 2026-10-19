# Security policy

[Português abaixo](#política-de-segurança)

## Supported versions

VersaEdit is in **beta**. Only the most recent `beta` release receives fixes:
`npm install versaedit@beta`.

## Reporting a vulnerability

Please **do not open a public issue** for security problems (for example an XSS that gets past the
sanitizer, or content that leaks between editors).

- Preferred: **GitHub private vulnerability reporting** — repository **Security** tab →
  **Report a vulnerability**.
- Or email **support@versaedit.dev** with the subject `SECURITY`.

Include the VersaEdit version, the browser, the HTML (or steps) that reproduce the problem and what
you expected. We aim to acknowledge reports within **3 business days** and to publish a fixed beta as
soon as possible; affected versions are marked with `npm deprecate`.

## Scope

In scope: the npm package `versaedit` (sanitization of loaded, opened and pasted HTML, the editor's
own output) and the site `versaedit.dev`. Out of scope: how an application stores or displays the
HTML — the editor runs in the user's browser and can be bypassed, so **applications must sanitize on
the server** (see the [integration guide](docs/integration.md#sanitization-browser-and-server)).

---

## Política de segurança

O VersaEdit está em **beta**. Só a versão `beta` mais recente recebe correções.

**Não abra issue pública** para problemas de segurança. Use o **relato privado de vulnerabilidades
do GitHub** (aba **Security** → **Report a vulnerability**) ou escreva para
**support@versaedit.dev** com o assunto `SECURITY`, informando versão, navegador e o HTML ou os
passos que reproduzem o problema. Resposta inicial em até **3 dias úteis**; versões afetadas são
marcadas com `npm deprecate`.

Fora do escopo: como a aplicação grava ou exibe o HTML — **sanitize no servidor** (veja o
[guia de integração](docs/integration.pt-BR.md#sanitização-navegador-e-servidor)).
