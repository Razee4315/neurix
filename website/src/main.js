import { lazyImages, lerp, move, reveals, scene, start, view } from './lib/engine.js'
import { setOffline } from './lib/signal.js'
import { climb } from './scenes/climb.js'
import { models } from './scenes/models.js'
import { privacy } from './scenes/private.js'
import { rest } from './scenes/rest.js'
import { yours } from './scenes/yours.js'

climb()
models()
privacy()
yours()
rest()

// The two closing photographs drift a little against the scroll and the pointer, like everything else.
for (const plate of document.querySelectorAll('.origin-plate, .download-plate')) {
  scene(plate.parentElement, ({ v }) => {
    const m = view.motion
    move(plate, -view.px * view.w * 0.007 * m, lerp(-0.04, 0.04, v) * view.h * m - view.py * view.h * 0.005 * m, 1)
  })
}

/* The nav steps aside while you read down the page and comes back as soon as you head up. It stays put
   through the climb, where its signal meter is part of the story. */
const nav = document.querySelector('.nav')
const hero = document.querySelector('#climb')
let lastY = 0
scene(document.body, () => {
  const y = view.y
  const pastHero = y > hero.offsetTop + hero.offsetHeight - view.h * 0.5
  if (!pastHero) nav.classList.remove('is-away')
  else if (y > lastY + 4) nav.classList.add('is-away')
  else if (y < lastY - 4) nav.classList.remove('is-away')
  lastY = y
})

lazyImages()
reveals()
start()

/* If the visitor's own connection drops, say the one thing worth saying. */
const toast = document.querySelector('.toast')
let hide = 0
function say(text) {
  toast.textContent = text
  toast.classList.add('is-on')
  clearTimeout(hide)
  hide = setTimeout(() => toast.classList.remove('is-on'), 6000)
}
addEventListener('offline', () => {
  setOffline(true)
  say('You just went offline. Neurix would still be answering.')
})
addEventListener('online', () => {
  setOffline(false)
  toast.classList.remove('is-on')
})
if (!navigator.onLine) setOffline(true)
