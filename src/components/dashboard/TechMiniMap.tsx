import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/googleMaps'

/**
 * TechMiniMap — a compact live map of tech GPS positions for the dashboard
 * widget. Reuses the shared Google Maps loader (tenant key). Degrades to a
 * "configure maps" / "no positions" message so the widget never breaks.
 */
export interface TechMarker {
  id: string
  lat: number
  lng: number
  /** Stale (older than ~10 min) markers render muted. */
  stale?: boolean
}

export function TechMiniMap({
  markers,
  height = 180,
}: {
  markers: TechMarker[]
  height?: number
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const gRef = useRef<typeof google | null>(null)
  const markerObjs = useRef<google.maps.Marker[]>([])
  const geoTriedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  // Init the map once.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then(async (g) => {
        if (cancelled || !elRef.current) return
        const { Map } = (await g.maps.importLibrary('maps')) as google.maps.MapsLibrary
        gRef.current = g
        mapRef.current = new Map(elRef.current, {
          center: { lat: 39.5, lng: -98.35 },
          zoom: 4,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // (Re)place markers + fit bounds when positions change.
  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (status !== 'ready' || !g || !map) return

    markerObjs.current.forEach((m) => m.setMap(null))
    markerObjs.current = []

    if (markers.length === 0) return
    const bounds = new g.maps.LatLngBounds()
    for (const m of markers) {
      const pos = { lat: m.lat, lng: m.lng }
      const marker = new g.maps.Marker({
        map,
        position: pos,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: m.stale ? '#94a3b8' : '#E8902C',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
      markerObjs.current.push(marker)
      bounds.extend(pos)
    }
    if (markers.length === 1) {
      map.setCenter({ lat: markers[0].lat, lng: markers[0].lng })
      map.setZoom(13)
    } else {
      map.fitBounds(bounds, 40)
    }
  }, [markers, status])

  // No tech markers yet → center on the viewer's location (one-shot) so the
  // map zooms into the shop's area instead of sitting on the whole country.
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    if (markers.length > 0 || geoTriedRef.current) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    geoTriedRef.current = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (markerObjs.current.length === 0 && mapRef.current) {
          mapRef.current.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          mapRef.current.setZoom(11)
        }
      },
      () => {
        /* denied / unavailable — keep the default view */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    )
  }, [status, markers.length])

  if (status === 'unavailable') {
    return (
      <div
        className="flex items-center justify-center text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200 px-3"
        style={{ height }}
      >
        Connect Google Maps in Tool Shed → Connections → Integrations to see techs on a map.
      </div>
    )
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200" style={{ height }}>
      <div ref={elRef} className="absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse" />
      )}
    </div>
  )
}
