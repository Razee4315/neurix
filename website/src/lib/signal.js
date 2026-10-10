// The signal meter in the nav and above the headline. One level for the whole page.
const meters = [...document.querySelectorAll('[data-signal]')]
const words = ['No signal', 'One bar', 'Signal dropping', 'Signal dropping', 'Full signal']
let level = -1
let offline = false

function paint() {
  const shown = offline ? 0 : level
  for (const el of meters) {
    el.dataset.level = shown
    if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', `Signal strength: ${shown} of 4`)
    const text = el.querySelector('.signal-text')
    if (text && !el.closest('.nav')) text.textContent = words[shown]
  }
}

export function setSignal(next) {
  if (next === level) return
  level = next
  paint()
}

/** The visitor's own connection overrides the story: if they really go offline, the meter is empty. */
export function setOffline(value) {
  offline = value
  paint()
}
