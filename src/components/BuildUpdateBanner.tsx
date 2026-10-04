import { useCallback, useEffect, useState } from 'react'
import { getStoredToken } from '@/lib/api'
import { createPortal } from 'react-dom'

/**
 * Tells the user when the tab is running a build that no longer exists.
 *
 * Cloudflare Pages serves content-hashed assets and retires the previous set on
 * each deploy. A tab left open across a deploy still references the old hashes —
 * and because Pages treats any unmatched path as an SPA route, the request for a
 * retired /assets/index-<hash>.css comes back as index.html with a text/html
 * content type. Chrome refuses to apply it and the app renders as raw unstyled
 * markup, with nothing on screen explaining why or suggesting a refresh.
 *
 * That can't be fixed in Pages config: _redirects has no 404 status, and adding
 * a top-level 404.html to defeat the SPA fallback would break deep links to
 * /customers and every other client-side route. So the app has to notice for
 * itself.
 *
 * The check compares the main script path the page BOOTED with against the one
 * the server is handing out now. The build hash is the version — nothing extra
 * to emit, bump, or keep in sync.
 *
 * What the user sees: once, a centred card — what changed (from the deployed
 * /whats-new.json), why a reload is needed, Reload now / Close for now. Closing
 * leaves a small pill at the bottom so they can reload when they're done with
 * whatever they were in the middle of. The pill never goes away on its own:
 * a stale tab eventually breaks, and the pill is the way out.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000

/** The hashed entry script this tab actually loaded. */
function loadedEntryPath(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
  if (!el?.src) return null
  try {
    return new URL(el.src, window.location.origin).pathname
  } catch {
    return null
  }
}

