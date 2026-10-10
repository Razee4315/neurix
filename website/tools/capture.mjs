// Captures the real Neurix interface for the site. Needs the app's own dev server running on :1420
// (`npm run dev` in the app folder), which serves the UI against its in-memory mock backend.
//
//   node tools/capture.mjs            screenshots + live snapshot
//   node tools/capture.mjs shots      screenshots only
//   node tools/capture.mjs snapshot   live snapshot only
//
// Two outputs:
//   captures/*.png            real screenshots, 390x844 at 3x (and one desktop window)
//   src/app/snapshot.json     the chat screen's real rendered HTML and CSS, so the site can show it
//                             live (streaming text, theme and character changes) instead of as a picture
//
// All data on screen is the demo data in tools/seed.mjs. Nothing here reads real user data.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { PROMPT, seed } from './seed.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = join(root, 'captures')
const APP = 'http://localhost:1420/'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const want = process.argv[2] ?? 'all'
mkdirSync(SHOTS, { recursive: true })
mkdirSync(join(root, 'src', 'app'), { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] })

async function open(state, viewport) {
  const page = await browser.newPage()
  await page.setViewport(viewport)
  await page.goto(APP, { waitUntil: 'networkidle0' })
  await page.evaluate((s) => {
    localStorage.clear()
    localStorage.setItem('neurix.mock', JSON.stringify(s))
    localStorage.setItem('neurix.coach.subtitle.v2', 'seen') // the one-time tip would cover the chat
  }, state)
  await page.goto(APP, { waitUntil: 'networkidle0' })
  await sleep(2400) // splash loads the last model, then routes to chat
  return page
}

const go = async (page, hash, wait = 1100) => {
  await page.evaluate((h) => (location.hash = h), hash)
  await sleep(wait)
}

// Clicks the first button whose text or label matches (or the last one: dialogs render after the page).
const press = async (page, pattern, last = false) => {
  const found = await page.evaluate(
    (src, fromEnd) => {
      const re = new RegExp(src, 'i')
      const all = [...document.querySelectorAll('button')]
      const el = (fromEnd ? all.reverse() : all).find((b) => re.test(b.textContent.trim()) || re.test(b.getAttribute('aria-label') ?? ''))
      el?.click()
      return Boolean(el)
    },
    pattern,
    last,
  )
  if (!found) throw new Error(`no button matches /${pattern}/`)
}

const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

/* ── Screenshots ──────────────────────────────────────────────────────── */

if (want === 'all' || want === 'shots') {
  const page = await open(seed(), PHONE)
  const shot = async (name) => {
    await page.screenshot({ path: join(SHOTS, `${name}.png`) })
    console.log('shot', name)
  }

  await go(page, '#/chat/history')
  await press(page, '^How does a glacier')
  await sleep(1200)
  await shot('chat')

  await press(page, '^Character:')
  await sleep(900)
  await shot('picker')
  await press(page, '^Close')
  await sleep(500)

  await go(page, '#/chat/history')
  await shot('history')
  await page.type('input', 'glacier')
  await sleep(1000)
  await shot('search')

  await go(page, '#/store')
  await shot('store')
  await go(page, '#/models')
  await shot('models')
  await go(page, '#/settings')
  await shot('settings')
  // Further down the same page: text size, downloads, and "Your data" (backup and restore).
  await page.evaluate(() => {
    const scroller = [...document.querySelectorAll('main, div')].find((el) => el.scrollHeight > el.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(el).overflowY))
    const heading = [...scroller.querySelectorAll('*')].find((el) => el.children.length === 0 && /^your data$/i.test(el.textContent.trim()))
    scroller.scrollTop += heading.getBoundingClientRect().top - 150
  })
  await sleep(500)
  await shot('backup')
  await go(page, '#/character/new')
  await shot('character')

  await go(page, '#/store')
  await press(page, 'Llama 3.2 1B')
  await sleep(1000)
  await shot('detail')
  await press(page, '^Download Llama')
  await sleep(500)
  await press(page, '^Download$', true)
  await sleep(2700) // the mock download takes about six seconds; this lands near 40%
  await shot('downloading')
  await page.close()

  // First launch, before any model is installed.
  const fresh = await open({ ...seed({ installed: [], conversations: [] }), settings: { ...seed().settings, onboarding_done: false, last_model_id: null } }, PHONE)
  await sleep(600)
  await fresh.screenshot({ path: join(SHOTS, 'splash.png') })
  console.log('shot splash')
  await fresh.close()

  // The same app in a desktop window.
  const desk = await open(seed(), { width: 1180, height: 740, deviceScaleFactor: 2 })
  await go(desk, '#/chat/history')
  await press(desk, '^How does a glacier')
  await sleep(1200)
  await desk.screenshot({ path: join(SHOTS, 'desktop.png') })
  console.log('shot desktop')
  await desk.close()
}

