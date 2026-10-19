// Servidor estático mínimo para os testes do site (como o GitHub Pages:
// /pasta/ serve pasta/index.html). Uso: node scripts/serve-static.mjs site 5183
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const [dir = 'site', port = '5183'] = process.argv.slice(2)
const ROOT = path.resolve(dir)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    let file = path.join(ROOT, url)
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end()
      return
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  .listen(Number(port), () => console.log(`site em http://localhost:${port}`))
