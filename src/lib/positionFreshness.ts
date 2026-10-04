import type { Position } from '@/hooks/useRealtimePositions'

export function positionAge(position: Position | null, nowMs: number): number | null {
  if (!position) return null
  const recorded = position.recorded_at ? Date.parse(position.recorded_at) : NaN
  if (Number.isFinite(recorded)) return Math.max(0, (nowMs - recorded) / 1000)
  if (position.age_seconds == null || !Number.isFinite(position.age_seconds)) return null
  return Math.max(0, position.age_seconds) + Math.max(0, (nowMs - (position.received_at ?? nowMs)) / 1000)
}

/** GPS freshness follows fix time, never the order HTTP/socket messages arrive. */
export function newestPosition(nowMs: number, ...positions: (Position | null | undefined)[]): Position | null {
  let newest: Position | null = null
  let youngest = Infinity
  for (const position of positions) {
    if (!position) continue
    const age = positionAge(position, nowMs)
    if (!newest || (age != null && age < youngest)) {
      newest = position
      youngest = age ?? Infinity
    }
  }
  return newest
}
