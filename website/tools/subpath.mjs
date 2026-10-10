// Serves dist/ under a sub-path, the way GitHub Pages does, loads it in Chrome and reports anything that
// failed to load. Review tool only.
//   npm run build && node tools/subpath.mjs [neurix]     (pass "" to test from the root)
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
// The path is given without slashes (Git Bash rewrites arguments that look like absolute paths).
const name = (process.argv[2] ?? 'neurix').split('/').filter(Boolean).join('/')
const base = name ? '/' + name + '/' : '/'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' }

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (!path.startsWith(base)) return res.writeHead(404).end('outside base')
  let file = join(dist, path.slice(base.length) || 'index.html')
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) return res.writeHead(404).end('missing')
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}).listen(0)
const url = `http://localhost:${server.address().port}${base}`

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const bad = []
let ok = 0
page.on('response', (r) => (r.status() >= 400 ? bad.push(`${r.status()} ${r.url()}`) : ok++))
page.on('requestfailed', (r) => bad.push(`failed ${r.url()}`))
page.on('pageerror', (e) => bad.push(`pageerror ${e.message}`))
await page.goto(url, { waitUntil: 'networkidle0' })
// Walk the whole page so every lazy image is requested.
const height = await page.evaluate(() => document.documentElement.scrollHeight)
for (let y = 0; y <= height; y += 700) {
  await page.evaluate((v) => window.scrollTo(0, v), y)
  await new Promise((r) => setTimeout(r, 220))
}
await new Promise((r) => setTimeout(r, 1500))
const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))
console.log(`${url}\n${ok} responses ok, ${bad.length} bad, fonts loaded: ${fonts.join(', ')}`)
if (bad.length) console.log(bad.join('\n'))
await browser.close()
server.close()
process.exit(bad.length ? 1 : 0)
