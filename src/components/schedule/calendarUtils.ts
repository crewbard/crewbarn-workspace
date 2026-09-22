import { addDays, startOfWeek as dfStartOfWeek } from 'date-fns'
import type { ScheduleWorkOrder } from '@/types/schedule'

/** Full 24-hour range so after-hours / overnight jobs are visible. */
export const DAY_START_HOUR = 0
export const DAY_END_HOUR = 24
/** Slot granularity in minutes. 15 = snap to quarter-hour. */
export const SLOT_MINUTES = 15
/** Pixels per slot at 100% zoom. Tune for block size — bigger = chunkier. */
export const SLOT_PX = 18
/** Default scroll target on mount — typical workday start. */
export const DEFAULT_SCROLL_HOUR = 6

/** Zoom bounds for the Day/Week time grid. 1 = 100% = the SLOT_PX baseline. */
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25

/** Slots in a day. Equals (hours visible × 60) ÷ SLOT_MINUTES. */
export const SLOTS_PER_DAY =
  ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES

/** Total pixel height of a day column. */
export const DAY_PX = SLOTS_PER_DAY * SLOT_PX

export function weekStart(d: Date): Date {
  return dfStartOfWeek(d, { weekStartsOn: 1 })
}

export function weekDays(d: Date): Date[] {
  const ws = weekStart(d)
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
}

/**
 * Pixel offset from the top of the day column for a given timestamp.
 * Clamps to the visible window — events starting before DAY_START_HOUR
 * render at the top; those ending after DAY_END_HOUR get clipped.
 */
export function timeToY(date: Date, slotPx: number = SLOT_PX): number {
  const minutesFromStart =
    (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes()
  const slot = Math.max(0, Math.min(SLOTS_PER_DAY - 1, minutesFromStart / SLOT_MINUTES))
  return slot * slotPx
}

/** Inverse — given a Y offset within a day column, return the snapped Date. */
export function yToTime(date: Date, y: number, slotPx: number = SLOT_PX): Date {
  const slot = Math.max(0, Math.min(SLOTS_PER_DAY - 1, Math.round(y / slotPx)))
  const minutes = slot * SLOT_MINUTES
  const out = new Date(date)
  out.setHours(DAY_START_HOUR, 0, 0, 0)
  out.setMinutes(minutes)
  return out
}

/** Event height in pixels from a start+end pair. Minimum 2 slots so short jobs stay usable. */
export function durationToHeight(start: Date, end: Date, slotPx: number = SLOT_PX): number {
  const ms = Math.max(0, end.getTime() - start.getTime())
  const slots = Math.max(2, Math.round(ms / 60000 / SLOT_MINUTES))
  return slots * slotPx
}

export interface PackedEventLayout {
  lane: number
  laneCount: number
}

interface TimedEvent {
  wo: ScheduleWorkOrder
  start: Date
  end: Date
}

function eventEnd(wo: ScheduleWorkOrder, start: Date): Date {
  return wo.scheduled_end_time
    ? new Date(wo.scheduled_end_time)
    : new Date(start.getTime() + (wo.estimated_duration_minutes ?? 60) * 60000)
}

/**
 * Assigns side-by-side lanes for overlapping timed events. Every event in an
 * overlapping cluster uses the same laneCount, so exact collisions render as
 * equal-width columns instead of stacking on top of each other.
 */
export function packTimedEvents(events: ScheduleWorkOrder[]): Map<string, PackedEventLayout> {
  const timed: TimedEvent[] = events
    .filter((wo) => !!wo.scheduled_start_time)
    .map((wo) => {
      const start = new Date(wo.scheduled_start_time!)
      return { wo, start, end: eventEnd(wo, start) }
    })
    .sort((a, b) => {
      const startDiff = a.start.getTime() - b.start.getTime()
      if (startDiff !== 0) return startDiff
      return b.end.getTime() - a.end.getTime()
    })

  const out = new Map<string, PackedEventLayout>()
  let cluster: TimedEvent[] = []
  let clusterEnd = 0

  function flushCluster() {
    if (cluster.length === 0) return

    const laneEnds: number[] = []
    const assigned = new Map<string, number>()

    for (const event of cluster) {
      const startMs = event.start.getTime()
      let lane = laneEnds.findIndex((endMs) => endMs <= startMs)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = event.end.getTime()
      assigned.set(event.wo.id, lane)
    }

    const laneCount = Math.max(1, laneEnds.length)
    for (const event of cluster) {
      out.set(event.wo.id, {
        lane: assigned.get(event.wo.id) ?? 0,
        laneCount,
      })
    }

    cluster = []
    clusterEnd = 0
  }

  for (const event of timed) {
    const startMs = event.start.getTime()
    const endMs = event.end.getTime()
    if (cluster.length > 0 && startMs >= clusterEnd) {
      flushCluster()
    }
    cluster.push(event)
    clusterEnd = Math.max(clusterEnd, endMs)
  }
  flushCluster()

  return out
}

/** Same-day check ignoring time. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Time labels for the left axis — one per hour. */
export function hourLabels(): string[] {
  const out: string[] = []
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    const hr12 = h % 12 === 0 ? 12 : h % 12
    const ampm = h < 12 ? 'a' : 'p'
    out.push(`${hr12}${ampm}`)
  }
  return out
}
