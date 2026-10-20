import { useEffect } from 'react'

/**
 * Keep the screen on while something is playing (an intro film, a narrated
 * tour), so a phone doesn't dim and lock halfway through.
 *
 * Uses the browser's Screen Wake Lock (Chrome/Android, Safari on iOS 16.4+,
 * Edge). The browser drops the lock whenever the tab is hidden, so it is
 * asked for again when the page comes back. Where it isn't supported this
 * does nothing and the phone sleeps as usual.
 */
type Sentinel = { release: () => Promise<void> }
type WakeLockNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const nav = navigator as WakeLockNav
    if (!active || !nav.wakeLock) return
    let lock: Sentinel | null = null
    let alive = true
    const take = async () => {
      if (!alive || document.visibilityState !== 'visible') return
      try {
        const l = await nav.wakeLock!.request('screen')
        if (alive) lock = l
        else void l.release().catch(() => {})
      } catch {
        // refused (low battery, not allowed): the phone just sleeps as usual
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void take() }
    void take()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      if (lock) void lock.release().catch(() => {})
      lock = null
    }
  }, [active])
}
