import { useEffect, useRef } from 'react'

/**
 * Cloudflare Turnstile — the bot check on the public sign-up and beta forms.
 * Renders nothing when there is no site key (the server skips verification
 * then too), so turning it on is: create a widget in the Cloudflare dashboard,
 * set TURNSTILE_SITE_KEY + TURNSTILE_SECRET on the API, done — no rebuild.
 *
 * The token is single-use and expires in ~5 minutes; onToken(null) fires when
 * it lapses so the submit button can wait for a fresh one.
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')))
    s.onerror = () => reject(new Error('Turnstile did not load'))
    document.head.appendChild(s)
  })
  return loading
}

export function Turnstile({
  siteKey,
  onToken,
  theme = 'auto',
}: {
  siteKey: string
  onToken: (token: string | null) => void
  theme?: 'light' | 'dark' | 'auto'
}) {
  const host = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    let id: string | null = null
    let gone = false
    loadTurnstile()
      .then((api) => {
        if (gone || !host.current) return
        id = api.render(host.current, {
          sitekey: siteKey,
          theme,
          callback: (token: string) => cb.current(token),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        })
      })
      .catch(() => cb.current(null))
    return () => {
      gone = true
      if (id && window.turnstile) {
        try { window.turnstile.remove(id) } catch { /* already gone */ }
      }
    }
  }, [siteKey, theme])

  return <div ref={host} className="min-h-[65px]" />
}
