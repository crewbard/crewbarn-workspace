import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { loadGoogleMaps } from '@/lib/googleMaps'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { initialsOf, monogramColor } from '@/components/Avatar'

/**
 * Route history — where a tech actually drove, day by day, for a week.
 *
 * Reads device_route_logs (the nightly gps:rollup of raw GPS fixes): one
 * row per device per day with a ≤200-point simplified path, detected
 * stops (matched to work orders via geofence visits), and drive stats.
 * Because it reads rollups, "today" never appears — routes show up the
 * morning after the day completes.
 */

interface RouteStop {
  lat: number
  lng: number
  arrived_at: string
  left_at: string
  work_order_id?: string
}

interface RouteLog {
  id: string
  account_id: string | null
  tracking_device_id: string
  device_label: string | null
  device_source: string | null
  date: string // YYYY-MM-DD (tenant-local day)
  path: [number, number, number][] // [lat, lng, epoch_s]
  stops: RouteStop[]
  gaps?: number[] // epoch_s of the last fix before each raw-stream hole

  miles_driven: number
  max_speed_mph: number | null
  first_fix_at: string | null
  last_fix_at: string | null
  fix_count: number
}

interface RouteLogsResponse {
  data: RouteLog[]
  work_orders: Record<string, { number: number | null; customer: string | null }>
  techs: { id: string; name: string }[]
}

// [lat, lng, epoch_s, speed_mph|null]
type ReplayPoint = [number, number, number, number | null]

interface ReplayResponse {
  data: {
    account_id: string
    date: string
    points: ReplayPoint[]
    jobs?: { id: string; number: number | null; customer: string | null; lat: number; lng: number; starts_at: string; ends_at: string | null }[]
    total_fixes: number
    returned: number
    thinned: boolean
    first_fix_at: string | null
    last_fix_at: string | null
  }
}

/** Monday-start week bucket for the picker. */
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Local YYYY-MM-DD (no UTC shift). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function stopMinutes(s: RouteStop): number {
  return Math.round((new Date(s.left_at).getTime() - new Date(s.arrived_at).getTime()) / 60_000)
}

// One color per weekday slot (Mon..Sun) so a day keeps its color across weeks.
const DAY_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777']

