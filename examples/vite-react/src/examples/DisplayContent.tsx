// Stylesheet for displaying saved content (wrap it in .versaedit-content)
import 'versaedit/versaedit-content.css'

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgaPj/HwAEhQJ/UhG2BwAAAABJRU5ErkJggg=='

// HTML as the editor saves it (in a real site: loaded from your backend and
// sanitized on the server)
const SAVED =
  `<h2>Published post</h2><img src="${PIXEL}" class="pos-right" style="width: 120px" alt="Blue square">` +
  '<p>An image floated to the right, a text box and a table, styled for readers.</p>' +
  '<div class="rich-textbox"><span contenteditable="false" class="textbox-handle">⠿</span>Text box: the drag handle is hidden.</div>' +
  '<table><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody><tr><td>Bread</td><td>2</td></tr></tbody></table>'

export function DisplayContent() {
  return (
    <section
      className="versaedit-content"
      data-testid="display"
      dangerouslySetInnerHTML={{ __html: SAVED }}
    />
  )
}
