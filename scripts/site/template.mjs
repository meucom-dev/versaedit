// Modelo da página inicial, no formato de artigo enciclopédico: cabeçalho,
// sumário lateral, artigo, caixa de informações e rodapé. Um único modelo para
// as duas línguas (os textos vêm de content.mjs), sem recursos externos.
import { REPO } from './content.mjs'

const SECTION_IDS = [
  'features',
  'installation',
  'usage',
  'styling',
  'security',
  'browsers',
  'limitations',
  'see-also',
  'references',
]

const ICON = {
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  languages:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>',
  beta: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2M8.5 2h7M7 16h10"/></svg>',
}

const CSS = `
:root {
  --bg: #ffffff; --fg: #202122; --muted: #54595d; --link: #3366cc; --line: #a2a9b1;
  --hair: #eaecf0; --panel: #f8f9fa; --head: #eaecf0; --notice: #fc3; --notice-ink: #8a5d00;
  --ok: #14866d; --warn: #a66200; --off: #72777d;
  --serif: Georgia, "Times New Roman", Times, serif;
  --sans: Arial, Helvetica, "Liberation Sans", sans-serif;
  --mono: Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #101418; --fg: #eaecf0; --muted: #a2a9b1; --link: #88a3e8; --line: #54595d;
    --hair: #2b3036; --panel: #1a1e23; --head: #262b31; --notice: #c99a00; --notice-ink: #f0c040;
    --ok: #4fc1a0; --warn: #e6a43c; --off: #a2a9b1; color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.6 var(--sans); }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
code, pre { font-family: var(--mono); font-size: 13px; }
img { max-width: 100%; }
.skip { position: absolute; left: 8px; top: -48px; padding: 8px 12px; background: var(--bg); border: 1px solid var(--line); z-index: 10; }
.skip:focus { top: 8px; }
.wrap { max-width: 1440px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
@media (min-width: 768px) { .wrap { padding-left: 32px; padding-right: 32px; } }

.site-header { border-bottom: 1px solid var(--hair); }
.site-header .header-row { display: flex; align-items: center; gap: 20px; padding-top: 10px; padding-bottom: 10px; }
.site-header .menu-row { display: none; padding-bottom: 10px; }
.menu-btn { display: none; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 2px; background: var(--bg); color: var(--fg); font: 14px var(--sans); padding: 6px 10px; cursor: pointer; }
/* Logo oficial, transparente, com o mesmo tamanho no cabeçalho e na caixa de informações */
.logo { display: block; flex: none; line-height: 0; }
.logo img, .facts .logo-band img { display: block; width: 110px; height: auto; aspect-ratio: 880 / 455; }
.site-nav { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; font-size: 14px; }
.lang-link { display: inline-flex; align-items: center; gap: 6px; }

.body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 40px; padding-top: 24px; padding-bottom: 48px; }
.rail { font-size: 14px; align-self: start; position: sticky; top: env(safe-area-inset-top, 0px); padding-top: 8px; }
.rail h2 { margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--hair); font: 700 14px var(--sans); }
.rail ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.rail .sub { padding-left: 14px; font-size: 13px; }
.rail .top { color: var(--fg); }
.rail .project { margin-top: 22px; }

.title-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
h1 { margin: 0; font: 400 34px/1.2 var(--serif); }
.tabs { display: flex; justify-content: space-between; gap: 0 16px; flex-wrap: wrap; border-bottom: 1px solid var(--hair); font-size: 14px; }
.tabs ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0 20px; }
.tabs li > * { display: block; padding: 10px 0 8px; }
.tabs .on { color: var(--fg); font-weight: 700; border-bottom: 2px solid var(--fg); }
.tagline { margin: 12px 0 4px; font-size: 13px; color: var(--muted); }

.content { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 28px; padding-top: 16px; align-items: start; }
.article { min-width: 0; display: grid; gap: 14px; }
.article > * { margin: 0; }
.hatnote { padding-left: 24px; font-style: italic; font-size: 14px; color: var(--muted); }
.notice { display: flex; gap: 14px; align-items: center; padding: 10px 14px; background: var(--panel); border: 1px solid var(--line); border-left: 6px solid var(--notice); font-size: 14px; }
.notice svg { flex: none; color: var(--notice-ink); }
.notice p { margin: 0; }
h2.sec { margin-top: 18px; padding-bottom: 4px; border-bottom: 1px solid var(--line); font: 400 24px/1.3 var(--serif); scroll-margin-top: 16px; }
h3.sec { margin-top: 6px; font: 700 16px var(--sans); scroll-margin-top: 16px; }
ul.list { padding-left: 40px; display: grid; gap: 4px; }
.code-block { display: grid; gap: 4px; }
.code-label { font-size: 13px; color: var(--muted); }
pre { margin: 0; padding: 12px 16px; background: var(--panel); border: 1px solid var(--hair); overflow-x: auto; line-height: 1.6; }
table.wikitable { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.45; }
.wikitable th, .wikitable td { border: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; }
.wikitable th { background: var(--head); }
.wikitable td:nth-child(1), .wikitable td:nth-child(2) { width: 170px; }
.st-ok { color: var(--ok); } .st-warn { color: var(--warn); } .st-off { color: var(--off); }
ol.refs { padding-left: 24px; font-size: 13px; display: grid; gap: 6px; }

.facts { background: var(--panel); border: 1px solid var(--line); padding: 6px; font-size: 13px; line-height: 1.4; }
.facts .name { margin: 0; text-align: center; font: 700 19px var(--sans); padding: 6px 0; }
.facts figure { margin: 0; }
.facts .logo-band { padding: 10px 0; display: flex; justify-content: center; }
.facts figcaption { text-align: center; color: var(--muted); font-size: 12px; padding: 4px 0 8px; }
.facts dl { margin: 0; }
.facts .row { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 10px; padding: 5px 6px; border-top: 1px solid var(--hair); }
.facts dt { font-weight: 700; }
.facts dd { margin: 0; overflow-wrap: anywhere; }

.site-footer { border-top: 1px solid var(--hair); }
.site-footer .wrap { padding-top: 20px; padding-bottom: 32px; }
.site-footer .inner { padding-left: 260px; display: grid; gap: 8px; font-size: 13px; color: var(--muted); }
.site-footer p, .site-footer h2, .site-footer ul { margin: 0; }
.site-footer h2 { font: 700 13px var(--sans); color: var(--fg); margin-top: 6px; }
.site-footer ul.privacy { padding-left: 18px; display: grid; gap: 2px; }
.site-footer nav ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; }

/* Tablet: sumário recolhível (botão Conteúdo), artigo e caixa lado a lado */
@media (max-width: 1199px) {
  .site-header .menu-row { display: block; }
  .menu-btn { display: inline-flex; }
  .body { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .rail { position: static; display: none; border: 1px solid var(--hair); background: var(--panel); padding: 12px 16px; }
  .rail.open { display: block; }
  .content { grid-template-columns: minmax(0, 1fr) 280px; }
  .site-footer .inner { padding-left: 0; }
}
/* Celular: uma coluna, caixa de informações logo depois do título, tabela em blocos */
@media (max-width: 767px) {
  .site-header .header-row { flex-wrap: wrap; gap: 10px 14px; }
  .site-nav { margin-left: 0; width: 100%; gap: 6px 16px; }
  h1 { font-size: 28px; }
  .content { grid-template-columns: minmax(0, 1fr); }
  .facts { order: -1; }
  .hatnote { padding-left: 0; }
  ul.list { padding-left: 22px; }
  .wikitable thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .wikitable, .wikitable tbody, .wikitable tr, .wikitable td { display: block; width: auto !important; }
  .wikitable tr { border: 1px solid var(--line); margin-bottom: 10px; }
  .wikitable td { border: 0; border-top: 1px solid var(--hair); display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; }
  .wikitable td:first-child { border-top: 0; background: var(--head); font-weight: 700; }
  .wikitable td::before { content: attr(data-label); font-weight: 700; color: var(--muted); }
}
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`

