import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { loadGoogleMaps } from '@/lib/googleMaps'

/**
 * Lazily geocode the IN-VIEW job locations that are missing coordinates — in
 * the browser, on the tenant's existing Maps key — and save them, so the
 * dispatch map self-populates as you browse (no manual backfill to babysit).
 *
 * Guardrails: capped per run (a wide range can't hammer Google or the tenant's
 * bill — it just fills more each refresh), deduped by location (repeat
 * customers geocode once), and a `tried` set so an un-geocodable address can't
 * spin in a retry loop. After a batch saves, the map-jobs query is invalidated
 * so the freshly-geocoded jobs re-appear pinned.
 */

interface GeocodableLoc {
  id?: string
  customer_id?: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}
interface GeocodableJob {
  location: GeocodableLoc | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const MAX_PER_RUN = 60

export function useLazyGeocode(jobs: GeocodableJob[]): void {
  const qc = useQueryClient()
  const running = useRef(false)
  const tried = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (running.current) return

    // Unique in-view locations that have an address but no coords yet.
    const byId = new Map<string, GeocodableLoc>()
    for (const j of jobs) {
      const l = j.location
      if (
        l && l.id && l.customer_id && l.address &&
        l.latitude == null && l.longitude == null &&
        !tried.current.has(l.id) && !byId.has(l.id)
      ) {
        byId.set(l.id, l)
      }
    }
    const batch = [...byId.values()].slice(0, MAX_PER_RUN)
    if (batch.length === 0) return

    running.current = true
    let cancelled = false
    ;(async () => {
      let saved = 0
      try {
        const g = await loadGoogleMaps()
        const { Geocoder } = (await g.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary
        const geocoder = new Geocoder()
        for (const loc of batch) {
          if (cancelled) break
          tried.current.add(loc.id as string)
          try {
            const { results } = await geocoder.geocode({ address: loc.address as string })
            const pos = results[0]?.geometry?.location
            if (pos) {
              await apiRequest(
                `/v1/customers/${loc.customer_id}/service-locations/${loc.id}`,
                { method: 'PATCH', body: { latitude: pos.lat(), longitude: pos.lng() } },
              )
              saved++
            }
          } catch {
            // No match or rate-limited — skip; `tried` prevents a tight loop.
          }
          await sleep(140) // stay well under Google's client QPS
        }
      } catch {
        // Maps key not configured / not loadable — silently no-op.
      } finally {
        running.current = false
        if (!cancelled && saved > 0) {
          qc.invalidateQueries({ queryKey: ['dispatch-map-jobs'] })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [jobs, qc])
}
