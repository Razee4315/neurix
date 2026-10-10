// Models, shown as what they are once downloaded: a solid thing you carry. Eight mineral specimens stand
// in a line running away from the lens, smallest file first. Scrolling walks along the line. The model
// you are at is sharp; the ones behind it are small and soft, the ones you have passed drift by large and
// out of focus. Each stone is a sharp image and a pre-blurred twin, cross-faded.
import { models as catalogue } from '../app/models.js'
import meta from '../img-meta.json'
import { clamp, ease, fade, goTo, lerp, move, scene, span, view } from '../lib/engine.js'

export function models() {
  const section = document.querySelector('#models')
  const field = section.querySelector('.stones')
  const card = section.querySelector('.model-card')
  const slots = Object.fromEntries([...card.querySelectorAll('[data-m]')].map((el) => [el.dataset.m, el]))
  const index = section.querySelector('.model-index')
  const pool = section.querySelector('.pool')
  const last = catalogue.length - 1

  const stones = catalogue.map((model, i) => {
    const id = `stone-${i + 1}`
    const sharp = meta[id]
    const soft = meta[`${id}-soft`]
    const el = document.createElement('div')
    el.className = 'stone'
    el.style.zIndex = 20 - i // a stone you have passed is nearer than the one you are looking at
    // The soft twin is half resolution and carries the blur's spill around it; both are centred on the same point.
    el.innerHTML =
      `<img class="s-soft" data-src="/img/${id}-soft.webp" alt="" width="${soft.w}" height="${soft.h}" style="width:${soft.w * 2}px;height:${soft.h * 2}px;margin:${-soft.h}px 0 0 ${-soft.w}px">` +
      `<img class="s-sharp" data-src="/img/${id}.webp" alt="" width="${sharp.w}" height="${sharp.h}" style="margin:${-sharp.h / 2}px 0 0 ${-sharp.w / 2}px">`
    field.append(el)
    // Bigger file, bigger stone.
    const weight = lerp(0.56, 1, Math.sqrt((model.mb - catalogue[0].mb) / (catalogue[last].mb - catalogue[0].mb)))
    return { el, sharp: el.lastChild, soft: el.firstChild, size: Math.max(sharp.w, sharp.h), weight, phase: i * 1.7 }
  })

  catalogue.forEach((model, i) => {
    const li = document.createElement('li')
    li.innerHTML = `<button type="button" aria-label="${model.name}, ${model.size}">${model.name}</button>`
    li.firstChild.addEventListener('click', () => goTo(top + (i / last) * travel + 2, { duration: 1.4 }))
    index.append(li)
  })
  const rows = [...index.children]

  let top = 0
  let travel = 1
  let shown = -1
  let swap = 0

  function show(i) {
    if (i === shown) return
    const first = shown < 0
    shown = i
    rows.forEach((row, n) => row.classList.toggle('is-active', n === i))
    const write = () => {
      const model = catalogue[i]
      slots.maker.textContent = model.maker
      slots.name.textContent = model.name
      slots.meta.textContent = `${model.params} parameters · about ${model.size}`
      slots.for.textContent = model.best.join(' · ')
      card.classList.remove('is-swapping')
    }
    clearTimeout(swap)
    if (first) return write()
    card.classList.add('is-swapping')
    swap = setTimeout(write, 240)
  }
  show(0)

  scene(section, ({ p }) => {
    const rect = section.getBoundingClientRect()
    top = rect.top + view.y
    travel = Math.max(1, rect.height - view.h)

    // Position along the line. Each model holds for a moment before the walk continues.
    const raw = p * last
    const at = Math.floor(raw) + ease.inOut(span(raw - Math.floor(raw), 0.22, 0.78))
    show(clamp(Math.round(raw), 0, last))

    const fw = field.clientWidth
    const fh = field.clientHeight
    const unit = Math.min(fw * 0.62, fh * 0.68)
    const { px, py, t, motion: m } = view
    const narrow = view.w <= 760
    // The light rests behind the stone in focus and leans toward the pointer.
    move(pool, (narrow ? 0 : view.w * 0.1) + px * view.w * 0.16 * m, py * view.h * 0.16 * m)

    for (let i = 0; i <= last; i++) {
      const s = stones[i]
      const d = i - at // 0 in focus, positive further away, negative already passed
      const visible = d > -1.5 && d < 3.2
      if (!visible) {
        fade(s.sharp, 0)
        fade(s.soft, 0)
        continue
      }
      const near = Math.max(0, -d)
      const far = Math.max(0, d)
      const depth = 1 / (1 + far * 0.95) + near * 1.15 // apparent size from distance
      // Waiting stones recede up and to the right. A passed stone sinks out under the frame, never across the words.
      const x = (far ? Math.pow(far, 0.85) * 0.17 : near * 0.1) * fw
      const y = (far ? -Math.pow(far, 0.9) * 0.15 : Math.pow(near, 1.15) * 1.02) * fh
      const parallax = 0.25 + near * 1.6 - Math.min(far, 2) * 0.09
      const scale = (unit / s.size) * s.weight * depth
      move(
        s.el,
        x - px * parallax * view.w * 0.03 * m,
        y - py * parallax * view.h * 0.03 * m + Math.sin(t * 0.5 + s.phase) * 7 * m,
        scale,
        Math.sin(t * 0.27 + s.phase) * 1.2 * m - near * 5 * m,
      )
      const blur = clamp(Math.abs(d) * 1.7)
      // On a narrow screen the model card sits under the stones, so a passed stone is gone before it gets there.
      const present = (1 - (narrow ? span(near, 0.25, 0.7) : span(near, 0.7, 1.2))) * (1 - span(far, 2.2, 3)) * lerp(1, 0.6, clamp(far - 0.4))
      fade(s.sharp, (1 - blur * blur) * present)
      fade(s.soft, clamp(blur * 1.5) * present)
    }
  })
}
