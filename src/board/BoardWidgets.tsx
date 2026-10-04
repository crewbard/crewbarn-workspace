import { useEffect, useRef, useState } from 'react'

import { googleMapsAuthFailed, hasMapError, loadGoogleMaps } from '@/lib/googleMaps'
import type { BoardData, BoardWidget } from '@/board/boardApi'

/**
 * The panels on the wall.
 *
 * Written for twelve feet, not for a desk. The desk app leans on
 * slate-400 hints and 11px meta lines; at this distance those are simply
 * not there. Everything here is heavy weight, high contrast, and sized
 * from the board's own scale so it grows with the screen rather than
 * being a small thing magnified.
 *
 * Status never depends on colour alone — there is always a word, because
 * a colour-blind tech across the room gets nothing from an amber dot.
 */

export interface WidgetProps {
  data: BoardData
  widget: BoardWidget
}

/**
 * Which slice of a too-long list to show right now.
 *
 * Paged rather than scrolled: a list creeping upwards is hard to read
 * from across a shop and impossible to read at a glance, which is the
 * only way anybody reads a wall. A page that holds still and then
 * changes is legible at every moment it is on screen.
 */
function useListPage(total: number, perPage: number, seconds: number): number {
  const pages = perPage > 0 ? Math.ceil(total / perPage) : 1
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (pages < 2 || seconds <= 0) {
      setPage(0)
      return
    }
    const id = window.setInterval(() => setPage((p) => (p + 1) % pages), seconds * 1000)
    return () => window.clearInterval(id)
  }, [pages, seconds])

  // The list can shrink under us between refreshes; a window left past
  // the end would show an empty card rather than the top of the list.
  return page < pages ? page : 0
}

/** How long each page holds, as this screen's owner set it. */
function pageSeconds(data: BoardData): number {
  return data.board?.layout?.behavior?.list_scroll_seconds ?? 0
}

/**
 * How many list rows a card of this height should show.
 *
 * A fixed three looked right on the card it was designed against and
 * wasted most of a taller one. Deliberately conservative — one row per
 * grid row after the title — because a card that overflows clips in
 * silence, and never fewer than the card showed before.
 */
function listRows(widget: BoardWidget | undefined, min: number): number {
  return Math.max(min, (widget?.h ?? 0) - 1)
}

/** Grid footprint per size, from docs/CREWBARN-TV.md. */
export const SIZE_SPAN: Record<string, { cols: number; rows: number }> = {
  small: { cols: 3, rows: 2 },
  medium: { cols: 4, rows: 2 },
  wide: { cols: 5, rows: 2 },
  tall: { cols: 3, rows: 4 },
  big: { cols: 4, rows: 4 },
}

function Panel({
  title,
  note,
  children,
}: {
  title: string
  /** A summary that belongs beside the title rather than inside the card. */
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="tv-panel">
      <h2 className="tv-panel-head">
        <span className="tv-panel-title">{title}</span>
        {note && <span className="tv-panel-note">{note}</span>}
      </h2>
      <div className="tv-panel-body">{children}</div>
    </section>
  )
}

/** Nothing to show is a sentence, not an empty box. */
function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="tv-quiet">{children}</p>
}

function timeOf(iso: string | null, tz: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz })
  } catch {
    return ''
  }
}

const money = (cents: number) =>
  // Cents always. Rounding money on a wall is how two people end up
  // quoting different numbers from the same screen.
  (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

// ── where everyone is ───────────────────────────────────────────────────
/**
 * The crew on a real map, with a plot to fall back on.
 *
 * Tiles need the Maps key to allow crewbarn.tv as a referrer. A key that
 * rejects the origin does not raise anything useful — it paints a blank
 * grey rectangle, which on a wall is indistinguishable from a broken
 * board. So the map is only shown once it has actually drawn, and until
 * then (or if it never does) the crew are plotted against each other,
 * which still answers who is clustered, who is far out, and who has
 * stopped reporting.
 */
/**
 * A dark map for a dark board.
 *
 * Google's default tiles are near-white. On a night-theme wall that turns
 * the biggest panel on the screen into a lamp, which is both unpleasant
 * to sit under all day and the fastest way to burn a rectangle into an
 * OLED. Only the land/water/road tones are restyled — labels stay legible
 * because reading the town name is the point of having a map.
 */
const DARK_MAP: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#16213a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b6c2d6' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#24324c' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#33445f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1526' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a4a66' }] },
]

