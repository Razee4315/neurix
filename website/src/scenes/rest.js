// The rest of the app, on real screenshots. A phone stays put while short lines pass beside it. The line
// nearest the middle of the window is the live one: the phone pulls focus to that screen, and among the
// pieces of field kit hanging around the phone at different distances, the one that belongs to the line
// comes sharp while the others stay soft.
import meta from '../img-meta.json'
import { fade, lerp, move, scene, view } from '../lib/engine.js'
import { Phone } from '../lib/phone.js'

// Position is in phone-widths from the centre of the phone; depth 0 is far, 1 is near the lens.
const KIT = {
  notebook: { x: -1.0, y: -0.66, size: 0.62, depth: 0.55, spin: -9 },
  compass: { x: 0.9, y: -0.82, size: 0.44, depth: 0.3, spin: 7 },
  mug: { x: 0.98, y: 0.7, size: 0.56, depth: 0.85, spin: 5 },
  lantern: { x: -1.04, y: 0.74, size: 0.42, depth: 0.4, spin: -4 },
  carabiner: { x: -0.84, y: 0.06, size: 0.26, depth: 0.12, spin: 14 },
  padlock: { x: 0.86, y: -0.06, size: 0.24, depth: 0.18, spin: -8 },
}

export function rest() {
  const section = document.querySelector('#rest')
  const stage = section.querySelector('.kit')
  const wrap = section.querySelector('.phone-wrap')
  const phone = new Phone(wrap)
  const items = [...section.querySelectorAll('.rest-item')]
  const pool = section.querySelector('.pool')
  const viewBox = section.querySelector('.rest-view')

  const kit = Object.entries(KIT).map(([name, spec], i) => {
    const sharp = meta[`kit-${name}`]
    const soft = meta[`kit-${name}-soft`]
    const el = document.createElement('div')
    el.className = 'kit-item'
    el.style.zIndex = spec.depth > 0.5 ? 3 : 1
    el.innerHTML =
      `<img class="k-soft" data-src="/img/kit-${name}-soft.webp" alt="" width="${soft.w}" height="${soft.h}" style="width:${soft.w * 2}px;height:${soft.h * 2}px;margin:${-soft.h}px 0 0 ${-soft.w}px">` +
      `<img class="k-sharp" data-src="/img/kit-${name}.webp" alt="" width="${sharp.w}" height="${sharp.h}" style="margin:${-sharp.h / 2}px 0 0 ${-sharp.w / 2}px">`
    stage.append(el)
    return { name, el, ...spec, natural: Math.max(sharp.w, sharp.h), phase: i * 2.1, focus: 0 }
  })

  let active = -1
  const preload = new Set()

  scene(section, ({ v }) => {
    const { w, h, px, py, t, motion: m } = view
    const narrow = w <= 760

    // Which line is live.
    const eye = h * (narrow ? 0.72 : 0.52)
    let best = 0
    let bestGap = Infinity
    items.forEach((item, i) => {
      const r = item.firstElementChild.getBoundingClientRect()
      const gap = Math.abs((r.top + r.bottom) / 2 - eye)
      if (gap < bestGap) [best, bestGap] = [i, gap]
      // Fetch a screen a little before its line arrives.
      if (r.top < h * 2 && !preload.has(i)) {
        preload.add(i)
        new Image().src = `/img/shot-${item.dataset.shot}.webp`
        new Image().src = `/img/shot-${item.dataset.shot}-soft.webp`
      }
    })
    if (best !== active) {
      active = best
      items.forEach((item, i) => item.classList.toggle('is-active', i === best))
      phone.show(items[best].dataset.shot)
      kit.forEach((k) => k.el.classList.toggle('is-active', k.name === items[best].dataset.kit))
    }

    // The kit hangs in depth around the phone.
    const pw = wrap.offsetWidth
    const cx = wrap.offsetLeft + pw / 2
    const cy = wrap.offsetTop + wrap.offsetHeight / 2
    move(pool, cx - w / 2 + px * w * 0.12 * m, cy - viewBox.offsetHeight / 2 + py * h * 0.12 * m)
    const spread = narrow ? 0.86 : 1
    for (const k of kit) {
      const on = k.el.classList.contains('is-active')
      k.focus += ((on ? 1 : 0) - k.focus) * (m ? 0.06 : 1)
      const travel = 0.4 + k.depth * 1.5
      const x = cx + k.x * pw * spread - px * travel * w * 0.014 * m
      const y = cy + k.y * pw * spread - py * travel * h * 0.014 * m + lerp(0.5, -0.5, v) * h * 0.22 * k.depth * m + Math.sin(t * 0.45 + k.phase) * 8 * m
      const scale = ((k.size * pw) / k.natural) * (narrow ? 0.9 : 1) * lerp(1, 1.1, k.focus)
      move(k.el, x, y, scale, k.spin + Math.sin(t * 0.3 + k.phase) * 2 * m)
      fade(k.el, lerp(0.55 + k.depth * 0.3, 1, k.focus))
    }
  })
}
