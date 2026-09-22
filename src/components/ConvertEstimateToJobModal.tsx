import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { TenantAccountPicker } from '@/components/TenantAccountPicker'
import { useJobTypes } from '@/hooks/useJobTypes'
import { apiRequest } from '@/lib/api'
import type { Estimate } from '@/types/estimate'

/**
 * ConvertEstimateToJobModal — the overlay shown when dispatch clicks
 * "Convert to job" on an approved estimate (calendar context menu OR
 * estimate detail page).
 *
 * Captures the new work order's schedule, lead tech, priority, and
 * tech notes — fields that the convert endpoint accepts but the
 * estimate doesn't necessarily have on it.
 *
 * On Save: POST /v1/estimates/{id}/convert → navigate to /jobs/{new_wo_id}.
 */

export function ConvertEstimateToJobModal({
  isOpen,
  onClose,
  estimate,
}: {
  isOpen: boolean
  onClose: () => void
  estimate: Estimate
}) {
  const navigate = useNavigate()
  const jobTypesQuery = useJobTypes({ active: true, per_page: 100 })
  const jobTypes = jobTypesQuery.data?.data ?? []

  const [jobTypeId, setJobTypeId] = useState<string>(estimate.job_type_id ?? '')
  const [priority, setPriority] = useState<'low' | 'normal' | 'urgent' | 'emergency'>('normal')
  const [scheduledDate, setScheduledDate] = useState<string>(isoToday())
  const [scheduledStartTime, setScheduledStartTime] = useState<string>('09:00')
  const [scheduledEndTime, setScheduledEndTime] = useState<string>('11:00')
  const [leadTechId, setLeadTechId] = useState<string | null>(estimate.lead_tech_account_id ?? null)
  const [crewId, setCrewId] = useState<string | null>(null)
  const [techNotes, setTechNotes] = useState('')
  const [publicNotes, setPublicNotes] = useState(estimate.customer_notes ?? '')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setJobTypeId(estimate.job_type_id ?? '')
    setPriority('normal')
    setScheduledDate(isoToday())
    setScheduledStartTime('09:00')
    setScheduledEndTime('11:00')
    setLeadTechId(estimate.lead_tech_account_id ?? null)
    setCrewId(null)
    setTechNotes('')
    setPublicNotes(estimate.customer_notes ?? '')
    setError(null)
  }, [isOpen, estimate.id])

  // Auto-pick a job type if the estimate doesn't carry one and there's a
  // sensible default. Most-used flagged type wins; otherwise the first.
  useEffect(() => {
    if (jobTypeId || jobTypes.length === 0) return
    const fav = jobTypes.find((t) => t.most_used) ?? jobTypes[0]
    if (fav) setJobTypeId(fav.id)
  }, [jobTypes, jobTypeId])

  async function handleConvert() {
    setError(null)
    if (!jobTypeId) {
      setError('Pick a job type.')
      return
    }

    const startIso = combineToIso(scheduledDate, scheduledStartTime)
    const endIso = combineToIso(scheduledDate, scheduledEndTime)
    const durationMin = startIso && endIso
      ? Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000))
      : null

    setSubmitting(true)
    try {
      const res = await apiRequest<{ data: { id: string } }>(
        `/v1/estimates/${estimate.id}/convert`,
        {
          method: 'POST',
          body: {
            job_type_id: jobTypeId,
            priority,
            scheduled_start_at: startIso,
            scheduled_end_at: endIso,
            estimated_duration_minutes: durationMin,
            lead_tech_account_id: leadTechId,
            crew_id: crewId,
            tech_notes: techNotes.trim() || null,
            public_notes: publicNotes.trim() || null,
          },
        },
      )
      onClose()
      navigate(`/jobs/${res.data.id}`)
    } catch (e) {
      const errObj = e as {
        payload?: { errors?: Record<string, string[]>; reason?: string; error?: string; message?: string }
      }
      const fieldErr = errObj?.payload?.errors
        ? Object.values(errObj.payload.errors)[0]?.[0]
        : null
      setError(
        fieldErr
          ?? errObj?.payload?.reason
          ?? errObj?.payload?.error
          ?? errObj?.payload?.message
          ?? (e instanceof Error ? e.message : String(e)),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert estimate to job"
      subtitle={`${estimate.display_number ?? estimate.estimate_number}${estimate.customer ? ' · ' + estimate.customer.display_name : ''}`}
      size="lg"
    >
      <Modal.Body>
        <div className="space-y-4">
          <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-3">
            This creates a new <strong>work order</strong> with the estimate&apos;s line items
            copied over. The estimate stays in place for history. Schedule the actual repair
            visit below — usually different from the walkthrough date.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Job type *">
              <select
                className={inputCls}
                value={jobTypeId}
                onChange={(e) => setJobTypeId(e.target.value)}
                disabled={jobTypesQuery.isLoading}
              >
                <option value="">{jobTypesQuery.isLoading ? 'Loading…' : 'Select job type'}</option>
                {jobTypes.map((jt) => (
                  <option key={jt.id} value={jt.id}>
                    {jt.name}{jt.most_used ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label="Priority">
              <select
                className={inputCls}
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
              >
                {(['low', 'normal', 'urgent', 'emergency'] as const).map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </Labeled>
          </div>

          {/* Schedule */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Schedule the visit
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Labeled label="Date">
                <input
                  type="date"
                  className={inputCls}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </Labeled>
              <Labeled label="Start">
                <input
                  type="time"
                  className={inputCls}
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                />
              </Labeled>
              <Labeled label="End">
                <input
                  type="time"
                  className={inputCls}
                  value={scheduledEndTime}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                />
              </Labeled>
            </div>
          </div>

          {/* Tech */}
          <Labeled label="Assign lead tech">
            <TenantAccountPicker
              value={leadTechId}
              onChange={(id) => setLeadTechId(id)}
              placeholder="Search staff…"
            />
          </Labeled>

          {/* Crew (optional). When selected, the WO's lead tech auto-fills
              from the crew's designated lead on save — but only if the lead
              tech field above is empty. */}
          <Labeled label="Crew (optional)">
            <CrewPickerSelect value={crewId} onChange={setCrewId} />
          </Labeled>

          {/* Notes */}
          <Labeled label="Tech notes (internal — appended to the estimate's internal notes)">
            <textarea
              rows={2}
              className={inputCls}
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              placeholder="e.g. Bring the 6-ft ladder; gate code 1234."
            />
          </Labeled>

          <Labeled label="Customer-facing notes (shown on invoice)">
            <textarea
              rows={2}
              className={inputCls}
              value={publicNotes}
              onChange={(e) => setPublicNotes(e.target.value)}
              placeholder="Anything the customer should see on the job paperwork."
            />
          </Labeled>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConvert}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
        >
          {submitting ? 'Converting…' : 'Convert & schedule job'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function isoToday(): string {
  return localDate(new Date())
}

function combineToIso(date: string, time: string): string | null {
  if (!date) return null
  const t = time && time.length >= 5 ? time.slice(0, 5) : '00:00'
  return `${date}T${t}:00`
}

function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Labeled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  )
}

/**
 * Inline crew picker — lightweight select fed by /v1/crews. Returns
 * crew_id (string) or null. Auto-hides when the tenant has no active
 * crews so the form doesn't show an empty dropdown.
 */
function CrewPickerSelect({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const list = useQuery({
    queryKey: ['crews', 'for-convert-modal'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string; color: string | null; lead_name: string | null; active: boolean }> }>('/v1/crews'),
    staleTime: 60_000,
  })
  const crews = (list.data?.data ?? []).filter((c) => c.active)
  if (crews.length === 0) return <p className="text-xs text-slate-500 italic">No crews configured yet.</p>
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
    >
      <option value="">— No crew —</option>
      {crews.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}{c.lead_name ? ` · led by ${c.lead_name}` : ''}
        </option>
      ))}
    </select>
  )
}
