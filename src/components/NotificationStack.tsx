import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const subscribers = new Set<() => void>()
let host: HTMLDivElement | null = null
const snapshot = () => host
const serverSnapshot = () => null

function subscribe(listener: () => void) {
  if (!host) {
    host = document.createElement('div')
    host.className = 'cb-toast-stack print:hidden'
    host.setAttribute('aria-label', 'Notifications')
    document.body.appendChild(host)
  }
  subscribers.add(listener)
  // React checks the snapshot immediately after subscribing, including when
  // StrictMode mounts again. Every producer receives the same stable portal.
  return () => {
    subscribers.delete(listener)
    if (subscribers.size === 0) {
      host?.remove()
      host = null
    }
  }
}

/** Shared by app notifications and errors, including on the login page. */
export function NotificationStack({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  return target ? createPortal(children, target) : null
}
