// Guia rápido (Quick Start) do site, em inglês, português e espanhol. O código
// mostrado vem dos arquivos do exemplo examples/quick-start, o mesmo que o
// test:package instala, compila e testa no navegador (inclusive a partir do
// npm, com --from-registry). Nas outras línguas só mudam comentários, textos da
// interface e o `locale`: cada troca precisa existir no original, senão o build
// do site falha (assim o código do site nunca se afasta do código testado).
import { REPO } from './content.mjs'

const NPM = 'https://www.npmjs.com/package/versaedit'
const GUIDE = `${REPO}/blob/main/docs/integration.md`

// Traduções do código: [texto do original, texto traduzido]
const CODE_PT = {
  'App.tsx': [
    [
      '// Editor styles as a file (used with injectStyles={false}; see "Styles")',
      '// Estilos do editor como arquivo (usado com injectStyles={false}; veja "Estilos")',
    ],
    [
      "'<h2>Hello, VersaEdit</h2><p>Edit this text and click <strong>Save content</strong>.</p>'",
      "'<h2>Olá, VersaEdit</h2><p>Edite este texto e clique em <strong>Salvar conteúdo</strong>.</p>'",
    ],
    [
      '// Latest HTML produced by the editor (updated on every change)',
      '// HTML mais recente produzido pelo editor (atualizado a cada alteração)',
    ],
    [
      '// HTML captured by the "Save content" button',
      '// HTML capturado pelo botão "Salvar conteúdo"',
    ],
    [
      '// getHTML() returns the current content (the same HTML as the onChange state)',
      '// getHTML() devolve o conteúdo atual (o mesmo HTML do estado do onChange)',
    ],
    ['<h1>VersaEdit Quick Start</h1>', '<h1>Guia rápido do VersaEdit</h1>'],
    ['locale="en"', 'locale="pt-BR"'],
    ['          Save content\n', '          Salvar conteúdo\n'],
    ['characters of HTML', 'caracteres de HTML'],
    ['<h2>Captured HTML</h2>', '<h2>HTML capturado</h2>'],
    [
      '{/* Shown as text: React escapes it, nothing is executed */}',
      '{/* Exibido como texto: o React o escapa, nada é executado */}',
    ],
    [
      `'Click "Save content" to capture the HTML.'`,
      `'Clique em "Salvar conteúdo" para capturar o HTML.'`,
    ],
  ],
  'saveContent.ts': [
    [
      '// Sends the HTML to your API (optional: the example above does not call it).',
      '// Envia o HTML para a sua API (opcional: o exemplo acima não a chama).',
    ],
    [
      '// Adjust the URL, the method and the authentication to your backend.',
      '// Ajuste a URL, o método e a autenticação ao seu backend.',
    ],
    [
      '`Could not save: HTTP ${response.status}`',
      '`Não foi possível salvar: HTTP ${response.status}`',
    ],
  ],
}
const CODE_ES = {
  'App.tsx': [
    [
      '// Editor styles as a file (used with injectStyles={false}; see "Styles")',
      '// Estilos del editor como archivo (se usa con injectStyles={false}; véase "Estilos")',
    ],
    [
      "'<h2>Hello, VersaEdit</h2><p>Edit this text and click <strong>Save content</strong>.</p>'",
      "'<h2>Hola, VersaEdit</h2><p>Edite este texto y haga clic en <strong>Guardar contenido</strong>.</p>'",
    ],
    [
      '// Latest HTML produced by the editor (updated on every change)',
      '// HTML más reciente producido por el editor (se actualiza con cada cambio)',
    ],
    [
      '// HTML captured by the "Save content" button',
      '// HTML capturado por el botón "Guardar contenido"',
    ],
    [
      '// getHTML() returns the current content (the same HTML as the onChange state)',
      '// getHTML() devuelve el contenido actual (el mismo HTML del estado de onChange)',
    ],
    ['<h1>VersaEdit Quick Start</h1>', '<h1>Guía rápida de VersaEdit</h1>'],
    ['locale="en"', 'locale="es"'],
    ['          Save content\n', '          Guardar contenido\n'],
    ['characters of HTML', 'caracteres de HTML'],
    ['<h2>Captured HTML</h2>', '<h2>HTML capturado</h2>'],
    [
      '{/* Shown as text: React escapes it, nothing is executed */}',
      '{/* Se muestra como texto: React lo escapa y no se ejecuta nada */}',
    ],
    [
      `'Click "Save content" to capture the HTML.'`,
      `'Haga clic en "Guardar contenido" para capturar el HTML.'`,
    ],
  ],
  'saveContent.ts': [
    [
      '// Sends the HTML to your API (optional: the example above does not call it).',
      '// Envía el HTML a su API (opcional: el ejemplo anterior no la llama).',
    ],
    [
      '// Adjust the URL, the method and the authentication to your backend.',
      '// Ajuste la URL, el método y la autenticación a su backend.',
    ],
    ['`Could not save: HTTP ${response.status}`', '`No se pudo guardar: HTTP ${response.status}`'],
  ],
}