function dayColor(dateStr: string): string {
  const idx = (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7
  return DAY_COLORS[idx]
}

/** Local YYYY-MM-DD for today (no UTC shift) — the replay date default. */
function todayYmd(): string {
  return ymd(new Date())
}

/** Position along the track at a given epoch, interpolated between the two
 *  surrounding fixes so the marker glides instead of hopping fix-to-fix. */
function posAt(points: ReplayPoint[], clock: number): { lat: number; lng: number } {
  const first = points[0]
  const last = points[points.length - 1]
  if (clock <= first[2]) return { lat: first[0], lng: first[1] }
  if (clock >= last[2]) return { lat: last[0], lng: last[1] }
  for (let i = 1; i < points.length; i++) {
    if (points[i][2] >= clock) {
      const a = points[i - 1]
      const b = points[i]
      const span = b[2] - a[2] || 1
      const f = (clock - a[2]) / span
      return { lat: a[0] + (b[0] - a[0]) * f, lng: a[1] + (b[1] - a[1]) * f }
    }
  }
  return { lat: last[0], lng: last[1] }
}

function fmtClock(epoch: number): string {
  return new Date(epoch * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** The tech's monogram avatar as a map-pin data URL — initials on their hashed
 *  color, matching the avatar shown everywhere else in the app. A teardrop so
 *  the tip marks the exact spot; anchored at that tip. */
function avatarPinUrl(name: string): string {
  const color = monogramColor(name)
  const initials = initialsOf(name)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">` +
    `<path d="M22 53 C22 53 5 32 5 20 a17 17 0 1 1 34 0 C39 32 22 53 22 53 Z" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>` +
    `<circle cx="22" cy="20" r="12.5" fill="#ffffff" fill-opacity="0.18"/>` +
    `<text x="22" y="20" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="13" font-weight="700" fill="#ffffff">${initials}</text>` +
    `</svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

/** Speed (mph) at the clock — the nearest fix's reading, since speed isn't
 *  meaningful to interpolate. null when that fix carried no speed. */
function speedAt(points: ReplayPoint[], clock: number): number | null {
  if (points.length === 0) return null
  let best = points[0]
  let bestGap = Math.abs(points[0][2] - clock)
  for (const p of points) {
    const gap = Math.abs(p[2] - clock)
    if (gap < bestGap) { best = p; bestGap = gap }
  }
  return best[3]
}

const REPLAY_SPEEDS = [30, 60, 120, 300] as const

/**
 * Replay one day's driving as an animated scrubber, windowed to an hour range.
 *
 * Reads RAW fixes (/route-logs/replay), NOT the nightly rollup, so TODAY plays
 * — the point of the whole thing is watching the track that just caught up
 * after a GPS gap, not waiting for tomorrow's rollup.
 *
 * Self-contained: its own map, its own fetch, its own rAF loop. It deliberately
 * does not share the week view's map so the two can't fight over overlays.
 */
function RouteReplay({ accountId, techName }: { accountId: string; techName: string }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayYmd)

  const q = useQuery({
    queryKey: ['route-replay', accountId, date],
    queryFn: () =>
      apiRequest<ReplayResponse>(
        `/v1/route-logs/replay?account_id=${encodeURIComponent(accountId)}&date=${date}`,
      ),
    enabled: open && !!accountId,
  })

  const points = q.data?.data.points ?? []

  // Hour window (local clock). Defaults to the day's actual span once fixes
  // arrive; "same as day" — pick from-hour and to-hour like you pick the date.
  const [fromHour, setFromHour] = useState(0)
  const [toHour, setToHour] = useState(24)

  const dayHourBounds = useMemo(() => {
    if (points.length === 0) return null
    const firstH = new Date(points[0][2] * 1000).getHours()
    const lastH = new Date(points[points.length - 1][2] * 1000).getHours()
    return { firstH, lastH: Math.min(23, lastH) }
  }, [points])

  // Snap the window to the loaded day whenever a new day's fixes arrive.
  useEffect(() => {
    if (dayHourBounds) {
      setFromHour(dayHourBounds.firstH)
      setToHour(dayHourBounds.lastH + 1)
    }
  }, [dayHourBounds])

  const windowed = useMemo(() => {
    if (points.length === 0) return []
    return points.filter((p) => {
      const h = new Date(p[2] * 1000).getHours()
      return h >= fromHour && h < toHour
    })
  }, [points, fromHour, toHour])

  const t0 = windowed.length ? windowed[0][2] : 0
  const t1 = windowed.length ? windowed[windowed.length - 1][2] : 0

  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(120)

  // Reset the scrubber to the window's start whenever the window changes.
  useEffect(() => {
    setClock(t0)
    setPlaying(false)
  }, [t0, t1])

  const speedRef = useRef(speed)
  useEffect(() => { speedRef.current = speed }, [speed])
  const rafRef = useRef<number | undefined>(undefined)
  const lastTsRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!playing) return
    lastTsRef.current = undefined
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      setClock((prev) => {
        const next = prev + dt * speedRef.current
        if (next >= t1) {
          setPlaying(false)
          return t1
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, t1])

  // ------------------------------------------------------------------ map ---
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const gRef = useRef<typeof google | null>(null)
  const fullLine = useRef<google.maps.Polyline | null>(null)
  const doneLine = useRef<google.maps.Polyline | null>(null)
  const dot = useRef<google.maps.Marker | null>(null)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadGoogleMaps()
      .then(async (g) => {
        if (cancelled || !mapEl.current || mapRef.current) return
        const { Map } = (await g.maps.importLibrary('maps')) as google.maps.MapsLibrary
        gRef.current = g
        mapRef.current = new Map(mapEl.current, {
          center: { lat: 39.5, lng: -98.35 },
          zoom: 4,
          streetViewControl: false,
          mapTypeControl: false,
        })
        setMapStatus('ready')
      })
      .catch(() => { if (!cancelled) setMapStatus('unavailable') })
    return () => { cancelled = true }
  }, [open])

  // Draw the full windowed track (faint) + fit bounds when the window changes.
  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (!open || mapStatus !== 'ready' || !g || !map) return
    const start = new Date(`${date}T00:00:00`)
    start.setHours(fromHour)
    const end = new Date(`${date}T00:00:00`)
    end.setHours(toHour)
    const info = new g.maps.InfoWindow()
    const markers = (q.data?.data.jobs ?? []).filter(job => {
      const a = new Date(job.starts_at).getTime()
      const b = job.ends_at ? new Date(job.ends_at).getTime() : a
      return a < end.getTime() && (b > start.getTime() || (a === b && a >= start.getTime()))
    }).map(job => {
      const marker = new g.maps.Marker({ map, position: { lat: job.lat, lng: job.lng }, title: `Job #${job.number ?? '—'} · ${job.customer ?? 'Customer'}`, icon: { path: g.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }, zIndex: 5 })
      marker.addListener('click', () => {
        const content = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = `Job #${job.number ?? '—'}`
        const customer = document.createElement('p')
        customer.textContent = job.customer ?? 'Customer not listed'
        const link = document.createElement('a')
        link.href = `/jobs/${encodeURIComponent(job.id)}`
        link.textContent = 'Open job · logs and customer details →'
        link.style.color = '#b45309'
        content.append(title, customer, link)
        info.setContent(content)
        info.open({ map, anchor: marker })
      })
      return marker
    })
    return () => { info.close(); markers.forEach(marker => { g.maps.event.clearInstanceListeners(marker); marker.setMap(null) }) }
  }, [open, mapStatus, q.data, date, fromHour, toHour])

  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (mapStatus !== 'ready' || !g || !map) return

    fullLine.current?.setMap(null)
    if (windowed.length < 1) return

    const path = windowed.map((p) => ({ lat: p[0], lng: p[1] }))
    fullLine.current = new g.maps.Polyline({
      map,
      path,
      strokeColor: '#94a3b8',
      strokeOpacity: 0.7,
      strokeWeight: 3,
    })

    const bounds = new g.maps.LatLngBounds()
    path.forEach((pt) => bounds.extend(pt))
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48)
  }, [windowed, mapStatus])

  // Move the marker + grow the traveled line as the clock advances.
  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (mapStatus !== 'ready' || !g || !map || windowed.length < 1) return

    const here = posAt(windowed, clock)
    const traveled = windowed.filter((p) => p[2] <= clock).map((p) => ({ lat: p[0], lng: p[1] }))
    traveled.push(here)

    if (!doneLine.current) {
      doneLine.current = new g.maps.Polyline({
        map, path: traveled, strokeColor: '#2563eb', strokeOpacity: 0.95, strokeWeight: 4,
      })
    } else {
      doneLine.current.setPath(traveled)
    }

    if (!dot.current) {
      dot.current = new g.maps.Marker({
        map,
        position: here,
        icon: {
          url: avatarPinUrl(techName),
          scaledSize: new g.maps.Size(44, 54),
          anchor: new g.maps.Point(22, 53), // teardrop tip = exact position
        },
        zIndex: 10,
      })
    } else {
      dot.current.setPosition(here)
    }
  }, [clock, windowed, mapStatus, techName])

  // Refresh the pin when the tech changes — the icon is otherwise only set on
  // creation, so switching techs would keep the previous initials/color.
  useEffect(() => {
    const g = gRef.current
    if (!dot.current || !g) return
    dot.current.setIcon({
      url: avatarPinUrl(techName),
      scaledSize: new g.maps.Size(44, 54),
      anchor: new g.maps.Point(22, 53),
    })
  }, [techName])

  // Tear down replay overlays when the panel closes.
  useEffect(() => {
    if (open) return
    fullLine.current?.setMap(null); fullLine.current = null
    doneLine.current?.setMap(null); doneLine.current = null
    dot.current?.setMap(null); dot.current = null
    mapRef.current = null
    setMapStatus('loading')
    setPlaying(false)
  }, [open])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        ▶ Replay a day
      </button>
    )
  }

  const speedActive = 'bg-navy-900 text-white'
  const speedIdle = 'bg-white text-slate-600 hover:bg-slate-50'
  const atEnd = clock >= t1 && windowed.length > 0

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">Replay</span>
        <input
          type="date"
          value={date}
          max={todayYmd()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />

        {/* Hour window — the "from/to hour, same as day" ask. */}
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <select
            value={fromHour}
            onChange={(e) => setFromHour(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-1.5 py-1"
            aria-label="From hour"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{fmtHour(h)}</option>
            ))}
          </select>
          <span>to</span>
          <select
            value={toHour}
            onChange={(e) => setToHour(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-1.5 py-1"
            aria-label="To hour"
          >
            {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
              <option key={h} value={h}>{h === 24 ? 'end of day' : fmtHour(h)}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setOpen(false)}
          className="ml-auto text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      {mapStatus === 'unavailable' ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-center text-sm text-slate-500">
          Ask your administrator to configure Google Maps in CrewBarn Connect to replay routes.
        </div>
      ) : (
        <div className="relative h-[360px] overflow-hidden rounded-lg border border-slate-200">
          <div ref={mapEl} className="absolute inset-0" />
          {(mapStatus === 'loading' || q.isLoading) && (
            <div className="absolute inset-0 animate-pulse bg-slate-100" />
          )}
          {mapStatus === 'ready' && !q.isLoading && !q.isError && points.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
              <span className="rounded-md border border-slate-200 bg-white/95 px-3 py-1.5 text-sm text-slate-600 shadow-sm">
                No GPS fixes for this day yet.
              </span>
            </div>
          )}
        </div>
      )}

      {q.isError && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        GPS replay data could not be loaded. <button type="button" onClick={() => void q.refetch()} className="ml-2 underline">Retry replay</button>
      </div>}
      {/* Transport controls */}
      {windowed.length > 1 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (atEnd) setClock(t0)
                setPlaying((p) => !p)
              }}
              className="rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              {playing ? '❚❚ Pause' : atEnd ? '↻ Replay' : '▶ Play'}
            </button>

            <input
              type="range"
              min={t0}
              max={t1}
              value={clock}
              step={1}
              onChange={(e) => { setPlaying(false); setClock(Number(e.target.value)) }}
              className="flex-1 accent-navy-900"
              aria-label="Scrub replay"
            />

            <div className="w-24 text-right">
              <div className="text-sm tabular-nums text-slate-700">{fmtClock(clock || t0)}</div>
              {(() => {
                const mph = speedAt(windowed, clock || t0)
                return (
                  <div className="text-xs tabular-nums text-slate-500">
                    {mph != null ? `${Math.round(mph)} mph` : '—'}
                  </div>
                )
              })()}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Speed</span>
            {REPLAY_SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded border border-slate-300 px-2 py-0.5 font-medium ${speed === s ? speedActive : speedIdle}`}
              >
                {s}×
              </button>
            ))}
            <span className="ml-auto">
              {fmtClock(t0)} – {fmtClock(t1)}
              {(() => {
                const top = windowed.reduce((m, p) => (p[3] != null && p[3] > m ? p[3] : m), 0)
                return top > 0 ? ` · top ${Math.round(top)} mph` : ''
              })()}
              {q.data?.data.thinned
                ? ` · ${q.data.data.returned.toLocaleString()} of ${q.data.data.total_fixes.toLocaleString()} fixes`
                : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** 12-hour label for an hour-of-day integer (0–23). */
function fmtHour(h: number): string {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric' })
}

export function RouteHistoryPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  // Deep-linkable tech: the dispatch roster's right-click menu lands here
  // with ?account=<id> already set.
  const [searchParams, setSearchParams] = useSearchParams()
  const [accountId, setAccountId] = useState(() => searchParams.get('account') ?? '')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [hiddenDates, setHiddenDates] = useState<Set<string>>(new Set())

  const from = ymd(weekStart)
  const to = ymd(addDays(weekStart, 6))

  const q = useQuery({
    queryKey: ['route-logs', accountId, from],
    queryFn: () =>
      apiRequest<RouteLogsResponse>(
        `/v1/route-logs?account_id=${encodeURIComponent(accountId)}&from=${from}&to=${to}`,
      ),
  })

  const techs = q.data?.techs ?? []
  const workOrders = q.data?.work_orders ?? {}
  // Until a tech is picked the response holds every tech's logs — don't draw those.
  const logs = useMemo(
    () => (accountId ? (q.data?.data ?? []).filter((l) => l.account_id === accountId) : []),
    [q.data, accountId],
  )
  const visibleLogs = useMemo(
    () => logs.filter((l) => !hiddenDates.has(l.date)),
    [logs, hiddenDates],
  )

  // Auto-select the first tech once the roster arrives.
  useEffect(() => {
    if (!accountId && techs.length > 0) setAccountId(techs[0].id)
  }, [accountId, techs])

  // ---------------------------------------------------------------- map ----
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const gRef = useRef<typeof google | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const overlays = useRef<(google.maps.Polyline | google.maps.Marker)[]>([])
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then(async (g) => {
        if (cancelled || !mapEl.current) return
        const { Map, InfoWindow } = (await g.maps.importLibrary('maps')) as google.maps.MapsLibrary
        gRef.current = g
        mapRef.current = new Map(mapEl.current, {
          center: { lat: 39.5, lng: -98.35 },
          zoom: 4,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        })
        infoRef.current = new InfoWindow()
        setMapStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setMapStatus('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Redraw routes + stop markers whenever the visible set changes.
  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (mapStatus !== 'ready' || !g || !map) return

    overlays.current.forEach((o) => o.setMap(null))
    overlays.current = []
    infoRef.current?.close()

    if (visibleLogs.length === 0) return

    const bounds = new g.maps.LatLngBounds()
    for (const log of visibleLogs) {
      const color = dayColor(log.date)

      // Break the track only at the rollup's recorded GAPS — real holes in
      // the raw fix stream where the phone moved while dark. Time spacing
      // between path points means nothing here: the simplified path keeps
      // only spatial corner points, so its points are legitimately minutes
      // apart while the line between them is accurate.
      const gaps = [...(log.gaps ?? [])].sort((a, b) => a - b)
      const segments: { lat: number; lng: number }[][] = []
      let seg: { lat: number; lng: number }[] = []
      let prevEpoch: number | null = null
      for (const [lat, lng, epoch] of log.path) {
        const crossesGap =
          prevEpoch !== null && gaps.some((gp) => gp >= (prevEpoch as number) && gp < epoch)
        if (crossesGap && seg.length > 0) {
          segments.push(seg)
          seg = []
        }
        seg.push({ lat, lng })
        prevEpoch = epoch
        bounds.extend({ lat, lng })
      }
      if (seg.length > 0) segments.push(seg)

      for (const s of segments) {
        if (s.length < 2) continue
        overlays.current.push(
          new g.maps.Polyline({
            map,
            path: s,
            strokeColor: color,
            strokeOpacity: 0.75,
            strokeWeight: 3,
          }),
        )
      }

      log.stops.forEach((s, i) => {
        const wo = s.work_order_id ? workOrders[s.work_order_id] : undefined
        const marker = new g.maps.Marker({
          map,
          position: { lat: s.lat, lng: s.lng },
          label: { text: String(i + 1), color: '#ffffff', fontSize: '10px', fontWeight: '700' },
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: wo ? `Job #${wo.number ?? '—'}` : 'Stop',
        })
        marker.addListener('click', () => {
          const mins = stopMinutes(s)
          const job = wo
            ? `<div style="margin-top:2px"><a href="/jobs/${s.work_order_id}" style="color:#b45309;font-weight:600">Job #${wo.number ?? '—'}</a>${wo.customer ? ` · ${wo.customer}` : ''}</div>`
            : ''
          infoRef.current?.setContent(
            `<div style="font-size:12px;line-height:1.5">` +
              `<div style="font-weight:700">${fmtDay(log.date)} — stop ${i + 1}</div>` +
              `<div>${fmtTime(s.arrived_at)} → ${fmtTime(s.left_at)} (${mins} min)</div>` +
              job +
              `</div>`,
          )
          infoRef.current?.open({ map, anchor: marker })
        })
        overlays.current.push(marker)
      })
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48)
  }, [visibleLogs, workOrders, mapStatus])

  // -------------------------------------------------------------- render ---
  const totalMiles = visibleLogs.reduce((sum, l) => sum + l.miles_driven, 0)
  const totalStops = visibleLogs.reduce((sum, l) => sum + l.stops.length, 0)
  const thisWeek = ymd(startOfWeek(new Date())) === from

  const toggleDate = (date: string) =>
    setHiddenDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  return (
    <div className={easy ? 'w-full min-w-0 px-3 sm:px-6 py-4 sm:py-6' : 'max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6'}>
      <div className="mb-4">
        <Link to="/dispatch" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-1">
          ← Back to Dispatch
        </Link>
        {easy ? <EasyPageHeading title="Route history" description="Choose an app user and week. Routes require recorded GPS locations. Use the day replay to inspect the route, or toggle days in the table to compare them on the map. Weekly routes appear after the nightly rollup." /> : <>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Route history</h1>
        <p className="text-sm text-slate-500 mt-1">
          Where each tech drove, day by day. Routes are rolled up nightly — a day appears the
          morning after it ends.
        </p>
        </>}
      </div>

      {/* Tech + week pickers */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={accountId}
          aria-label="App user for route history"
          onChange={(e) => {
            setAccountId(e.target.value)
            setHiddenDates(new Set())
            setSearchParams({ account: e.target.value }, { replace: true })
          }}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
        >
          {techs.length === 0 && <option value="">{q.isError ? 'App users unavailable' : q.isLoading ? 'Loading app users…' : 'No app users found'}</option>}
          {techs.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white hover:bg-slate-50"
            aria-label="Previous week"
          >
            ←
          </button>
          <span className="text-sm text-slate-700 px-1 whitespace-nowrap">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' – '}
            {addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            disabled={thisWeek}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white hover:bg-slate-50 disabled:opacity-40"
            aria-label="Next week"
          >
            →
          </button>
          {!thisWeek && (
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="text-sm text-amber-700 hover:underline px-1"
            >
              This week
            </button>
          )}
        </div>

        {visibleLogs.length > 0 && (
          <span className="text-sm text-slate-500 ml-auto">
            {totalMiles.toFixed(1)} mi · {totalStops} stop{totalStops === 1 ? '' : 's'} shown
          </span>
        )}
      </div>

      {q.isError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Route history could not be loaded. <button type="button" onClick={() => void q.refetch()} className="ml-2 underline">Retry history</button>
      </div>}
      {/* Animated single-day replay with an hour window. Reads raw fixes, so
          it covers today; the week view below reads the nightly rollup. */}
      {accountId && (
        <RouteReplay
          accountId={accountId}
          techName={techs.find((t) => t.id === accountId)?.name ?? 'App user'}
        />
      )}

      {/* Map */}
      {mapStatus === 'unavailable' ? (
        <div className="flex items-center justify-center text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-200 px-3 h-64">
          Ask your administrator to configure Google Maps in CrewBarn Connect to see routes on a map.
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border border-slate-200 h-[420px]">
          <div ref={mapEl} className="absolute inset-0" />
          {mapStatus === 'loading' && <div className="absolute inset-0 bg-slate-100 animate-pulse" />}
          {mapStatus === 'ready' && accountId && !q.isLoading && !q.isError && logs.length === 0 && (
            <div className="absolute inset-x-0 top-0 flex justify-center pt-3 pointer-events-none">
              <span className="bg-white/95 border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-600 shadow-sm">
                No route logs for this week.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats table — one row per device-day; checkbox toggles the day on the map */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Device</th>
              <th className="px-3 py-2 text-right">Miles</th>
              <th className="px-3 py-2 text-right">Max mph</th>
              <th className="px-3 py-2">First fix</th>
              <th className="px-3 py-2">Last fix</th>
              <th className="px-3 py-2 text-right">Stops</th>
              <th className="px-3 py-2 text-right">Fixes</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>
            )}
            {!q.isLoading && !q.isError && logs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  No route logs for this tech this week. Days appear the morning after they end.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!hiddenDates.has(log.date)}
                    onChange={() => toggleDate(log.date)}
                    className="accent-amber-600"
                    aria-label={`Show ${fmtDay(log.date)} on map`}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                    style={{ backgroundColor: dayColor(log.date) }}
                  />
                  {fmtDay(log.date)}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {log.device_label || (log.device_source === 'phone' ? 'Phone' : log.tracking_device_id)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{log.miles_driven.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {log.max_speed_mph != null ? Math.round(log.max_speed_mph) : '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtTime(log.first_fix_at)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtTime(log.last_fix_at)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{log.stops.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">{log.fix_count.toLocaleString()}</td>
              </tr>
            ))}
            {logs.length > 1 && (
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Week total</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {logs.reduce((s, l) => s + l.miles_driven, 0).toFixed(1)}
                </td>
                <td className="px-3 py-2" colSpan={3} />
                <td className="px-3 py-2 text-right tabular-nums">
                  {logs.reduce((s, l) => s + l.stops.length, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {logs.reduce((s, l) => s + l.fix_count, 0).toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
