import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconHelpCircle } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'
import { visibleStatusColor, textColorOn } from '@/lib/statusColor'
import { Modal } from '@/components/ui/Modal'

/**
 * Settings UI for the work-order transition rules (Slice 5). Lets the owner
 * define which status moves are allowed and what each requires.
 *
 * Enforcement is permissive until at least one rule is ACTIVE — surfaced in the
 * banner so it's never a surprise.
 */

export interface StatusOption {
  id: string
  name: string
  color: string
  category: string
}

interface StatusRef {
  id: string
  name: string
  color: string | null
}

interface Transition {
  id: string
  from_status_id: string | null
  to_status_id: string
  from_status: StatusRef | null
  to_status: StatusRef | null
  requires_assigned_tech: boolean
  requires_schedule: boolean
  requires_signature: boolean
  requires_photos: boolean
  requires_completed_visit: boolean
  requires_no_open_visit: boolean
  active: boolean
}

type ReqKey =
  | 'requires_assigned_tech'
  | 'requires_schedule'
  | 'requires_signature'
  | 'requires_photos'
  | 'requires_completed_visit'
  | 'requires_no_open_visit'

const REQ_FIELDS: Array<{ key: ReqKey; short: string; label: string }> = [
  { key: 'requires_assigned_tech', short: 'Tech', label: 'Technician assigned' },
  { key: 'requires_schedule', short: 'Scheduled', label: 'Job is scheduled' },
  { key: 'requires_signature', short: 'Signature', label: 'Signature captured' },
  { key: 'requires_photos', short: 'Photos', label: 'Required photos attached' },
  { key: 'requires_completed_visit', short: 'Visit', label: 'A visit was completed' },
  { key: 'requires_no_open_visit', short: 'Closed', label: 'No open visit' },
]

function StatusPill({ status, label }: { status: StatusRef | null; label?: string }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 italic">
        {label ?? 'Any status'}
      </span>
    )
  }
  const bg = visibleStatusColor(status.color)
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
      style={{ background: bg, color: textColorOn(bg) }}
    >
      {status.name}
    </span>
  )
}

