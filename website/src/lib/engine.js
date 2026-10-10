// One loop for the whole page. Scroll, pointer and time live in a single shared state, and every scene
// reads from it on the same frame, so the world moves as one thing instead of as separate effects.
import Lenis from 'lenis'

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
export const coarse = matchMedia('(hover: none)').matches

export const view = {
  w: innerWidth,
  h: innerHeight,
  y: 0, // scroll position
  px: 0, // pointer, eased, -1..1 from the centre of the window
  py: 0,
  t: 0, // seconds since load
  motion: reduced ? 0 : 1, // scenes multiply travel by this, so reduced motion keeps the states but drops the movement
}

/* ── Maths ── */

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
/** Where `v` sits between `a` and `b`, clamped to 0..1. */
export const span = (v, a, b) => clamp((v - a) / (b - a))
/** Rises 0→1 over a..b, holds, then falls 1→0 over c..d. */
export const window4 = (v, a, b, c, d) => Math.min(span(v, a, b), 1 - span(v, c, d))

/** CSS-style cubic-bezier easing as a function. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t) => ((ax * t + bx) * t + cx) * t
  const sy = (t) => ((ay * t + by) * t + cy) * t
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const d = (3 * ax * t + 2 * bx) * t + cx
      if (Math.abs(d) < 1e-6) break
      t -= (sx(t) - x) / d
    }
    return sy(clamp(t))
  }
}

export const ease = {
  out: bezier(0.16, 1, 0.3, 1), // long, soft landing
  inOut: bezier(0.65, 0, 0.35, 1),
  glide: bezier(0.33, 0, 0.15, 1),
}

/* ── Writing to the DOM: only transform and opacity, and only when the value changed ── */

export function move(el, x = 0, y = 0, scale = 1, rotate = 0) {
  const v = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)${scale !== 1 ? ` scale(${scale.toFixed(4)})` : ''}${rotate ? ` rotate(${rotate.toFixed(3)}deg)` : ''}`
  if (el._tf !== v) el.style.transform = el._tf = v
}

export function fade(el, o) {
  const v = o < 0.004 ? 0 : o > 0.996 ? 1 : +o.toFixed(3)
  if (el._op === v) return
  el._op = v
  el.style.opacity = v
  // Fully transparent layers are taken out of painting altogether.
  const hidden = v === 0
  if (el._hid !== hidden) el.style.visibility = (el._hid = hidden) ? 'hidden' : 'visible'
}

/* ── Scenes ── */

const scenes = []

/**
 * Registers a section. `render` receives:
 *   p  0..1 while the section is pinned (its top has reached the top of the window, until its bottom reaches the bottom)
 *   v  0..1 for the whole time any of it is on screen
 */
export function scene(el, render) {
  const s = { el, render, top: 0, height: 0, on: false }
  scenes.push(s)
  return s
}

function measure() {
  view.w = document.documentElement.clientWidth
  view.h = innerHeight
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect()
    s.top = r.top + scrollY
    s.height = r.height
  }
}

/* ── Smooth scroll ── */

export let lenis = null

export function goTo(target, options) {
  if (lenis) lenis.scrollTo(target, options)
  else if (typeof target === 'number') window.scrollTo({ top: target })
  else target.scrollIntoView()
}

export function start() {
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, anchors: true })
  }

  let tx = 0
  let ty = 0
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return
      tx = (e.clientX / view.w) * 2 - 1
      ty = (e.clientY / view.h) * 2 - 1
      view.cx = e.clientX
      view.cy = e.clientY
    },
    { passive: true },
  )

  measure()
  addEventListener('resize', measure)
  new ResizeObserver(measure).observe(document.body)

  const t0 = performance.now()
  const frame = (now) => {
    lenis?.raf(now)
    view.y = lenis ? lenis.scroll : scrollY
    view.t = (now - t0) / 1000
    view.px += (tx - view.px) * 0.06
    view.py += (ty - view.py) * 0.06

    for (const s of scenes) {
      const v = (view.y + view.h - s.top) / (s.height + view.h)
      const on = v > -0.05 && v < 1.05
      if (!on && !s.on) continue // off screen and already settled
      s.on = on
      const travel = Math.max(1, s.height - view.h)
      s.render({ p: clamp((view.y - s.top) / travel), v: clamp(v), raw: (view.y - s.top) / travel })
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/* ── Small shared behaviours ── */

const small = matchMedia('(max-width: 760px)').matches

/** A file from public/, addressed relative to wherever the site is served from. */
export const asset = (path) => import.meta.env.BASE_URL + path.replace(/^\//, '')

/** Gives an image its real source (the smaller file on a phone). */
export function loadImage(img) {
  if (!img.dataset.src) return
  img.src = asset((small && img.dataset.srcM) || img.dataset.src)
  img.removeAttribute('data-src')
}

/** Starts loading `data-src` images shortly before they scroll into view. Images marked `data-defer` are left to their scene. */
export function lazyImages(root = document) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        loadImage(entry.target)
        io.unobserve(entry.target)
      }
    },
    { rootMargin: '120% 0px' },
  )
  root.querySelectorAll('img[data-src]:not([data-defer])').forEach((img) => io.observe(img))
}

/** Text enters once, quietly, when it is properly on screen. */
export function reveals() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    },
    { threshold: 0.35, rootMargin: '0px 0px -8% 0px' },
  )
  document.querySelectorAll('.reveal').forEach((el) => {
    const siblings = [...el.parentElement.querySelectorAll(':scope > .reveal')]
    el.style.setProperty('--i', siblings.indexOf(el))
    io.observe(el)
  })
}
