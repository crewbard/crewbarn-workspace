import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listWorkOrders } from '@/lib/workOrders'
import type { ComposerUsedJob } from '@/lib/comms'
import type { WorkOrder } from '@/types/workOrder'
import { useNow } from '@/lib/useNow'

/**
 * Shared by the email and text composers: once a template is filled in from
 * the page, say which job it used (with a way to pick another), and ask for
 * anything that's still blank before it can be sent.
 */

/** Any {{tag}} still in the text. */
const RAW_TAG = /\{\{\s*([^{}]*?)\s*\}\}/g

const TAG_LABELS: Record<string, string> = {
  'appointment.at': 'Appointment time',
  'appointment.date': 'Appointment date',
  'appointment.time': 'Arrival time',
  'technician.name': 'Technician',
  'technician.full_name': 'Technician',
  'job.number': 'Job number',
  'job.title': 'Job title',
  'job.description': 'Job description',
  'job.address': 'Job address',
  'job.service_address': 'Job address',
  'job.scheduled_at': 'Scheduled date',
  'job.date': 'Scheduled date',
  'job.scheduled_date': 'Scheduled date',
  'job.status': 'Job status',
  'job.type': 'Job type',
  'job.portal_link': 'Job link',
  'customer.name': 'Customer name',
  'customer.first_name': 'First name',
  'customer.last_name': 'Last name',
  'customer.address': 'Customer address',
  'customer.phone': 'Customer phone',
  'customer.email': 'Customer email',
  'service_location.full_address': 'Service address',
  'service_location.address': 'Service address',
  'service_location.gate_code': 'Gate code',
  'invoice.number': 'Invoice number',
  'invoice.total': 'Invoice total',
  'invoice.balance': 'Balance due',
  'invoice.due_at': 'Due date',
  'invoice.pay_link': 'Payment link',
  'estimate.number': 'Estimate number',
  'estimate.total': 'Estimate total',
  'contract.title': 'Agreement name',
  'contract.next_visit': 'Next visit',
  'contract.renewal_date': 'Renewal date',
  'company.phone': 'Your phone number',
  'company.review_link': 'Review link',
}

/** A plain-words name for a tag, e.g. "appointment.at" → "Appointment time". */
export function tagLabel(tag: string): string {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag]
  const parts = tag.split('.')
  const last = (parts[parts.length - 1] || tag).replace(/_/g, ' ').trim()
  const group = parts.length > 1 ? parts[0].replace(/_/g, ' ') : ''
  const words = last === 'name' || last === 'number' || last === 'at' ? `${group} ${last === 'at' ? 'time' : last}` : last
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Unique {{tags}} left in any of these texts, in the order they appear. */
export function findBlankTags(...texts: Array<string | null | undefined>): string[] {
  const seen: string[] = []
  for (const text of texts) {
    if (!text) continue
    for (const m of text.matchAll(RAW_TAG)) {
      const tag = m[1].trim()
      if (tag && !seen.includes(tag)) seen.push(tag)
    }
  }
  return seen
}

/** True while any {{…}} is still in the text. */
export function hasBlankTags(...texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => !!t && /\{\{[^{}]*\}\}/.test(t))
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Put a typed value in place of {{tag}}; escaped when the text is HTML. */
export function fillTag(text: string, tag: string, value: string, html = false): string {
  const safe = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\{\\{\\s*${safe}\\s*\\}\\}`, 'g')
  const out = html ? escapeHtml(value) : value
  return text.replace(re, () => out)
}

function jobStartLabel(wo: WorkOrder): string | null {
  const local = wo.schedule?.start_local
  if (!local) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function jobName(number: string | number | null | undefined): string {
  return number !== null && number !== undefined && `${number}` !== '' ? `Job #${number}` : 'this job'
}

