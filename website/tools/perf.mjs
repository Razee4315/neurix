// Scrolls the whole page at a steady pace in a real (headed-size) Chrome and reports frame times and
// what the first screen costs to load. Review tool only.
//   node tools/perf.mjs [--url=http://localhost:5184]
import puppeteer from 'puppeteer-core'

const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '--url=http://localhost:5184').slice(6)
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars', '--enable-gpu-rasterization'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const requests = []
page.on('response', async (r) => {
  const len = +(r.headers()['content-length'] ?? 0)
  requests.push({ url: r.url().replace(url, ''), len, t: Date.now() })
})
const t0 = Date.now()
await page.goto(url, { waitUntil: 'networkidle0' })
const first = requests.filter((r) => r.t - t0 < 4000)
console.log(`first screen: ${first.length} requests, ${(first.reduce((n, r) => n + r.len, 0) / 1024).toFixed(0)} KB`)
console.log(first.sort((a, b) => b.len - a.len).slice(0, 8).map((r) => `  ${(r.len / 1024).toFixed(0).padStart(4)} KB  ${r.url}`).join('\n'))

await new Promise((r) => setTimeout(r, 2500))
const result = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const total = document.documentElement.scrollHeight - innerHeight
      const frames = []
      let last = performance.now()
      const start = last
      const duration = 26000
      const tick = (now) => {
        frames.push(now - last)
        last = now
        const k = (now - start) / duration
        if (k >= 1) return resolve({ frames, total })
        window.scrollTo(0, total * k)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }),
)
const f = result.frames.slice(5).sort((a, b) => a - b)
const at = (q) => f[Math.floor(f.length * q)].toFixed(1)
console.log(`scrolled ${result.total}px in ${f.length} frames: median ${at(0.5)}ms, p95 ${at(0.95)}ms, p99 ${at(0.99)}ms, worst ${f.at(-1).toFixed(1)}ms, over 20ms: ${f.filter((x) => x > 20).length}`)
const all = requests.reduce((n, r) => n + r.len, 0)
console.log(`whole page: ${requests.length} requests, ${(all / 1024 / 1024).toFixed(2)} MB`)
await browser.close()
