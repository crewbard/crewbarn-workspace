import { useCallback, useEffect, useState } from 'react'

/**
 * Which pop-up alerts this person wants, per area.
 *
 * Per-browser in localStorage, matching how theme/accent/layout are stored
 * here. That is the right scope for this: whether a toast is welcome or
 * distracting depends on the seat, not the company. A dispatcher watching the
 * board wants call toasts; someone doing invoices all afternoon does not, and
 * neither should have to decide for the other.
 *
 * Toggling has to reach the toast layer, which is mounted somewhere else
 * entirely (AppLayout, not the page with the switch on it). A plain useState
 * would leave the layer showing the old value until a reload, so writes emit an
 * event every hook instance listens for. The native `storage` event is not
 * enough on its own — it only fires in OTHER tabs, never the one that wrote.
 */

/*
 * Errors are not in here on purpose: a failure that pops up is the only
 * warning somebody gets that their work did not save, and a switch for that
 * is a switch for losing work quietly.
 *
 * payments and reviews are ready ahead of the events that will fire them —
 * the card types exist, and the moment the backend emits those events the
 * switch is already here rather than being added in a rush afterwards.
 */
export type ToastArea = 'messages' | 'calls' | 'intake' | 'payments' | 'reviews'

const KEY: Record<ToastArea, string> = {
  messages: 'cb.toasts.messages',
  calls: 'cb.toasts.calls',
  intake: 'cb.toasts.intake',
  payments: 'cb.toasts.payments',
  reviews: 'cb.toasts.reviews',
}

const CHANGED = 'cb:toast-prefs-changed'

/** Default ON: an alert nobody asked to silence is the safer failure. */
function read(area: ToastArea): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(KEY[area]) !== 'off'
}

export function useToastPref(area: ToastArea): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => read(area))

  useEffect(() => {
    const sync = () => setOn(read(area))
    window.addEventListener(CHANGED, sync)
    // Other tabs, so silencing alerts in one window silences them in all.
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [area])

  const set = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(KEY[area], next ? 'on' : 'off')
      setOn(next)
      window.dispatchEvent(new Event(CHANGED))
    },
    [area],
  )

  return [on, set]
}
