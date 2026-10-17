// Vetores de XSS conhecidos (baseados na OWASP XSS Filter Evasion Cheat Sheet e em
// casos de mXSS publicados). Em vez de alert(), chamam window.__xss(id): se algum
// for executado, o teste de navegador (tests/e2e/xss.spec.ts) registra o id.
const hit = (id: string) => `window.__xss&&window.__xss('${id}')`

export const XSS_VECTORS: [id: string, html: string][] = [
  ['script', `<script>${hit('script')}</script>`],
  ['img-onerror', `<img src=x onerror="${hit('img-onerror')}">`],
  ['img-onerror-sem-aspas', `<img src=x onerror=${hit('img-onerror-sem-aspas')}>`],
  ['svg-onload', `<svg onload="${hit('svg-onload')}"></svg>`],
  ['svg-script', `<svg><script>${hit('svg-script')}</script></svg>`],
  ['body-onload', `<body onload="${hit('body-onload')}">x</body>`],
  ['iframe-src', `<iframe src="javascript:${hit('iframe-src')}"></iframe>`],
  ['iframe-srcdoc', `<iframe srcdoc="<script>${hit('iframe-srcdoc')}</script>"></iframe>`],
  ['a-javascript', `<a href="javascript:${hit('a-javascript')}">x</a>`],
  ['a-javascript-tab', `<a href="java\tscript:${hit('a-javascript-tab')}">x</a>`],
  ['a-javascript-newline', `<a href="java\nscript:${hit('a-javascript-newline')}">x</a>`],
  ['a-javascript-entidade', `<a href="&#106;avascript:${hit('a-javascript-entidade')}">x</a>`],
  ['a-javascript-hex', `<a href="&#x6A;avascript:${hit('a-javascript-hex')}">x</a>`],
  ['a-javascript-espaco', `<a href=" javascript:${hit('a-javascript-espaco')}">x</a>`],
  ['a-vbscript', `<a href="vbscript:msgbox(1)">x</a>`],
  ['a-data-html', `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`],
  ['img-data-svg', `<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">`],
  ['object', `<object data="javascript:${hit('object')}"></object>`],
  ['embed', `<embed src="javascript:${hit('embed')}">`],
  ['base', `<base href="javascript:${hit('base')}//">`],
  ['meta-refresh', `<meta http-equiv="refresh" content="0;url=javascript:${hit('meta-refresh')}">`],
  ['link-import', `<link rel="import" href="https://evil.example/x.html">`],
  ['style-tag', `<style>@import 'https://evil.example/x.css';</style><p>t</p>`],
  ['form-action', `<form action="javascript:${hit('form-action')}"><button>x</button></form>`],
  ['button-formaction', `<button formaction="javascript:${hit('button-formaction')}">x</button>`],
  ['input-autofocus', `<input autofocus onfocus="${hit('input-autofocus')}">`],
  ['details-ontoggle', `<details open ontoggle="${hit('details-ontoggle')}">x</details>`],
  ['video-source', `<video><source onerror="${hit('video-source')}"></video>`],
  ['marquee', `<marquee onstart="${hit('marquee')}">x</marquee>`],
  ['div-onmouseover', `<div onmouseover="${hit('div-onmouseover')}">x</div>`],
  ['template', `<template><script>${hit('template')}</script></template>`],
  [
    'noscript-mxss',
    `<noscript><p title="</noscript><img src=x onerror=${hit('noscript-mxss')}>"></noscript>`,
  ],
  [
    'math-mxss',
    `<math><mtext><table><mglyph><style><img src=x onerror=${hit('math-mxss')}></style></mglyph></table></mtext></math>`,
  ],
  ['svg-xlink', `<svg><a xlink:href="javascript:${hit('svg-xlink')}"><text>x</text></a></svg>`],
  ['style-url', `<div style="background:url(javascript:${hit('style-url')})">x</div>`],
  ['style-expression', `<img src="a.png" style="width:expression(${hit('style-expression')})">`],
  ['style-behavior', `<span style="behavior:url(x.htc)">x</span>`],
  ['style-moz-binding', `<span style="-moz-binding:url(x.xml#x)">x</span>`],
  [
    'textbox-handler',
    `<div class="rich-textbox" contenteditable="true" onmouseover="${hit('textbox-handler')}">x</div>`,
  ],
  [
    'img-layout-url',
    `<img src="a.png" style="border-top:1px solid url(javascript:1);transform:url(x)">`,
  ],
  [
    'papel-css',
    `<div class="ve-paper" data-paper="red;background:url(https://evil.example/t)" style=""><p>t</p></div>`,
  ],
  [
    'comentario-condicional',
    `<!--[if gte IE 4]><script>${hit('comentario-condicional')}</script><![endif]-->`,
  ],
]