/* ── Live snapshot of the chat screen ─────────────────────────────────── */

// Marks the parts of the chat screen the site swaps between states, then returns their markup.
const readRegions = (page) =>
  page.evaluate(() => {
    const box = document.querySelector('textarea')
    const row = box.parentElement
    const messages = row.parentElement.parentElement.firstElementChild
    const pill = document.querySelector('header button[aria-label^="Character"]')
    const actions = document.querySelector('header button[aria-label="New chat"]').parentElement
    const tag = { pill, actions, messages, row }
    for (const [name, el] of Object.entries(tag)) el.dataset.r = name
    box.removeAttribute('style') // the auto-grow height belongs to this capture's layout
    return { ...Object.fromEntries(Object.entries(tag).map(([name, el]) => [name, el.innerHTML])), shell: document.querySelector('.app-container').outerHTML }
  })

// The page's stylesheets, resolved for a 390px touch screen and rewritten to live inside a shadow root:
// media queries are evaluated now (the site's own viewport must not affect the phone), rem and viewport
// units become px, and page-level selectors point at the snapshot's wrapper.
const readStyles = (page) =>
  page.evaluate(() => {
    const out = []
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule instanceof CSSFontFaceRule) continue
        if (rule instanceof CSSMediaRule) {
          if (rule.conditionText.includes('prefers-reduced-motion')) out.push(rule.cssText)
          else if (matchMedia(rule.conditionText).matches) walk(rule.cssRules)
          continue
        }
        if (rule instanceof CSSStyleRule) {
          const sel = rule.selectorText
          if (/(^|,)\s*(html|#root)\s*(,|$)/.test(sel) && !/body/.test(sel)) continue
          if (/(^|,)\s*(html|body|#root)\s*(,|$)/.test(sel)) {
            const keep = [...rule.style].filter((p) => !/^(height|width|overflow|margin|padding)/.test(p))
            out.push(`.screen { ${keep.map((p) => `${p}: ${rule.style.getPropertyValue(p)};`).join(' ')} }`)
            continue
          }
        }
        out.push(rule.cssText)
      }
    }
    for (const sheet of document.styleSheets) walk(sheet.cssRules)
    return out
  })

if (want === 'all' || want === 'snapshot') {
  const characters = ['default', 'friendly', 'professional', 'concise', 'tutor', 'creative']
  const states = {}
  // styled-components adds a component's rules the first time it renders, so rules are collected from every state.
  const rules = new Set()
  const collect = async (page) => (await readStyles(page)).forEach((rule) => rules.add(rule))
  let shell = ''

  // Each built-in character's empty chat: greeting, description and starters come from the app.
  for (const slug of characters) {
    const page = await open(seed({ conversations: [], character: `preset:${slug}` }), PHONE)
    const { shell: html, ...regions } = await readRegions(page)
    states[`new:${slug}`] = regions
    if (slug === 'default') {
      shell = html
      // Type the demo question: the send button changes state.
      await page.type('textarea', PROMPT)
      await sleep(300)
      states.typed = { row: (await readRegions(page)).row }
      // Send it and catch the screen while the model is "thinking" (the mock waits 300ms before its first word).
      await page.evaluate(() => (window.__neurixMock.tokenDelayMs = 60_000))
      await press(page, '^Send message')
      await sleep(170)
      const { shell: _s, ...thinking } = await readRegions(page)
      states.thinking = thinking
    }
    await collect(page)
    await page.close()
    console.log('snapshot', slug)
  }

  // The finished conversation, opened from history.
  const page = await open(seed({ conversations: 'demo' }), PHONE)
  await go(page, '#/chat/history')
  await press(page, '^How does a glacier')
  await sleep(1200)
  const { shell: _s, ...done } = await readRegions(page)
  states.done = done
  await collect(page)
  await page.close()
  console.log('snapshot done')

  const css = [...rules]
    .join('\n')
    .replace(/:root/g, ':host')
    .replace(/(\d*\.?\d+)rem/g, (_, n) => `${+(n * 16).toFixed(3)}px`)
    .replace(/100d?vh/g, '100%')
    .replace(/100vw/g, '390px')
    .replace(/env\(safe-area-inset-[a-z]+(?:,\s*([^)]+))?\)/g, (_, fallback) => fallback ?? '0px')
  const json = JSON.stringify({ css, shell, states })
  writeFileSync(join(root, 'src', 'app', 'snapshot.json'), json)
  console.log(`snapshot.json  ${(json.length / 1024).toFixed(0)} KB`)
}

await browser.close()