function WhereEveryoneIs({ data }: WidgetProps) {
  const pts = data.locations.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
  // The shop itself, for the days nobody is reporting. A map of the area
  // you work in is worth drawing with no dots on it: an empty map reads
  // as a quiet morning, an empty panel reads as a broken screen.
  const home =
    data.home && Number.isFinite(data.home.lat) && Number.isFinite(data.home.lng) ? data.home : null
  const dark = (data.board?.layout?.look?.theme ?? 'night') !== 'daylight'
  const host = useRef<HTMLDivElement | null>(null)
  const map = useRef<google.maps.Map | null>(null)
  const markers = useRef<google.maps.Marker[]>([])
  const [tiles, setTiles] = useState(false)
  // Refused, rather than simply not drawn yet. The two look identical on
  // a wall and have completely different answers.
  const [refused, setRefused] = useState(false)

  useEffect(() => {
    let alive = true
    if (pts.length === 0 && !home) return

    void loadGoogleMaps()
      .then((g) => {
        if (!alive || !host.current) return
        if (!map.current) {
          map.current = new g.maps.Map(host.current, {
            disableDefaultUI: true,
            gestureHandling: 'none',
            keyboardShortcuts: false,
            // Nobody drives a wall, and the default controls are sized
            // for a mouse that is not in the room.
            zoomControl: false,
            clickableIcons: false,
            styles: dark ? DARK_MAP : undefined,
          })
        } else {
          map.current.setOptions({ styles: dark ? DARK_MAP : undefined })
        }

        markers.current.forEach((m) => m.setMap(null))
        markers.current = pts.map(
          (p) =>
            new g.maps.Marker({
              map: map.current!,
              position: { lat: p.lat, lng: p.lng },
              title: p.name ?? undefined,
              label: p.name
                ? { text: p.name, className: 'tv-marker-label', color: '#fff', fontWeight: '800' }
                : undefined,
              opacity: (p.age_minutes ?? 0) > 30 ? 0.45 : 1,
            }),
        )

        if (pts.length === 0 && home) {
          // Far enough out to be the area worked rather than the car park.
          map.current.setCenter({ lat: home.lat, lng: home.lng })
          map.current.setZoom(11)
        } else {
          const bounds = new g.maps.LatLngBounds()
          pts.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
          map.current.fitBounds(bounds, 48)
          // One tech gives a zero-area bounds and Maps zooms to the street.
          if (pts.length === 1) map.current.setZoom(13)
        }

        // Only now decide it worked. Google paints its apology inside the
        // container rather than throwing, so a promise that resolved is
        // not evidence of a map.
        window.setTimeout(() => {
          if (!alive) return
          const ok = !googleMapsAuthFailed() && !hasMapError(host.current)
          setTiles(ok)
          setRefused(!ok)
        }, 1200)
      })
      .catch(() => {
        // No key, a rejected referrer, or the script blocked. The plot
        // below carries on doing the useful part.
        if (alive) {
          setTiles(false)
          setRefused(true)
        }
      })

    return () => {
      alive = false
    }
  }, [pts, dark, home])

  // Nowhere to draw and nobody to draw: all that is left is the reason.
  if (pts.length === 0 && !home) {
    return (
      <Panel title="Where everyone is">
        <Quiet>Nobody is reporting a location</Quiet>
      </Panel>
    )
  }

  const lats = pts.length > 0 ? pts.map((p) => p.lat) : [home!.lat]
  const lngs = pts.length > 0 ? pts.map((p) => p.lng) : [home!.lng]
  // A single tech would otherwise divide by a zero-width box.
  const pad = 0.01
  const minLat = Math.min(...lats) - pad
  const maxLat = Math.max(...lats) + pad
  const minLng = Math.min(...lngs) - pad
  const maxLng = Math.max(...lngs) + pad

  return (
    <Panel title="Where everyone is">
      <div className="tv-map">
        <div
          ref={host}
          className="tv-map-tiles"
          style={{ opacity: tiles ? 1 : 0, visibility: tiles ? 'visible' : 'hidden' }}
        />
        {!tiles &&
          pts.map((p) => {
            const x = ((p.lng - minLng) / (maxLng - minLng)) * 100
            const y = 100 - ((p.lat - minLat) / (maxLat - minLat)) * 100
            // A fix nobody has updated in half an hour is not where they are.
            const stale = (p.age_minutes ?? 0) > 30
            return (
              <span key={p.id} className="tv-dot-wrap" style={{ left: `${x}%`, top: `${y}%` }}>
                <span className={stale ? 'tv-dot tv-dot-stale' : 'tv-dot'} />
                <span className="tv-dot-name">
                  {p.name}
                  {stale && <em className="tv-dot-stale-note"> · last seen {p.age_minutes}m ago</em>}
                </span>
              </span>
            )
          })}
        {refused ? (
          // The hostname is the whole answer, and this screen is the only
          // thing that knows which one it is being served from.
          <span className="tv-map-note">
            Map blocked &mdash; add {window.location.hostname} to the Google Maps key
          </span>
        ) : (
          pts.length === 0 && (
            // Over the map rather than instead of it.
            <span className="tv-map-note">Nobody is reporting a location right now</span>
          )
        )}
      </div>
    </Panel>
  )
}

