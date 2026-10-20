import type { IncomingCallAlert } from './incomingCalls'

/**
 * The call card's rules, kept free of React so they can be tested
 * (scripts/call-card.test.mjs): which state a call is in, how the caller is
 * named without printing the number twice, and which calls are "waiting"
 * for the pill.
 */

export type CallCardState = 'ringing' | 'missed' | 'voicemail' | 'after_hours' | 'spam'

/** Caller-ID names that say nothing. */
const EMPTY_NAMES = ['anonymous', 'restricted', 'unavailable', 'unknown']

export function normalizeCallerText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (EMPTY_NAMES.includes(trimmed.toLowerCase())) return null
  return trimmed
}

/**
 * ringing / missed / voicemail come from the channel and the provider's
 * event type. after_hours and spam come from the server (API 34.273,
 * CallFlags): `meta.after_hours` when the company was closed, `meta.spam`
 * when the office marked the number. Spam wins over everything, a spam
 * voicemail included; `extra.spam` is the caller snapshot's say, for a
 * number marked while its card is up.
 */
export function callCardState(
  call: Pick<IncomingCallAlert, 'channel' | 'call_event' | 'meta'>,
  extra?: { spam?: boolean | null },
): CallCardState {
  const meta = call.meta ?? {}
  if (meta.spam === true || (extra?.spam === true && meta.spam !== false)) return 'spam'
  if (call.channel === 'voicemail') return 'voicemail'
  if (meta.after_hours === true) return 'after_hours'
  const event = String(call.call_event || meta.type || '').toLowerCase()
  if (event === 'call_missed') return 'missed'
  return 'ringing'
}

export interface CallerIdentity {
  title: string
  /** Formatted, for showing. */
  phone: string | null
  /** As received, for dialling and prefilling. */
  rawPhone: string | null
  callerIdName: string | null
  /** The line under the name. Never repeats the title. */
  sub: string | null
}

function titleCase(value: string | null | undefined): string | null {
  if (!value) return null
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
}

/**
 * Who to say is calling.
 *
 * Title: customer, else caller-ID name, else the number, else "Unknown
 * caller" (the old order). The number then appears once: as the title when
 * that is all we have, otherwise under the name. The old card put an
 * unmatched number in both places.
 */
export function callerIdentity(
  call: Pick<IncomingCallAlert, 'customer' | 'caller_id_name' | 'caller_id_number' | 'external_number' | 'from_number'>,
  formatPhone: (raw: string) => string,
): CallerIdentity {
  const callerIdName = normalizeCallerText(call.caller_id_name)
  const rawPhone = normalizeCallerText(call.caller_id_number) || call.external_number || call.from_number || null
  const phone = rawPhone ? formatPhone(rawPhone) || rawPhone : null
  const title = call.customer?.display_name || callerIdName || phone || 'Unknown caller'
  const phoneUnder = phone && title !== phone ? phone : null
  const sub = call.customer
    ? [titleCase(call.customer.customer_type), phoneUnder].filter(Boolean).join(' · ') || null
    : callerIdName
      ? phoneUnder
      : 'Not a customer yet'
  return { title, phone, rawPhone, callerIdName, sub }
}

/**
 * Calls waiting behind the card: queued (✕, Esc, timed out or pushed
 * aside by a newer call), not handled, inbound phone calls from the last
 * `windowMs`, newest first, one per call, never the one on screen.
 */
export function waitingCalls<T extends Pick<IncomingCallAlert, 'direction' | 'channel' | 'created_at'>>(
  calls: T[],
  opts: {
    keyOf: (call: T) => string
    queued: Record<string, number>
    isHandled: (call: T) => boolean
    shownKey: string | null
    now: number
    windowMs: number
  },
): T[] {
  const cutoff = opts.now - opts.windowMs
  const seen = new Set<string>()
  const out: T[] = []
  const sorted = calls
    .filter((call) => call.direction === 'inbound' && call.channel === 'call')
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
  for (const call of sorted) {
    const key = opts.keyOf(call)
    if (seen.has(key) || key === opts.shownKey) continue
    seen.add(key)
    if (!opts.queued[key]) continue
    if (new Date(call.created_at ?? 0).getTime() < cutoff) continue
    if (opts.isHandled(call)) continue
    out.push(call)
  }
  return out
}

/** The pill shows for two or more calls at once: the card plus one, or two waiting. */
export function pillCount(waiting: number, cardShowing: boolean): boolean {
  return waiting >= (cardShowing ? 1 : 2)
}

/** A number compared the way the server stores it: its last ten digits. */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 7 ? digits.slice(-10) : null
}

function callNumber(call: Pick<IncomingCallAlert, 'caller_id_number' | 'external_number' | 'from_number'>): string | null {
  return normalizeCallerText(call.caller_id_number) || call.external_number || call.from_number || null
}

/**
 * The list after "Mark as spam" / "Not spam" on $phone: every call from that
 * number takes the new flag at once, before the server's next read.
 */
export function withSpamVerdict<T extends Pick<IncomingCallAlert, 'caller_id_number' | 'external_number' | 'from_number' | 'meta'>>(
  calls: T[],
  phone: string,
  spam: boolean,
): T[] {
  const key = phoneKey(phone)
  if (!key) return calls
  return calls.map((call) => (phoneKey(callNumber(call)) === key ? { ...call, meta: { ...(call.meta ?? {}), spam } } : call))
}

export interface AfterHoursNote {
  /** "CBI answered" or "Came in after hours". */
  label: string
  summary: string | null
  urgent: boolean
}

/**
 * What the card says about an after-hours call: whether CBI answered it,
 * whether CBI thought it urgent, and the call's one-line summary when there
 * is one (meta.after_hours_cbi, API 34.273). Null for any other call.
 */
export function afterHoursNote(meta: Record<string, unknown> | null | undefined): AfterHoursNote | null {
  if (!meta || meta.after_hours !== true) return null
  const cbi = (meta.after_hours_cbi && typeof meta.after_hours_cbi === 'object' ? meta.after_hours_cbi : {}) as Record<string, unknown>
  const summary = typeof cbi.summary === 'string' && cbi.summary.trim() ? cbi.summary.trim() : null
  const answered = cbi.answered === true || typeof cbi.outcome === 'string'
  const onCall = typeof cbi.on_call_name === 'string' && cbi.on_call_name.trim() ? cbi.on_call_name.trim() : null
  return {
    label: onCall ? `CBI put it through to ${onCall}` : answered ? 'CBI answered' : 'Came in after hours',
    summary,
    urgent: cbi.urgent === true,
  }
}