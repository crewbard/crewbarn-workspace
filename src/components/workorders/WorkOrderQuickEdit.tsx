import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import { captureStatusGeo } from '@/lib/statusGeo'
import { useTenantAccounts } from '@/hooks/useTenantAccounts'
import type { WorkOrder } from '@/types/workOrder'
import type { Customer } from '@/types/customer'
import { CustomerPicker } from '@/components/CustomerPicker'
import { AutoTextarea } from '@/components/AutoTextarea'

/**
 * Inline quick-edit card on the WO overview. Lets a dispatcher change
 * tech, status, schedule date+time, and notes without leaving the
 * page — covers the 4 most-edited fields. Bigger changes still go
 * through the full Edit form (which is on the deferred list).
 *
 * Each section is independently saveable so a partial change doesn't
 * block the rest.
 */

interface JobStatusRow {
  id: string
  name: string
  color: string | null
}

interface CrewRow {
  id: string
  name: string
  color: string | null
}

export type WorkOrderQuickEditState = {
  dirty: boolean
  saving: boolean
  saved: boolean
}

export interface WorkOrderQuickEditHandle {
  save: () => void
  discard: () => void
}

type WorkOrderQuickEditProps = {
  wo: WorkOrder
  onStateChange?: (state: WorkOrderQuickEditState) => void
  showInlineSave?: boolean
}

export const WorkOrderQuickEdit = forwardRef<
  WorkOrderQuickEditHandle,
  WorkOrderQuickEditProps
