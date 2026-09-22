import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { PERM, usePermissions } from '@/hooks/usePermissions'

/**
 * Time Off.
 *
 * Every signed-in staff member can submit and track their own requests from
 * desktop or mobile browser. Users with staff.view/staff.edit get the office
 * approval queue and can act on pending requests.
 */

interface TimeOffRow {
  id: string
  account_id: string
  account_name: string | null
  type: string
  start_date: string | null
  end_date: string | null
  all_day: boolean
  start_time: string | null
  end_time: string | null
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  reason: string | null
  approver_name: string | null
  approved_at: string | null
  decision_notes: string | null
  days: number | null
  hours: number | null
  created_at: string | null
}

interface ScheduleConflictRow {
  id: string
  kind?: 'job' | 'estimate'
  work_order_number: string | number | null
  title: string | null
  scheduled_start_time: string | null
  lead_tech: { id: string; name: string | null; email: string | null } | null
  customer: { id: string; name: string } | null
}

const TYPES = [
  'vacation',
  'sick',
  'personal',
  'unpaid',
  'bereavement',
  'jury',
  'other',
] as const

const STATUS_META: Record<
  TimeOffRow['status'],
  { label: string; chip: string; dot: string }
> = {
  pending: { label: 'Pending', chip: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  approved: { label: 'Approved', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  denied: { label: 'Denied', chip: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', chip: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(time: string | null): string {
  if (!time) return ''
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function fmtWindow(row: Pick<TimeOffRow, 'start_date' | 'end_date' | 'all_day' | 'start_time' | 'end_time'>): string {
  const dateLabel = row.start_date === row.end_date
    ? fmtDate(row.start_date)
    : `${fmtDate(row.start_date)} -> ${fmtDate(row.end_date)}`
  if (row.all_day) return `${dateLabel} · All day`
  return `${dateLabel} · ${fmtTime(row.start_time)}-${fmtTime(row.end_time)}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

interface Form {
  account_id: string
  type: string
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string
  end_time: string
  reason: string
}

const EMPTY_FORM: Form = {
  account_id: '',
  type: 'vacation',
  start_date: '',
  end_date: '',
  all_day: true,
  start_time: '08:00',
  end_time: '17:00',
  reason: '',
}

export function TimeOffPage() {
  const qc = useQueryClient()
  const permissions = usePermissions()
  const location = useLocation()
  const personalMode = location.pathname === '/my-time-off'
  const canViewAll = !personalMode && permissions.has(PERM.STAFF_VIEW)
  const canDecide = !personalMode && permissions.has(PERM.STAFF_EDIT)
  const [statusFilter, setStatusFilter] = useState<'all' | TimeOffRow['status']>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [decisionRequest, setDecisionRequest] = useState<{ row: TimeOffRow; status: 'approved' | 'denied' } | null>(null)

  const listEndpoint = canViewAll ? '/v1/time-off-requests' : '/v1/my-time-off-requests'

  const query = useQuery({
    queryKey: ['time-off', canViewAll ? 'all-staff' : 'mine', personalMode ? 'personal-route' : 'workspace-route'],
    enabled: !permissions.isLoading,
    queryFn: () => apiRequest<{ data: TimeOffRow[] }>(listEndpoint),
  })

  const rows = query.data?.data ?? []
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!q) return true
      return [row.account_name, row.type, row.reason, row.decision_notes, row.approver_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
  }, [rows, search, statusFilter])

  const sortedRows = useMemo(() => {
    return [...visibleRows].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (b.status === 'pending' && a.status !== 'pending') return 1
      return (b.start_date ?? '').localeCompare(a.start_date ?? '')
    })
  }, [visibleRows])

  const decide = useMutation({
    mutationFn: ({ id, status, decision_notes }: { id: string; status: TimeOffRow['status']; decision_notes?: string | null }) =>
      apiRequest(`/v1/time-off-requests/${id}`, { method: 'PATCH', body: { status, decision_notes } }),
    onSuccess: () => {
      setDecisionRequest(null)
      qc.invalidateQueries({ queryKey: ['time-off'] })
    },
  })

  const cancelMine = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/my-time-off-requests/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-off'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/time-off-requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-off'] }),
  })

  const counts = useMemo(() => {
    const next: Record<TimeOffRow['status'], number> = {
      pending: 0,
      approved: 0,
      denied: 0,
      cancelled: 0,
    }
    for (const row of rows) next[row.status] += 1
    return next
  }, [rows])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] font-bold text-amber-600 mb-2">
            {canViewAll ? 'Team schedule' : 'My schedule'}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">{canViewAll ? 'Time Off' : 'My Time Off'}</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            {canViewAll
              ? 'Staff submit vacation, sick, personal, or unpaid time. Office approves or denies before it blocks scheduling.'
              : 'Request vacation, sick, personal, or unpaid time from any browser. Your office will approve or deny it here.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium shrink-0"
        >
          + New request
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {(['pending', 'approved', 'denied', 'cancelled'] as const).map((s) => {
          const meta = STATUS_META[s]
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={[
                'text-left rounded-lg border bg-white px-4 py-3 transition',
                statusFilter === s ? 'border-slate-900 shadow-sm' : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <span className={['inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border', meta.chip].join(' ')}>
                <span className={['w-1.5 h-1.5 rounded-full', meta.dot].join(' ')} />
                {meta.label}
              </span>
              <span className="block text-2xl font-bold text-slate-900 mt-2">{counts[s]}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'approved', 'denied', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'text-xs px-3 py-1.5 rounded-full border transition',
                statusFilter === s
                  ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={canViewAll ? 'Search staff, reason, notes...' : 'Search reason or notes...'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 md:w-72"
        />
      </div>

      {(query.isLoading || permissions.isLoading) && <p className="text-sm text-slate-500 italic">Loading...</p>}
      {query.isError && (
        <p className="text-sm text-red-700">
          {(query.error as Error).message ?? 'Failed to load.'}
        </p>
      )}

      {!query.isLoading && !permissions.isLoading && sortedRows.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
          {search.trim()
            ? 'No time-off requests match that search.'
            : statusFilter === 'all'
              ? 'No time-off requests yet.'
              : `No ${STATUS_META[statusFilter as TimeOffRow['status']]?.label.toLowerCase() ?? statusFilter} requests.`}
        </div>
      )}

      <div className="space-y-3">
        {sortedRows.map((r) => {
          const meta = STATUS_META[r.status]
          const isMine = r.account_id === permissions.accountId
          return (
            <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">
                      {canViewAll ? r.account_name ?? r.account_id : 'Me'}
                    </span>
                    <span
                      className={[
                        'inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border',
                        meta.chip,
                      ].join(' ')}
                    >
                      <span className={['w-1.5 h-1.5 rounded-full', meta.dot].join(' ')} />
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
                      {r.type}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 mt-2">
                    {fmtWindow(r)}
                    {r.hours != null && (
                      <span className="text-slate-500 ml-2">
                        ({r.hours}h)
                      </span>
                    )}
                  </div>
                  {r.created_at && (
                    <div className="mt-1 text-[11px] text-slate-400">Requested {fmtDateTime(r.created_at)}</div>
                  )}
                  {r.reason && (
                    <p className="text-[12px] text-slate-500 mt-2 whitespace-pre-line">{r.reason}</p>
                  )}
                  {(r.approver_name || r.approved_at || r.decision_notes) && (
                    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-700">
                        Decision: {meta.label}
                        {r.approved_at && <span className="font-normal text-slate-500"> · {fmtDateTime(r.approved_at)}</span>}
                      </div>
                      {r.approver_name && <div className="mt-0.5">By {r.approver_name}</div>}
                      {r.decision_notes && <div className="mt-1 whitespace-pre-line italic">&quot;{r.decision_notes}&quot;</div>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {canDecide && r.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDecisionRequest({ row: r, status: 'approved' })}
                        disabled={decide.isPending}
                        className="text-xs px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecisionRequest({ row: r, status: 'denied' })}
                        disabled={decide.isPending}
                        className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </>
                  )}
                  {canDecide && r.status !== 'pending' && r.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => decide.mutate({ id: r.id, status: 'pending' })}
                      disabled={decide.isPending}
                      className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                  {!canDecide && isMine && r.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => cancelMine.mutate(r.id)}
                      disabled={cancelMine.isPending}
                      className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel request
                    </button>
                  )}
                  {canDecide && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(r.id)}
                      disabled={remove.isPending}
                      className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {createOpen && (
        <CreateRequestModal
          canManage={canViewAll}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            qc.invalidateQueries({ queryKey: ['time-off'] })
          }}
        />
      )}

      {decisionRequest && (
        <DecisionModal
          row={decisionRequest.row}
          status={decisionRequest.status}
          isSaving={decide.isPending}
          error={decide.isError ? (decide.error as Error).message : null}
          onClose={() => setDecisionRequest(null)}
          onSave={(decision_notes) =>
            decide.mutate({
              id: decisionRequest.row.id,
              status: decisionRequest.status,
              decision_notes: decision_notes || null,
            })
          }
        />
      )}
    </div>
  )
}


function DecisionModal({
  row,
  status,
  isSaving,
  error,
  onClose,
  onSave,
}: {
  row: TimeOffRow
  status: 'approved' | 'denied'
  isSaving: boolean
  error: string | null
  onClose: () => void
  onSave: (decisionNotes: string) => void
}) {
  const [notes, setNotes] = useState(row.decision_notes ?? '')
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const isDenied = status === 'denied'
  const busy = isSaving || checkingConflicts

  const confirmScheduledWorkConflicts = async (): Promise<boolean> => {
    if (status !== 'approved' || !row.start_date || !row.end_date) return true

    setCheckingConflicts(true)
    try {
      const q = new URLSearchParams({
        start: row.start_date,
        end: row.end_date,
        tech_id: row.account_id,
      })
      const response = await apiRequest<{ data: ScheduleConflictRow[] }>(`/v1/work-orders/calendar?${q.toString()}`)
      const conflicts = (response.data ?? []).filter((event) => event.lead_tech?.id === row.account_id)
      if (conflicts.length === 0) return true

      const examples = conflicts.slice(0, 5).map((event) => {
        const date = event.scheduled_start_time ? new Date(event.scheduled_start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'scheduled'
        const number = event.work_order_number ? `#${event.work_order_number}` : event.kind === 'estimate' ? 'Estimate' : 'Job'
        const title = event.title || event.customer?.name || 'Scheduled work'
        return `  - ${date}: ${number} ${title}`
      })
      const extra = conflicts.length > examples.length ? [`  - plus ${conflicts.length - examples.length} more`] : []
      return window.confirm([
        `${row.account_name ?? 'This staff member'} already has scheduled work during this time off:`,
        ...examples,
        ...extra,
        '',
        'Approve the time-off request anyway?',
      ].join('\n'))
    } catch {
      return true
    } finally {
      setCheckingConflicts(false)
    }
  }

  const handleSave = async () => {
    const ok = await confirmScheduledWorkConflicts()
    if (!ok) return
    onSave(notes.trim())
  }

  return (
    <Modal isOpen onClose={onClose} title={isDenied ? 'Deny time-off request' : 'Approve time-off request'} size="md">
      <Modal.Body className="space-y-4">
        {error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">{row.account_name ?? row.account_id}</div>
          <div className="mt-1">
            {fmtWindow(row)}
            {row.hours != null && (
              <span className="text-slate-500 ml-2">
                ({row.hours}h)
              </span>
            )}
          </div>
          {row.reason && <div className="mt-2 text-xs text-slate-500 whitespace-pre-line">{row.reason}</div>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Decision note {isDenied ? '(recommended)' : '(optional)'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-y"
            placeholder={isDenied ? 'Tell the tech why this request was denied.' : 'Add any approval notes for payroll or scheduling.'}
            disabled={busy}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          onClick={() => { void handleSave() }}
          disabled={busy}
          className={[
            'px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-50',
            isDenied ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700',
          ].join(' ')}
        >
          {busy ? (checkingConflicts ? 'Checking...' : 'Saving...') : isDenied ? 'Deny request' : 'Approve request'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function CreateRequestModal({
  canManage,
  onClose,
  onSaved,
}: {
  canManage: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const staff = useQuery({
    queryKey: ['staff-light'],
    enabled: canManage,
    queryFn: () =>
      apiRequest<{
        data: Array<{
          id: string
          email: string
          tenant_admin_account?: { first_name: string | null; last_name: string | null }
        }>
      }>('/v1/staff?per_page=200'),
  })

  const mutation = useMutation({
    mutationFn: (payload: Partial<Form>) =>
      apiRequest(canManage ? '/v1/time-off-requests' : '/v1/my-time-off-requests', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: onSaved,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      if (err?.status === 422 && err?.payload?.errors) {
        const fe: Record<string, string> = {}
        for (const [k, v] of Object.entries(err.payload.errors)) fe[k] = (v as string[])[0]
        setErrors(fe)
      } else {
        setServerError(err?.payload?.message ?? String(err))
      }
    },
  })

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

  const save = () => {
    setErrors({})
    setServerError(null)
    if (!form.start_date || !form.end_date) {
      setErrors({ start_date: 'Start and end dates are required' })
      return
    }
    if (!form.all_day) {
      if (form.start_date !== form.end_date) {
        setErrors({ end_date: 'Hourly time off must be on one day. Use all day for multi-day requests.' })
        return
      }
      if (!form.start_time || !form.end_time) {
        setErrors({ start_time: 'Start and end times are required', end_time: 'Start and end times are required' })
        return
      }
      if (form.end_time <= form.start_time) {
        setErrors({ end_time: 'End time must be after start time' })
        return
      }
    }

    mutation.mutate({
      account_id: canManage && form.account_id ? form.account_id : undefined,
      type: form.type,
      start_date: form.start_date,
      end_date: form.end_date,
      all_day: form.all_day,
      start_time: form.all_day ? undefined : form.start_time,
      end_time: form.all_day ? undefined : form.end_time,
      reason: form.reason || undefined,
    })
  }

  return (
    <Modal isOpen onClose={onClose} title="New time-off request" size="md">
      <Modal.Body className="space-y-4">
        {serverError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
            {serverError}
          </div>
        )}

        {canManage && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              For
            </label>
            <select
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              className={inputCls}
              disabled={mutation.isPending || staff.isLoading}
            >
              <option value="">- Me -</option>
              {(staff.data?.data ?? []).map((s) => {
                const name = s.tenant_admin_account
                  ? `${s.tenant_admin_account.first_name ?? ''} ${s.tenant_admin_account.last_name ?? ''}`.trim()
                  : ''
                return (
                  <option key={s.id} value={s.id}>
                    {name ? `${name} · ${s.email}` : s.email}
                  </option>
                )
              })}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave as "Me" for your own request, or pick another staff member.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={inputCls}
              disabled={mutation.isPending}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
              disabled={mutation.isPending}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            All day
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Start *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className={inputCls}
              disabled={mutation.isPending}
            />
            {errors.start_date && (
              <p className="text-[11px] text-red-600 mt-1">{errors.start_date}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">End *</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className={inputCls}
              disabled={mutation.isPending}
            />
            {errors.end_date && (
              <p className="text-[11px] text-red-600 mt-1">{errors.end_date}</p>
            )}
          </div>
        </div>

        {!form.all_day && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start time *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className={inputCls}
                disabled={mutation.isPending}
              />
              {errors.start_time && (
                <p className="text-[11px] text-red-600 mt-1">{errors.start_time}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End time *</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className={inputCls}
                disabled={mutation.isPending}
              />
              {errors.end_time && (
                <p className="text-[11px] text-red-600 mt-1">{errors.end_time}</p>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Reason (optional)
          </label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={3}
            maxLength={2000}
            className={inputCls + ' resize-y'}
            disabled={mutation.isPending}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={mutation.isPending}
          className="px-4 py-2 text-sm rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
        >
          {mutation.isPending ? 'Submitting...' : 'Submit'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
