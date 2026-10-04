import { useEffect, useRef, useState } from 'react'

import { boardFetchEvents, type BoardEvent, type BoardLayout } from '@/board/boardApi'

/**
 * Full-screen takeovers, for the four things worth stopping the room.
 *
 * A moment sits over the blurred board, plays once, and goes. The board
 * is dimmed behind rather than replaced, so anybody mid-sentence about
 * what is on the wall does not lose their place.
 *
 * One at a time, always. Two overlapping celebrations is a glitch, and a
 * queue that drains one after another at eight seconds each turns a busy
 * afternoon into a screen nobody can read. So arrivals within a minute of
 * each other merge: three jobs finishing together is one moment saying
 * three, not three moments.
 *
 * Nothing here is essential information — everything a moment shows is
 * also on the board. That is deliberate: a television people walk past
 * must never require them to have been watching.
 */

const POLL_MS = 15_000

/** How long each kind holds the screen. */
const SECONDS: Record<BoardEvent['type'], number> = { done: 8, new: 10, paid: 8, review: 12 }

/** Arrivals closer together than this are told as one. */
const MERGE_MS = 60_000

interface Shown {
  key: string
  type: BoardEvent['type']
  events: BoardEvent[]
}

export function BoardMoments({
  layout,
  quiet,
  timezone,
}: {
  layout: BoardLayout | undefined
  /** After hours, or a huddle — moments stay out of the way. */
  quiet: boolean
  timezone: string
}) {
  const [queue, setQueue] = useState<Shown[]>([])
  const [current, setCurrent] = useState<Shown | null>(null)
  const since = useRef<string | null>(null)
  const seen = useRef<Set<string>>(new Set())

  const moments = layout?.moments

  // ── collect ──
  useEffect(() => {
    if (quiet) return
    let alive = true

    const tick = async () => {
      try {
        const res = await boardFetchEvents(since.current)
        if (!alive) return
        since.current = res.now

        const fresh = res.events.filter((e) => {
          if (seen.current.has(e.id)) return false
          seen.current.add(e.id)
          return moments?.[e.type] !== false
        })
        if (fresh.length === 0) return

        setQueue((q) => {
          const next = [...q]
          for (const e of fresh) {
            // Merge into the last queued moment of the same kind when it
            // is recent enough to still be the same happening.
            const last = next[next.length - 1]
            const lastAt = last ? Date.parse(last.events[last.events.length - 1].at) : 0
            if (last && last.type === e.type && Date.parse(e.at) - lastAt < MERGE_MS) {
              last.events = [...last.events, e]
            } else {
              next.push({ key: e.id, type: e.type, events: [e] })
            }
          }
          // A board that has been ignored for a while should not work
          // through a backlog; the newest few are the interesting ones.
          return next.slice(-4)
        })
      } catch {
        /* a missed poll is not worth saying anything about */
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [quiet, moments])

  // ── play ──
  useEffect(() => {
    if (current || queue.length === 0 || quiet) return
    const [next, ...rest] = queue
    setQueue(rest)
    setCurrent(next)
    const id = window.setTimeout(() => setCurrent(null), SECONDS[next.type] * 1000)
    return () => window.clearTimeout(id)
  }, [queue, current, quiet])

  // After hours arriving mid-moment should clear the screen, not wait.
  useEffect(() => {
    if (quiet) {
      setCurrent(null)
      setQueue([])
    }
  }, [quiet])

  if (!current) return null

  return (
    <div className="tv-moment-wrap">
      <div className="tv-moment" data-kind={current.type}>
        <Moment shown={current} timezone={timezone} />
      </div>
    </div>
  )
}

const money = (cents: number) =>
  (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

function Moment({ shown, timezone }: { shown: Shown; timezone: string }) {
  const many = shown.events.length > 1
  const first = shown.events[0]

  switch (shown.type) {
    case 'done': {
      const who = [...new Set(shown.events.map((e) => e.tech).filter(Boolean))]
      return (
        <>
          <span className="tv-moment-eyebrow">Job done</span>
          <span className="tv-moment-big">
            {many ? `${shown.events.length} jobs done` : `${first.tech ?? 'The crew'} did it!`}
          </span>
          <span className="tv-moment-line">
            {many
              ? who.join(', ') || 'The crew'
              : [first.title, first.customer].filter(Boolean).join(' · ')}
          </span>
          {!many && first.minutes != null && (
            <span className="tv-moment-note">{first.minutes} minutes on site</span>
          )}
        </>
      )
    }

    case 'new':
      return (
        <>
          <span className="tv-moment-eyebrow">New job</span>
          <span className="tv-moment-big">
            {many ? `${shown.events.length} new jobs` : (first.customer ?? 'New job')}
          </span>
          <span className="tv-moment-line">{many ? 'just booked in' : first.title}</span>
          {!many && first.at_time && (
            <span className="tv-moment-note">
              {new Date(first.at_time).toLocaleString([], {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
                timeZone: timezone,
              })}
              {first.tech ? ` · ${first.tech}` : ' · unassigned'}
            </span>
          )}
        </>
      )

    case 'paid': {
      const total = shown.events.reduce((sum, e) => sum + (e.cents ?? 0), 0)
      return (
        <>
          <span className="tv-moment-eyebrow">Paid</span>
          <span className="tv-moment-big">{money(total)}</span>
          <span className="tv-moment-line">
            {many
              ? `${shown.events.length} payments in`
              : `from ${first.customer ?? 'a customer'}`}
          </span>
        </>
      )
    }

    case 'review':
      return (
        <>
          <span className="tv-moment-eyebrow">
            {many ? `${shown.events.length} five-star reviews` : 'Five stars'}
          </span>
          <span className="tv-moment-stars" aria-label="five stars">
            ★★★★★
          </span>
          {first.text && <span className="tv-moment-quote">“{first.text}”</span>}
          <span className="tv-moment-note">
            {first.reviewer ?? 'A customer'}
            {first.source ? ` · ${first.source}` : ''}
          </span>
        </>
      )
  }
}
