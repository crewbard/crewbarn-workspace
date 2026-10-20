/**
 * Where the pop-ups start: just under the top bar, measured.
 *
 * The stack used to sit at a fixed `top: 5rem`, which is a guess at the bar's
 * height. A taller bar (Easy's larger type, a wrapped banner, a zoomed
 * browser) put the card on top of the nav, the Parts-to-order button
 * included. This writes the bar's real bottom edge to `--cb-toast-top` on
 * <html> and keeps it current, and both toast layers read it.
 *
 * Reference-counted: the shared stack and the call layer each start it, and
 * it stops when the last one goes.
 */

let users = 0
let stop: (() => void) | null = null

function topBar(): HTMLElement | null {
  return document.querySelector<HTMLElement>('header[data-tour="topbar"]') ?? document.querySelector<HTMLElement>('body > div header')
}

function write() {
  const bar = topBar()
  // A bar scrolled out of view (or absent, e.g. the login page) leaves the
  // toasts at a small inset from the top of the window.
  const bottom = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0
  document.documentElement.style.setProperty('--cb-toast-top', `${Math.max(8, bottom)}px`)
}

export function startToastPlacement(): () => void {
  users += 1
  if (!stop) {
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        write()
      })
    }
    const resize = new ResizeObserver(schedule)
    let watched: HTMLElement | null = null
    const watch = () => {
      const bar = topBar()
      if (bar !== watched) {
        if (watched) resize.unobserve(watched)
        if (bar) resize.observe(bar)
        watched = bar
      }
      schedule()
    }
    // The bar mounts after the first paint and remounts between layouts.
    const mounts = new MutationObserver(() => {
      if (!watched || !watched.isConnected) watch()
    })
    mounts.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    watch()
    stop = () => {
      if (frame) window.cancelAnimationFrame(frame)
      resize.disconnect()
      mounts.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      document.documentElement.style.removeProperty('--cb-toast-top')
    }
  }
  let released = false
  return () => {
    if (released) return
    released = true
    users -= 1
    if (users === 0 && stop) {
      stop()
      stop = null
    }
  }
}
