import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import {
  ago,
  clientChip,
  describeAction,
  methodChip,
  statusTone,
  type ActivityRow,
} from '@/lib/activityLabels'

/**
 * Per-record activity — what happened to THIS record (job, customer, estimate…),
 * from the activity log scoped to the record's id, which appears in the request
 * path.
 *
 * Changes only, by default. The mobile app logs its reads too, deliberately, so
 * that field-app usage can be audited — but opening a single job fires a GET for
 * signatures, visits, NTE extensions, messages and line items, so a record's
 * timeline filled up with "viewed" entries and the thing you came to see was off
 * the bottom of the page. Views are still here behind the toggle, and the
 * tenant-wide audit log is unchanged.
 *
 * Gated upstream by settings.view (audit data). Read-only.
 */
export function EntityActivityPanel({
  entityId,
  noun = 'record',
}: {
  entityId: string
  noun?: string
}) {
  const [showViews, setShowViews] = useState(false)

  const q = useQuery({
    queryKey: ['entity-activity', entityId, showViews],
    queryFn: () =>
      apiRequest<{ data: ActivityRow[] }>(
        `/v1/tenant-settings/audit-log?per_page=100&entity_id=${encodeURIComponent(entityId)}` +
          (showViews ? '' : '&writes_only=1'),
      ),
  })

  const rows = q.data?.data ?? []

  const toggle = (
    <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
      <input
        type="checkbox"
        checked={showViews}
        onChange={(e) => setShowViews(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300"
      />
      Include views
    </label>
  )

  if (q.isLoading) {
    return <div className="text-sm text-slate-500 p-4">Loading activity…</div>
  }
  if (q.isError) {
    return (
      <div className="text-sm text-red-700 p-4">
        {(q.error as Error).message ?? 'Failed to load activity.'}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">{toggle}</div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          {showViews
            ? `No activity recorded for this ${noun} yet.`
            : `Nothing has been changed on this ${noun} yet. Tick "Include views" to see who has opened it.`}
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[12.5px] text-slate-500">
        {showViews ? 'Changes and views' : 'Changes only'}
      </span>
      {toggle}
    </div>
    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800">
                {describeAction(r.method, r.path, r.request_keys)}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${clientChip(r.client)}`}>
                {r.client === 'mobile' ? '📱 Mobile' : r.client ?? 'web'}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {r.actor_email ?? <span className="italic text-slate-400">system</span>}
              {' · '}
              <span title={r.created_at}>{ago(r.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[9px] font-bold px-1 py-0.5 rounded font-mono ${methodChip(r.method)}`}>
              {r.method}
            </span>
            <span className={`text-[11px] font-semibold font-mono ${statusTone(r.response_status)}`}>
              {r.response_status}
            </span>
          </div>
        </div>
      ))}
    </div>
    </>
  )
}

export default EntityActivityPanel