/** Código do exemplo na língua da página; falha se uma tradução não encontrar o original */
export function localizeCode(lang, file, source) {
  const pairs = { en: {}, pt: CODE_PT, es: CODE_ES }[lang][file] ?? []
  let code = source.replace(/\r\n/g, '\n')
  for (const [from, to] of pairs) {
    const count = code.split(from).length - 1
    if (count !== 1) {
      throw new Error(`Quick Start (${lang}, ${file}): "${from}" aparece ${count} vezes`)
    }
    code = code.replace(from, () => to)
  }
  return code
}

// Linhas da tabela de propriedades: [nome, tipo, padrão, descrição, exemplo]
// (padrões conferidos em src/core/defaults.ts e nos tipos publicados)
const PROPS = {
  en: [
    [
      'initialContent',
      'string',
      "''",
      'HTML loaded into the editor (sanitized). Changing it from outside reloads the content and resets undo.',
      'initialContent={html}',
    ],
    [
      'onChange',
      '(html: string) => void',
      '—',
      'Called whenever the HTML changes. The editor ignores the echo of its own changes, so it can feed a React state.',
      'onChange={setHtml}',
    ],
    [
      'ref',
      'Ref&lt;VersaEditHandle&gt;',
      '—',
      'Methods to read and control the content: <code>getHTML()</code>, <code>setHTML()</code>, <code>clear()</code>, <code>focus()</code>, <code>undo()</code>, <code>redo()</code>.',
      'ref={editorRef}',
    ],
    [
      'onSave',
      '(html: string) => void',
      'downloads a .html file',
      'The toolbar Save button hands you the HTML instead of downloading a file.',
      'onSave={saveContent}',
    ],
    [
      'width',
      'number | string',
      '640',
      'Total width: a number is px, a string is any CSS length.',
      'width="100%"',
    ],
    ['height', 'number', '480', 'Total height in px (toolbar and frame included).', 'height={360}'],
    [
      'locale',
      "'en' | 'pt-BR' | 'es'",
      "'en'",
      'Interface language (toolbar, menus, messages, dictation).',
      'locale="pt-BR"',
    ],
    [
      'placeholder',
      'string',
      'language text',
      'Text shown while the editor is empty.',
      'placeholder="Write your post"',
    ],
    [
      'toolbar',
      'readonly ToolbarGroup[]',
      'all groups',
      'Toolbar groups to show, always in the toolbar’s fixed order; <code>[]</code> hides the toolbar. The groups are listed in <code>TOOLBAR_GROUPS</code>.',
      "toolbar={['history', 'format', 'list', 'link']}",
    ],
    [
      'showFileButtons',
      'boolean',
      'true',
      'Shows the Save and Open file buttons.',
      'showFileButtons={false}',
    ],
    [
      'injectStyles',
      'boolean',
      'true',
      'Injects the editor CSS into <code>&lt;head&gt;</code>. With <code>false</code>, import <code>versaedit/versaedit.css</code>.',
      'injectStyles={false}',
    ],
    [
      'onImageUpload',
      '(file: File) => Promise&lt;string&gt;',
      'image stored as base64',
      'Uploads an inserted image and returns its public URL (recommended).',
      'onImageUpload={uploadImage}',
    ],
    [
      'onError',
      '(error: VersaEditError) => void',
      'alert()',
      'Errors and warnings with a stable <code>code</code> (invalid file, truncated content, failed upload).',
      'onError={(e) => toast(e.message)}',
    ],
    [
      'accentColor',
      'string',
      "'#2563eb'",
      'Color of selection outlines, text boxes and handles.',
      'accentColor="#0f766e"',
    ],
    [
      'labels',
      'Partial&lt;VersaEditLabels&gt;',
      '—',
      'Replaces any interface text.',
      "labels={{ placeholder: 'Start here' }}",
    ],
  ],
  pt: [
    [
      'initialContent',
      'string',
      "''",
      'HTML carregado no editor (sanitizado). Alterá-lo por fora recarrega o conteúdo e reinicia o desfazer.',
      'initialContent={html}',
    ],
    [
      'onChange',
      '(html: string) => void',
      '—',
      'Chamado sempre que o HTML muda. O editor ignora o eco das próprias alterações, então pode alimentar um estado do React.',
      'onChange={setHtml}',
    ],
    [
      'ref',
      'Ref&lt;VersaEditHandle&gt;',
      '—',
      'Métodos para ler e controlar o conteúdo: <code>getHTML()</code>, <code>setHTML()</code>, <code>clear()</code>, <code>focus()</code>, <code>undo()</code>, <code>redo()</code>.',
      'ref={editorRef}',
    ],
    [
      'onSave',
      '(html: string) => void',
      'baixa um arquivo .html',
      'O botão Salvar da barra entrega o HTML em vez de baixar um arquivo.',
      'onSave={saveContent}',
    ],
    [
      'width',
      'number | string',
      '640',
      'Largura total: número em px; texto em qualquer medida CSS.',
      'width="100%"',
    ],
    ['height', 'number', '480', 'Altura total em px (barra e moldura incluídas).', 'height={360}'],
    [
      'locale',
      "'en' | 'pt-BR' | 'es'",
      "'en'",
      'Idioma da interface (barra, menus, mensagens, ditado).',
      'locale="pt-BR"',
    ],
    [
      'placeholder',
      'string',
      'texto do idioma',
      'Texto exibido com o editor vazio.',
      'placeholder="Escreva seu artigo"',
    ],
    [
      'toolbar',
      'readonly ToolbarGroup[]',
      'todos os grupos',
      'Grupos da barra a exibir, sempre na ordem fixa da barra; <code>[]</code> esconde a barra. Os grupos estão em <code>TOOLBAR_GROUPS</code>.',
      "toolbar={['history', 'format', 'list', 'link']}",
    ],
    [
      'showFileButtons',
      'boolean',
      'true',
      'Mostra os botões Salvar e Abrir arquivo.',
      'showFileButtons={false}',
    ],
    [
      'injectStyles',
      'boolean',
      'true',
      'Injeta o CSS do editor no <code>&lt;head&gt;</code>. Com <code>false</code>, importe <code>versaedit/versaedit.css</code>.',
      'injectStyles={false}',
    ],
    [
      'onImageUpload',
      '(file: File) => Promise&lt;string&gt;',
      'imagem gravada em base64',
      'Envia a imagem inserida e devolve a URL pública dela (recomendado).',
      'onImageUpload={enviarImagem}',
    ],
    [
      'onError',
      '(error: VersaEditError) => void',
      'alert()',
      'Erros e avisos com um <code>code</code> estável (arquivo inválido, conteúdo cortado, falha no envio).',
      'onError={(e) => aviso(e.message)}',
    ],
    [
      'accentColor',
      'string',
      "'#2563eb'",
      'Cor dos contornos de seleção, caixas de texto e alças.',
      'accentColor="#0f766e"',
    ],
    [
      'labels',
      'Partial&lt;VersaEditLabels&gt;',
      '—',
      'Troca qualquer texto da interface.',
      "labels={{ placeholder: 'Comece aqui' }}",
    ],
  ],
  es: [
    [
      'initialContent',
      'string',
      "''",
      'HTML que se carga en el editor (saneado). Cambiarlo desde fuera recarga el contenido y reinicia el deshacer.',
      'initialContent={html}',
    ],
    [
      'onChange',
      '(html: string) => void',
      '—',
      'Se llama cada vez que cambia el HTML. El editor ignora el eco de sus propios cambios, por lo que puede alimentar un estado de React.',
      'onChange={setHtml}',
    ],
    [
      'ref',
      'Ref&lt;VersaEditHandle&gt;',
      '—',
      'Métodos para leer y controlar el contenido: <code>getHTML()</code>, <code>setHTML()</code>, <code>clear()</code>, <code>focus()</code>, <code>undo()</code>, <code>redo()</code>.',
      'ref={editorRef}',
    ],
    [
      'onSave',
      '(html: string) => void',
      'descarga un archivo .html',
      'El botón Guardar de la barra entrega el HTML en lugar de descargar un archivo.',
      'onSave={saveContent}',
    ],
    [
      'width',
      'number | string',
      '640',
      'Ancho total: un número son px; un texto, cualquier medida CSS.',
      'width="100%"',
    ],
    ['height', 'number', '480', 'Alto total en px (barra y marco incluidos).', 'height={360}'],
    [
      'locale',
      "'en' | 'pt-BR' | 'es'",
      "'en'",
      'Idioma de la interfaz (barra, menús, mensajes, dictado).',
      'locale="es"',
    ],
    [
      'placeholder',
      'string',
      'texto del idioma',
      'Texto que se muestra con el editor vacío.',
      'placeholder="Escriba su artículo"',
    ],
    [
      'toolbar',
      'readonly ToolbarGroup[]',
      'todos los grupos',
      'Grupos de la barra que se muestran, siempre en el orden fijo de la barra; <code>[]</code> oculta la barra. Los grupos están en <code>TOOLBAR_GROUPS</code>.',
      "toolbar={['history', 'format', 'list', 'link']}",
    ],
    [
      'showFileButtons',
      'boolean',
      'true',
      'Muestra los botones Guardar y Abrir archivo.',
      'showFileButtons={false}',
    ],
    [
      'injectStyles',
      'boolean',
      'true',
      'Inyecta el CSS del editor en <code>&lt;head&gt;</code>. Con <code>false</code>, importe <code>versaedit/versaedit.css</code>.',
      'injectStyles={false}',
    ],
    [
      'onImageUpload',
      '(file: File) => Promise&lt;string&gt;',
      'imagen guardada en base64',
      'Sube la imagen insertada y devuelve su URL pública (recomendado).',
      'onImageUpload={subirImagen}',
    ],
    [
      'onError',
      '(error: VersaEditError) => void',
      'alert()',
      'Errores y avisos con un <code>code</code> estable (archivo no válido, contenido recortado, fallo en la subida).',
      'onError={(e) => aviso(e.message)}',
    ],
    [
      'accentColor',
      'string',
      "'#2563eb'",
      'Color de los contornos de selección, cuadros de texto y tiradores.',
      'accentColor="#0f766e"',
    ],
    [
      'labels',
      'Partial&lt;VersaEditLabels&gt;',
      '—',
      'Reemplaza cualquier texto de la interfaz.',
      "labels={{ placeholder: 'Empiece aquí' }}",
    ],
  ],
}

