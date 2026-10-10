// Yours. The app has ten themes, several named after places in the mountains. Here each theme re-lights
// the same view: ten exposures of one lake, pixel-aligned, cross-faded. The phone in front is the live
// chat screen, recoloured with the theme's real values, and it can be handed to any built-in character.
import { characters } from '../app/models.js'
import themes from '../app/themes.json'
import { asset, lerp, move, reduced, scene, view } from '../lib/engine.js'
import { Phone } from '../lib/phone.js'

export function yours() {
  const section = document.querySelector('#yours')
  const world = section.querySelector('.lights-out')
  const swatches = section.querySelector('.swatches')
  const chips = section.querySelector('.chips')
  const themeName = section.querySelector('[data-theme-name]')
  const characterName = section.querySelector('[data-character-name]')
  const phone = new Phone(section.querySelector('.phone-wrap'), { live: true })
  const small = matchMedia('(max-width: 760px)').matches

  /* One exposure per theme, loaded when first needed. */
  const plates = themes.map((theme, i) => {
    const img = document.createElement('img')
    img.alt = ''
    img.width = 1672
    img.height = 941
    img.decoding = 'async'
    img.dataset.lazy = asset(`img/world-${i + 1}${small ? '-m' : ''}.webp`)
    world.append(img)
    return img
  })
  const load = (i) => {
    const img = plates[i]
    if (!img.dataset.lazy) return Promise.resolve()
    img.src = img.dataset.lazy
    delete img.dataset.lazy
    return img.decode().catch(() => {})
  }

  let current = -1
  let auto = 0
  let touched = false

  async function setTheme(i) {
    if (i === current) return
    current = i
    const theme = themes[i]
    ;[...swatches.children].forEach((b, n) => b.setAttribute('aria-pressed', n === i))
    themeName.textContent = `${theme.name}. ${theme.tagline}.`
    await load(i)
    if (current !== i) return
    plates.forEach((img, n) => img.classList.toggle('is-on', n === i))
    phone.theme(theme.id)
    const c = theme.colors
    section.style.setProperty('--bg', c.background)
    section.style.setProperty('--fg', c.onSurface)
    section.style.setProperty('--fg-soft', c.onSurfaceVariant)
    section.style.setProperty('--accent', c.primary)
    section.dataset.mode = theme.mode
    load((i + 1) % themes.length) // have the next one ready
  }

  themes.forEach((theme, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'swatch'
    b.setAttribute('aria-label', `${theme.name} theme`)
    b.setAttribute('aria-pressed', 'false')
    b.style.setProperty('--a', theme.colors.surfaceContainerHigh)
    b.style.setProperty('--b', theme.colors.primary)
    b.innerHTML = '<i></i>'
    b.addEventListener('click', () => {
      stop()
      setTheme(i)
    })
    swatches.append(b)
  })

  function setCharacter(id) {
    const c = characters.find((x) => x.id === id)
    ;[...chips.children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === id))
    characterName.textContent = `${c.note}.`
    phone.set(`new:${id}`)
  }
  characters.forEach((c) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.dataset.id = c.id
    b.textContent = c.name
    b.setAttribute('aria-pressed', 'false')
    b.addEventListener('click', () => {
      stop()
      setCharacter(c.id)
    })
    chips.append(b)
  })
  setCharacter('default')

  /* Until someone chooses, the light changes on its own, slowly. */
  const stop = () => {
    touched = true
    clearInterval(auto)
    auto = 0
  }
  section.addEventListener('focusin', (e) => e.target.matches('.swatch, .chip') && e.target.matches(':focus-visible') && stop())

  let started = false
  scene(section, ({ v }) => {
    const { px, py, w, h, motion: m } = view
    move(world, -px * w * 0.008 * m, lerp(-0.03, 0.03, v) * h * m - py * h * 0.006 * m, 1)

    const rect = section.getBoundingClientRect()
    const onScreen = rect.top < h * 0.55 && rect.bottom > h * 0.45
    if (!started && rect.top < h * 1.5) {
      started = true
      setTheme(0)
    }
    if (onScreen && !auto && !touched && !reduced) auto = setInterval(() => setTheme((current + 1) % themes.length), 3800)
    if (!onScreen && auto) {
      clearInterval(auto)
      auto = 0
    }
    // The nav sits over this section's sky: on a daylight theme it switches to dark ink.
    const want = rect.top < 40 && rect.bottom > 40 && section.dataset.mode === 'light' ? 'light' : ''
    if (document.body.dataset.nav !== want) document.body.dataset.nav = want
  })
}
