/**
 * Best-effort geotag for a status change.
 *
 * The owner wants to know WHERE a tech was when they flipped a job's status
 * ("On site", "Completed"). We ask the browser for a GPS fix; whatever happens
 * we resolve (never reject) with a `location_status` so the backend always
 * logs an audit row — including when the tech DENIED the prompt, so the owner
 * can see the gap and question it.
 *
 * The returned object is meant to be spread straight into a work-order PATCH
 * body alongside `status_id`; the backend strips these keys and records them
 * on work_order_status_events.
 */
export interface StatusGeo {
  location_lat?: number
  location_lng?: number
  location_accuracy_m?: number
  location_status: 'captured' | 'denied' | 'unavailable' | 'not_supported'
  location_error?: string
  location_source: 'web' | 'mobile'
}

/**
 * @param timeoutMs how long to wait for a fix before giving up (default 8s).
 */
export function captureStatusGeo(timeoutMs = 8000): Promise<StatusGeo> {
  const source: StatusGeo['location_source'] = 'web'

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({ location_status: 'not_supported', location_source: source })
  }

  return new Promise<StatusGeo>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          location_lat: pos.coords.latitude,
          location_lng: pos.coords.longitude,
          location_accuracy_m: Math.round(pos.coords.accuracy),
          location_status: 'captured',
          location_source: source,
        }),
      (err) =>
        resolve({
          // PERMISSION_DENIED (1) → the tech blocked it on purpose; flag it
          // distinctly from a device that simply couldn't get a fix.
          location_status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
          location_error: err.message?.slice(0, 255),
          location_source: source,
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    )
  })
}
