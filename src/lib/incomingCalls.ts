import { apiRequest } from '@/lib/api'

export const RECENT_INCOMING_CALLS_QUERY_KEY = ['comms', 'recent-incoming-calls'] as const

export const MISSED_CALL_LOOKBACK_HOURS = 12
export const HANDLED_CALL_TOASTS_KEY = 'crewbarn.handledIncomingCalls.v1'
export const QUEUED_CALL_TOASTS_KEY = 'crewbarn.queuedIncomingCalls.v1'
export const HANDLED_CALLS_CHANGED_EVENT = 'crewbarn:handled-incoming-calls-changed'

export interface IncomingCallAlert {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  channel: string
  body: string | null
  provider_message_id?: string | null
  meta?: Record<string, unknown> | null
  call_id?: string | null
  call_event?: string | null
  caller_id_name?: string | null
  caller_id_number?: string | null
  recording_url: string | null
  transcription_status: string | null
  from_number: string | null
  to_number: string | null
  external_number: string | null
  created_at: string | null
  customer: {
    id: string
    display_name: string
    customer_type: string | null
    vip: boolean
    lifetime_value_cents: number
    last_contact_at: string | null
    avatar_preset?: string | null
    avatar_url?: string | null
  } | null
}

export async function fetchRecentIncomingCalls(hours = MISSED_CALL_LOOKBACK_HOURS): Promise<IncomingCallAlert[]> {
  const res = await apiRequest<{ data: IncomingCallAlert[] }>(
    `/v1/comms/recent-incoming-calls?hours=${hours}`,
  )
  return res.data
}

export function mergeIncomingCallAlerts(
  next: IncomingCallAlert[],
  current: IncomingCallAlert[],
  limit = 50,
): IncomingCallAlert[] {
  const merged = [...current]

  for (const call of next.slice().reverse()) {
    const key = incomingCallKey(call)
    if (merged.some((existing) => existing.id === call.id || incomingCallKey(existing) === key)) {
      continue
    }
    merged.unshift(call)
  }

  return merged.slice(0, limit)
}

export function incomingCallKey(call: IncomingCallAlert): string {
  const callId = call.call_id || (typeof call.meta?.call_id === 'string' ? call.meta.call_id : null)
  if (callId) return `${call.channel}:call:${callId}`

  const phone = call.caller_id_number || call.external_number || call.from_number || 'unknown'
  return `${call.channel}:phone:${phone}`
}

export function readHandledIncomingCallKeys(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HANDLED_CALL_TOASTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {}
  } catch {
    return {}
  }
}

export function writeHandledIncomingCallKeys(keys: Record<string, number>) {
  try {
    localStorage.setItem(HANDLED_CALL_TOASTS_KEY, JSON.stringify(keys))
    window.dispatchEvent(new Event(HANDLED_CALLS_CHANGED_EVENT))
  } catch {
    // ignore storage errors
  }
}

export function readQueuedIncomingCallKeys(): Record<string, number> {
  try {
    const raw = localStorage.getItem(QUEUED_CALL_TOASTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {}
  } catch {
    return {}
  }
}

export function writeQueuedIncomingCallKeys(keys: Record<string, number>) {
  try {
    localStorage.setItem(QUEUED_CALL_TOASTS_KEY, JSON.stringify(keys))
    window.dispatchEvent(new Event(HANDLED_CALLS_CHANGED_EVENT))
  } catch {
    // ignore storage errors
  }
}

export function markIncomingCallQueued(call: IncomingCallAlert) {
  const queued = readQueuedIncomingCallKeys()
  queued[incomingCallKey(call)] = Date.now()
  writeQueuedIncomingCallKeys(queued)
}

export function isIncomingCallQueued(call: IncomingCallAlert): boolean {
  return Boolean(readQueuedIncomingCallKeys()[incomingCallKey(call)])
}

export function isIncomingCallHandled(call: IncomingCallAlert): boolean {
  const key = incomingCallKey(call)
  const now = Date.now()
  const handled = readHandledIncomingCallKeys()
  const handledAt = handled[key]
  if (!handledAt) return false

  if (now - handledAt > MISSED_CALL_LOOKBACK_HOURS * 60 * 60 * 1000) {
    delete handled[key]
    writeHandledIncomingCallKeys(handled)
    return false
  }

  return true
}

export function markIncomingCallHandled(call: IncomingCallAlert) {
  const handled = readHandledIncomingCallKeys()
  handled[incomingCallKey(call)] = Date.now()
  writeHandledIncomingCallKeys(handled)

  const queued = readQueuedIncomingCallKeys()
  delete queued[incomingCallKey(call)]
  writeQueuedIncomingCallKeys(queued)
}

export function unhandledIncomingCalls(calls: IncomingCallAlert[]): IncomingCallAlert[] {
  const queued = readQueuedIncomingCallKeys()
  const now = Date.now()
  let changed = false

  for (const [key, queuedAt] of Object.entries(queued)) {
    if (now - queuedAt > MISSED_CALL_LOOKBACK_HOURS * 60 * 60 * 1000) {
      delete queued[key]
      changed = true
    }
  }

  if (changed) {
    writeQueuedIncomingCallKeys(queued)
  }

  return calls.filter((call) => queued[incomingCallKey(call)] && !isIncomingCallHandled(call))
}
