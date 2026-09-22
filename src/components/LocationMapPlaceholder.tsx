import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGoogleMapsKey, loadGoogleMaps } from '@/lib/googleMaps'

interface LocationMapPlaceholderProps {
  latitude: number | null
  longitude: number | null
  formattedAddress: string
}

/**
 * Renders a Google Map for a service location.
 *
 * Why the Maps JavaScript API (not the Embed API iframe)?
 *   Maps Embed API is a SEPARATE GCP-enabled API that most BYO keys
 *   don't have turned on — even if Maps JS works elsewhere in the
 *   app. We were hitting "this page can't load Google Maps correctly"
 *   on every BYO key. The JS SDK works against whatever key the rest
 *   of the app already loads, so if Address Autocomplete / Customer
 *   Picker work, this will too.
 *
 * Three states:
 *   1. No key configured (neither BYO nor platform) → settings link
 *   2. Key + no address + no coords → "add an address" notice
 *   3. Key + coords (or geocodable address) → real Map with marker.
 *      Falls back to geocoding the address client-side when coords
 *      are missing, so we still render even though we don't auto-
 *      geocode at write time.
 *
 * Failure mode: if the Maps SDK fails to load (referrer restriction,
 * disabled API, etc.) we show a friendly error + a plain Google Maps
 * link so the user can still get directions while they fix their key.
 */
export function LocationMapPlaceholder({
  latitude,
  longitude,
  formattedAddress,
}: LocationMapPlaceholderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [keyState, setKeyState] = useState<'loading' | 'missing' | 'ready'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const hasCoords = latitude !== null && longitude !== null
  const addrTrim = formattedAddress.trim()

  // 1. Check whether ANY usable key is configured.
  useEffect(() => {
    let cancelled = false
    getGoogleMapsKey()
      .then((k) => {
        if (cancelled) return
        setKeyState(k ? 'ready' : 'missing')
      })
      .catch(() => {
        if (!cancelled) setKeyState('missing')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 2. When the key is ready AND we have something to render, mount
  //    the JS SDK + place a Map + marker. Geocodes when only the
  //    address (not coords) is available.
  useEffect(() => {
    if (keyState !== 'ready') return
    if (!hasCoords && !addrTrim) return
    if (!containerRef.current) return

    let cancelled = false

    ;(async () => {
      try {
        const google = await loadGoogleMaps()
        if (cancelled || !containerRef.current) return

        // Modern Maps SDK splits constructors across libraries — Map
        // is in 'maps', Marker is in 'marker', Geocoder is in 'geocoding'.
        // Same pattern as JobLocationMap.
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary
        const { Marker } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary
        const { Geocoder } = (await google.maps.importLibrary(
          'geocoding',
        )) as google.maps.GeocodingLibrary

        let center: google.maps.LatLngLiteral
        if (hasCoords) {
          center = { lat: Number(latitude), lng: Number(longitude) }
        } else {
          const geocoder = new Geocoder()
          const result = await geocoder.geocode({ address: addrTrim })
          const loc = result.results[0]?.geometry?.location
          if (!loc) throw new Error('No geocoding result for this address.')
          center = { lat: loc.lat(), lng: loc.lng() }
        }

        if (cancelled || !containerRef.current) return
        const map = new Map(containerRef.current, {
          center,
          zoom: 16,
          // Disable street view + fullscreen — keeps the card compact.
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        })
        new Marker({ position: center, map })
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            (e as Error).message ?? 'Google Maps SDK failed to load.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [keyState, hasCoords, latitude, longitude, addrTrim])

  if (keyState === 'loading') {
    return (
      <div className="mt-3 border border-dashed border-slate-200 rounded-md p-3 bg-slate-50 text-xs text-slate-500">
        Loading map…
      </div>
    )
  }

  if (keyState === 'missing') {
    return (
      <div className="mt-3 border border-dashed border-navy-200 rounded-md p-4 bg-navy-50/30">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🗺️</div>
          <div className="flex-1">
            <div className="text-sm font-medium text-navy-700 mb-1">Map preview disabled</div>
            <div className="text-xs text-navy-500">
              Add a Google Maps API key in{' '}
              <Link
                to="/settings/integrations"
                className="font-medium text-amber-700 hover:underline"
              >
                Settings → Integrations
              </Link>{' '}
              to see this address on a map.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!hasCoords && !addrTrim) {
    return (
      <div className="mt-3 border border-dashed border-navy-200 rounded-md p-4 bg-navy-50/30 text-xs text-navy-500">
        <span className="font-medium text-navy-700">No address on this location.</span>{' '}
        Add a street address (or set coordinates) to render the map.
      </div>
    )
  }

  // Google Maps directions URL — handy regardless of whether the
  // inline map rendered.
  const directionsUrl = `https://maps.google.com/?q=${
    hasCoords ? `${latitude},${longitude}` : encodeURIComponent(addrTrim)
  }`

  if (loadError) {
    return (
      <div className="mt-3 border border-rose-200 bg-rose-50 rounded-md p-3 text-xs text-rose-800 space-y-2">
        <div className="font-semibold">Map failed to load</div>
        <div>{loadError}</div>
        <div className="text-rose-700">
          Common causes: the API key has a referrer restriction that doesn't
          allow this domain, OR <strong>Maps JavaScript API</strong> isn't
          enabled on the Google Cloud project. Check{' '}
          <Link to="/settings/integrations" className="font-semibold underline">
            Settings → Integrations
          </Link>
          .
        </div>
        <div>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1 text-xs font-semibold text-amber-700 hover:underline"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-md overflow-hidden border border-navy-200">
      <div
        ref={containerRef}
        style={{ width: '100%', height: 220 }}
        aria-label={`Map of ${addrTrim || `${latitude}, ${longitude}`}`}
      />
      <div className="bg-slate-50 border-t border-navy-200 px-3 py-1.5 text-right">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-amber-700 hover:underline"
        >
          Directions ↗
        </a>
      </div>
    </div>
  )
}
