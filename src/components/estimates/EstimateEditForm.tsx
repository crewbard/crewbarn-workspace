import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUpdateEstimate } from '@/hooks/useEstimates'
import { apiRequest } from '@/lib/api'
import type { Estimate, EstimateUpdateInput } from '@/types/estimate'

/**
 * Header-fields editor for an estimate. Replaces the "coming soon"
 * placeholder under the Edit tab. Line items still live on the Line
 * Items tab — that surface owns its own editor.
 *
 * Strategy: a buffered draft + Save button rather than auto-save on
 * blur. Estimates are formal customer-facing artifacts; deliberate save
 * matches the user's mental model better than the inline-edit pattern
 * we use on the WO Quick Edit.
 *
 * Status transitions (send/approve/reject) live OUTSIDE this form on
 * the top action bar — those go through dedicated lifecycle endpoints,
 * not PATCH.
 */

type Priority = 'low' | 'normal' | 'urgent' | 'emergency'

interface DraftState {
  title: string
  description: string
  priority: Priority
  customer_notes: string
  internal_notes: string
  terms: string
  /** '' means "(no contract)". */
  contract_template_id: string
  expires_at: string
  scheduled_start_at: string
  scheduled_end_at: string
  estimated_duration_minutes: string
}

function fromEstimate(est: Estimate): DraftState {
  return {
    title: est.title ?? '',
    description: est.description ?? '',
    priority: est.priority ?? 'normal',
    customer_notes: est.customer_notes ?? '',
    internal_notes: est.internal_notes ?? '',
    terms: est.terms ?? '',
    contract_template_id: est.contract_template_id ?? '',
    expires_at: est.expires_at ? est.expires_at.slice(0, 10) : '',
    scheduled_start_at: est.scheduled_start_at ? est.scheduled_start_at.slice(0, 16) : '',
    scheduled_end_at: est.scheduled_end_at ? est.scheduled_end_at.slice(0, 16) : '',
    estimated_duration_minutes:
      est.estimated_duration_minutes != null ? String(est.estimated_duration_minutes) : '',
  }
}

function toInput(d: DraftState): EstimateUpdateInput {
  const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim())
  return {
    title: blankToNull(d.title),
    description: blankToNull(d.description),
    priority: d.priority,
    customer_notes: blankToNull(d.customer_notes),
    internal_notes: blankToNull(d.internal_notes),
    terms: blankToNull(d.terms),
    contract_template_id: d.contract_template_id || null,
    expires_at: blankToNull(d.expires_at),
    scheduled_start_at: blankToNull(d.scheduled_start_at),
    scheduled_end_at: blankToNull(d.scheduled_end_at),
    estimated_duration_minutes:
      d.estimated_duration_minutes.trim() === ''
        ? null
        : Number(d.estimated_duration_minutes),
  }
}

interface ContractTemplateRow {
  id: string
  name: string
  type: string | null
  active: boolean
  merge_tags?: string[]
}

const SIGNABLE_TEMPLATE_TYPES = new Set(['contract', 'estimate', 'work_order', 'sub_work_order'])

function isSignableDocumentTemplate(template: ContractTemplateRow): boolean {
  const type = (template.type ?? '').toLowerCase()
  return (
    SIGNABLE_TEMPLATE_TYPES.has(type) ||
    (template.merge_tags ?? []).some((tag) => /signature/i.test(tag))
  )
}

function formatTemplateType(type: string | null): string {
  const normalized = (type ?? '').replace(/_/g, ' ').trim()
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Template'
}