/** The hashed entry script the server is serving right now, or null if unknown. */
async function deployedEntryPath(): Promise<string | null> {
  try {
    // no-store so we compare against the deploy, not this tab's cached copy —
    // its cached copy is exactly the thing that's gone stale.
    const res = await fetch(`/index.html?_v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const html = await res.text()
    return html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? null
  } catch {
    // Offline or blocked — say nothing rather than nag.
    return null
  }
}

interface Release {
  version: string
  items: string[]
}

/** whats-new.json: { releases: [{version, items}, …] } newest first (older builds shipped a flat {version, items}). */
interface WhatsNew {
  releases?: Release[]
  version?: string
  items?: string[]
}

const SEEN_KEY = 'crewbarn:whats-new-seen'

function seenVersion(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function markSeen(version: string) {
  try {
    if (version) localStorage.setItem(SEEN_KEY, version)
  } catch {
    // private mode — they'll see the list again next time, no harm
  }
}

const clean = (xs: unknown): string[] =>
  Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []

/**
 * The notes shipped WITH the new build — fetched from the server, so they
 * describe what the reload brings. Only releases newer than the last one
 * this browser saw; a browser that has never seen the card gets just the
 * newest release. Versions sort as strings (YYYY-MM-DD + letter).
 */
async function deployedWhatsNew(): Promise<{ items: string[]; latest: string; catchUp: boolean }> {
  try {
    const res = await fetch(`/whats-new.json?_v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return { items: [], latest: '', catchUp: false }
    const data = (await res.json()) as WhatsNew
    const releases: Release[] = Array.isArray(data.releases)
      ? data.releases.map((r) => ({ version: String(r?.version ?? ''), items: clean(r?.items) })).filter((r) => r.version)
      : data.version
        ? [{ version: String(data.version), items: clean(data.items) }]
        : []
    releases.sort((a, b) => (a.version < b.version ? 1 : a.version > b.version ? -1 : 0))
    const latest = releases[0]?.version ?? ''
    const seen = seenVersion()
    const fresh = seen ? releases.filter((r) => r.version > seen) : releases.slice(0, 1)

    /*
     * Not every deploy carries release notes — a docs change, a fix with
     * nothing worth announcing, a rebuild. The build hash moves, this card
     * appears, and with nothing newer than the last version this browser
     * saw it appeared EMPTY: "Reload to get the new changes", and then no
     * changes. From the outside that is indistinguishable from the notes
     * never being written.
     *
     * So when there is nothing newer, fall back to the most recent notes
     * and say that is what they are. A card that repeats itself is a great
     * deal better than one that asks you to reload for changes it will not
     * name.
     */
    const catchUp = fresh.length === 0
    const shown = catchUp ? releases.slice(0, 1) : fresh

    return { items: shown.flatMap((r) => r.items).slice(0, 40), latest, catchUp }
  } catch {
    return { items: [], latest: '', catchUp: false }
  }
}

/** Reload from the server, not the cache: a plain reload can hand back the same stale HTML that caused this. */
function reloadNow() {
  // Change the query, not only the fragment: same-URL replace can be a
  // same-document navigation on settings tabs and can reuse cached HTML.
  const url = new URL(window.location.href)
  url.searchParams.set('_crewbarn_update', `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  window.location.replace(url.href)
}

export function BuildUpdateBanner() {
  const [stale, setStale] = useState(false)
  const [items, setItems] = useState<string[]>([])
  const [catchUp, setCatchUp] = useState(false)
  const [latest, setLatest] = useState('')
  // 'card' once; 'pill' after Close for now.
  const [mode, setMode] = useState<'card' | 'pill'>('card')

  /**
   * Say so. `reason` only has to be stable per stale build, so the
   * signed-out auto-reload cannot loop on a bad deploy.
   */
  const announce = useCallback(
    async (reason: string) => {
      if (stale) return
      // Signed out (the login screen): nothing in this tab can be lost, and
      // the what's-new card is for people using the app — just take the new
      // build quietly. Once per stale build, so a bad deploy can't loop us.
      if (!getStoredToken()) {
        const key = 'crewbarn:auto-reloaded-for'
        if (sessionStorage.getItem(key) !== reason) {
          sessionStorage.setItem(key, reason)
          reloadNow()
        }
        return
      }
      const notes = await deployedWhatsNew()
      setItems(notes.items)
      setCatchUp(notes.catchUp)
      setLatest(notes.latest)
      setStale(true)
    },
    [stale],
  )

  const check = useCallback(async () => {
    if (stale) return
    const loaded = loadedEntryPath()
    if (!loaded) return // dev server / no hashed entry — nothing to compare
    const deployed = await deployedEntryPath()
    if (deployed && deployed !== loaded) await announce(deployed)
  }, [stale, announce])

  /**
   * The failure itself, which arrives before any poll can.
   *
   * Polling every five minutes is fine for telling somebody a new build
   * exists. It is useless for the moment a tab actually breaks, which is
   * the first request for a retired asset — the first lazy route they
   * open after a deploy. By then the app is already unstyled or stuck on
   * a Suspense fallback with nothing on screen to explain it.
   *
   * Two signals, both raised by the browser for free:
   *
   *   vite:preloadError  a lazy chunk could not be imported. Pages answers
   *                      a retired /assets path with index.html and a 200,
   *                      so the import gets HTML where a module should be.
   *   error (capture)    a <link> or <script> that was refused. The same
   *                      HTML-for-CSS is blocked outright rather than
   *                      sniffed, because _headers sets nosniff — which is
   *                      what turns the page into raw unstyled markup.
   *
   * Resource errors do not bubble, hence the capture phase; and a script
   * error reaching the same listener has window as its target, which the
   * tag check filters out.
   */
  useEffect(() => {
    const onPreload = () => void announce('retired-chunk')

    const onResource = (e: Event) => {
      const el = e.target as (HTMLLinkElement & HTMLScriptElement) | null
      if (!el || (el.tagName !== 'LINK' && el.tagName !== 'SCRIPT')) return
      const url = el.href || el.src || ''
      if (url.includes('/assets/')) void announce('retired-asset')
    }

    window.addEventListener('vite:preloadError', onPreload)
    window.addEventListener('error', onResource, true)
    return () => {
      window.removeEventListener('vite:preloadError', onPreload)
      window.removeEventListener('error', onResource, true)
    }
  }, [announce])

  // Either button means "I've read this" — next time, only what's newer.
  const dismiss = useCallback(() => {
    markSeen(latest)
    setMode('pill')
  }, [latest])
  const reload = useCallback(() => {
    markSeen(latest)
    reloadNow()
  }, [latest])

  useEffect(() => {
    void check()

    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS)
    // Returning to the tab is the highest-value moment: it's the most likely
    // point for a deploy to have happened while the tab sat in the background,
    // and the moment before the user starts clicking things.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  // Escape = Close for now, same as the button.
  useEffect(() => {
    if (!stale || mode !== 'card') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [stale, mode, dismiss])

  if (!stale || typeof document === 'undefined') return null

  // Portal to <body>, NOT into the app tree. Mounted inside #root, the banner's
  // z-index is trapped in #root's stacking context — a calendar context menu
  // (zIndex 250), a modal portal, or any element in a higher context paints over
  // it and eats the click even though it looks on top. As the last child of
  // <body> with a max z-index, nothing can cover or intercept the Reload button.
  if (mode === 'pill') {
    return createPortal(
      <div
        role="status"
        style={{ zIndex: 2147483647 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full border border-amber-300 bg-amber-50 py-2 pl-4 pr-2 shadow-lg"
      >
        <span className="text-sm text-amber-900">Update ready — reload when you're done</span>
        <button
          type="button"
          onClick={reload}
          className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Reload
        </button>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="build-update-title"
      style={{ zIndex: 2147483647 }}
      className="fixed inset-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      onClick={dismiss}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">CrewBarn was updated</div>
          <h2 id="build-update-title" className="mt-1 text-lg font-bold text-navy-900">
            Reload to get the new changes
          </h2>
          <p className="mt-1 text-sm text-amber-900/80">
            This tab is still running the old version. Saved work is safe. Finish or save any unsaved changes before reloading.
          </p>
        </div>

        {items.length > 0 && (
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {catchUp ? 'Most recent changes' : "What's new"}
            </div>
            <ul className="mt-2 space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            title="In the middle of something? Finish it — a Reload pill stays at the bottom."
          >
            Close for now
          </button>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
          >
            Reload now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
