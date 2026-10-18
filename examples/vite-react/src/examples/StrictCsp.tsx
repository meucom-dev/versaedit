import { VersaEdit } from 'versaedit'
// With a Content Security Policy that blocks <style> elements, import the
// stylesheet (once, anywhere in the app) and turn injection off
import 'versaedit/versaedit.css'

export function StrictCsp() {
  return (
    <VersaEdit
      initialContent="<p>The editor CSS comes from <code>versaedit/versaedit.css</code>.</p>"
      injectStyles={false}
      width="100%"
      height={260}
    />
  )
}
