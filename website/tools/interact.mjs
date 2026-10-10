// Drives the running site through its interactive states and screenshots each one. Review tool only.
//   node tools/interact.mjs [width height] [--url=...]
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number)
const [width = 1440, height = 900] = nums
const url = (process.argv.find((a) => a.startsWith('--url=')) ?? '--url=http://localhost:5183').slice(6)
const out = 'tools/shots'
mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const mobile = width < 700
const tag = mobile ? 'im' : 'i'

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${tag}-${name}.png` })
  console.log(name)
}
const to = async (sel, p = 0, wait = 1200) => {
  await page.evaluate(
    (s, k) => {
      const el = document.querySelector(s)
      window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * k)
    },
    sel,
    p,
  )
  await sleep(wait)
}

/* Load: the first two seconds, frame by frame. */
await page.goto(url, { waitUntil: 'domcontentloaded' })
for (const ms of [250, 700, 1300, 2200, 3600]) {
  await sleep(ms - (globalThis.last ?? 0))
  globalThis.last = ms
  await shot(`load-${ms}`)
}

/* Themes: every one, by clicking its swatch. */
await to('#yours', 0.5, 1500)
const count = await page.$$eval('.swatch', (els) => els.length)
for (let i = 0; i < count; i++) {
  await page.evaluate((n) => document.querySelectorAll('.swatch')[n].click(), i)
  await sleep(2300)
  await shot(`theme-${String(i + 1).padStart(2, '0')}`)
}
/* Mid cross-fade between two themes. */
await page.evaluate(() => document.querySelectorAll('.swatch')[2].click())
await sleep(650)
await shot('theme-crossfade')
await sleep(1800)

/* Characters. */
for (const name of ['Tutor', 'Creative']) {
  await page.evaluate((n) => [...document.querySelectorAll('.chip')].find((c) => c.textContent === n).click(), name)
  await sleep(900)
  await shot(`character-${name.toLowerCase()}`)
}

/* The lamp follows the pointer. */
if (!mobile) {
  await to('#private', 0.5, 900)
  await page.mouse.move(width * 0.3, height * 0.72, { steps: 12 })
  await sleep(1600)
  await shot('lamp-moved')
}

/* Keyboard focus is visible. */
await to('#climb', 0, 1200)
await page.keyboard.press('Tab')
await shot('focus-skip')
await page.keyboard.press('Tab')
await page.keyboard.press('Tab')
await page.keyboard.press('Tab')
await shot('focus-cta')

/* Model index jumps to a model. */
if (!mobile) {
  await to('#models', 0, 900)
  await page.evaluate(() => document.querySelectorAll('.model-index button')[6].click())
  await sleep(2600)
  await shot('index-jump')
}

/* Nav download link goes to the last section. */
await page.evaluate(() => document.querySelector('.nav .btn').click())
await sleep(3200)
await shot('nav-download')
console.log('scroll after nav click', await page.evaluate(() => Math.round(scrollY)), 'of', await page.evaluate(() => document.documentElement.scrollHeight - innerHeight))

/* Going offline for real. */
await page.setOfflineMode(true)
await sleep(1100)
await shot('offline')
await page.setOfflineMode(false)

console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
