// Server-side sanitization of HTML produced by VersaEdit (Node.js).
// Requires: npm install dompurify jsdom
// Tested by tests/unit/recipes.test.ts: editor output passes through unchanged and
// the XSS battery comes out harmless.
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const purify = createDOMPurify(new JSDOM('').window)

purify.addHook('afterSanitizeAttributes', (node) => {
  // Links saved by the editor open in a new tab: keep target, always with a safe rel
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
  // Only contenteditable="false" (the text box drag handle) is kept
  if (node.hasAttribute('contenteditable') && node.getAttribute('contenteditable') !== 'false') {
    node.removeAttribute('contenteditable')
  }
})

export function sanitizeOnServer(html: string): string {
  return purify.sanitize(html, {
    ADD_ATTR: ['target', 'contenteditable'],
    // Same exclusions as the editor: no SVG/MathML, forms or embedded documents
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