export function JobStatusTransitionsManager({ statuses }: { statuses: StatusOption[] }) {
  const qc = useQueryClient()
  const [helpOpen, setHelpOpen] = useState(false)
  const [fromId, setFromId] = useState<string>('')   // '' = Any
  const [toId, setToId] = useState<string>('')
  const [addError, setAddError] = useState<string | null>(null)

  const rulesQ = useQuery({
    queryKey: ['job-status-transitions'],
    queryFn: () => apiRequest<{ data: Transition[] }>('/v1/job-status-transitions'),
  })
  const rules = rulesQ.data?.data ?? []
  const activeCount = useMemo(() => rules.filter((r) => r.active).length, [rules])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['job-status-transitions'] })

  const createRule = useMutation({
    mutationFn: () =>
      apiRequest('/v1/job-status-transitions', {
        method: 'POST',
        body: { from_status_id: fromId || null, to_status_id: toId },
      }),
    onSuccess: () => {
      setFromId('')
      setToId('')
      setAddError(null)
      invalidate()
    },
    onError: (e: Error) => setAddError(e.message),
  })

  const patchRule = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiRequest(`/v1/job-status-transitions/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: invalidate,
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/job-status-transitions/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return (
    <section className="mt-10 bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-navy-900">Status flow rules</h2>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="How status flow rules work"
              title="How status flow rules work"
            >
              <IconHelpCircle size={20} stroke={1.8} aria-hidden="true" />
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Control which status changes are allowed and what each one requires
            (e.g. a signature before <em>Complete</em>). Field check-ins still
            move status automatically — these rules guard manual changes.
          </p>
        </div>
      </div>

      {/* Enforcement banner */}
      <div
        className={`mt-3 rounded-md px-3 py-2 text-sm ${
          activeCount > 0
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-slate-50 text-slate-600 border border-slate-200'
        }`}
      >
        {activeCount > 0 ? (
          <>
            <strong>Enforcing {activeCount} rule{activeCount === 1 ? '' : 's'}.</strong>{' '}
            A status that has an active rule can only be reached from its allowed
            source. Moves into statuses with no active rule stay open.
          </>
        ) : (
          <>
            <strong>Enforcement is off.</strong> All status changes are allowed
            until you activate at least one rule below.
          </>
        )}
      </div>

      {/* Add rule */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-slate-500">
          From
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="mt-1 text-sm px-2 py-1.5 border border-slate-300 rounded-md min-w-[160px]"
          >
            <option value="">Any status</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <span className="pb-2 text-slate-400">→</span>
        <label className="flex flex-col text-xs text-slate-500">
          To
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="mt-1 text-sm px-2 py-1.5 border border-slate-300 rounded-md min-w-[160px]"
          >
            <option value="">Select status…</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!toId || createRule.isPending}
          onClick={() => createRule.mutate()}
          className="text-sm px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-40"
        >
          Add rule
        </button>
      </div>
      {addError && <div className="mt-2 text-xs text-red-600">{addError}</div>}

      {/* Rules list */}
      <div className="mt-5 space-y-2">
        {rulesQ.isLoading && <div className="text-sm text-slate-400">Loading…</div>}
        {!rulesQ.isLoading && rules.length === 0 && (
          <div className="text-sm text-slate-400">
            No rules yet. Add moves above (or run the default-rules seeder) to start shaping the flow.
          </div>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className={`border rounded-lg px-3 py-2.5 ${r.active ? 'border-slate-200' : 'border-dashed border-slate-200 bg-slate-50/50'}`}
          >
            <div className="flex items-center flex-wrap gap-2">
              <StatusPill status={r.from_status} />
              <span className="text-slate-400 text-sm">→</span>
              <StatusPill status={r.to_status} label={r.to_status?.name} />

              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => patchRule.mutate({ id: r.id, patch: { active: e.target.checked } })}
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() => deleteRule.mutate(r.id)}
                  title="Delete rule"
                  className="text-slate-400 hover:text-red-600 text-sm px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Requirement toggles */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REQ_FIELDS.map((f) => {
                const on = r[f.key]
                return (
                  <button
                    key={f.key}
                    type="button"
                    title={`Require: ${f.label}`}
                    onClick={() => patchRule.mutate({ id: r.id, patch: { [f.key]: !on } })}
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      on
                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {on ? '✓ ' : ''}{f.short}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="How status flow rules work"
        subtitle="Use rules to prevent manual status changes until the job is ready."
        size="lg"
      >
        <Modal.Body className="space-y-6 text-sm text-slate-700">
          <section>
            <h3 className="font-semibold text-slate-900">What a rule does</h3>
            <p className="mt-1 leading-6">
              A rule has a starting status, a destination status, and optional requirements. For example,
              <strong> On Site to Complete</strong> means a person can manually select Complete only while the
              job is On Site and after every selected requirement is satisfied.
            </p>
          </section>

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-950">Important enforcement behavior</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-6 text-amber-950">
              <li>A destination with one or more active rules is locked to the allowed starting statuses.</li>
              <li>A destination with no active rules remains open from any status.</li>
              <li><strong>Any status</strong> allows that destination from every starting status, but selected requirements still apply.</li>
              <li>Turning off Active keeps the rule saved but stops enforcing it.</li>
              <li>Field check-in and check-out record real activity and can move status automatically without these manual-change rules.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900">Requirement buttons</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ['Tech', 'A lead technician must be assigned to the job.'],
                ['Scheduled', 'The job must have a scheduled start time.'],
                ['Signature', 'At least one signature must be captured on the job.'],
                ['Photos', 'The required number of job photos must be attached; if no minimum is set, at least one photo is required.'],
                ['Visit', 'At least one visit must have a Completed outcome.'],
                ['Closed', 'No visit can still be open; the technician must check out first.'],
              ].map(([name, description]) => (
                <div key={name} className="rounded-md border border-slate-200 p-3">
                  <div className="font-medium text-slate-900">{name}</div>
                  <div className="mt-0.5 leading-5 text-slate-600">{description}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-slate-900">Examples</h3>
            <div className="mt-2 space-y-3">
              <div className="rounded-md border border-slate-200 p-3">
                <div className="font-medium text-slate-900">On Site to Complete</div>
                <p className="mt-1 leading-5 text-slate-600">
                  Select Signature, Photos, Visit, and Closed when a job should not be completed until its field work and closeout are finished.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="font-medium text-slate-900">Complete to Invoiced</div>
                <p className="mt-1 leading-5 text-slate-600">
                  Allows staff to invoice only after the job reaches Complete. Requirements are optional if completion already enforces them.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="font-medium text-slate-900">Invoiced to Paid</div>
                <p className="mt-1 leading-5 text-slate-600">
                  Keeps the manual workflow in order. A payment can mark the invoice Paid, while the cash drawer separately tracks whether a technician or the office holds physical money.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <div className="font-medium text-slate-900">Any status to Canceled</div>
                <p className="mt-1 leading-5 text-slate-600">
                  Allows cancellation from anywhere in the workflow. The cancellation email or text is controlled by the status notification templates and triggers, not by this rule.
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-4">
            <h3 className="font-semibold text-slate-900">Rules are not notifications</h3>
            <p className="mt-1 leading-6">
              Flow rules decide whether a manual status change is allowed. Status templates contain the customer message,
              and status triggers send that message. Configure those separately on each status.
            </p>
          </section>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
          >
            Got it
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  )
}
