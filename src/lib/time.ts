/**
 * Human-readable "time ago" formatting. Shared by the GPS device pages
 * (and anywhere else that needs a compact relative timestamp).
 */

export function relativeTime(
  isoString: string | null,
  opts: { nullLabel?: string; recentLabel?: string } = {},
): string {
  const { nullLabel = 'Never', recentLabel = 'Just now' } = opts
  if (!isoString) return nullLabel

  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)

  if (seconds < 90) return recentLabel
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.round((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`
  }
  return `${Math.floor(seconds / 86400)}d ago`
}

// ── Time-of-day helpers for the TimeField picker ───────────────────────────
// Canonical value everywhere is a 24-hour "HH:mm" string (matches
// <input type="time"> + the API), so the picker is a drop-in for native inputs.

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Parse loose typed input to "HH:mm" (24h), or null. Accepts "3:30 PM",
 * "3:30pm", "330p", "3p", "3", "15:30", "1530".
 */
export function parseTimeInput(raw: string): string | null {
  let s = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  let ap: 'a' | 'p' | null = null
  if (s.endsWith('am')) { ap = 'a'; s = s.slice(0, -2) }
  else if (s.endsWith('pm')) { ap = 'p'; s = s.slice(0, -2) }
  else if (s.endsWith('a')) { ap = 'a'; s = s.slice(0, -1) }
  else if (s.endsWith('p')) { ap = 'p'; s = s.slice(0, -1) }

  let h: number
  let m: number
  if (s.includes(':') || s.includes('.')) {
    const [hp, mp = '0'] = s.split(/[:.]/)
    h = parseInt(hp, 10)
    m = parseInt(mp, 10)
  } else {
    if (!/^\d+$/.test(s)) return null
    if (s.length <= 2) { h = parseInt(s, 10); m = 0 }
    else { h = parseInt(s.slice(0, -2), 10); m = parseInt(s.slice(-2), 10) }
  }

  if (Number.isNaN(h) || Number.isNaN(m) || m > 59) return null
  if (ap) {
    if (h < 1 || h > 12) return null
    h = h % 12
    if (ap === 'p') h += 12
  }
  if (h > 23) return null

  return `${pad(h)}:${pad(m)}`
}

/** "HH:mm" (24h) → "3:30 PM". Empty/invalid → ''. */
export function formatTime12(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return ''
  let h = parseInt(match[1], 10)
  const m = match[2]
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ap}`
}

/** Split "HH:mm" into 12h parts for the clock (defaults to 9:00 AM). */
export function to12Parts(hhmm: string | null | undefined): { hour12: number; minute: number; ampm: 'AM' | 'PM' } {
  const match = (hhmm ?? '').match(/^(\d{1,2}):(\d{2})$/)
  let h = match ? parseInt(match[1], 10) : 9
  const m = match ? parseInt(match[2], 10) : 0
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return { hour12: h, minute: m, ampm }
}

/** 12h parts → "HH:mm" (24h). */
export function from12Parts(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  let h = hour12 % 12
  if (ampm === 'PM') h += 12
  return `${pad(h)}:${pad(minute)}`
}

/** Every-`step`-minute slots across the day: { value:"HH:mm", label:"3:30 PM" }. */
export function timeSlots(step = 15): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = []
  for (let mins = 0; mins < 24 * 60; mins += step) {
    const value = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
    out.push({ value, label: formatTime12(value) })
  }
  return out
}
