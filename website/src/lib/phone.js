// The phone. Its screen is not a mock-up: it is the app's own rendered HTML and CSS, captured from the
// running app by tools/capture.mjs and replayed inside a shadow root, so it stays crisp at any size and can
// stream a reply, change character or change theme exactly as the app does (the app themes itself with the
// same CSS variables). Static screens are real screenshots.
import snapshot from '../app/snapshot.json'
import themes from '../app/themes.json'
import { asset, reduced } from './engine.js'

const W = 390
const H = 844

const sheet = new CSSStyleSheet()
sheet.replaceSync(
  snapshot.css +
    `
:host { display: block; width: ${W}px; height: ${H}px; transform-origin: 0 0; pointer-events: none; user-select: none; }
.screen { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: rgb(var(--c-background)); }
.app-container { position: absolute; }
.screen.recolour, .screen.recolour * { transition: background-color .9s cubic-bezier(.33,0,.15,1), border-color .9s cubic-bezier(.33,0,.15,1), color .9s cubic-bezier(.33,0,.15,1); }
[data-wait] { display: none !important; }
`,
)

const kebab = (role) => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const triplet = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export class Phone {
  /** `live: true` builds the replayed chat screen; otherwise the phone shows screenshots via `show()`. */
  constructor(slot, { live = false, state = 'new:default', theme = 'obsidian' } = {}) {
    this.el = document.createElement('div')
    this.el.className = 'phone'
    this.el.innerHTML = '<div class="phone-body"><div class="phone-screen"></div></div>'
    this.screen = this.el.querySelector('.phone-screen')
    slot.append(this.el)
    this.run = 0

    if (live) {
      this.host = document.createElement('div')
      this.host.setAttribute('role', 'img')
      this.host.setAttribute('aria-label', 'The Neurix chat screen')
      const root = this.host.attachShadow({ mode: 'open' })
      root.adoptedStyleSheets = [sheet]
      root.innerHTML = `<div class="screen" inert>${snapshot.shell}</div>`
      this.root = root
      this.screen.append(this.host)
      this.theme(theme, false)
      this.set(state)
      new ResizeObserver(([entry]) => {
        this.host.style.transform = `scale(${entry.contentRect.width / W})`
      }).observe(this.screen)
    }
  }

  region(name) {
    return this.root.querySelector(`[data-r="${name}"]`)
  }

  /** Puts the screen into one of the captured states. */
  set(name) {
    this.run++
    this.state = name
    for (const [region, html] of Object.entries(snapshot.states[name])) this.region(region).innerHTML = html
  }

  theme(id, animate = true) {
    const t = themes.find((x) => x.id === id) ?? themes[0]
    const screen = this.root.querySelector('.screen')
    screen.classList.toggle('recolour', animate && !reduced)
    for (const [role, hex] of Object.entries(t.colors)) this.host.style.setProperty(`--c-${kebab(role)}`, triplet(hex))
    this.el.dataset.mode = t.mode
  }

  /** Types the question, sends it, waits, then streams the reply a word at a time. */
  async ask(text) {
    const run = ++this.run
    const alive = () => run === this.run
    if (reduced) return this.answered()

    await wait(450)
    if (!alive()) return
    this.region('row').innerHTML = snapshot.states.typed.row
    const box = this.region('row').querySelector('textarea')
    for (let i = 1; i <= text.length && alive(); i++) {
      box.value = text.slice(0, i)
      await wait(26 + Math.random() * 38)
    }
    if (!alive()) return
    await wait(420)
    if (!alive()) return

    for (const [region, html] of Object.entries(snapshot.states.thinking)) this.region(region).innerHTML = html
    await wait(1100)
    if (!alive()) return

    // Lay out the finished reply, hide every word, then let them through in order.
    this.region('messages').innerHTML = snapshot.states.done.messages
    const body = this.region('messages').lastElementChild.firstElementChild.lastElementChild
    const words = []
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    const texts = []
    while (walker.nextNode()) texts.push(walker.currentNode)
    for (const node of texts) {
      const frag = document.createDocumentFragment()
      for (const part of node.data.split(/(\s+)/)) {
        if (!part) continue
        if (/^\s+$/.test(part)) {
          frag.append(part)
          continue
        }
        const w = document.createElement('span')
        w.textContent = part
        w.dataset.wait = ''
        words.push(w)
        frag.append(w)
      }
      node.replaceWith(frag)
    }
    // A block (paragraph, list row, the spacer before it) appears with its first word.
    for (const block of body.children) block.dataset.wait = ''

    for (const w of words) {
      if (!alive()) return
      delete w.dataset.wait
      let block = w
      while (block.parentElement !== body) block = block.parentElement
      for (; block?.dataset.wait === ''; block = block.previousElementSibling) delete block.dataset.wait
      await wait(70 + Math.random() * 80)
    }
    if (alive()) this.answered()
  }

  /** The finished conversation, as the app shows it after a reply. */
  answered() {
    this.set('done')
  }

  /** Shows a real screenshot. A change is a focus pull: the old screen goes soft, the new one comes sharp. */
  show(name) {
    if (this.shot === name) return
    const first = !this.shot
    this.shot = name
    const frame = document.createElement('div')
    frame.className = 'shot'
    frame.innerHTML =
      `<img class="shot-soft" src="${asset(`img/shot-${name}-soft.webp`)}" alt="" width="390" height="844">` +
      `<img class="shot-sharp" src="${asset(`img/shot-${name}.webp`)}" alt="" width="780" height="1688" decoding="async">`
    this.screen.append(frame)
    const old = this.current
    this.current = frame
    if (first || reduced) {
      frame.classList.add('is-sharp', 'is-in')
      old?.remove()
      return
    }
    old?.classList.remove('is-sharp')
    requestAnimationFrame(() => {
      frame.classList.add('is-in')
      setTimeout(() => frame.classList.add('is-sharp'), 260)
    })
    setTimeout(() => old?.remove(), 1100)
  }
}