// Troca de idioma: leva junto a seção aberta (#security etc.); sem JavaScript,
// o link abre o início da outra página. Botão Conteúdo abre/fecha o sumário.
const SCRIPT = `
(function () {
  document.querySelectorAll('a[data-lang-switch]').forEach(function (a) {
    a.addEventListener('click', function () {
      var hash = location.hash;
      if (/^#[A-Za-z0-9_-]+$/.test(hash)) a.href = a.getAttribute('href').split('#')[0] + hash;
    });
  });
  var btn = document.getElementById('menu-btn'), rail = document.getElementById('rail');
  btn.addEventListener('click', function () {
    var open = rail.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    if (open) rail.querySelector('a').focus();
  });
  rail.addEventListener('click', function (e) {
    if (e.target.closest('a') && getComputedStyle(btn).display !== 'none') {
      rail.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
})();
`

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function renderPage(t, { editedDate }) {
  const s = t.sections
  const other = t.otherLang === 'pt' ? '/pt/' : '/'
  const date = new Intl.DateTimeFormat(t.footer.dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(editedDate)
  const factRow = (label, value) => `<div class="row"><dt>${label}</dt><dd>${value}</dd></div>`
  const usage = `import { VersaEdit } from 'versaedit'

&lt;VersaEdit
  initialContent={html}
  onChange={setHtml}
  width="100%"
  height={480}
  locale="${t.htmlLang === 'pt-BR' ? 'pt-BR' : 'en'}"
/&gt;`

  // A marca de referência [1] não quebra para a linha de baixo (o navegador
  // permite quebrar antes de "["): um separador invisível a prende ao texto
  const page = `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="https://versaedit.dev${t.path}">
<link rel="alternate" hreflang="en" href="https://versaedit.dev/">
<link rel="alternate" hreflang="pt-BR" href="https://versaedit.dev/pt/">
<link rel="icon" href="data:,">
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#content">${t.skip}</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="logo" href="${t.path}"><img src="/assets/logo.png" width="110" height="57" alt="VersaEdit"></a>
    <nav class="site-nav" aria-label="${t.nav.label}">
      <a href="/playground/">${t.nav.playground}</a>
      <a href="${t.docsUrl}">${t.nav.docs}</a>
      <a href="${REPO}">${t.nav.github}</a>
      <a class="lang-link" href="${other}" hreflang="${t.otherLang === 'pt' ? 'pt-BR' : 'en'}" lang="${t.otherLang === 'pt' ? 'pt-BR' : 'en'}" data-lang-switch>${ICON.languages}${t.otherLabel}</a>
    </nav>
  </div>
  <div class="wrap menu-row">
    <button type="button" class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="rail">${ICON.menu}<span>${t.nav.contents}</span></button>
  </div>
</header>

<div class="wrap body">
  <nav class="rail" id="rail" aria-label="${t.rail.contents}">
    <h2>${t.rail.contents}</h2>
    <ol>
      <li><a class="top" href="#top">${t.rail.top}</a></li>
${SECTION_IDS.map((id) => {
  const key = { 'see-also': 'seeAlso' }[id] ?? id
  return `      <li${id === 'styling' ? ' class="sub"' : ''}><a href="#${id}">${s[key]}</a></li>`
}).join('\n')}
    </ol>
    <div class="project">
      <h2>${t.rail.project}</h2>
      <ol>
        <li><a href="/playground/">Playground</a></li>
        <li><a href="${REPO}">${t.rail.sourceCode}</a></li>
        <li><a href="${REPO}/blob/main/CHANGELOG.md">${t.rail.changelog}</a></li>
        <li><a href="${REPO}/issues/new/choose">${t.rail.issue}</a></li>
        <li><a href="${REPO}/security/policy">${t.rail.security}</a></li>
      </ol>
    </div>
  </nav>

  <main id="content">
    <div class="title-row" id="top">
      <h1>VersaEdit</h1>
    </div>
    <div class="tabs">
      <ul aria-label="${t.tabs.namespaces}"><li><span class="on" aria-current="page">${t.tabs.article}</span></li><li><a href="/playground/">Playground</a></li></ul>
      <ul aria-label="${t.tabs.views}"><li><span class="on">${t.tabs.read}</span></li><li><a href="${REPO}">${t.tabs.source}</a></li><li><a href="${REPO}/commits/main">${t.tabs.history}</a></li></ul>
    </div>
    <p class="tagline">${t.tagline}</p>

    <div class="content">
      <article class="article">
        <p class="hatnote">${t.hatnote}</p>
        <div class="notice" role="note">${ICON.beta}<p><strong>${t.notice.title}</strong><br>${t.notice.body}</p></div>
${t.lead.map((p) => `        <p>${p}</p>`).join('\n')}

        <h2 class="sec" id="features">${s.features}</h2>
        <ul class="list">
${t.features.map((f) => `          <li>${f}</li>`).join('\n')}
        </ul>

        <h2 class="sec" id="installation">${s.installation}</h2>
        <p>${t.installation}</p>
        <div class="code-block"><span class="code-label" id="install-label">${t.installLabel}</span><pre aria-labelledby="install-label"><code>npm install versaedit@beta</code></pre></div>

        <h2 class="sec" id="usage">${s.usage}</h2>
        <pre><code>${usage}</code></pre>
        <h3 class="sec" id="styling">${s.styling}</h3>
        <p>${t.styling}</p>

        <h2 class="sec" id="security">${s.security}</h2>
        <p>${t.security}</p>

        <h2 class="sec" id="browsers">${s.browsers}</h2>
        <table class="wikitable">
          <thead><tr><th scope="col">${t.table.browser}</th><th scope="col">${t.table.status}</th><th scope="col">${t.table.notes}</th></tr></thead>
          <tbody>
${t.table.rows
  .map(
    ([name, level, status, notes]) =>
      `            <tr><td data-label="${t.table.browser}">${name}</td><td data-label="${t.table.status}" class="st-${level}">${status}</td><td data-label="${t.table.notes}">${notes}</td></tr>`,
  )
  .join('\n')}
          </tbody>
        </table>

        <h2 class="sec" id="limitations">${s.limitations}</h2>
        <ul class="list">
${t.limitations.map((l) => `          <li>${l}</li>`).join('\n')}
        </ul>

        <h2 class="sec" id="see-also">${s.seeAlso}</h2>
        <ul class="list">
${t.seeAlso.map(([href, label, after]) => `          <li><a href="${href}">${label}</a>${after}</li>`).join('\n')}
        </ul>

        <h2 class="sec" id="references">${s.references}</h2>
        <ol class="refs">
${t.references.map(([href, label, after], i) => `          <li id="ref-${i + 1}"><a href="${href}">${label}</a>${after}</li>`).join('\n')}
        </ol>
      </article>

      <aside class="facts" aria-labelledby="facts-name">
        <p class="name" id="facts-name">VersaEdit</p>
        <figure>
          <div class="logo-band"><img src="/assets/logo.png" width="110" height="57" alt="${t.facts.caption}"></div>
          <figcaption>${t.facts.caption}</figcaption>
        </figure>
        <dl>
          ${factRow(t.facts.developer, 'meucom-dev')}
          ${factRow(t.facts.started, '2026')}
          ${factRow(t.facts.preview, t.facts.previewValue)}
          ${factRow(t.facts.playground, '<a href="/playground/">versaedit.dev/playground</a>')}
          ${factRow(t.facts.repository, `<a href="${REPO}">github.com/meucom-dev/versaedit</a>`)}
          ${factRow(t.facts.writtenIn, 'TypeScript')}
          ${factRow(t.facts.framework, 'React 18.3+ / 19')}
          ${factRow(t.facts.dependency, '<a href="https://github.com/cure53/DOMPurify">DOMPurify</a>')}
          ${factRow(t.facts.type, `<a href="${t.facts.typeUrl}">${t.facts.typeValue}</a>`)}
          ${factRow(t.facts.license, `<a href="${REPO}/blob/main/LICENSE">${t.facts.licenseValue}</a>`)}
          ${factRow(t.facts.website, `<a href="${t.path}">versaedit.dev</a>`)}
        </dl>
      </aside>
    </div>
  </main>
</div>

<footer class="site-footer">
  <div class="wrap">
    <div class="inner">
      <p>${t.footer.edited(date)}</p>
      <p>${t.footer.license}</p>
      <h2>${t.footer.privacyTitle}</h2>
      <ul class="privacy">
${t.footer.privacy.map((p) => `        <li>${p}</li>`).join('\n')}
      </ul>
      <nav aria-label="${t.footer.about}">
        <ul>
          <li><a href="${t.docsUrl}">${t.footer.about}</a></li>
          <li><a href="${REPO}/security/policy">${t.footer.security}</a></li>
          <li><a href="mailto:support@versaedit.dev">support@versaedit.dev</a></li>
          <li><a href="${other}" hreflang="${t.otherLang === 'pt' ? 'pt-BR' : 'en'}" lang="${t.otherLang === 'pt' ? 'pt-BR' : 'en'}" data-lang-switch>${t.otherLabel}</a></li>
        </ul>
      </nav>
    </div>
  </div>
</footer>
<script>${SCRIPT}</script>
</body>
</html>
`
  return page.replaceAll('<sup>', '&#8288;<sup>')
}