export function TemplateFillPanel({
  usedJob,
  customerId,
  onPickJob,
  blanks,
  onFill,
  busy = false,
}: {
  usedJob: ComposerUsedJob | null
  /** Lets "change" list this customer's jobs. */
  customerId?: string | null
  onPickJob?: (workOrderId: string) => void
  blanks: string[]
  onFill: (tag: string, value: string) => void
  busy?: boolean
}) {
  const [picking, setPicking] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const jobsQuery = useQuery({
    queryKey: ['composer-jobs', customerId],
    queryFn: () => listWorkOrders({ service_customer_id: customerId!, per_page: 50 }),
    enabled: picking && !!customerId,
    staleTime: 60_000,
  })

  const now = useNow(60_000)
  const jobs = (jobsQuery.data?.data ?? []).slice()
  const startOf = (w: WorkOrder) => (w.schedule?.start_at ? new Date(w.schedule.start_at).getTime() : null)
  const upcoming = jobs
    .filter((w) => {
      const s = startOf(w)
      return s !== null && s >= now
    })
    .sort((a, b) => (startOf(a) ?? 0) - (startOf(b) ?? 0))
  const recent = jobs
    .filter((w) => !upcoming.includes(w))
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 10)

  const commit = (tag: string) => {
    const value = (drafts[tag] ?? '').trim()
    if (!value) return
    onFill(tag, value)
    setDrafts((d) => {
      const next = { ...d }
      delete next[tag]
      return next
    })
  }

  if (!usedJob && blanks.length === 0) return null

  return (
    <div className="space-y-2">
      {usedJob && (
        <div data-tour="composer-filled-from" className="text-[11px] text-slate-500">
          Filled in from{' '}
          <span className="font-semibold text-slate-700" title={usedJob.title ?? undefined}>
            {jobName(usedJob.number)}
          </span>
          {' · '}
          {usedJob.scheduled_label ?? 'not scheduled yet'}
          {customerId && onPickJob && (
            <>
              {' — '}
              <button
                type="button"
                onClick={() => setPicking((v) => !v)}
                className="font-semibold text-slate-600 underline hover:text-slate-900"
                disabled={busy}
              >
                {picking ? 'close' : 'change'}
              </button>
            </>
          )}
        </div>
      )}

      {picking && customerId && onPickJob && (
        <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white text-xs shadow-sm">
          {jobsQuery.isLoading && <div className="px-3 py-2 text-slate-400">Loading jobs…</div>}
          {jobsQuery.isError && <div className="px-3 py-2 text-red-600">Couldn’t load this customer’s jobs.</div>}
          {!jobsQuery.isLoading && !jobsQuery.isError && upcoming.length === 0 && recent.length === 0 && (
            <div className="px-3 py-2 text-slate-400">This customer has no jobs yet.</div>
          )}
          {[
            { label: 'Coming up', rows: upcoming },
            { label: 'Recent', rows: recent },
          ]
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <div key={g.label}>
                <div className="bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</div>
                {g.rows.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setPicking(false)
                      onPickJob(w.id)
                    }}
                    className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-amber-50 ${usedJob?.id === w.id ? 'bg-amber-50' : ''}`}
                  >
                    <span className="font-semibold text-slate-700">{jobName(w.work_order_number)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-600">{w.title || 'Untitled job'}</span>
                    <span className="shrink-0 text-slate-400">{jobStartLabel(w) ?? w.status?.name ?? ''}</span>
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}

      {blanks.length > 0 && (
        <div data-tour="composer-blanks" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <div className="text-xs font-semibold text-amber-900">
            Still blank: {blanks.map(tagLabel).join(', ')}
          </div>
          <div className="mt-2 space-y-1.5">
            {blanks.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-xs text-amber-900">
                <span className="w-36 shrink-0">{tagLabel(tag)}</span>
                <input
                  type="text"
                  value={drafts[tag] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [tag]: e.target.value }))}
                  onBlur={() => commit(tag)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commit(tag)
                    }
                  }}
                  placeholder="Type it here"
                  className="min-w-0 flex-1 rounded border border-amber-300 bg-white px-2 py-1 text-xs placeholder:text-amber-700/50 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateFillPanel
