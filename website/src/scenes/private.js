// Private. One tent on a dark plateau. The same frame exists a second time, lit by the moon, and a
// soft round window onto that brighter exposure follows the pointer like a lamp. Left alone, the lamp
// rests on the tent. Both images are placed by the same cover maths so they line up exactly.
import { coarse, lerp, move, scene, view } from '../lib/engine.js'

const IMAGE = 1672 / 941
const TENT = [0.775, 0.655] // where the tent sits in the photograph
const OVER = 0.06 // the picture overhangs the section by this much on every side (see .camp)

export function privacy() {
  const section = document.querySelector('#private')
  const camp = section.querySelector('.camp')
  const dark = section.querySelector('.camp-dark')
  const lamp = section.querySelector('.lamp')
  const lit = lamp.querySelector('img')
  lit.style.transformOrigin = '0 0'

  let inside = false
  let touch = null
  let touched = -1e5
  let lx = null
  let ly = 0
  section.addEventListener('pointerenter', (e) => (inside = e.pointerType !== 'touch'))
  section.addEventListener('pointerleave', () => (inside = false))
  section.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'touch') return
      touch = [e.clientX, e.clientY]
      touched = performance.now()
    },
    { passive: true },
  )

  scene(section, ({ v }) => {
    const { w, t, motion: m } = view
    const rect = section.getBoundingClientRect()
    const h = rect.height
    const cw = w * (1 + 2 * OVER)
    const ch = h * (1 + 2 * OVER)

    // The picture drifts a little against the scroll and the pointer.
    const dx = -view.px * w * 0.006 * m
    const dy = lerp(-0.035, 0.035, v) * h * m
    move(camp, dx, dy)

    // Cover geometry, read from the dark image's own object-position so the two can never disagree.
    const [fx, fy] = getComputedStyle(dark)
      .objectPosition.split(' ')
      .map((n) => parseFloat(n) / 100)
    const iw = Math.max(cw, ch * IMAGE)
    const ih = iw / IMAGE
    const ox = (cw - iw) * fx
    const oy = (ch - ih) * fy
    lit.style.width = `${iw}px`
    lit.style.height = `${ih}px`

    // Where the lamp wants to be, in the picture box's coordinates.
    const rest = [ox + iw * TENT[0] + Math.sin(t * 0.35) * w * 0.012 * m, oy + ih * TENT[1] + Math.cos(t * 0.27) * h * 0.012 * m]
    const toBox = ([x, y]) => [x - rect.left + w * OVER - dx, y - rect.top + h * OVER - dy]
    let goal = rest
    if (!coarse && inside && view.cx != null) goal = toBox([view.cx, view.cy])
    else if (touch && performance.now() - touched < 2600) goal = toBox(touch)

    if (lx === null) [lx, ly] = rest
    const follow = m ? 0.075 : 1
    lx += (goal[0] - lx) * follow
    ly += (goal[1] - ly) * follow

    const size = lamp.offsetWidth
    const b = 1 + Math.sin(t * 0.8) * 0.03 * m // the lamp breathes
    move(lamp, lx - size / 2, ly - size / 2, b)
    // The lit image is counter-moved and counter-scaled so it stays registered with the dark one beneath.
    move(lit, (ox - lx) / b + size / 2, (oy - ly) / b + size / 2, 1 / b)
  })
}
