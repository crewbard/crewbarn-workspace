import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/googleMaps'

/** Coerce a value (number | numeric string | null | NaN) to a finite number, else null. */
function toFinite(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * Compact embedded Google Map for a job's service location. Renders a
 * single pin at the address. Click "Directions" to open Google Maps
 * with turn-by-turn from the user's current location.
 *
 * Used in the schedule event side panel + (future) customer / asset
 * detail pages.
 *
 * Falls back gracefully:
 *   - No Google Maps API key configured → message + manual address text
 *   - Geocoder finds nothing → message + manual address text
 *
 * Performance: geocodes the address on first render and caches the
 * coords for the component's lifetime. If the parent passes lat/lng
 * we skip geocoding entirely.
 */
export function JobLocationMap({
  address,
  lat,
  lng,
  label,
}: {
  address: string
  lat?: number | null
  lng?: number | null
  label?: string
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const g = await loadGoogleMaps()
        if (cancelled || !mapRef.current) return

        // Modern Maps SDK requires importLibrary for constructors — direct
        // access via `g.maps.Geocoder` is unreliable on `v=weekly`.
        const { Geocoder } = await g.maps.importLibrary('geocoding') as google.maps.GeocodingLibrary
        const { Map } = await g.maps.importLibrary('maps') as google.maps.MapsLibrary
        const { Marker } = await g.maps.importLibrary('marker') as google.maps.MarkerLibrary

        // Only trust lat/lng if they're finite numbers. Bad data (null,
        // NaN, empty string, or "0,0" placeholder) would otherwise crash the
        // SDK with "setCenter: lat: not a number" and blank the map — instead
        // we fall through and geocode the address text.
        const flat = toFinite(lat)
        const flng = toFinite(lng)
        const hasRealCoords =
          flat !== null && flng !== null && !(flat === 0 && flng === 0)
        let coords: { lat: number; lng: number } | null = hasRealCoords
          ? { lat: flat as number, lng: flng as number }
          : null

        if (!coords) {
          const geo = new Geocoder()
          try {
            const res = await geo.geocode({ address })
            if (res.results.length > 0) {
              const l = res.results[0].geometry.location
              coords = { lat: l.lat(), lng: l.lng() }
            }
          } catch {
            // Geocoder throws on ZERO_RESULTS — swallow, fall through to no-coords path.
          }
        }

        if (!coords) {
          if (!cancelled) setError('Address not specific enough to map')
          return
        }

        const map = new Map(mapRef.current, {
          center: coords,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        })
        new Marker({
          position: coords,
          map,
          title: label ?? address,
        })

        if (!cancelled) setLoading(false)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [address, lat, lng, label])

  const directionsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=` +
    encodeURIComponent(address)

  if (error) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs">
        <div className="text-slate-700 font-medium">📍 {address}</div>
        <div className="text-slate-500 mt-1">{error}</div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-amber-700 hover:underline mt-1.5 inline-block"
        >
          Open in Google Maps →
        </a>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded overflow-hidden">
      <div className="relative bg-slate-100" style={{ width: '100%', height: 180 }}>
        {/* Map container — MUST be a pure leaf. Google Maps replaces its
            children with its own DOM, so any React children inside this
            div cause a removeChild crash on the next React render. */}
        <div ref={mapRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 pointer-events-none">
            Loading map…
          </div>
        )}
      </div>
      <div className="bg-slate-50 px-3 py-2 flex items-center justify-between gap-2 text-xs border-t border-slate-200">
        <div className="text-slate-700 truncate">📍 {address}</div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-amber-700 hover:underline font-medium whitespace-nowrap"
        >
          Directions →
        </a>
      </div>
    </div>
  )
}