>(function WorkOrderQuickEdit({ wo, onStateChange, showInlineSave = true }, ref) {
  const qc = useQueryClient()

  const techsQ = useTenantAccounts('', 100)
  const statusesQ = useQuery({
    queryKey: ['job-statuses'],
    queryFn: () => apiRequest<{ data: JobStatusRow[] }>('/v1/job-statuses'),
    staleTime: 5 * 60_000,
  })
  const crewsQ = useQuery({
    queryKey: ['crews'],
    queryFn: () => apiRequest<{ data: CrewRow[] }>('/v1/crews'),
    staleTime: 5 * 60_000,
  })
  const techs = techsQ.data ?? []
  const statuses = statusesQ.data?.data ?? []
  const crews = crewsQ.data?.data ?? []

  const [title, setTitle] = useState<string>(wo.title)
  const [description, setDescription] = useState<string>(wo.description ?? '')
  const [priority, setPriority] = useState<string>(wo.priority)
  const [theirWoNum, setTheirWoNum] = useState<string>(wo.their_work_order_number ?? '')
  const [theirPoNum, setTheirPoNum] = useState<string>(wo.their_po_number ?? '')
  const [leadTechId, setLeadTechId] = useState<string>(wo.lead_tech_account_id ?? '')
  const [crewId, setCrewId] = useState<string>(wo.crew_id ?? '')
  const [statusId, setStatusId] = useState<string>(wo.status_id)
  const [billTo, setBillTo] = useState<Customer | null>(
    wo.billing_customer
      ? ({ id: wo.billing_customer.id, display_name: wo.billing_customer.display_name } as unknown as Customer)
      : null,
  )
  const [date, setDate] = useState<string>(wo.schedule.date ?? '')
  const [startTime, setStartTime] = useState<string>((wo.schedule.start_time ?? '').slice(0, 5))
  const [endTime, setEndTime] = useState<string>((wo.schedule.end_time ?? '').slice(0, 5))
  const [duration, setDuration] = useState<string>(
    wo.schedule.estimated_duration_minutes != null
      ? String(wo.schedule.estimated_duration_minutes)
      : '',
  )
  const resetFromWo = useCallback(() => {
    setTitle(wo.title)
    setDescription(wo.description ?? '')
    setPriority(wo.priority)
    setTheirWoNum(wo.their_work_order_number ?? '')
    setTheirPoNum(wo.their_po_number ?? '')
    setLeadTechId(wo.lead_tech_account_id ?? '')
    setCrewId(wo.crew_id ?? '')
    setStatusId(wo.status_id)
    setBillTo(
      wo.billing_customer
        ? ({ id: wo.billing_customer.id, display_name: wo.billing_customer.display_name } as unknown as Customer)
        : null,
    )
    setDate(wo.schedule.date ?? '')
    setStartTime((wo.schedule.start_time ?? '').slice(0, 5))
    setEndTime((wo.schedule.end_time ?? '').slice(0, 5))
    setDuration(
      wo.schedule.estimated_duration_minutes != null
        ? String(wo.schedule.estimated_duration_minutes)
        : '',
    )
  }, [wo])

  useEffect(() => {
    if (Object.keys(buildPatch()).length > 0) return
    resetFromWo()
  }, [resetFromWo, wo.id, wo.updated_at])

  function buildPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {}
    if (title !== wo.title) patch.title = title
    if (description !== (wo.description ?? '')) patch.description = description || null
    if (priority !== wo.priority) patch.priority = priority
    if (theirWoNum !== (wo.their_work_order_number ?? '')) {
      patch.their_work_order_number = theirWoNum || null
    }
    if (theirPoNum !== (wo.their_po_number ?? '')) {
      patch.their_po_number = theirPoNum || null
    }
    if (leadTechId !== (wo.lead_tech_account_id ?? '')) {
      patch.lead_tech_account_id = leadTechId || null
    }
    if (crewId !== (wo.crew_id ?? '')) patch.crew_id = crewId || null
    if (statusId !== wo.status_id) patch.status_id = statusId
    if ((billTo?.id ?? '') !== (wo.billing_customer?.id ?? '')) {
      patch.billing_customer_id = billTo?.id || null
    }
    if (date !== (wo.schedule.date ?? '')) {
      patch.scheduled_date = date || null
      patch.is_scheduled = !!date
    }
    if (startTime !== (wo.schedule.start_time ?? '').slice(0, 5)) {
      patch.scheduled_start_time = startTime ? `${startTime}:00` : null
    }
    if (endTime !== (wo.schedule.end_time ?? '').slice(0, 5)) {
      patch.scheduled_end_time = endTime ? `${endTime}:00` : null
    }
    if (duration !== (wo.schedule.estimated_duration_minutes?.toString() ?? '')) {
      patch.estimated_duration_minutes = duration ? Number(duration) : null
    }
    return patch
  }

  const save = useMutation({
    mutationFn: async () => {
      const patch = buildPatch()
      if (Object.keys(patch).length === 0) return null
      // Geotag a status change so the owner can see where the tech was when
      // they flipped it (best-effort; logs 'denied' if they block the prompt).
      if (patch.status_id) {
        Object.assign(patch, await captureStatusGeo())
      }
      return apiRequest(`/v1/work-orders/${wo.id}`, { method: 'PATCH', body: patch })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order', wo.id] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['dispatch-board'] })
    },
  })

  // Status auto-saves the moment it changes — dispatchers flip it constantly
  // and shouldn't have to hit "Save changes" for it. Sends ONLY status (+geo),
  // leaving any other in-progress edits untouched and still pending.
  const statusSave = useMutation({
    mutationFn: async (newStatusId: string) => {
      const patch: Record<string, unknown> = { status_id: newStatusId }
      Object.assign(patch, await captureStatusGeo())
      return apiRequest(`/v1/work-orders/${wo.id}`, { method: 'PATCH', body: patch })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order', wo.id] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['dispatch-board'] })
    },
  })

  function onStatusChange(newStatusId: string) {
    setStatusId(newStatusId)
    statusSave.mutate(newStatusId)
  }

  const hasChanges = Object.keys(buildPatch()).length > 0

  useImperativeHandle(
    ref,
    () => ({
      save: () => {
        if (hasChanges && !save.isPending) save.mutate()
      },
      discard: resetFromWo,
    }),
    [hasChanges, save.isPending, resetFromWo],
  )

  useEffect(() => {
    onStateChange?.({
      dirty: hasChanges,
      saving: save.isPending || statusSave.isPending,
      saved:
        !hasChanges &&
        !save.isPending &&
        !statusSave.isPending &&
        (save.isSuccess || statusSave.isSuccess),
    })
  }, [
    onStateChange,
    hasChanges,
    save.isPending,
    save.isSuccess,
    statusSave.isPending,
    statusSave.isSuccess,
  ])

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">
          Quick edit
        </h2>
        {hasChanges && (
          <span className="text-[11px] text-amber-700 font-semibold uppercase tracking-wider">
            Unsaved
          </span>
        )}
      </div>

      {save.isError && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">
          {(save.error as ApiError).message ?? 'Save failed.'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Description">
            <AutoTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minRows={4}
              className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Bill to (Send invoice to)">
            <CustomerPicker
              value={billTo}
              onChange={setBillTo}
              placeholder="Same as customer — or pick who gets the bill (dealer, etc.)…"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Leave empty to bill the customer above. Set a dealer here to route this job's invoice to them.
            </span>
          </Field>
        </div>
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            value={statusId}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={statusSave.isPending}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {statusSave.isPending ? (
            <span className="block text-[11px] text-slate-500 mt-1">Saving…</span>
          ) : statusSave.isError ? (
            <span className="block text-[11px] text-red-600 mt-1">
              {(statusSave.error as ApiError).message ?? 'Save failed.'}
            </span>
          ) : statusSave.isSuccess ? (
            <span className="block text-[11px] text-emerald-600 mt-1">Saved automatically ✓</span>
          ) : (
            <span className="block text-[11px] text-slate-400 mt-1">Saves automatically</span>
          )}
        </Field>
        <Field label="Lead tech">
          <select
            value={leadTechId}
            onChange={(e) => setLeadTechId(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">— Unassigned —</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Crew (for multi-tech jobs)">
          <select
            value={crewId}
            onChange={(e) => setCrewId(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">— No crew —</option>
            {crews.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Their WO #">
          <input
            type="text"
            value={theirWoNum}
            onChange={(e) => setTheirWoNum(e.target.value)}
            maxLength={100}
            placeholder="customer's WO number"
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>
        <Field label="Their PO #">
          <input
            type="text"
            value={theirPoNum}
            onChange={(e) => setTheirPoNum(e.target.value)}
            maxLength={100}
            placeholder="customer's PO number"
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>
        <Field label="Schedule date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>
        <Field label="Estimated duration (min)">
          <input
            type="number"
            min={0}
            step={15}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="60"
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>
        <Field label="Start">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>
        <Field label="End">
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>
      </div>

      {showInlineSave && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!hasChanges || save.isPending}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {!hasChanges && save.isSuccess && (
            <span className="text-xs text-emerald-600">Saved.</span>
          )}
        </div>
      )}
    </section>
  )
})

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
