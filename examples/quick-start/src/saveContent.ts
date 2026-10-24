// Sends the HTML to your API (optional: the example above does not call it).
// Adjust the URL, the method and the authentication to your backend.
export async function saveContent(html: string): Promise<void> {
  const response = await fetch('/api/documents/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  if (!response.ok) {
    throw new Error(`Could not save: HTTP ${response.status}`)
  }
}
