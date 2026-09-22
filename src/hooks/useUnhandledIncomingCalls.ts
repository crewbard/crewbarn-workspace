import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import {
  fetchRecentIncomingCalls,
  HANDLED_CALLS_CHANGED_EVENT,
  MISSED_CALL_LOOKBACK_HOURS,
  RECENT_INCOMING_CALLS_QUERY_KEY,
  unhandledIncomingCalls,
} from '@/lib/incomingCalls'

export function useUnhandledIncomingCalls() {
  const { has, isLoading } = usePermissions()
  const canViewCalls = !isLoading && has(PERM.CALLS_VIEW)
  const [handledVersion, setHandledVersion] = useState(0)

  useEffect(() => {
    const bump = () => setHandledVersion((v) => v + 1)
    window.addEventListener(HANDLED_CALLS_CHANGED_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(HANDLED_CALLS_CHANGED_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const query = useQuery({
    queryKey: RECENT_INCOMING_CALLS_QUERY_KEY,
    queryFn: () => fetchRecentIncomingCalls(MISSED_CALL_LOOKBACK_HOURS),
    enabled: canViewCalls,
    refetchInterval: 15000,
  })

  const calls = useMemo(
    () => unhandledIncomingCalls(query.data ?? []),
    [query.data, handledVersion],
  )

  return {
    ...query,
    calls,
    count: calls.length,
    canViewCalls,
  }
}
