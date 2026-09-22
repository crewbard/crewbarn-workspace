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