export function EstimateEditForm({ estimate }: { estimate: Estimate }) {
  const update = useUpdateEstimate()
  const [draft, setDraft] = useState<DraftState>(() => fromEstimate(estimate))
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [aiOpen, setAiOpen] = useState(false)

  // Pull all document templates so estimate/work-order templates with
  // signature blocks can be attached, not only legal contract templates.
  const contractsQ = useQuery({
    queryKey: ['document-templates', 'signable'],
    queryFn: () => apiRequest<{ data: ContractTemplateRow[] }>('/v1/document-templates'),
  })
  const signableTemplates = (contractsQ.data?.data ?? []).filter(
    (template) => template.active && isSignableDocumentTemplate(template)
  )

  // Re-seed when the underlying estimate changes (e.g. after a re-quote).
  useEffect(() => {
    setDraft(fromEstimate(estimate))
    setDirty(false)
  }, [estimate.id, estimate.updated_at])

  function patch(p: Partial<DraftState>) {
    setDraft((d) => ({ ...d, ...p }))
    setDirty(true)
    setSavedAt(null)
  }

  async function save() {
    setError(null)
    try {
      await update.mutateAsync({ id: estimate.id, input: toInput(draft) })
      setDirty(false)
      setSavedAt(Date.now())
    } catch (err) {
      const e = err as { payload?: { message?: string } }
      setError(e?.payload?.message ?? (err as Error).message ?? 'Failed to save.')
    }
  }

  function reset() {
    setDraft(fromEstimate(estimate))
    setDirty(false)
    setError(null)
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'

  return (
    <div className="space-y-5">
      {/* Title + description + priority */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <Field label="Title">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            className={inputCls}
            placeholder="e.g., Roof inspection + repair quote"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Priority">
            <select
              value={draft.priority}
              onChange={(e) => patch({ priority: e.target.value as Priority })}
              className={inputCls}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </Field>
          <Field label="Expires">
            <input
              type="date"
              value={draft.expires_at}
              onChange={(e) => patch({ expires_at: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={3}
            className={inputCls}
            placeholder="Internal description / scope of work"
          />
        </Field>
      </section>

      {/* Scheduling */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-700">
          Walkthrough schedule
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Start">
            <input
              type="datetime-local"
              value={draft.scheduled_start_at}
              onChange={(e) => patch({ scheduled_start_at: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="End">
            <input
              type="datetime-local"
              value={draft.scheduled_end_at}
              onChange={(e) => patch({ scheduled_end_at: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Estimated duration (minutes)">
          <input
            type="number"
            min="0"
            step="15"
            value={draft.estimated_duration_minutes}
            onChange={(e) => patch({ estimated_duration_minutes: e.target.value })}
            className={`${inputCls} max-w-[140px]`}
          />
        </Field>
      </section>

      {/* Signable document attachment — when set, the customer is required to
          read + sign this document before approving the estimate on
          the portal. */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-700">
            Signable document
          </h3>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="text-xs font-semibold border border-sky-300 text-sky-700 hover:bg-sky-50 rounded px-2 py-1 inline-flex items-center gap-1"
            title="Describe the scope; AI drafts a contract + saves it to Templates & Forms"
          >
            <span>✨</span> Generate with AI
          </button>
        </div>
        <Field
          label="Attached signable document"
          hint={
            draft.contract_template_id
              ? 'Customer must read + sign this before approving the estimate on the portal.'
              : 'Optional. Pick a contract, estimate, or work-order template to require a signature before approving.'
          }
        >
          <select
            value={draft.contract_template_id}
            onChange={(e) => patch({ contract_template_id: e.target.value })}
            disabled={contractsQ.isLoading}
            className={inputCls}
          >
            <option value="">(no signable document)</option>
            {signableTemplates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {formatTemplateType(c.type)}
              </option>
            ))}
          </select>
        </Field>
        {contractsQ.isSuccess && signableTemplates.length === 0 && (
          <p className="text-[11px] text-slate-500">
            No signable document templates yet — create a Contract, Estimate, or Work Order template
            under{' '}
            <a className="text-amber-700 underline" href="/tool-shed/documents">
              Tool Shed → Templates & Forms
            </a>{' '}
            and include a signature block, or click <strong>Generate with AI</strong> above.
          </p>
        )}
      </section>

      {aiOpen && (
        <AiContractModal
          estimate={estimate}
          onClose={() => setAiOpen(false)}
          onCreated={(templateId) => {
            patch({ contract_template_id: templateId })
            setAiOpen(false)
          }}
        />
      )}

      {/* Notes + terms */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-700">
          Notes & terms
        </h3>
        <Field label="Customer-facing notes" hint="Shows on the customer's PDF + portal.">
          <textarea
            value={draft.customer_notes}
            onChange={(e) => patch({ customer_notes: e.target.value })}
            rows={3}
            className={inputCls}
          />
        </Field>
        <Field label="Internal notes" hint="Office-only. Never shown to the customer.">
          <textarea
            value={draft.internal_notes}
            onChange={(e) => patch({ internal_notes: e.target.value })}
            rows={3}
            className={inputCls}
          />
        </Field>
        <Field label="Terms" hint="Boilerplate at the bottom of the customer PDF.">
          <textarea
            value={draft.terms}
            onChange={(e) => patch({ terms: e.target.value })}
            rows={4}
            className={inputCls}
          />
        </Field>
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-slate-50 -mx-2 px-2 py-3 border-t border-slate-200">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1.5 mr-auto">
            {error}
          </div>
        )}
        {!error && savedAt && !dirty && (
          <div className="text-xs text-emerald-700 mr-auto">Saved.</div>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={!dirty || update.isPending}
          className="px-3 py-2 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || update.isPending}
          className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  )
}

/**
 * Two-step AI contract generator. Sequence:
 *
 *   1. POST /v1/document-templates/ai-draft with type='contract' +
 *      a description built from the estimate's title/customer/scope
 *      + the user's freeform scope text.
 *   2. POST /v1/document-templates with the returned name+title+body
 *      to persist a real DocumentTemplate row.
 *   3. Call onCreated(templateId) so the parent picks the new template
 *      and selects it on the form.
 *
 * Live in this file (vs a /components/ai folder) because it's tightly
 * coupled to the estimate context — the scope is pre-seeded from the
 * estimate's title + description and the saved template name defaults
 * to "Contract for {customer} — {estimate#}." Extract later when the
 * WO side wants the same flow.
 */
function AiContractModal({
  estimate,
  onClose,
  onCreated,
}: {
  estimate: Estimate
  onClose: () => void
  onCreated: (templateId: string) => void
}) {
  const qc = useQueryClient()
  const customerName = estimate.customer?.display_name ?? ''
  const defaultScope =
    [estimate.title, estimate.description].filter(Boolean).join('. ').trim()
  const [scope, setScope] = useState(defaultScope)
  const [extra, setExtra] = useState('')
  const [phase, setPhase] = useState<'input' | 'preview'>('input')
  const [draft, setDraft] = useState<{ name: string; title: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      // Compose the description that goes to the AI. Specific context
      // beats a freeform "draft me a contract" — the AI needs the
      // customer name, scope, dollar amount, and any extra terms.
      const description = [
        `Contract for customer "${customerName}".`,
        scope ? `Scope of work: ${scope}.` : '',
        estimate.money?.total_formatted
          ? `Total estimate: ${estimate.money.total_formatted}.`
          : '',
        extra ? `Additional terms / considerations: ${extra}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const suggestedName =
        `Contract — ${customerName || 'Customer'} (${estimate.estimate_number})`.slice(0, 120)

      const res = await apiRequest<{
        data: {
          ok: boolean
          draft: { name: string; title: string; body: string } | null
          error: string | null
        }
      }>('/v1/document-templates/ai-draft', {
        method: 'POST',
        body: { description, type: 'contract', name: suggestedName },
      })

      if (!res.data.ok || !res.data.draft) {
        throw new Error(res.data.error ?? 'AI returned no draft.')
      }
      setDraft(res.data.draft)
      setPhase('preview')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveAndAttach() {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest<{ data: { id: string } }>('/v1/document-templates', {
        method: 'POST',
        body: {
          name: draft.name,
          type: 'contract',
          title: draft.title,
          body: draft.body,
          active: true,
        },
      })
      // Refresh the contract list so the picker shows it.
      qc.invalidateQueries({ queryKey: ['document-templates', 'contracts'] })
      qc.invalidateQueries({ queryKey: ['document-templates'] })
      onCreated(res.data.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            ✨ Generate contract with AI
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-2xl text-slate-500 leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          {phase === 'input' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scope of the job
                </label>
                <textarea
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  rows={4}
                  placeholder="What work will be performed? Include materials, exclusions, anything the customer needs to agree to."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Pre-seeded from the estimate's title + description. Edit before generating.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Anything else? <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  rows={3}
                  placeholder="Warranty terms, payment schedule, special conditions, liability language, etc."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                The AI returns a contract template that you'll preview before saving. After
                saving, it lives in Tool Shed → Templates & Forms and gets attached to this
                estimate.
              </p>
            </>
          )}

          {phase === 'preview' && draft && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template name <span className="text-slate-400">(editable)</span>
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title shown on the contract
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Body (markdown)
                </label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={16}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Uses merge tags like <code>{'{{customer.name}}'}</code>,{' '}
                  <code>{'{{money.total}}'}</code>, <code>{'{{today}}'}</code>. You can edit
                  here, or save then refine later under Tool Shed → Templates & Forms.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {phase === 'preview' && (
            <button
              type="button"
              onClick={() => setPhase('input')}
              disabled={busy}
              className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
          >
            Cancel
          </button>
          {phase === 'input' ? (
            <button
              type="button"
              onClick={generate}
              disabled={busy || !scope.trim()}
              className="px-4 py-2 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-md disabled:opacity-50"
            >
              {busy ? 'Drafting…' : 'Draft contract'}
            </button>
          ) : (
            <button
              type="button"
              onClick={saveAndAttach}
              disabled={busy || !draft?.body}
              className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save + attach to estimate'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
