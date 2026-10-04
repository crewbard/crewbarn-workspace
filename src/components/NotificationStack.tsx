import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const subscribers = new Set<() => void>()
let host: HTMLDivElement | null = null
const snapshot = () => host
const serverSnapshot = () => null

/**
 * Are the toast timers frozen?
 *
 * Every card counts down on its own interval, but they all read this, so
 * putting the pointer anywhere over the stack — or tabbing into it — stops
 * the lot. Without that, the one you are reading disappears mid-sentence
 * while you reach for its button.
 *
 * Module-level rather than context because the cards come from four
 * different producers (messages, calls, intake, errors) that each portal
 * into this one host and share no React parent.
 */
let paused = false
const pauseListeners = new Set<() => void>()

export const toastPaused = () => paused

export function subscribeToastPause(listener: () => void) {
  pauseListeners.add(listener)
  return () => {
    pauseListeners.delete(listener)
  }
}

function setPaused(next: boolean) {
  if (paused === next) return
  paused = next
  // Cards reset their own step clock, so time spent paused is not billed to
  // the countdown the moment the pointer leaves.
  for (const listener of pauseListeners) listener()
}

/**
 * How many toasts are behind the visible ones.
 *
 * The stack shows the newest three; the rest are hidden by CSS. Counting the
 * host's children in a MutationObserver lets the "+N more" pill be a CSS
 * ::after on the host, which avoids having to give four independent
 * producers a shared React parent just to render one pill.
 */
function watchCount(target: HTMLDivElement) {
  const update = () => {
    const extra = target.childElementCount - 3
    if (extra > 0) target.dataset.extra = String(extra)
    else delete target.dataset.extra
  }
  const observer = new MutationObserver(update)
  observer.observe(target, { childList: true })
  update()
  return observer
}

function subscribe(listener: () => void) {
  if (!host) {
    host = document.createElement('div')
    host.className = 'cb-toast-stack print:hidden'
    host.setAttribute('aria-label', 'Notifications')
    host.addEventListener('mouseenter', () => setPaused(true))
    host.addEventListener('mouseleave', () => setPaused(false))
    host.addEventListener('focusin', () => setPaused(true))
    host.addEventListener('focusout', () => setPaused(false))
    document.body.appendChild(host)
    ;(host as HTMLDivElement & { _cbObserver?: MutationObserver })._cbObserver = watchCount(host)
  }
  subscribers.add(listener)
  // React checks the snapshot immediately after subscribing, including when
  // StrictMode mounts again. Every producer receives the same stable portal.
  return () => {
    subscribers.delete(listener)
    if (subscribers.size === 0) {
      ;(host as (HTMLDivElement & { _cbObserver?: MutationObserver }) | null)?._cbObserver?.disconnect()
      host?.remove()
      host = null
      paused = false
    }
  }
}

/** Shared by app notifications and errors, including on the login page. */
export function NotificationStack({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  return target ? createPortal(children, target) : null
}
