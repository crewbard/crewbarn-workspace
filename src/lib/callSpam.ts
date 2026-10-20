import type { QueryClient } from '@tanstack/react-query'
import { apiRequest } from './api'
import { withSpamVerdict } from './callCard'
import { RECENT_INCOMING_CALLS_QUERY_KEY, type IncomingCallAlert } from './incomingCalls'

/**
 * "Mark as spam" / "Not spam" (PUT /v1/comms/call-spam, API 34.274), from
 * the call card and the Calls list. The cached calls take the new flag at
 * once, then the list and the caller snapshots are read again.
 */
export async function setCallSpam(queryClient: QueryClient, phone: string, spam: boolean): Promise<void> {
  await apiRequest<{ data: { phone: string; spam: boolean } }>('/v1/comms/call-spam', {
    method: 'PUT',
    body: { phone, spam },
  })
  queryClient.setQueryData<IncomingCallAlert[] | { data: IncomingCallAlert[] }>(RECENT_INCOMING_CALLS_QUERY_KEY, (old) => {
    if (!old) return old
    if (Array.isArray(old)) return withSpamVerdict(old, phone, spam)
    return Array.isArray(old.data) ? { ...old, data: withSpamVerdict(old.data, phone, spam) } : old
  })
  void queryClient.invalidateQueries({ queryKey: RECENT_INCOMING_CALLS_QUERY_KEY })
  void queryClient.invalidateQueries({ queryKey: ['caller-snapshot'] })
}