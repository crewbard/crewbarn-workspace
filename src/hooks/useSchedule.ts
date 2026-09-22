import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCalendarEvents,
  fetchUnscheduledJobs,
  rescheduleWorkOrder,
} from '@/lib/schedule'
import { apiRequest } from '@/lib/api'
import type { ScheduleCalendarFilters } from '@/types/schedule'

export const scheduleKeys = {
  calendar: (f: ScheduleCalendarFilters) => ['schedule', 'calendar', f] as const,
  unscheduled: (q?: string) => ['schedule', 'unscheduled', q ?? ''] as const,
}

/**
 * Polls every 10s so a tech changing status on their phone (POST /...
 * /status or PATCH /work-orders/{id}) propagates to the dispatcher's
 * calendar without a manual refresh.
 */
export function useCalendarEvents(filters: ScheduleCalendarFilters) {
  return useQuery({
    queryKey: scheduleKeys.calendar(filters),
    queryFn: () => fetchCalendarEvents(filters),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  })
}

export function useUnscheduledJobs(q?: string) {
  return useQuery({
    queryKey: scheduleKeys.unscheduled(q),
    queryFn: () => fetchUnscheduledJobs(q),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}

/**
 * Optimistic reschedule. Updates the cache immediately so the event
 * stays in its new position (no "bounce" from polling refetches racing
 * the PATCH response). On error, rolls back. Invalidates queries on
 * settle so the next polling cycle reconciles with the server.
 */
export function useRescheduleWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      start,
      end,
      leadTechAccountId,
      kind,
      statusId,
    }: {
      id: string
      start: string
      end: string
      leadTechAccountId?: string | null
      kind?: 'job' | 'estimate'
      statusId?: string | null
    }) => rescheduleWorkOrder(id, start, end, leadTechAccountId, kind ?? 'job', statusId),
    onMutate: async ({ id, start, end, leadTechAccountId }) => {
      await qc.cancelQueries({ queryKey: ['schedule'] })
      const snapshots = qc.getQueriesData({ queryKey: ['schedule', 'calendar'] })

      // Patch every calendar cache so the dragged event jumps to its new
      // slot immediately instead of waiting for the next refetch.
      qc.setQueriesData({ queryKey: ['schedule', 'calendar'] }, (old: unknown) => {
        const typed = old as { data?: Array<Record<string, unknown>> } | undefined
        if (!typed?.data) return old
        return {
          ...typed,
          data: typed.data.map((w) => {
            if (w.id !== id) return w
            const next: Record<string, unknown> = {
              ...w,
              scheduled_start_time: start,
              scheduled_end_time: end,
            }
            if (leadTechAccountId !== undefined) {
              next.lead_tech =
                leadTechAccountId === null
                  ? null
                  : { ...((w.lead_tech as Record<string, unknown>) ?? {}), id: leadTechAccountId }
            }
            return next
          }),
        }
      })

      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      // Reconcile both the calendar AND the unscheduled sidebar list. A job
      // dragged off the queue isn't in the calendar cache (so the optimistic
      // patch can't move it) — invalidating makes it disappear from the
      // sidebar and land on the calendar without waiting for the poll.
      qc.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

/**
 * Generic PATCH on a work order — used by the right-click context menu
 * for status change, reassign, cancel. Optimistically updates the
 * calendar cache (status badge / tech name flips immediately).
 */
export function useUpdateWorkOrderFromCalendar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch, kind }: { id: string; patch: Record<string, unknown>; kind?: 'job' | 'estimate' }) => {
      const url = kind === 'estimate' ? `/v1/estimates/${id}` : `/v1/work-orders/${id}`
      return apiRequest<{ data: unknown }>(url, { method: 'PATCH', body: patch })
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['schedule'] })
      const snapshots = qc.getQueriesData({ queryKey: ['schedule', 'calendar'] })

      qc.setQueriesData({ queryKey: ['schedule', 'calendar'] }, (old: unknown) => {
        const typed = old as { data?: Array<Record<string, unknown>> } | undefined
        if (!typed?.data) return old
        return {
          ...typed,
          data: typed.data.map((w) => {
            if (w.id !== id) return w
            const next: Record<string, unknown> = { ...w }
            // Map known fields back onto the calendar-cache shape.
            if ('status_id' in patch) {
              // We don't have the full status object — leave the cache's
              // status alone; the next refetch (we trigger below) will
              // bring the real one. Just clear stale color momentarily.
            }
            if ('lead_tech_account_id' in patch) {
              next.lead_tech = patch.lead_tech_account_id === null
                ? null
                : { id: patch.lead_tech_account_id, name: null, email: null }
            }
            return next
          }),
        }
      })

      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSuccess: () => {
      // Trigger a refetch so the full status (color, name) lands quickly
      // — the next 10s poll would catch it but waiting feels laggy. Invalidate
      // the whole 'schedule' tree so the unscheduled sidebar list refreshes too
      // (an unscheduled job needs to appear there right away).
      qc.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}
