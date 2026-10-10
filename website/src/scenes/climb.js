// The climb. Scrolling is altitude: the valley and its town lights sink away, the page passes up
// through the cloud and comes out above it under the stars. The signal meter empties on the way.
// The phone never moves and never goes soft. Near the top it is asked a question, and answers.
import { PROMPT } from '../app/demo.js'
import { ease, fade, lerp, loadImage, move, reduced, scene, span, view, window4 } from '../lib/engine.js'
import { Phone } from '../lib/phone.js'
import { setSignal } from '../lib/signal.js'

export function climb() {
  const section = document.querySelector('#climb')
  const L = Object.fromEntries([...section.querySelectorAll('[data-l]')].map((el) => [el.dataset.l, el]))
  const beats = [...section.querySelectorAll('.beat')]
  const cue = section.querySelector('.scroll-cue')
  const glow = section.querySelector('.phone-glow')
  const phone = new Phone(section.querySelector('.phone-wrap'), { live: true })

  let asked = false
  const narrow = () => view.w <= 760

  scene(section, ({ p }) => {
    const { w, h, px, py, t, motion: m } = view
    // Pointer parallax: nearer layers travel further. `d` is depth, 0 far to 1 at the lens.
    const sx = (d) => -px * d * w * 0.018 * m
    const sy = (d) => -py * d * h * 0.014 * m
    const drift = (speed, amount, phase = 0) => Math.sin(t * speed + phase) * amount * m

    /* Signal: gone by the time the cloud closes in. */
    setSignal(p < 0.09 ? 4 : p < 0.18 ? 3 : p < 0.27 ? 2 : p < 0.36 ? 1 : 0)

    /* Words. */
    const shows = [1 - span(p, 0.06, 0.12), window4(p, 0.16, 0.21, 0.3, 0.35), window4(p, 0.4, 0.45, 0.56, 0.61), span(p, 0.71, 0.77)]
    const enters = [0, span(p, 0.16, 0.24), span(p, 0.4, 0.48), span(p, 0.71, 0.8)]
    const leaves = [span(p, 0.03, 0.12), span(p, 0.29, 0.35), span(p, 0.55, 0.61), 0]
    beats.forEach((el, i) => {
      fade(el, shows[i])
      move(el, 0, (lerp(26, 0, ease.out(enters[i] || (i ? 0 : 1))) - 22 * ease.inOut(leaves[i])) * m)
      el.style.pointerEvents = shows[i] > 0.6 ? '' : 'none'
    })
    fade(cue, 1 - span(p, 0, 0.03))

    /* The valley sinks as we rise. */
    const rise = ease.glide(span(p, 0, 0.5))
    const vy = rise * h * 0.13 * m
    const vs = lerp(1.07, 1.0, rise)
    const valleyOn = 1 - span(p, 0.42, 0.49)
    move(L.valley, sx(0.25), vy + sy(0.25), vs)
    if (L['valley-sharp'].isConnected) move(L['valley-sharp'], sx(0.25), vy + sy(0.25), vs)
    fade(L.valley, valleyOn)
    // The town's lights, thrown out of focus, drifting down with the valley and going out behind us.
    move(L.lights, sx(0.3), vy * 1.6 + sy(0.3), 1)
    fade(L.lights, document.documentElement.classList.contains('is-arrived') ? 0.42 * (1 - span(p, 0.05, 0.26)) : 0)

    /* Grass by the lens at the start, and a rock ridge passing close on the way up. */
    const g = ease.inOut(span(p, 0, 0.15))
    move(L.grass, sx(1) + drift(0.5, 5), g * h * 0.95 + sy(1), 1 + g * 0.2, drift(0.4, 0.6))
    fade(L.grass, 1 - span(p, 0.12, 0.16))
    const r = span(p, 0.1, 0.36)
    move(L.ridge, sx(0.9), lerp(-1.15, 1.25, r) * h, 1.25)
    fade(L.ridge, window4(p, 0.1, 0.13, 0.33, 0.36) * (m ? 1 : 0))

    /* Into the cloud: banks of mist come down past us, each at its own distance. */
    const fog = ease.inOut(window4(p, 0.3, 0.45, 0.53, 0.68))
    fade(L.veil, fog)
    const bank = (el, from, to, depth, xOff, scale, alpha, phase) => {
      const k = span(p, from, to)
      move(el, xOff * w + sx(depth) + drift(0.11, w * 0.012, phase), lerp(-1.25, 1.3, k) * h * m, scale)
      fade(el, alpha * window4(p, from, from + 0.05, to - 0.06, to) * (m ? 1 : 0))
    }
    bank(L['mist-a'], 0.2, 0.66, 0.35, -0.12, 1.0, 0.5, 0)
    bank(L['mist-b'], 0.26, 0.7, 0.5, 0.16, 1.15, 0.45, 2)
    bank(L['mist-c'], 0.3, 0.74, 0.6, 0.3, 0.8, 0.55, 4)
    bank(L['mist-d'], 0.33, 0.66, 1, -0.46, 1.05, 0.3, 1) // the only bank nearer than the phone: thin, out of focus, and mostly to its left

    /* Out above it. */
    const out = ease.out(span(p, 0.5, 0.86))
    move(L.cloudsea, sx(0.2), lerp(-0.1, 0, out) * h * m + sy(0.2), lerp(1.1, 1.02, out))
    fade(L.cloudsea, span(p, 0.47, 0.5))

    /* The phone: the one thing that holds still. It is never transformed on a large screen, so its text is
       never resampled; on a small one it slides up once, by whole pixels, to make room for its reply. */
    const lift = narrow() ? -Math.round(ease.inOut(span(p, 0.05, 0.2)) * view.h * 0.275) : 0
    if (phone.lift !== lift) phone.el.style.transform = (phone.lift = lift) ? `translate3d(0,${lift}px,0)` : ''
    fade(glow, 0.3 + 0.7 * fog)

    /* Above the cloud, with no signal at all, ask it something. */
    if (!asked && p > 0.705) {
      asked = true
      phone.ask(PROMPT)
    } else if (asked && p < 0.45) {
      asked = false
      phone.set('new:default')
    }
  })

  /* Load. The words come straight away. Then the lens finds the landscape, holds it for a beat, and pulls
     focus to the phone as it arrives: the sharp photograph fades out over its soft twin. */
  const root = document.documentElement
  const sharp = L['valley-sharp']
  const words = () => requestAnimationFrame(() => root.classList.add('is-ready'))
  const arrive = () => {
    section.classList.remove('is-focused')
    root.classList.add('is-arrived')
    setTimeout(() => sharp.remove(), 3200)
    setTimeout(later, 900)
  }
  // The cloud and everything above it is not needed for the first screen: fetch it once that has settled,
  // or the moment the visitor starts to climb.
  const later = () => section.querySelectorAll('img[data-defer]').forEach(loadImage)
  addEventListener('scroll', later, { once: true, passive: true })
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 500))]).then(words)

  if (reduced || scrollY > innerHeight * 0.5) return arrive()
  const giveUp = setTimeout(arrive, 2200) // slow connection: skip the pull rather than keep the phone waiting
  sharp.onload = async () => {
    await sharp.decode?.().catch(() => {})
    if (root.classList.contains('is-arrived')) return
    clearTimeout(giveUp)
    section.classList.add('is-focused')
    setTimeout(arrive, 1050)
  }
  loadImage(sharp)
}