// ── crew right now ──────────────────────────────────────────────────────
/**
 * Initials and a colour, picked from the name itself.
 *
 * Deterministic, so a tech is the same colour on every board in every
 * shop and people learn the dot before they read the word. Hashed rather
 * than assigned by position, so adding somebody to the roster does not
 * re-colour everybody below them.
 */
const AVATAR_COLOURS = ['#f5a524', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#eab308']

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function avatarColour(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length]
}

/** A short name, so a wall shows "Patrick K." rather than half a surname. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return name
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

function CrewRightNow({ data }: WidgetProps) {
  if (data.crew.length === 0) {
    return (
      <Panel title="Crew right now">
        <Quiet>No techs set up for the app yet — Settings, Staff</Quiet>
      </Panel>
    )
  }

  const working = data.crew.filter((c) => c.current)
  const idle = data.crew.filter((c) => !c.current)

  /*
   * Nobody is "off today" on a day nobody has anything booked.
   *
   * When there is work on the board, a tech with none of it is genuinely
   * out of the running and belongs in the strip at the bottom. When the
   * whole day is empty, that same tech is simply available — and saying
   * otherwise contradicted the band directly above, which was already
   * announcing them as free.
   */
  const anyBooked = data.crew.some((c) => c.jobs_today > 0)
  const free = anyBooked ? idle.filter((c) => c.jobs_today > 0) : idle
  const off = anyBooked ? idle.filter((c) => c.jobs_today === 0) : []

  const summary = [
    working.length > 0 ? `${working.length} working` : null,
    free.length > 0 ? `${free.length} free` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Panel title="Crew right now" note={summary || undefined}>
      <ul className="tv-list">
        {[...working, ...free].map((c) => {
          const name = c.name ?? 'Unnamed'
          return (
            <li key={c.id} className="tv-crew-row">
              <span className="tv-avatar" style={{ background: avatarColour(c.id || name) }}>
                {initials(name)}
              </span>
              <span className="tv-crew-mid">
                <span className="tv-crew-name">{shortName(name)}</span>
                <span className="tv-crew-job">
                  {c.current ? (c.current.title ?? c.current.customer ?? 'On a job') : 'Free now'}
                </span>
                {c.current?.customer && <span className="tv-crew-cust">{c.current.customer}</span>}
              </span>
              <span className="tv-crew-right">
                <span className={c.current ? 'tv-pill' : 'tv-pill tv-pill-quiet'}>
                  {c.current ? (c.current.status ?? 'On a job') : 'Free now'}
                </span>
                <span className="tv-crew-progress">
                  <span className="tv-dots" aria-hidden>
                    {Array.from({ length: Math.min(6, c.jobs_today) }).map((_, i) => (
                      <span key={i} className={i < c.done_today ? 'tv-dot-on' : 'tv-dot-off'} />
                    ))}
                  </span>
                  <span className="tv-crew-count">
                    {c.jobs_today === 0 ? 'nothing booked' : `${c.done_today} of ${c.jobs_today} jobs`}
                  </span>
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      {/* Off today sits under a rule, so the list above is only people
          somebody might actually be waiting on. */}
      {off.length > 0 && (
        <span className="tv-crew-off">
          {off.slice(0, 3).map((c) => (
            <span key={c.id} className="tv-crew-off-one">
              <span className="tv-avatar tv-avatar-sm" style={{ background: avatarColour(c.id || c.name || '') }}>
                {initials(c.name ?? '?')}
              </span>
              {shortName(c.name ?? 'Unnamed')}
            </span>
          ))}
          <span className="tv-crew-off-label">
            {off.length > 3 ? `+${off.length - 3} more` : 'nothing booked'}
          </span>
        </span>
      )}
    </Panel>
  )
}

// ── today's jobs ────────────────────────────────────────────────────────
function TodaysJobs({ data }: WidgetProps) {
  const t = data.todays_jobs
  if (!t) return <Panel title="Today's jobs"><Quiet>Not available</Quiet></Panel>

  const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0

  return (
    <Panel title="Today's jobs">
      <div className="tv-hero">{t.done}<span className="tv-hero-of"> / {t.total}</span></div>
      <div className="tv-bar"><span className="tv-bar-fill" style={{ width: `${pct}%` }} /></div>
      <p className="tv-sub">
        {t.going_now} going now · {t.still_to_go} still to go
      </p>
    </Panel>
  )
}

// ── up next ─────────────────────────────────────────────────────────────
function UpNext({ data, widget }: WidgetProps) {
  const per = listRows(widget, 3)
  const page = useListPage(data.up_next.length, per, pageSeconds(data))
  const rows = data.up_next.slice(page * per, page * per + per)
  const more = data.up_next.length - rows.length

  return (
    <Panel title="Up next">
      {rows.length === 0 ? (
        <Quiet>Nothing else booked today</Quiet>
      ) : (
        <ul className="tv-list">
          {rows.map((j, i) => (
            <li key={i} className="tv-next-row">
              <span className="tv-next-time">{timeOf(j.at, data.timezone)}</span>
              <span className="tv-next-who">
                <span className="tv-next-customer">{j.customer ?? 'Customer'}</span>
                <span className="tv-next-title">{j.title}</span>
              </span>
              <span className="tv-next-tech">{j.tech ?? 'Unassigned'}</span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="tv-sub">{more} more today</p>}
    </Panel>
  )
}

// ── needs a hand ────────────────────────────────────────────────────────
function NeedsAHand({ data, widget }: WidgetProps) {
  const n = data.needs_a_hand
  // Before the early return: a hook that runs only sometimes is not a
  // hook, and React counts them by position.
  const perStale = listRows(widget, 2)
  const stalePage = useListPage(n?.stale_jobs?.length ?? 0, perStale, pageSeconds(data))

  if (!n) return <Panel title="Needs a hand"><Quiet>Not available</Quiet></Panel>

  const stale = n.stale_jobs.slice(stalePage * perStale, stalePage * perStale + perStale)

  return (
    <Panel title="Needs a hand">
      <ul className="tv-list">
        {n.overdue_invoices.count > 0 && (
          <li className="tv-alert">
            <span className="tv-alert-n">{n.overdue_invoices.count}</span>
            <span>
              overdue {n.overdue_invoices.count === 1 ? 'invoice' : 'invoices'}
              {n.overdue_invoices.cents !== null && ` · ${money(n.overdue_invoices.cents)}`}
            </span>
          </li>
        )}
        {stale.map((s, i) => (
          <li key={i} className="tv-alert">
            <span className="tv-alert-n">{s.days}d</span>
            <span>{s.customer ?? s.title} still open</span>
          </li>
        ))}
        {n.overdue_invoices.count === 0 && stale.length === 0 && <Quiet>Nothing needs chasing</Quiet>}
      </ul>
    </Panel>
  )
}

// ── collected today ─────────────────────────────────────────────────────
function CollectedToday({ data }: WidgetProps) {
  // Null means the server withheld it, which is the setting working. Say
  // so plainly rather than showing a zero somebody reads as a bad day.
  if (!data.money) {
    return (
      <Panel title="Collected today">
        <Quiet>Hidden while customers are in the shop</Quiet>
      </Panel>
    )
  }

  return (
    <Panel title="Collected today">
      <div className="tv-hero">{money(data.money.collected_today_cents)}</div>
      <p className="tv-sub">{money(data.money.outstanding_cents)} still outstanding</p>
    </Panel>
  )
}

// ── jobs this week ──────────────────────────────────────────────────────
function JobsThisWeek({ data }: WidgetProps) {
  const max = Math.max(1, ...data.jobs_this_week.map((d) => d.count))

  return (
    <Panel title="Jobs this week">
      <div className="tv-bars">
        {data.jobs_this_week.map((d) => (
          <span key={d.date} className="tv-bars-col">
            <span className="tv-bars-n">{d.count}</span>
            <span
              className={d.today ? 'tv-bars-bar tv-bars-today' : 'tv-bars-bar'}
              style={{ height: `${(d.count / max) * 100}%` }}
            />
            <span className="tv-bars-label">{d.label}</span>
          </span>
        ))}
      </div>
    </Panel>
  )
}

// ── big clock ───────────────────────────────────────────────────────────
function BigClock({ data }: WidgetProps) {
  const now = new Date()
  return (
    <Panel title="Time">
      <div className="tv-hero">{timeOf(now.toISOString(), data.timezone)}</div>
      <p className="tv-sub">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    </Panel>
  )
}

// ── dormant jobs ────────────────────────────────────────────────────────
function DormantJobs({ data, widget }: WidgetProps) {
  const rows = data.dormant_jobs ?? []
  const per = listRows(widget, 3)
  const page = useListPage(rows.length, per, pageSeconds(data))

  return (
    <Panel title="Gone quiet">
      {rows.length === 0 ? (
        <Quiet>Nothing has been sitting</Quiet>
      ) : (
        <ul className="tv-list">
          {/* Three, because a medium panel holds three at this size and a
              fourth runs off the bottom edge. The count carries the rest —
              nothing on a wall should end mid-row. */}
          {rows.slice(page * per, page * per + per).map((j, i) => (
            <li key={i} className="tv-alert">
              <span className="tv-alert-n">{j.days}d</span>
              <span className="tv-dormant-who">
                <span className="tv-next-customer">{j.customer ?? j.title}</span>
                <span className="tv-next-title">
                  {j.status ?? 'Open'}
                  {j.tech ? ` · ${j.tech}` : ' · unassigned'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 3 && <p className="tv-sub">{rows.length - 3} more sitting</p>}
    </Panel>
  )
}

// ── estimates approved ──────────────────────────────────────────────────
function EstimatesApproved({ data, widget }: WidgetProps) {
  const e = data.estimates
  const perTop = listRows(widget, 2)
  const topPage = useListPage(e?.top?.length ?? 0, perTop, pageSeconds(data))

  if (!e) return <Panel title="Approved estimates"><Quiet>Not available</Quiet></Panel>

  return (
    <Panel title="Said yes, not booked">
      <div className="tv-hero">{e.approved}</div>
      <p className="tv-sub">
        {e.approved_cents !== null && e.approved_cents !== undefined
          ? `${money(e.approved_cents)} waiting to be scheduled`
          : 'approved and waiting to be scheduled'}
      </p>
      <ul className="tv-list">
        {(e.top ?? []).slice(topPage * perTop, topPage * perTop + perTop).map((t, i) => (
          <li key={i} className="tv-named">
            <span className="tv-named-who">{t.customer ?? 'Customer'}</span>
            {t.cents !== null && t.cents !== undefined && (
              <span className="tv-named-val">{money(t.cents)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="tv-sub">{e.waiting} still out for a decision</p>
    </Panel>
  )
}

// ── waiting on parts ────────────────────────────────────────────────────
function WaitingOnParts({ data }: WidgetProps) {
  const p = data.parts
  if (!p) return <Panel title="Parts"><Quiet>Not available</Quiet></Panel>

  return (
    <Panel title="Parts">
      <div className="tv-split">
        <span className="tv-split-half">
          <span className="tv-hero tv-hero-sm">{p.needs_parts}</span>
          <span className="tv-sub">need parts</span>
        </span>
        <span className="tv-split-half">
          <span className="tv-hero tv-hero-sm">{p.parts_ordered}</span>
          <span className="tv-sub">on order</span>
        </span>
      </div>
      {p.needs_parts === 0 && p.parts_ordered === 0 && <Quiet>Nothing blocked on parts</Quiet>}
    </Panel>
  )
}

/**
 * The morning nobody has booked anything.
 *
 * Not a card and not configurable: an empty board is a state, not a
 * choice, and the one thing nobody should have to set up is what happens
 * when there is nothing to show. A wall reading "0 jobs today" all
 * morning trains people to stop looking at it, which costs more than the
 * empty day does.
 *
 * So it says the quiet part and then points at the work that already
 * exists — approved estimates nobody booked, jobs that went quiet, parts
 * to chase. That is a morning's dispatching, on the wall, unprompted.
 */
export function QuietDayHero({ data }: { data: BoardData }) {
  const free = data.crew.filter((c) => !c.current)
  const ready =
    (data.estimates?.approved ?? 0) + (data.dormant_jobs?.length ?? 0) + (data.parts?.needs_parts ?? 0)

  return (
    <section className="tv-hero-band">
      <span className="tv-hero-words">
        <span className="tv-hero-line">Nothing booked yet today.</span>
        <span className="tv-hero-sub">
          {ready > 0 ? 'Here is work that is ready to go.' : 'Nothing waiting either — a genuinely clear day.'}
        </span>
      </span>

      {free.length > 0 && (
        <span className="tv-hero-crew">
          <span className="tv-hero-faces">
            {free.slice(0, 5).map((c) => (
              <span
                key={c.id}
                className="tv-avatar tv-avatar-stack"
                style={{ background: avatarColour(c.id || c.name || '') }}
              >
                {initials(c.name ?? '?')}
              </span>
            ))}
          </span>
          <span className="tv-hero-free">
            {free.length} {free.length === 1 ? 'tech' : 'techs'} free
          </span>
        </span>
      )}
    </section>
  )
}

// ── today, hour by hour ─────────────────────────────────────────────────
/**
 * The day as a shape rather than a list.
 *
 * Every other card answers "what" and none of them answer "when", which
 * is most of what a dispatcher standing in front of a wall is actually
 * asking: who is free at two, what is stacked up this morning, is
 * anybody double-booked. A list cannot answer any of those at a glance
 * and a timeline answers all three without being read.
 *
 * Everything is a percentage of the day's own window, so the card fits
 * whatever size the board gives it without measuring anything.
 */
function TodaysTimeline({ data, widget }: WidgetProps) {
  const t = data.timeline
  const per = listRows(widget, 3)
  const page = useListPage(t?.lanes.length ?? 0, per, pageSeconds(data))

  if (!t || t.lanes.length === 0) {
    return (
      <Panel title="Today, hour by hour">
        <Quiet>Nothing scheduled today</Quiet>
      </Panel>
    )
  }

  const span = Math.max(1, t.to - t.from)
  const at = (minute: number) => ((minute - t.from) / span) * 100

  // Ticks on the hour, thinned out when the window is long so the labels
  // never collide on a narrow card.
  const hours: number[] = []
  const step = span > 8 * 60 ? 120 : 60
  for (let m = Math.ceil(t.from / step) * step; m <= t.to; m += step) hours.push(m)

  const clock = (m: number) => {
    const h = Math.floor(m / 60) % 24
    const ampm = h >= 12 ? 'p' : 'a'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}${ampm}`
  }

  const nowVisible = t.now >= t.from && t.now <= t.to

  return (
    <Panel title="Today, hour by hour">
      <div className="tv-tl">
        {/* the hour scale */}
        <div className="tv-tl-scale">
          {hours.map((m) => (
            <span key={m} className="tv-tl-tick" style={{ left: `${at(m)}%` }}>
              {clock(m)}
            </span>
          ))}
        </div>

        <div className="tv-tl-lanes">
          {/* the hour lines, behind everything */}
          {hours.map((m) => (
            <span key={m} className="tv-tl-rule" style={{ left: `${at(m)}%` }} aria-hidden />
          ))}

          {nowVisible && <span className="tv-tl-now" style={{ left: `${at(t.now)}%` }} aria-hidden />}

          {t.lanes.slice(page * per, page * per + per).map((lane, i) => (
            <div key={lane.tech_id ?? i} className="tv-tl-lane">
              <span
                className="tv-avatar tv-avatar-sm tv-tl-who"
                style={{ background: avatarColour(lane.tech_id || lane.tech || '') }}
                title={lane.tech ?? undefined}
              >
                {initials(lane.tech ?? '?')}
              </span>
              <span className="tv-tl-track">
                {lane.jobs.map((j, k) => {
                  if (j.start === null || j.end === null) return null
                  const left = at(j.start)
                  const width = Math.max(2, at(j.end) - left)
                  return (
                    <span
                      key={k}
                      className={`tv-tl-job${j.done ? ' is-done' : ''}${j.going ? ' is-going' : ''}`}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: avatarColour(lane.tech_id || lane.tech || ''),
                      }}
                      title={`${j.customer ?? j.title ?? 'Job'} — ${clock(j.start)} to ${clock(j.end)}`}
                    >
                      <span className="tv-tl-job-name">{j.customer ?? j.title}</span>
                    </span>
                  )
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ── the sky ───────────────────────────────────────────────
/**
 * Weather, for a trade that works outside.
 *
 * The next few hours rather than a week: nobody standing in a shop at
 * ten past eight is planning Thursday, they are deciding whether the
 * afternoon roof job happens. A warning gets its own line because it is
 * the only part of a forecast worth interrupting somebody for.
 */
function WeatherNow({ data }: WidgetProps) {
  const w = data.weather
  if (!w || w.hours.length === 0) {
    return (
      <Panel title="Weather">
        <Quiet>No forecast — add the company address in Settings</Quiet>
      </Panel>
    )
  }

  const now = w.hours[0]
  const rest = w.hours.slice(1, 5)
  const at = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', timeZone: data.timezone }) : ''

  return (
    <Panel title="Weather" note={now.short ?? undefined}>
      <div className="tv-hero">
        {now.temp ?? '—'}&deg;
        <span className="tv-hero-of"> {now.unit ?? 'F'}</span>
      </div>
      {w.warning ? <p className="tv-sub tv-weather-warn">{w.warning}</p> : null}
      <div className="tv-tl-scale" style={{ position: 'static', marginLeft: 0, height: 'auto' }}>
        <div className="tv-huddle-weather">
          {rest.map((h, i) => (
            <span key={i} className="tv-hour">
              <span className="tv-hour-at">{at(h.at)}</span>
              <span className="tv-hour-temp">{h.temp ?? '—'}&deg;</span>
              {h.rain != null && h.rain >= 20 ? <span className="tv-hour-rain">{h.rain}%</span> : null}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ── stalled work, by tech ───────────────────────────────────────────────
/**
 * A shared pile of stalled jobs says the shop has a problem. The same
 * pile with names on it says whose, which is the only version anybody
 * standing in front of a wall can act on.
 */
function DormantByTech({ data, widget }: WidgetProps) {
  const groups = data.dormant_by_tech ?? []
  const per = listRows(widget, 2)
  const page = useListPage(groups.length, per, pageSeconds(data))

  return (
    <Panel title="Gone quiet, by tech">
      {groups.length === 0 ? (
        <Quiet>Nothing has been sitting</Quiet>
      ) : (
        <ul className="tv-list">
          {groups.slice(page * per, page * per + per).map((g, i) => (
            <li key={g.tech_id ?? i} className="tv-crew-row">
              <span
                className="tv-avatar"
                style={{ background: avatarColour(g.tech_id || g.tech || '') }}
              >
                {initials(g.tech ?? '?')}
              </span>
              <span className="tv-crew-mid">
                <span className="tv-crew-name">{shortName(g.tech ?? 'Nobody assigned')}</span>
                <span className="tv-crew-job">
                  {g.jobs.slice(0, 2).map((j) => j.customer).filter(Boolean).join(' \u00b7 ') || 'Stalled work'}
                </span>
              </span>
              <span className="tv-crew-right">
                <span className="tv-pill">{g.count}</span>
                <span className="tv-crew-count">oldest {g.oldest_days}d</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ── to do, by tech ──────────────────────────────────────────────────────
/**
 * Overdue is counted per person rather than only marked per row, so a
 * glance from across the shop lands on the right name before anybody has
 * read a single task.
 */
function TasksByTech({ data, widget }: WidgetProps) {
  const groups = data.tasks_by_tech ?? []
  const per = listRows(widget, 2)
  const page = useListPage(groups.length, per, pageSeconds(data))

  return (
    <Panel title="To do, by tech">
      {groups.length === 0 ? (
        <Quiet>Nothing on anybody's list</Quiet>
      ) : (
        <ul className="tv-list">
          {groups.slice(page * per, page * per + per).map((g, i) => (
            <li key={g.tech_id ?? i} className="tv-crew-row">
              <span
                className="tv-avatar"
                style={{ background: avatarColour(g.tech_id || g.tech || '') }}
              >
                {initials(g.tech ?? '?')}
              </span>
              <span className="tv-crew-mid">
                <span className="tv-crew-name">{shortName(g.tech ?? 'Unassigned')}</span>
                <span className="tv-crew-job">{g.tasks[0]?.title ?? 'Nothing written down'}</span>
              </span>
              <span className="tv-crew-right">
                <span className={g.overdue > 0 ? 'tv-pill tv-pill-bad' : 'tv-pill tv-pill-quiet'}>
                  {g.count}
                </span>
                <span className="tv-crew-count">
                  {g.overdue > 0 ? `${g.overdue} overdue` : 'on time'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * The library, by the id stored on the device.
 *
 * A type the board does not recognise is skipped rather than crashing the
 * wall — the config is edited elsewhere and may name something this build
 * has not shipped yet.
 */
/** A position nobody has updated in half an hour is not where somebody is. */
const FRESH_MINUTES = 30

/**
 * Whether a card has anything worth the space.
 *
 * A wall of zeroes and "nothing today" is how a board teaches people to
 * stop looking at it, and once they have stopped they do not start again
 * when the day gets busy. An empty card is therefore removed and the rest
 * grow into the gap, rather than every widget drawing whatever it has.
 */
/** What a card is for, in one line, and where it sits in the library. */
export interface WidgetMeta {
  title: string
  Component: React.ComponentType<WidgetProps>
  hasContent?: (d: BoardData) => boolean
  group: 'People' | 'Jobs' | 'Money' | 'Extras'
  blurb: string
  /** Grid cells: what it gets when added, and how small it may go. */
  size: { w: number; h: number }
  min: { w: number; h: number }
}

export const BOARD_WIDGETS: Record<string, WidgetMeta> = {
  'where-everyone-is': {
    group: 'People',
    blurb: 'A map with a dot for each tech, and how long ago they reported.',
    size: { w: 5, h: 4 },
    min: { w: 4, h: 3 },
    title: 'Where everyone is',
    Component: WhereEveryoneIs,
    // Only with fixes fresh enough to mean something. A single stale dot
    // on an empty grid is worse than no map — it says somebody is
    // somewhere they left hours ago.
    hasContent: (d) => d.locations.some((l) => (l.age_minutes ?? 999) <= FRESH_MINUTES),
  },
  'crew-right-now': {
    group: 'People',
    blurb: 'Who is working, what they are on, and how far through the day.',
    size: { w: 6, h: 4 },
    min: { w: 4, h: 3 },
    title: 'Crew right now',
    Component: CrewRightNow,
    hasContent: (d) => d.crew.some((c) => c.jobs_today > 0),
  },
  'todays-jobs': {
    group: 'Jobs',
    blurb: 'Done, going now, and still to go.',
    size: { w: 4, h: 2 },
    min: { w: 3, h: 2 },
    title: "Today's jobs",
    Component: TodaysJobs,
    // 0 of 0 is not information. The quiet-day band says it better.
    hasContent: (d) => (d.todays_jobs?.total ?? 0) > 0,
  },
  'up-next': {    group: 'Jobs',
    blurb: 'The next few jobs, with the time and the tech.',
    size: { w: 4, h: 4 },
    min: { w: 4, h: 2 },
 title: 'Up next', Component: UpNext, hasContent: (d) => d.up_next.length > 0 },
  'needs-a-hand': {
    group: 'Jobs',
    blurb: 'Overdue invoices and jobs that have stalled.',
    size: { w: 6, h: 2 },
    min: { w: 4, h: 2 },
    title: 'Needs a hand',
    Component: NeedsAHand,
    hasContent: (d) =>
      (d.needs_a_hand?.overdue_invoices.count ?? 0) > 0 || (d.needs_a_hand?.stale_jobs.length ?? 0) > 0,
  },
  'collected-today': {
    group: 'Money',
    blurb: 'What has come in today, and what is still outstanding.',
    size: { w: 4, h: 2 },
    min: { w: 3, h: 2 },
    title: 'Collected today',
    Component: CollectedToday,
    // Withheld money still earns its card — it says why it is blank.
    hasContent: (d) => d.money === null || d.money.collected_today_cents > 0 || d.money.outstanding_cents > 0,
  },
  'jobs-this-week': {
    group: 'Jobs',
    blurb: 'A bar for each day, with today picked out.',
    size: { w: 4, h: 2 },
    min: { w: 4, h: 2 },
    title: 'Jobs this week',
    Component: JobsThisWeek,
    hasContent: (d) => d.jobs_this_week.some((b) => b.count > 0),
  },
  'big-clock': {    group: 'Extras',
    blurb: 'The time and the date, large.',
    size: { w: 4, h: 2 },
    min: { w: 3, h: 2 },
 title: 'Big clock', Component: BigClock },
  'dormant-jobs': {    group: 'Jobs',
    blurb: 'Jobs nobody has touched, oldest first.',
    size: { w: 5, h: 3 },
    min: { w: 4, h: 2 },
 title: 'Gone quiet', Component: DormantJobs, hasContent: (d) => (d.dormant_jobs?.length ?? 0) > 0 },
  'estimates-approved': {
    group: 'Money',
    blurb: 'Work already said yes to and not yet booked.',
    size: { w: 5, h: 3 },
    min: { w: 4, h: 2 },
    title: 'Said yes, not booked',
    Component: EstimatesApproved,
    hasContent: (d) => (d.estimates?.approved ?? 0) > 0 || (d.estimates?.waiting ?? 0) > 0,
  },
  'weather': {
    group: 'Extras',
    title: 'Weather',
    blurb: 'The next few hours, and any warning worth knowing.',
    Component: WeatherNow,
    size: { w: 4, h: 3 },
    min: { w: 3, h: 2 },
    hasContent: (d) => (d.weather?.hours.length ?? 0) > 0,
  },
  'todays-timeline': {
    group: 'Jobs',
    title: 'Today, hour by hour',
    blurb: 'A lane per tech, a block per job, and a line where now is.',
    Component: TodaysTimeline,
    size: { w: 8, h: 4 },
    min: { w: 6, h: 3 },
    hasContent: (d) => (d.timeline?.lanes.length ?? 0) > 0,
  },
  'dormant-by-tech': {
    group: 'People',
    title: 'Gone quiet, by tech',
    blurb: 'Stalled jobs, grouped by whose they are.',
    Component: DormantByTech,
    size: { w: 5, h: 4 },
    min: { w: 4, h: 3 },
    hasContent: (d) => (d.dormant_by_tech?.length ?? 0) > 0,
  },
  'tasks-by-tech': {
    group: 'People',
    title: 'To do, by tech',
    blurb: "Everybody's open tasks, and who is behind.",
    Component: TasksByTech,
    size: { w: 5, h: 4 },
    min: { w: 4, h: 3 },
    hasContent: (d) => (d.tasks_by_tech?.length ?? 0) > 0,
  },
  'waiting-on-parts': {
    group: 'Jobs',
    blurb: 'How many jobs need parts, and how many are on order.',
    size: { w: 4, h: 2 },
    min: { w: 4, h: 2 },
    title: 'Parts',
    Component: WaitingOnParts,
    hasContent: (d) => (d.parts?.needs_parts ?? 0) > 0 || (d.parts?.parts_ordered ?? 0) > 0,
  },
}
