// Screenshots of the running site for review. Not part of the site.
//   node tools/inspect.mjs <label> <width> <height> <y or section[:progress]>...   [--url=http://localhost:5183]
// A target is a pixel offset, or `#id:0.4` for 40% of the way through that section's pinned travel.
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const flag = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${fallback}`).split('=').slice(1).join('=')
const [label, width, height, ...targets] = args
const out = flag('out', 'tools/shots')
mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
const mobile = +width < 700
await page.setViewport({ width: +width, height: +height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
if (flag('reduced', '') === '1') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`))
await page.goto(flag('url', 'http://localhost:5183'), { waitUntil: 'networkidle2' })
await sleep(+flag('wait', 3200))

for (const target of targets) {
  const [what, extra] = target.split('@') // `@1500` waits that long before the shot
  const y = await page.evaluate((t) => {
    if (!t.startsWith('#')) return +t
    const [id, p = '0'] = t.split(':')
    const el = document.querySelector(id)
    const top = el.getBoundingClientRect().top + scrollY
    return Math.round(top + Math.max(0, el.offsetHeight - innerHeight) * +p)
  }, what)
  await page.evaluate((v) => window.scrollTo(0, v), y)
  await sleep(extra ? +extra : 1300)
  const name = `${out}/${label}-${what.replace(/[#:.]/g, (c) => ({ '#': '', ':': '_', '.': '' })[c])}${extra ? `-t${extra}` : ''}.png`
  await page.screenshot({ path: name })
  console.log(name)
}
console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
