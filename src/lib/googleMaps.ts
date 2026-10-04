/**
 * Google Maps JS loader. Fetches the tenant's API key from the backend
 * once, then dynamically injects the Google Maps `<script>` tag. Cached
 * promise — every component that calls `loadGoogleMaps()` gets the same
 * load. Safe to call from multiple components simultaneously.
 *
 * Libraries:
 *   - places   — Address autocomplete + Place Details
 *   - geometry — Distance / direction math
 *
 * Public API:
 *   loadGoogleMaps() => Promise<typeof google>   // returns the global namespace
 *   getGoogleMapsKey() => Promise<string | null> // raw key fetch
 *   isGoogleMapsConfigured() => Promise<boolean> // for feature flags
 */

import { apiRequest } from '@/lib/api'

let loadPromise: Promise<typeof google> | null = null
let cachedKey: string | null | undefined = undefined

async function fetchKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey
  try {
    const res = await apiRequest<{ data: { key: string | null } }>(
      '/v1/settings/integrations/google-maps-key',
    )
    cachedKey = res.data.key
    return cachedKey
  } catch {
    cachedKey = null
    return null
  }
}

export async function getGoogleMapsKey(): Promise<string | null> {
  return fetchKey()
}

/**
 * Hand the loader a key instead of letting it fetch one.
 *
 * The wall board has no signed-in session, so the usual settings fetch
 * would 401 and the map would silently never load. Its key arrives on the
 * board's own config call, and this seeds the same cache so everything
 * downstream — the single-load promise, the libraries — is unchanged.
 */
export function primeGoogleMapsKey(key: string | null): void {
  cachedKey = key
}

/**
 * Did Google refuse the key?
 *
 * A rejected referrer, a disabled API or unpaid billing does not reject
 * the promise — the script loads fine and Google paints "Oops! Something
 * went wrong" inside the map container. Anything relying on a catch()
 * therefore thinks the map worked and hides its own fallback, which is
 * how a wall ends up showing a grey apology box instead of the crew.
 *
 * Google calls window.gm_authFailure for exactly this, so it is the one
 * reliable signal.
 */
let authFailed = false

export function googleMapsAuthFailed(): boolean {
  return authFailed
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    authFailed = true
  }
}

/** Google's own error panel, for the cases that do not call gm_authFailure. */
export function hasMapError(host: HTMLElement | null): boolean {
  return !!host?.querySelector('.gm-err-container')
}

export async function isGoogleMapsConfigured(): Promise<boolean> {
  const k = await fetchKey()
  return !!k
}

/**
 * Lazy-load the Google Maps JS SDK with the tenant's key. Resolves to
 * the `google` global. Throws if the tenant hasn't configured a key.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    // Already loaded by someone else? Reuse.
    if (typeof window !== 'undefined' && (window as unknown as { google?: typeof google }).google?.maps) {
      return (window as unknown as { google: typeof google }).google
    }

    const key = await fetchKey()
    if (!key) {
      loadPromise = null  // allow retry after user configures
      throw new Error('Google Maps API key not configured. Tool Shed → Storage & Maps.')
    }

    return new Promise<typeof google>((resolve, reject) => {
      type GoogleWindow = Window & { google?: typeof google; [k: string]: unknown }
      const w = window as unknown as GoogleWindow

      const cbName = `__crewbarnMapsCb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
      w[cbName] = () => {
        const g = w.google
        delete w[cbName]
        // Modern SDK exposes importLibrary; consumers load classes via it.
        if (g?.maps?.importLibrary) resolve(g)
        else reject(new Error('Google Maps SDK loaded but importLibrary missing.'))
      }

      const script = document.createElement('script')
      const params = new URLSearchParams({
        key,
        libraries: 'places,geometry',
        v: 'weekly',
        loading: 'async', // Google's recommended async bootstrap (silences the
        // "loaded directly without loading=async" perf warning).
        callback: cbName,
      })
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
      script.async = true
      script.defer = true
      script.onerror = () => {
        delete w[cbName]
        loadPromise = null
        reject(new Error('Failed to load Google Maps script.'))
      }
      ;(w as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
        delete w[cbName]
        loadPromise = null
        reject(new Error('Google Maps auth failure — referrer not whitelisted or APIs not enabled.'))
      }
      document.head.appendChild(script)
    })
  })()

  return loadPromise
}

/** Reset the in-memory cache — call after user updates the key. */
export function resetGoogleMapsCache(): void {
  cachedKey = undefined
  loadPromise = null
}