export const QUICKSTART = {
  en: {
    path: '/quick-start/',
    title: 'Quick Start',
    description:
      'Install VersaEdit from npm and add a working rich text editor to a React app in a few minutes.',
    navLabel: 'Quick Start',
    tagline: 'From versaedit.dev, the open-source rich text editor for React',
    intro: [
      'This guide adds VersaEdit to a React application with TypeScript and Vite: installation, a complete example that captures the edited HTML, the essential properties and how to send the content to your backend. It is based on the published beta, <a href="' +
        NPM +
        '">0.5.0-beta.1</a>.',
      'Requirements: React 18.3 or 19 and a bundler that imports CSS files, such as Vite or Next.js.',
    ],
    sections: {
      install: 'Installation',
      example: 'Complete example',
      styles: 'Styles',
      props: 'Essential properties',
      ref: 'Ref methods',
      flow: 'Capturing and saving the HTML',
      security: 'Security',
      next: 'Next steps',
    },
    install: {
      latest: 'Current beta',
      pinned: 'Specific version',
      text: '<code>versaedit@beta</code> installs the most recent beta and records it in <code>package.json</code> with a range (<code>^0.5.0-beta.1</code>), so a later <code>npm install</code> or <code>npm update</code> may bring a newer beta. <code>versaedit@0.5.0-beta.1</code> installs exactly this version; add <code>--save-exact</code> to record it without a range, so every installation gets the same version until you change it. While the API may still change before 1.0, pinning the version is the safer choice for production.',
      newProject:
        'No project yet? Create one with Vite (React + TypeScript), then install VersaEdit inside it:',
    },
    example: {
      text: 'Replace <code>src/App.tsx</code> with the code below. The editor starts with an HTML document, every change updates a React state through <code>onChange</code>, and <strong>Save content</strong> reads the HTML with <code>getHTML()</code> and shows it on the page.',
      fileApp: 'src/App.tsx',
      template:
        "In a project created with the Vite template, also remove <code>import './index.css'</code> from <code>src/main.tsx</code> (or empty that file): the template centers the page text, and the editor would inherit that alignment.",
      run: 'Run <code>npm run dev</code> and open the address shown by Vite. Type in the editor and click <strong>Save content</strong>: the HTML appears below the editor, displayed as text.',
      tested:
        'This is the code of the <a href="' +
        REPO +
        '/tree/main/examples/quick-start">quick-start example</a>, compiled and tested in a browser with the package installed from npm.',
    },
    styles:
      'By default the editor injects its own stylesheet, so no import is needed. The example turns injection off (<code>injectStyles={false}</code>) and imports <code>versaedit/versaedit.css</code> instead, which is required on sites with a strict Content Security Policy. To display saved content on your site, wrap it in an element with the <code>versaedit-content</code> class and import <code>versaedit/versaedit-content.css</code>.',
    props: {
      intro: 'All properties are optional. The most used ones:',
      head: ['Property', 'Type', 'Required', 'Default', 'Description', 'Example'],
      no: 'No',
      more:
        'The complete list (frame, fonts, colors, dictation, paste and overflow options) is in the <a href="' +
        REPO +
        '#props">README</a>.',
    },
    ref: {
      intro: 'With <code>ref</code>, the application reads and controls the editor at any time:',
      head: ['Method', 'Description'],
      rows: [
        ['getHTML(): string', 'Current HTML (with the paper color, when set).'],
        ['setHTML(html: string): void', 'Replaces the content (resets undo).'],
        ['clear(): void', 'Erases all content.'],
        ['focus(): void', 'Puts the cursor back in the editor.'],
        ['undo() / redo()', 'Undo and redo, as with the toolbar buttons.'],
      ],
    },
    flow: {
      steps: [
        'The user edits',
        'VersaEdit produces HTML',
        'React captures it',
        'Your application saves it',
      ],
      text: 'React captures the HTML in two ways: <code>onChange</code> on every change (for a state, a draft or a character count) and <code>getHTML()</code> through the ref when you need it (for example, when saving). VersaEdit does not replace your backend or your database: it only hands the HTML to the application, which decides where to store it (Supabase, Firebase, a REST API…).',
      fetchText:
        'A function that sends the HTML to an API with <code>fetch</code>. It is optional: the example above runs without any backend.',
      fileSave: 'src/saveContent.ts',
      usage: 'To save to your API from the example, call it in <code>handleSave</code>:',
    },
    security:
      'The editor sanitizes everything it receives (DOMPurify and its own allow-lists), but it runs in the user’s browser, where it can be bypassed. Your server must validate and sanitize the HTML again before storing or publishing it, according to your application’s security policy. The <a href="' +
      GUIDE +
      '">integration guide</a> includes a tested server-side recipe.',
    next: [
      'Try every tool in the <a href="/playground/">Playground</a>.',
      'All properties, error codes and toolbar groups: <a href="' + REPO + '#readme">README</a>.',
      'Image upload, server-side sanitization and display: <a href="' +
        GUIDE +
        '">integration guide</a>.',
      'More examples (Vite and Next.js): <a href="' +
        REPO +
        '/tree/main/examples">examples folder</a>.',
    ],
  },

  pt: {
    path: '/pt/guia-rapido/',
    title: 'Guia rápido',
    description:
      'Instale o VersaEdit pelo npm e coloque um editor de texto rico funcionando numa aplicação React em poucos minutos.',
    navLabel: 'Guia rápido',
    tagline: 'De versaedit.dev, o editor de texto rico de código aberto para React',
    intro: [
      'Este guia coloca o VersaEdit numa aplicação React com TypeScript e Vite: instalação, um exemplo completo que captura o HTML editado, as propriedades essenciais e como enviar o conteúdo para o seu backend. Ele se baseia na versão beta publicada, <a href="' +
        NPM +
        '">0.5.0-beta.1</a>.',
      'Requisitos: React 18.3 ou 19 e um bundler que importe arquivos CSS, como o Vite ou o Next.js.',
    ],
    sections: {
      install: 'Instalação',
      example: 'Exemplo completo',
      styles: 'Estilos',
      props: 'Propriedades essenciais',
      ref: 'Métodos da ref',
      flow: 'Captura e gravação do HTML',
      security: 'Segurança',
      next: 'Próximos passos',
    },
    install: {
      latest: 'Beta atual',
      pinned: 'Versão específica',
      text: '<code>versaedit@beta</code> instala a beta mais recente e a registra no <code>package.json</code> com uma faixa (<code>^0.5.0-beta.1</code>); assim, um <code>npm install</code> ou <code>npm update</code> posterior pode trazer uma beta mais nova. <code>versaedit@0.5.0-beta.1</code> instala exatamente esta versão; acrescente <code>--save-exact</code> para registrá-la sem faixa, e toda instalação recebe a mesma versão até você trocá-la. Como a API ainda pode mudar antes da 1.0, fixar a versão é a escolha mais segura para produção.',
      newProject:
        'Ainda não tem um projeto? Crie um com o Vite (React + TypeScript) e instale o VersaEdit dentro dele:',
    },
    example: {
      text: 'Substitua o <code>src/App.tsx</code> pelo código abaixo. O editor começa com um documento HTML, cada alteração atualiza um estado do React pelo <code>onChange</code>, e <strong>Salvar conteúdo</strong> lê o HTML com <code>getHTML()</code> e o mostra na página.',
      fileApp: 'src/App.tsx',
      template:
        "Num projeto criado com o modelo do Vite, retire também o <code>import './index.css'</code> do <code>src/main.tsx</code> (ou esvazie esse arquivo): o modelo centraliza o texto da página, e o editor herdaria esse alinhamento.",
      run: 'Rode <code>npm run dev</code> e abra o endereço indicado pelo Vite. Digite no editor e clique em <strong>Salvar conteúdo</strong>: o HTML aparece abaixo do editor, exibido como texto.',
      tested:
        'Este é o código do <a href="' +
        REPO +
        '/tree/main/examples/quick-start">exemplo quick-start</a>, compilado e testado no navegador com o pacote instalado do npm; aqui, só os comentários, os textos da tela e o <code>locale</code> estão em português.',
    },
    styles:
      'Por padrão o editor injeta a própria folha de estilos, então nenhuma importação é necessária. O exemplo desliga a injeção (<code>injectStyles={false}</code>) e importa <code>versaedit/versaedit.css</code> no lugar, o que é obrigatório em sites com política de segurança de conteúdo (CSP) restrita. Para exibir o conteúdo salvo no seu site, coloque-o num elemento com a classe <code>versaedit-content</code> e importe <code>versaedit/versaedit-content.css</code>.',
    props: {
      intro: 'Todas as propriedades são opcionais. As mais usadas:',
      head: ['Propriedade', 'Tipo', 'Obrigatória', 'Padrão', 'Descrição', 'Exemplo'],
      no: 'Não',
      more:
        'A lista completa (moldura, fontes, cores, ditado, colagem e excesso de conteúdo) está no <a href="' +
        REPO +
        '/blob/main/README.pt-BR.md">README</a>.',
    },
    ref: {
      intro: 'Com a <code>ref</code>, a aplicação lê e controla o editor a qualquer momento:',
      head: ['Método', 'Descrição'],
      rows: [
        ['getHTML(): string', 'HTML atual (com a cor do papel, quando definida).'],
        ['setHTML(html: string): void', 'Troca o conteúdo (reinicia o desfazer).'],
        ['clear(): void', 'Apaga todo o conteúdo.'],
        ['focus(): void', 'Devolve o cursor ao editor.'],
        ['undo() / redo()', 'Desfazer e refazer, como os botões da barra.'],
      ],
    },
    flow: {
      steps: ['O usuário edita', 'O VersaEdit produz HTML', 'O React captura', 'A aplicação salva'],
      text: 'O React captura o HTML de dois jeitos: pelo <code>onChange</code>, a cada alteração (para um estado, um rascunho ou uma contagem de caracteres), e pelo <code>getHTML()</code> da ref, quando você precisar (por exemplo, ao salvar). O VersaEdit não substitui o seu backend nem o seu banco de dados: ele só entrega o HTML à aplicação, que decide onde guardá-lo (Supabase, Firebase, uma API REST…).',
      fetchText:
        'Uma função que envia o HTML para uma API com <code>fetch</code>. Ela é opcional: o exemplo acima funciona sem backend.',
      fileSave: 'src/saveContent.ts',
      usage: 'Para gravar na sua API a partir do exemplo, chame-a no <code>handleSave</code>:',
    },
    security:
      'O editor sanitiza tudo o que recebe (DOMPurify e listas de permissão próprias), mas ele roda no navegador do usuário, onde pode ser contornado. O seu servidor deve validar e sanitizar o HTML de novo antes de gravá-lo ou publicá-lo, conforme a política de segurança da sua aplicação. O <a href="' +
      GUIDE +
      '">guia de integração</a> inclui uma receita testada para o servidor.',
    next: [
      'Experimente todas as ferramentas no <a href="/playground/">Playground</a>.',
      'Todas as propriedades, códigos de erro e grupos da barra: <a href="' +
        REPO +
        '/blob/main/README.pt-BR.md">README</a>.',
      'Envio de imagens, sanitização no servidor e exibição: <a href="' +
        GUIDE +
        '">guia de integração</a> (em inglês).',
      'Mais exemplos (Vite e Next.js): <a href="' +
        REPO +
        '/tree/main/examples">pasta de exemplos</a>.',
    ],
  },

  es: {
    path: '/es/guia-rapida/',
    title: 'Guía rápida',
    description:
      'Instale VersaEdit desde npm y añada un editor de texto enriquecido funcional a una aplicación React en pocos minutos.',
    navLabel: 'Guía rápida',
    tagline: 'De versaedit.dev, el editor de texto enriquecido de código abierto para React',
    intro: [
      'Esta guía añade VersaEdit a una aplicación React con TypeScript y Vite: instalación, un ejemplo completo que captura el HTML editado, las propiedades esenciales y cómo enviar el contenido a su backend. Se basa en la versión beta publicada, <a href="' +
        NPM +
        '">0.5.0-beta.1</a>.',
      'Requisitos: React 18.3 o 19 y un bundler que importe archivos CSS, como Vite o Next.js.',
    ],
    sections: {
      install: 'Instalación',
      example: 'Ejemplo completo',
      styles: 'Estilos',
      props: 'Propiedades esenciales',
      ref: 'Métodos de la ref',
      flow: 'Captura y guardado del HTML',
      security: 'Seguridad',
      next: 'Próximos pasos',
    },
    install: {
      latest: 'Beta actual',
      pinned: 'Versión específica',
      text: '<code>versaedit@beta</code> instala la beta más reciente y la registra en <code>package.json</code> con un rango (<code>^0.5.0-beta.1</code>), por lo que un <code>npm install</code> o <code>npm update</code> posterior puede traer una beta más nueva. <code>versaedit@0.5.0-beta.1</code> instala exactamente esta versión; añada <code>--save-exact</code> para registrarla sin rango, y cada instalación recibirá la misma versión hasta que usted la cambie. Como la API aún puede cambiar antes de la 1.0, fijar la versión es la opción más segura para producción.',
      newProject:
        '¿Aún no tiene un proyecto? Cree uno con Vite (React + TypeScript) e instale VersaEdit en él:',
    },
    example: {
      text: 'Sustituya <code>src/App.tsx</code> por el código siguiente. El editor empieza con un documento HTML, cada cambio actualiza un estado de React mediante <code>onChange</code>, y <strong>Guardar contenido</strong> lee el HTML con <code>getHTML()</code> y lo muestra en la página.',
      fileApp: 'src/App.tsx',
      template:
        "En un proyecto creado con la plantilla de Vite, quite también <code>import './index.css'</code> de <code>src/main.tsx</code> (o vacíe ese archivo): la plantilla centra el texto de la página y el editor heredaría esa alineación.",
      run: 'Ejecute <code>npm run dev</code> y abra la dirección que indica Vite. Escriba en el editor y haga clic en <strong>Guardar contenido</strong>: el HTML aparece debajo del editor, mostrado como texto.',
      tested:
        'Este es el código del <a href="' +
        REPO +
        '/tree/main/examples/quick-start">ejemplo quick-start</a>, compilado y probado en el navegador con el paquete instalado desde npm; aquí solo los comentarios, los textos de la pantalla y el <code>locale</code> están en español.',
    },
    styles:
      'De forma predeterminada, el editor inyecta su propia hoja de estilos, por lo que no hace falta ninguna importación. El ejemplo desactiva la inyección (<code>injectStyles={false}</code>) e importa <code>versaedit/versaedit.css</code> en su lugar, lo que es obligatorio en sitios con una política de seguridad de contenido (CSP) estricta. Para mostrar el contenido guardado en su sitio, colóquelo en un elemento con la clase <code>versaedit-content</code> e importe <code>versaedit/versaedit-content.css</code>.',
    props: {
      intro: 'Todas las propiedades son opcionales. Las más usadas:',
      head: ['Propiedad', 'Tipo', 'Obligatoria', 'Predeterminado', 'Descripción', 'Ejemplo'],
      no: 'No',
      more:
        'La lista completa (marco, fuentes, colores, dictado, pegado y desbordamiento) está en el <a href="' +
        REPO +
        '/blob/main/README.es.md">README</a>.',
    },
    ref: {
      intro:
        'Con la <code>ref</code>, la aplicación lee y controla el editor en cualquier momento:',
      head: ['Método', 'Descripción'],
      rows: [
        ['getHTML(): string', 'HTML actual (con el color del papel, si está definido).'],
        ['setHTML(html: string): void', 'Reemplaza el contenido (reinicia el deshacer).'],
        ['clear(): void', 'Borra todo el contenido.'],
        ['focus(): void', 'Devuelve el cursor al editor.'],
        ['undo() / redo()', 'Deshacer y rehacer, como los botones de la barra.'],
      ],
    },
    flow: {
      steps: [
        'El usuario edita',
        'VersaEdit produce HTML',
        'React lo captura',
        'La aplicación lo guarda',
      ],
      text: 'React captura el HTML de dos maneras: con <code>onChange</code>, en cada cambio (para un estado, un borrador o un recuento de caracteres), y con <code>getHTML()</code> de la ref, cuando lo necesite (por ejemplo, al guardar). VersaEdit no sustituye a su backend ni a su base de datos: solo entrega el HTML a la aplicación, que decide dónde guardarlo (Supabase, Firebase, una API REST…).',
      fetchText:
        'Una función que envía el HTML a una API con <code>fetch</code>. Es opcional: el ejemplo anterior funciona sin backend.',
      fileSave: 'src/saveContent.ts',
      usage: 'Para guardar en su API desde el ejemplo, llámela en <code>handleSave</code>:',
    },
    security:
      'El editor sanea todo lo que recibe (DOMPurify y sus propias listas de permitidos), pero se ejecuta en el navegador del usuario, donde puede eludirse. Su servidor debe validar y sanear el HTML de nuevo antes de guardarlo o publicarlo, según la política de seguridad de su aplicación. La <a href="' +
      GUIDE +
      '">guía de integración</a> incluye una receta probada para el servidor.',
    next: [
      'Pruebe todas las herramientas en el <a href="/playground/">Playground</a>.',
      'Todas las propiedades, códigos de error y grupos de la barra: <a href="' +
        REPO +
        '/blob/main/README.es.md">README</a>.',
      'Subida de imágenes, saneamiento en el servidor y visualización: <a href="' +
        GUIDE +
        '">guía de integración</a> (en inglés).',
      'Más ejemplos (Vite y Next.js): <a href="' +
        REPO +
        '/tree/main/examples">carpeta de ejemplos</a>.',
    ],
  },
}

for (const key of Object.keys(QUICKSTART)) QUICKSTART[key].props.rows = PROPS[key]

// Comandos do guia (iguais nos três idiomas)
export const COMMANDS = {
  latest: 'npm install versaedit@beta',
  pinned: 'npm install versaedit@0.5.0-beta.1',
  newProject:
    'npm create vite@latest my-editor -- --template react-ts\ncd my-editor\nnpm install\nnpm install versaedit@beta',
  usage:
    "import { saveContent } from './saveContent'\n\nasync function handleSave() {\n  const current = editorRef.current?.getHTML() ?? html\n  setSavedHtml(current)\n  await saveContent(current)\n}",
}
