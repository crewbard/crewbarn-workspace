import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { AiGenerateTemplateModal } from '@/components/customDocuments/AiGenerateTemplateModal'
import { SmsTemplateEditor } from '@/components/customDocuments/SmsTemplateEditor'
import { AiGenerateSmsModal } from '@/components/customDocuments/AiGenerateSmsModal'
import { useStarters, type Starter } from '@/components/customDocuments/templateStarters'

type Tab = 'email' | 'document' | 'sms'
type View = 'library' | 'advanced'

const EMAIL_CATEGORIES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'job', label: 'Job' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'general', label: 'General' },
]

// SMS categories mirror email so the two text channels filter alike.
const SMS_CATEGORIES = EMAIL_CATEGORIES

const DOC_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'work_order', label: 'Work Order' },
  { value: 'sub_work_order', label: 'Sub Work Order (vendor partner)' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'general', label: 'General' },
]

interface ListRow {
  id: string
  name: string
  category?: string  // email + sms
  type?: string  // doc
  subject?: string  // email
  title?: string  // doc
  body?: string  // sms (no subject/title — the message itself is the preview)
  active: boolean
  is_default?: boolean
  merge_tags: string[]
  starter_signature?: string
  updated_at?: string
}

interface InitialDraft {
  name?: string
  category?: string
  titleOrSubject?: string
  body?: string
}

type SeedMode = 'add' | 'restore'

interface StarterSeedPlanItem {
  key: string
  kind: Kind
  name: string
  category: string
  title_or_subject: string
  state: 'missing' | 'update_available' | 'current'
  action: 'add' | 'restore' | 'none'
  selectable: boolean
  is_default: boolean
  existing_id?: string | null
  active_duplicate_count: number
  safe_duplicate_count: number
}

interface StarterSeedPlan {
  mode: SeedMode
  items: StarterSeedPlanItem[]
  summary: {
    missing: number
    update_available: number
    current: number
    duplicates: number
    selectable: number
  }
}

/**
 * Templates & Forms — the messages, PDFs, agreements, inspection reports,
 * and sign-off sheets a shop uses every day.
 *
 *   - Email templates    → email_templates (subject + body for sending)
 *   - Document templates → document_templates (printable / PDF / contracts /
 *                          inspections / invoices / etc.)
 *   - Text templates     → sms_templates
 *
 * Default view is a goal-based **Library**: cards grouped by what the member
 * is trying to do (Customer Messages, Work Orders, Estimates & Invoices,
 * Agreements & Signatures, Inspections, Subcontractor Forms…). The original
 * channel-tabbed table lives under **Advanced** for power users.
 */
export function CustomDocumentsPage() {
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem('crewbarn:templates:view') as View) || 'library'
    } catch {
      return 'library'
    }
  })
  const setViewPersist = (nextView: View) => {
    setView(nextView)
    try {
      localStorage.setItem('crewbarn:templates:view', nextView)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-950">Templates &amp; Forms</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Everything CrewBarn sends, prints, or gets signed — organized in the order your jobs actually happen.
          </p>
        </div>
        {view === 'advanced' && (
          <div className="flex items-center gap-2">
            <SeedStarterPackButton />
            <button type="button" onClick={() => setViewPersist('library')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              ← Job-stage library
            </button>
          </div>
        )}
      </div>

      <SeedDefaultsBanner />
      {view === 'library' ? <LibraryView onManageByChannel={() => setViewPersist('advanced')} /> : <AdvancedView />}
    </div>
  )
}
function SeedStarterPackButton() {
  const qc = useQueryClient()
  const [planMode, setPlanMode] = useState<SeedMode | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())

  const invalidateTemplates = () => {
    qc.invalidateQueries({ queryKey: ['email-templates'] })
    qc.invalidateQueries({ queryKey: ['document-templates'] })
    qc.invalidateQueries({ queryKey: ['sms-templates'] })
    qc.invalidateQueries({ queryKey: ['email-templates-count'] })
    qc.invalidateQueries({ queryKey: ['document-templates-count'] })
    qc.invalidateQueries({ queryKey: ['sms-templates-count'] })
    qc.invalidateQueries({ queryKey: ['template-seed-preview'] })
  }

  const preview = useQuery({
    queryKey: ['template-seed-preview', planMode],
    enabled: !!planMode,
    queryFn: () =>
      apiRequest<{ data: StarterSeedPlan }>(`/v1/templates/seed-defaults/preview?mode=${planMode}`),
    staleTime: 0,
  })

  useEffect(() => {
    if (!preview.data?.data || !planMode) return
    setSelectedKeys(new Set(preview.data.data.items.filter((item) => item.selectable).map((item) => item.key)))
  }, [preview.data, planMode])

  const seed = useMutation({
    mutationFn: ({ mode, starter_keys }: { mode: SeedMode; starter_keys: string[] }) =>
      apiRequest<{
        data: {
          email_created: number
          document_created: number
          sms_created: number
          email_updated?: number
          document_updated?: number
          sms_updated?: number
          email_duplicates_disabled?: number
          document_duplicates_disabled?: number
          sms_duplicates_disabled?: number
        }
      }>('/v1/templates/seed-defaults', { method: 'POST', body: { mode, starter_keys } }),
    onSuccess: () => {
      invalidateTemplates()
      setPlanMode(null)
    },
  })

  const result = seed.data?.data
  const changedTotal = result
    ? result.email_created + result.document_created + result.sms_created +
      (result.email_updated ?? 0) + (result.document_updated ?? 0) + (result.sms_updated ?? 0) +
      (result.email_duplicates_disabled ?? 0) + (result.document_duplicates_disabled ?? 0) + (result.sms_duplicates_disabled ?? 0)
    : null

  const plan = preview.data?.data
  const selectedCount = selectedKeys.size

  function openPlan(mode: SeedMode) {
    setPlanMode(mode)
    setSelectedKeys(new Set())
  }

  function toggleKey(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll(selectable: StarterSeedPlanItem[]) {
    setSelectedKeys(new Set(selectable.map((item) => item.key)))
  }

  function applyPlan() {
    if (!planMode || selectedCount === 0) return
    seed.mutate({ mode: planMode, starter_keys: Array.from(selectedKeys) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => openPlan('add')}
          disabled={seed.isPending}
          className="text-sm px-4 py-2 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium disabled:opacity-50"
          title="Reviews missing CrewBarn starter templates before adding them. Existing templates are not overwritten."
        >
          Add missing CrewBarn templates
        </button>
        <button
          type="button"
          onClick={() => openPlan('restore')}
          disabled={seed.isPending}
          className="text-sm px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50"
          title="Reviews CrewBarn starter updates before restoring selected templates. Custom templates are not touched."
        >
          Restore CrewBarn defaults
        </button>
        {changedTotal !== null && (
          <span className="text-xs text-emerald-700 max-w-72">
            {changedTotal === 0 ? 'No selected templates changed.' : `Updated starter library: ${changedTotal} template${changedTotal === 1 ? '' : 's'} changed or deduped.`}
          </span>
        )}
        {seed.isError && (
          <span className="text-xs text-red-700">{(seed.error as Error).message}</span>
        )}
      </div>

      {planMode && (
        <StarterSeedPlanModal
          mode={planMode}
          plan={plan}
          loading={preview.isLoading || preview.isFetching}
          error={preview.isError ? (preview.error as Error).message : seed.isError ? (seed.error as Error).message : null}
          selectedKeys={selectedKeys}
          applying={seed.isPending}
          onToggle={toggleKey}
          onSelectAll={selectAll}
          onApply={applyPlan}
          onClose={() => !seed.isPending && setPlanMode(null)}
        />
      )}
    </div>
  )
}

function StarterSeedPlanModal({
  mode,
  plan,
  loading,
  error,
  selectedKeys,
  applying,
  onToggle,
  onSelectAll,
  onApply,
  onClose,
}: {
  mode: SeedMode
  plan?: StarterSeedPlan
  loading: boolean
  error: string | null
  selectedKeys: Set<string>
  applying: boolean
  onToggle: (key: string) => void
  onSelectAll: (items: StarterSeedPlanItem[]) => void
  onApply: () => void
  onClose: () => void
}) {
  const selectable = plan?.items.filter((item) => item.selectable) ?? []
  const updates = plan?.items.filter((item) => item.state === 'update_available') ?? []
  const visible = mode === 'restore'
    ? plan?.items.filter((item) => item.state !== 'current' || item.active_duplicate_count > 1) ?? []
    : plan?.items.filter((item) => item.state === 'missing' || item.state === 'update_available' || item.active_duplicate_count > 1) ?? []
  const selectedCount = selectedKeys.size
  const title = mode === 'restore' ? 'Restore CrewBarn defaults' : 'Add missing CrewBarn templates'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-navy-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Review the CrewBarn starter templates first. Only checked rows will be changed, and custom templates with non-starter names are left alone.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              Close
            </button>
          </div>
          {plan && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Missing {plan.summary.missing}</span>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-800">Updates {plan.summary.update_available}</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">Current {plan.summary.current}</span>
              {plan.summary.duplicates > 0 && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">Duplicate starter names {plan.summary.duplicates}</span>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Checking starter templates...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : !plan || visible.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
              CrewBarn starters are current. Nothing needs to be added or restored.
            </div>
          ) : (
            <div className="space-y-3">
              {mode === 'add' && updates.length > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  {updates.length} existing starter template{updates.length === 1 ? '' : 's'} also have updates available. Use Restore CrewBarn defaults to update existing starters after reviewing them.
                </div>
              )}
              {visible.map((item) => {
                const checked = selectedKeys.has(item.key)
                return (
                  <label
                    key={item.key}
                    className={`flex gap-3 rounded-lg border p-3 text-sm ${item.selectable ? 'border-slate-200 bg-white hover:border-amber-300' : 'border-slate-200 bg-slate-50 opacity-80'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!item.selectable || applying}
                      onChange={() => onToggle(item.key)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{channelBadge(item.kind).label}</span>
                        {item.is_default && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">default candidate</span>}
                        {item.active_duplicate_count > 1 && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{item.active_duplicate_count} active duplicates</span>}
                        {item.safe_duplicate_count > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{item.safe_duplicate_count} safe to disable</span>}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {item.safe_duplicate_count > 0
                          ? `Will disable ${item.safe_duplicate_count} duplicate CrewBarn starter ${item.safe_duplicate_count === 1 ? 'copy' : 'copies'} and keep one active.`
                          : item.state === 'missing'
                            ? 'Will add this missing CrewBarn starter.'
                            : item.state === 'update_available'
                              ? mode === 'restore'
                                ? 'Will restore this existing starter to the latest CrewBarn default.'
                                : 'Update available; not changed by add-missing.'
                              : 'Already matches the latest CrewBarn starter.'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => onSelectAll(selectable)}
              disabled={selectable.length === 0 || applying}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Select all selectable
            </button>
            <button
              type="button"
              onClick={() => onSelectAll([])}
              disabled={selectedCount === 0 || applying}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{selectedCount} selected</span>
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={selectedCount === 0 || applying}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {applying ? 'Applying...' : mode === 'restore' ? 'Restore selected' : 'Add selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
// ================= LIBRARY (goal-based) =================

type Kind = 'email' | 'document' | 'sms'
interface LibRow extends ListRow {
  kind: Kind
  is_starter?: boolean
  starter_status?: 'current' | 'update_available'
}

const GOAL_GROUPS = [
  { key: 'before_job', step: '1', label: 'Before the job', blurb: 'Winning the work and keeping the customer informed' },
  { key: 'agreements', step: '2', label: 'Agreements & contracts', blurb: 'Signed before work begins' },
  { key: 'on_job', step: '3', label: 'On the job', blurb: 'What technicians and partners work from' },
  { key: 'closing_out', step: '4', label: 'Closing out', blurb: 'Proof, inspections, and customer sign-off' },
  { key: 'getting_paid', step: '5', label: 'Getting paid', blurb: 'Invoices, payment reminders, and receipts' },
] as const

type GoalKey = (typeof GOAL_GROUPS)[number]['key']

type WorkflowMoment = {
  id: string
  stage: GoalKey
  title: string
  detail: string
  signable?: boolean
  channels: Array<{ kind: Kind; category: string; aliases: string[] }>
}

// This is the customer-facing job flow. A moment owns the three ways it may
// be delivered (PDF, email, text); individual template records are attached
// to those slots below rather than rendered as separate cards.
const WORKFLOW_MOMENTS: WorkflowMoment[] = [
  { id: 'estimate', stage: 'before_job', title: 'Estimate', detail: 'The quote, and the note that sends it', channels: [
    { kind: 'document', category: 'estimate', aliases: ['estimate'] }, { kind: 'email', category: 'estimate', aliases: ['estimate'] }, { kind: 'sms', category: 'estimate', aliases: ['estimate'] },
  ] },
  { id: 'appointment', stage: 'before_job', title: 'Appointment reminder', detail: 'Day-before and on-the-way', channels: [
    { kind: 'email', category: 'appointment', aliases: ['appointment', 'reminder', 'on the way'] }, { kind: 'sms', category: 'appointment', aliases: ['appointment', 'reminder', 'on the way'] },
  ] },
  { id: 'service-agreement', stage: 'agreements', title: 'Service agreement', detail: 'Standard terms for one job', signable: true, channels: [
    { kind: 'document', category: 'contract', aliases: ['service agreement', 'agreement'] }, { kind: 'email', category: 'job', aliases: ['service agreement', 'agreement'] },
  ] },
  { id: 'work-authorization', stage: 'agreements', title: 'Work authorization', detail: 'Customer approves scope and price before you start', signable: true, channels: [
    { kind: 'document', category: 'contract', aliases: ['work authorization', 'authorization'] }, { kind: 'email', category: 'job', aliases: ['work authorization', 'authorization'] }, { kind: 'sms', category: 'job', aliases: ['work authorization', 'authorization'] },
  ] },
  { id: 'change-order', stage: 'agreements', title: 'Change order', detail: 'Scope grew mid-job — get it in writing', signable: true, channels: [
    { kind: 'document', category: 'contract', aliases: ['change order'] }, { kind: 'email', category: 'job', aliases: ['change order'] },
  ] },
  { id: 'work-order', stage: 'on_job', title: 'Work order', detail: 'The job sheet in the tech’s hands', channels: [{ kind: 'document', category: 'work_order', aliases: ['work order'] }] },
  { id: 'sub-work-order', stage: 'on_job', title: 'Subcontractor work order', detail: 'When you hand work to a partner', channels: [
    { kind: 'document', category: 'sub_work_order', aliases: ['subcontractor work order', 'sub work order'] }, { kind: 'email', category: 'job', aliases: ['subcontractor work order', 'sub work order'] },
  ] },
  { id: 'completion', stage: 'closing_out', title: 'Completion sign-off', detail: 'Customer agrees the work is done right', signable: true, channels: [{ kind: 'document', category: 'inspection', aliases: ['completion sign-off', 'completion sign off'] }] },
  { id: 'inspection', stage: 'closing_out', title: 'Inspection report', detail: 'Checklist + photos as one PDF', channels: [
    { kind: 'document', category: 'inspection', aliases: ['inspection report', 'inspection'] }, { kind: 'email', category: 'job', aliases: ['inspection report', 'inspection'] },
  ] },
  { id: 'invoice', stage: 'getting_paid', title: 'Invoice', detail: 'Print it, email it, or text the pay link', channels: [
    { kind: 'document', category: 'invoice', aliases: ['invoice'] }, { kind: 'email', category: 'invoice', aliases: ['invoice'] }, { kind: 'sms', category: 'invoice', aliases: ['invoice'] },
  ] },
  { id: 'receipt', stage: 'getting_paid', title: 'Receipt', detail: 'Sent the second a payment lands', channels: [
    { kind: 'document', category: 'receipt', aliases: ['receipt'] }, { kind: 'email', category: 'receipt', aliases: ['receipt'] }, { kind: 'sms', category: 'receipt', aliases: ['receipt'] },
  ] },
  { id: 'past-due', stage: 'getting_paid', title: 'Past-due reminder', detail: 'Nudge at 15, 30, and 45 days', channels: [
    { kind: 'email', category: 'invoice', aliases: ['past due', 'overdue', 'payment reminder'] }, { kind: 'sms', category: 'invoice', aliases: ['past due', 'overdue', 'payment reminder'] },
  ] },
]
/** Map the existing template type/category into the customer-facing job lifecycle. */
function goalGroupOf(row: LibRow): GoalKey {
  const cat = (row.type ?? row.category ?? 'general').toLowerCase()
  const name = row.name.toLowerCase()

  if (cat === 'invoice' || cat === 'receipt' || name.includes('past due') || name.includes('payment reminder')) {
    return 'getting_paid'
  }
  if (cat === 'contract' || name.includes('agreement') || name.includes('authorization') || name.includes('change order')) {
    return 'agreements'
  }
  if (cat === 'work_order' || cat === 'sub_work_order') return 'on_job'
  if (cat === 'inspection' || row.kind === 'document' || name.includes('sign-off') || name.includes('completion')) {
    return 'closing_out'
  }
  return 'before_job'
}
/** Short plain-English "what this is for" line per category/type. */
const USE_CASE: Record<string, string> = {
  invoice: 'Bill the customer for completed work.',
  estimate: 'Quote a job before it starts.',
  receipt: 'Proof of payment after a job is paid.',
  work_order: 'The work order your tech works from on site.',
  sub_work_order: 'Dispatch work to a subcontractor or vendor partner.',
  inspection: 'On-site checklist / inspection report.',
  contract: 'Service agreement the customer signs.',
  appointment: 'Confirm or remind about an appointment.',
  warranty: 'Warranty coverage communication.',
  job: 'Job-related customer message.',
  marketing: 'Promotion or re-engagement message.',
  general: 'General-purpose template.',
}

function isSignable(row: LibRow): boolean {
  if ((row.type ?? '').toLowerCase() === 'contract') return true
  return row.merge_tags.some((t) => /signature/i.test(t))
}

function recommendedTags(row: Pick<LibRow, 'kind' | 'category' | 'type'>): string[] {
  const cat = (row.type ?? row.category ?? 'general').toLowerCase()
  if (row.kind === 'document') {
    switch (cat) {
      case 'invoice': return ['invoice.number', 'billing_customer.name', 'products.total']
      case 'estimate': return ['job.number', 'customer.name', 'products.total']
      case 'work_order': return ['job.number', 'customer.name', 'service_location.full_address']
      case 'contract': return ['customer.name', 'job.description']
      case 'inspection': return ['job.number', 'customer.name', 'technician.name']
      case 'receipt': return ['invoice.number', 'payment.method', 'products.total']
      default: return ['customer.name', 'company.name']
    }
  }
  switch (cat) {
    case 'invoice': return ['customer.first_name', 'invoice.number', 'invoice.pay_link']
    case 'estimate': return ['customer.first_name', 'job.address', 'portal.url']
    case 'appointment': return ['customer.first_name', 'appointment.at', 'job.address']
    case 'job': return ['customer.first_name', 'job.address', 'company.phone']
    default: return ['customer.first_name', 'company.name']
  }
}

function missingRecommendedTags(row: LibRow): string[] {
  const existing = new Set(row.merge_tags)
  return recommendedTags(row).filter((tag) => !existing.has(tag))
}

function starterMap(starters: Starter[]): Map<string, Starter> {
  return new Map(starters.map((s) => [s.name.trim().toLowerCase(), s]))
}

function channelBadge(kind: Kind): { label: string; cls: string } {
  switch (kind) {
    case 'email':
      return { label: 'Email', cls: 'bg-indigo-100 text-indigo-700' }
    case 'sms':
      return { label: 'SMS', cls: 'bg-sky-100 text-sky-700' }
    case 'document':
      return { label: 'PDF', cls: 'bg-slate-200 text-slate-700' }
  }
}

type WorkflowRow = {
  moment: WorkflowMoment
  slots: Partial<Record<Kind, LibRow>>
}

function rowText(row: LibRow) {
  return [row.name, row.subject, row.title, row.body].filter(Boolean).join(' ').toLowerCase()
}

function categoryOf(row: LibRow) {
  return (row.type ?? row.category ?? 'general').toLowerCase()
}
function LibraryView({ onManageByChannel }: { onManageByChannel: () => void }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  // SMS edit/create happen in a modal (no route), lifted here so cards work.
  const [smsEditingId, setSmsEditingId] = useState<string | null>(null)
  const [smsDraft, setSmsDraft] = useState<InitialDraft | null>(null)
  const [aiKind, setAiKind] = useState<Kind | null>(null)
  const emailStarters = useStarters('email').data ?? []
  const documentStarters = useStarters('document').data ?? []
  const smsStarters = useStarters('sms').data ?? []

  const emails = useQuery({
    queryKey: ['email-templates', { search: '', filterCategory: '', active: true }],
    queryFn: () => apiRequest<{ data: ListRow[] }>('/v1/email-templates?active=true'),
  })
  const docs = useQuery({
    queryKey: ['document-templates', { search: '', filterType: '', active: true }],
    queryFn: () => apiRequest<{ data: ListRow[] }>('/v1/document-templates?active=true'),
  })
  const sms = useQuery({
    queryKey: ['sms-templates', { search: '', filterCategory: '', active: true }],
    queryFn: () => apiRequest<{ data: ListRow[] }>('/v1/sms-templates?active=true'),
  })

  const rows: LibRow[] = useMemo(() => {
    const startersByName: Record<Kind, Map<string, Starter>> = {
      email: starterMap(emailStarters),
      document: starterMap(documentStarters),
      sms: starterMap(smsStarters),
    }
    const tag = (arr: ListRow[] | undefined, kind: Kind): LibRow[] =>
      (arr ?? []).map((r) => {
        const starter = startersByName[kind].get(r.name.trim().toLowerCase())
        const isStarter = !!starter
        const starterStatus = isStarter && r.starter_signature && starter?.starter_signature
          ? r.starter_signature === starter.starter_signature ? 'current' : 'update_available'
          : undefined

        return {
          ...r,
          kind,
          is_starter: isStarter,
          starter_status: starterStatus,
        }
      })
    const all = [
      ...tag(emails.data?.data, 'email'),
      ...tag(docs.data?.data, 'document'),
      ...tag(sms.data?.data, 'sms'),
    ]
    return all
  }, [emails.data, docs.data, sms.data, emailStarters, documentStarters, smsStarters])

  const duplicates = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const row of rows) {
      if (!row.active) continue
      const key = `${row.kind}:${row.name.trim().toLowerCase()}`
      const current = counts.get(key) ?? {
        label: `${channelBadge(row.kind).label}: ${row.name}`,
        count: 0,
      }
      current.count += 1
      counts.set(key, current)
    }
    return Array.from(counts.values()).filter((entry) => entry.count > 1)
  }, [rows])

  const workflowRows = useMemo(() => {
    const used = new Set<string>()
    const take = (slot: WorkflowMoment['channels'][number]) => {
      const candidates = rows.filter((row) => row.kind === slot.kind && !used.has(`${row.kind}:${row.id}`))
      const exact = candidates.find((row) => slot.aliases.some((alias) => rowText(row).includes(alias)))
      // Category is a safe fallback only if it identifies one remaining record.
      const categoryMatches = candidates.filter((row) => categoryOf(row) === slot.category)
      const match = exact ?? (categoryMatches.length === 1 ? categoryMatches[0] : undefined)
      if (match) used.add(`${match.kind}:${match.id}`)
      return match
    }

    const standard = WORKFLOW_MOMENTS.map((moment) => ({
      moment,
      slots: Object.fromEntries(moment.channels.map((slot) => [slot.kind, take(slot)])) as Partial<Record<Kind, LibRow>>,
    }))
    const extras: WorkflowRow[] = rows
      .filter((row) => !used.has(`${row.kind}:${row.id}`))
      .map((row) => ({
        moment: {
          id: `custom-${row.kind}-${row.id}`,
          stage: goalGroupOf(row),
          title: row.name,
          detail: USE_CASE[categoryOf(row)] ?? 'Custom reusable template.',
          channels: [{ kind: row.kind, category: categoryOf(row), aliases: [row.name.toLowerCase()] }],
        },
        slots: { [row.kind]: row },
      }))
    return [...standard, ...extras]
  }, [rows])

  const visibleWorkflowRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return workflowRows
    return workflowRows.filter((item) => [
      item.moment.title,
      item.moment.detail,
      ...Object.values(item.slots).filter(Boolean).flatMap((row) => [row!.name, row!.subject, row!.title, row!.body]),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
  }, [workflowRows, search])
  const grouped = useMemo(() => {
    const map = new Map<GoalKey, WorkflowRow[]>()
    for (const item of visibleWorkflowRows) {
      const list = map.get(item.moment.stage) ?? []
      list.push(item)
      map.set(item.moment.stage, list)
    }
    return map
  }, [workflowRows])

  const loading = emails.isLoading || docs.isLoading || sms.isLoading
  const total = workflowRows.length
  const readyCount = workflowRows.filter((item) => item.moment.channels.every((slot) => Boolean(item.slots[slot.kind]))).length
  const missingSlots = workflowRows.flatMap((item) => item.moment.channels.filter((slot) => !item.slots[slot.kind]))
  const signableNeedsSetup = workflowRows.filter((item) => item.moment.signable && !Object.values(item.slots).some((row) => row && isSignable(row))).length
  const starterUpdates = rows.filter((row) => row.starter_status === 'update_available').length
  const readinessPercent = total > 0 ? Math.round((readyCount / total) * 100) : 0

  function newDraft(moment: WorkflowMoment, slot: WorkflowMoment['channels'][number]) {
    const body = `Hi {{customer.first_name}},\n\n{{company.name}} has an update about {{job.number}}.\n\n{{company.phone}}`
    const draft: InitialDraft = {
      name: moment.title,
      category: slot.category,
      titleOrSubject: `${moment.title} — {{job.number}}`,
      body: slot.kind === 'document' ? `# ${moment.title}\n\nCustomer: {{customer.name}}\n\nJob: {{job.number}}\n\n{{job.description}}${moment.signable ? '\n\n[[signature:customer]]' : ''}` : body,
    }
    if (slot.kind === 'sms') {
      setSmsEditingId(null)
      setSmsDraft(draft)
      return
    }
    sessionStorage.setItem('tpl-draft', JSON.stringify({ kind: slot.kind, draft }))
    navigate(`/custom-documents/${slot.kind}/new`)
  }
  function openRow(row: LibRow) {
    if (row.kind === 'sms') {
      setSmsDraft(null)
      setSmsEditingId(row.id)
    } else {
      navigate(`/custom-documents/${row.kind}/${row.id}`)
    }
  }

  return (
    <div className="mt-6">
      <div className="absolute right-4 top-7 flex items-center gap-2 sm:right-6">
        <KindMenu label="Draft with AI" ghost onPick={(kind) => setAiKind(kind)} />
        <KindMenu
          label="+ New template"
          onPick={(kind) => {
            if (kind === 'sms') {
              setSmsEditingId(null)
              setSmsDraft({})
            } else {
              navigate(`/custom-documents/${kind}/new`)
            }
          }}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-3.5">
          <h2 className="text-sm font-extrabold text-navy-950">CrewBarn pack · {readyCount} of {total} ready to use</h2>
          <div className="min-w-[180px] flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${readinessPercent}%` }} />
            </div>
          </div>
          <span className="text-xs text-slate-500">Seeded from your starter pack</span>
        </div>
        <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          <ReadinessAlert title={duplicates.length > 0 ? `${duplicates.length} duplicate template name${duplicates.length === 1 ? '' : 's'}` : 'Template names look good'} detail={duplicates.length > 0 ? 'Pick the keeper and disable leftover copies' : 'No active duplicates found'} action="Review" tone={duplicates.length > 0 ? 'warn' : 'good'} onClick={onManageByChannel} />
          <ReadinessAlert title={signableNeedsSetup > 0 ? `${signableNeedsSetup} agreement${signableNeedsSetup === 1 ? '' : 's'} need a signer` : 'Agreement signatures are ready'} detail={signableNeedsSetup > 0 ? 'Add a signature block before sending' : 'Signed workflows have a signature field'} action="Set up" tone={signableNeedsSetup > 0 ? 'warn' : 'good'} onClick={onManageByChannel} />
          <ReadinessAlert title={missingSlots.length > 0 ? `${missingSlots.length} channel slot${missingSlots.length === 1 ? '' : 's'} not added` : 'All workflow channels are covered'} detail={starterUpdates > 0 ? `${starterUpdates} starter update${starterUpdates === 1 ? '' : 's'} available` : 'Add only the channels your shop uses'} action={starterUpdates > 0 ? 'Finish' : 'Manage'} tone={missingSlots.length > 0 ? 'info' : 'good'} onClick={onManageByChannel} />
        </div>
      </section>

      <div className="mt-5 flex items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
        <div className="relative min-w-[260px] flex-1">
          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>⌕</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={'Search — "invoice", "agreement", "{{customer.name}}"…'} className="w-full border-0 bg-transparent py-3.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-0" />
        </div>
        <span className="hidden text-xs text-slate-400 sm:inline">Searches names, bodies, and merge tags</span>
      </div>
      {loading && <div className="py-14 text-center text-sm text-slate-500">Loading templates…</div>}

      {!loading && visibleWorkflowRows.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          {search.trim() ? 'No templates match your search.' : 'No templates yet. Add the CrewBarn starter pack or create a new template.'}
        </div>
      )}

      {!loading && total > 0 && (
        <div className="mt-6 space-y-6">
          {GOAL_GROUPS.map((group) => {
            const items = grouped.get(group.key) ?? []
            if (items.length === 0) return null
            return (
              <section key={group.key}>
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold text-white ${group.key === 'agreements' ? 'bg-emerald-600' : 'bg-navy-950'}`}>{group.step}</span>
                  <h2 className="text-base font-extrabold text-navy-950">{group.label}</h2>
                  <span className="text-xs text-slate-400">{group.blurb}</span>
                  <span className="ml-auto text-xs font-semibold text-slate-400">{items.length}</span>
                </div>
                <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {items.map((item) => <WorkflowMomentRow key={item.moment.id} item={item} onOpen={openRow} onAdd={newDraft} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {/* SMS editor modal (cards can't route to it) */}
      {(smsEditingId || smsDraft) && (
        <SmsTemplateEditor
          templateId={smsEditingId}
          initialDraft={
            smsDraft
              ? { name: smsDraft.name, category: smsDraft.category, body: smsDraft.body }
              : undefined
          }
          categories={SMS_CATEGORIES}
          invalidateKey={['sms-templates']}
          onClose={() => {
            setSmsEditingId(null)
            setSmsDraft(null)
          }}
        />
      )}

      {/* AI draft modals */}
      {aiKind && aiKind !== 'sms' && (
        <AiGenerateTemplateModal
          kind={aiKind}
          categories={aiKind === 'email' ? EMAIL_CATEGORIES : DOC_TYPES}
          onClose={() => setAiKind(null)}
          onAccept={(draft) => {
            const kind = aiKind
            setAiKind(null)
            sessionStorage.setItem('tpl-draft', JSON.stringify({ kind, draft }))
            navigate(`/custom-documents/${kind}/new`)
          }}
        />
      )}
      {aiKind === 'sms' && (
        <AiGenerateSmsModal
          categories={SMS_CATEGORIES}
          onClose={() => setAiKind(null)}
          onAccept={(draft) => {
            setAiKind(null)
            setSmsEditingId(null)
            setSmsDraft(draft)
          }}
        />
      )}
    </div>
  )
}

function ReadinessAlert({ title, detail, action, tone, onClick }: {
  title: string
  detail: string
  action: string
  tone: 'good' | 'warn' | 'info'
  onClick: () => void
}) {
  const dot = tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-sky-500'
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-navy-950">{title}</span>
        <span className="block truncate text-[11px] text-slate-500">{detail}</span>
      </span>
      <button type="button" onClick={onClick} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        {action}
      </button>
    </div>
  )
}function WorkflowMomentRow({ item, onOpen, onAdd }: {
  item: WorkflowRow
  onOpen: (row: LibRow) => void
  onAdd: (moment: WorkflowMoment, slot: WorkflowMoment['channels'][number]) => void
}) {
  const slots = new Map(item.moment.channels.map((slot) => [slot.kind, slot]))
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-[210px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-navy-950">{item.moment.title}</span>
          {item.moment.signable && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">✍ Signed</span>}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{item.moment.detail}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {(['document', 'email', 'sms'] as Kind[]).map((kind) => {
          const slot = slots.get(kind)
          if (!slot) return null
          const row = item.slots[kind]
          const badge = channelBadge(kind)
          if (row) {
            return <button key={kind} type="button" onClick={() => onOpen(row)} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition hover:brightness-95 ${badge.cls}`} title={`Edit ${row.name}`}>{kind === 'document' ? '📄' : kind === 'email' ? '✉' : '💬'} {badge.label}</button>
          }
          return <button key={kind} type="button" onClick={() => onAdd(item.moment, slot)} className="rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800">+ Add</button>
        })}
      </div>
    </div>
  )
}
/** Small kind-picker popover used by the "New" + "AI draft" buttons. */
function KindMenu({
  label,
  ghost,
  onPick,
}: {
  label: string
  ghost?: boolean
  onPick: (kind: Kind) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const items: { kind: Kind; label: string }[] = [
    { kind: 'email', label: 'Email' },
    { kind: 'document', label: 'Document / PDF' },
    { kind: 'sms', label: 'Text (SMS)' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          ghost
            ? 'text-sm px-4 py-2 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium'
            : 'text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium'
        }
      >
        {label} ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 w-44 bg-white border border-slate-200 rounded-md shadow-lg py-1">
          {items.map((it) => (
            <button
              key={it.kind}
              type="button"
              onClick={() => {
                setOpen(false)
                onPick(it.kind)
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ================= ADVANCED (channel-tabbed table) =================

function AdvancedView() {
  const [tab, setTab] = useState<Tab>('email')
  return (
    <div>
      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200 flex gap-1">
        <TabButton active={tab === 'email'} onClick={() => setTab('email')}>
          Email templates
        </TabButton>
        <TabButton active={tab === 'document'} onClick={() => setTab('document')}>
          Document templates
        </TabButton>
        <TabButton active={tab === 'sms'} onClick={() => setTab('sms')}>
          Text (SMS) templates
        </TabButton>
      </div>

      {tab === 'email' && <EmailPanel />}
      {tab === 'document' && <DocumentPanel />}
      {tab === 'sms' && <SmsPanel />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative px-4 py-2.5 text-sm font-medium transition-colors',
        active ? 'text-navy-900' : 'text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {children}
      {active && <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-500" />}
    </button>
  )
}

// -------- Email panel --------

function EmailPanel() {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showAi, setShowAi] = useState(false)
  const navigate = useNavigate()

  const list = useQuery({
    queryKey: ['email-templates', { search, filterCategory }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (filterCategory) params.set('category', filterCategory)
      return apiRequest<{ data: ListRow[] }>(
        '/v1/email-templates' + (params.toString() ? `?${params}` : ''),
      )
    },
  })

  return (
    <div className="mt-5">
      <Toolbar
        search={search}
        setSearch={setSearch}
        filter={filterCategory}
        setFilter={setFilterCategory}
        filterOptions={EMAIL_CATEGORIES}
        filterLabel="All categories"
        onNew={() => navigate('/custom-documents/email/new')}
        onAiNew={() => setShowAi(true)}
        newLabel="+ New email template"
      />

      <ListTable
        kind="email"
        list={list}
        emptyHint="No email templates yet. Click + New email template to build one by hand, or ✨ AI Generate to describe what you want."
        titleCol="Subject"
        titleField="subject"
        categoryCol="Category"
        categoryField="category"
        onRowClick={(id) => navigate(`/custom-documents/email/${id}`)}
      />

      {showAi && (
        <AiGenerateTemplateModal
          kind="email"
          categories={EMAIL_CATEGORIES}
          onClose={() => setShowAi(false)}
          onAccept={(draft) => {
            setShowAi(false)
            // Stash the AI-generated draft in sessionStorage so the
            // editor page can pick it up on first render.
            sessionStorage.setItem('tpl-draft', JSON.stringify({ kind: 'email', draft }))
            navigate('/custom-documents/email/new')
          }}
        />
      )}
    </div>
  )
}

// -------- Document panel --------

function DocumentPanel() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showAi, setShowAi] = useState(false)
  const navigate = useNavigate()

  const list = useQuery({
    queryKey: ['document-templates', { search, filterType }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (filterType) params.set('type', filterType)
      return apiRequest<{ data: ListRow[] }>(
        '/v1/document-templates' + (params.toString() ? `?${params}` : ''),
      )
    },
  })

  return (
    <div className="mt-5">
      <Toolbar
        search={search}
        setSearch={setSearch}
        filter={filterType}
        setFilter={setFilterType}
        filterOptions={DOC_TYPES}
        filterLabel="All types"
        onNew={() => navigate('/custom-documents/document/new')}
        onAiNew={() => setShowAi(true)}
        newLabel="+ New document template"
      />

      <ListTable
        kind="document"
        list={list}
        emptyHint="No document templates yet. Click + New to build a contract / inspection / invoice by hand, or ✨ AI Generate to describe what you want."
        titleCol="Title"
        titleField="title"
        categoryCol="Type"
        categoryField="type"
        onRowClick={(id) => navigate(`/custom-documents/document/${id}`)}
      />

      {showAi && (
        <AiGenerateTemplateModal
          kind="document"
          categories={DOC_TYPES}
          onClose={() => setShowAi(false)}
          onAccept={(draft) => {
            setShowAi(false)
            sessionStorage.setItem('tpl-draft', JSON.stringify({ kind: 'document', draft }))
            navigate('/custom-documents/document/new')
          }}
        />
      )}
    </div>
  )
}

// -------- SMS panel --------

function SmsPanel() {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creatingDraft, setCreatingDraft] = useState<InitialDraft | null>(null)
  const [showAi, setShowAi] = useState(false)

  const list = useQuery({
    queryKey: ['sms-templates', { search, filterCategory }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (filterCategory) params.set('category', filterCategory)
      return apiRequest<{ data: ListRow[] }>(
        '/v1/sms-templates' + (params.toString() ? `?${params}` : ''),
      )
    },
  })

  const editorOpen = !!editingId || !!creatingDraft

  return (
    <div className="mt-5">
      <Toolbar
        search={search}
        setSearch={setSearch}
        filter={filterCategory}
        setFilter={setFilterCategory}
        filterOptions={SMS_CATEGORIES}
        filterLabel="All categories"
        onNew={() => {
          setEditingId(null)
          setCreatingDraft({})
        }}
        onAiNew={() => setShowAi(true)}
        newLabel="+ New SMS template"
      />

      <ListTable
        kind="sms"
        list={list}
        emptyHint="No SMS templates yet. Click + New SMS template to write one, or ✨ AI Generate to describe the text you want."
        titleCol="Message"
        titleField="body"
        categoryCol="Category"
        categoryField="category"
        onRowClick={(id) => {
          setEditingId(id)
          setCreatingDraft(null)
        }}
      />

      {editorOpen && (
        <SmsTemplateEditor
          templateId={editingId}
          initialDraft={
            creatingDraft
              ? { name: creatingDraft.name, category: creatingDraft.category, body: creatingDraft.body }
              : undefined
          }
          categories={SMS_CATEGORIES}
          invalidateKey={['sms-templates']}
          onClose={() => {
            setEditingId(null)
            setCreatingDraft(null)
          }}
        />
      )}

      {showAi && (
        <AiGenerateSmsModal
          categories={SMS_CATEGORIES}
          onClose={() => setShowAi(false)}
          onAccept={(draft) => {
            setShowAi(false)
            setEditingId(null)
            setCreatingDraft(draft)
          }}
        />
      )}
    </div>
  )
}

// -------- shared UI --------

function Toolbar({
  search,
  setSearch,
  filter,
  setFilter,
  filterOptions,
  filterLabel,
  onNew,
  onAiNew,
  newLabel,
}: {
  search: string
  setSearch: (s: string) => void
  filter: string
  setFilter: (s: string) => void
  filterOptions: { value: string; label: string }[]
  filterLabel: string
  onNew: () => void
  onAiNew: () => void
  newLabel: string
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or title…"
          className="text-sm px-3 py-2 border border-slate-300 rounded-md w-72"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm px-3 py-2 border border-slate-300 rounded-md"
        >
          <option value="">{filterLabel}</option>
          {filterOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAiNew}
          className="text-sm px-4 py-2 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium"
          title="Describe what you want — AI drafts a starting point"
        >
          ✨ AI Generate
        </button>
        <button
          type="button"
          onClick={onNew}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
        >
          {newLabel}
        </button>
      </div>
    </div>
  )
}

function ListTable({
  kind,
  list,
  emptyHint,
  titleCol,
  titleField,
  categoryCol,
  categoryField,
  onRowClick,
}: {
  kind: Kind
  list: ReturnType<typeof useQuery<{ data: ListRow[] }>>
  emptyHint: string
  titleCol: string
  titleField: 'subject' | 'title' | 'body'
  categoryCol: string
  categoryField: 'category' | 'type'
  onRowClick: (id: string) => void
}) {
  return (
    <div className="mt-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
      {list.isLoading && (
        <div className="px-6 py-12 text-center text-sm text-slate-500">Loading…</div>
      )}
      {!list.isLoading && (list.data?.data?.length ?? 0) === 0 && (
        <div className="px-6 py-12 text-center text-sm text-slate-500">{emptyHint}</div>
      )}
      {(list.data?.data?.length ?? 0) > 0 && (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">{categoryCol}</th>
              <th className="text-left px-4 py-2.5">{titleCol}</th>
              <th className="text-left px-4 py-2.5">Tags</th>
              <th className="text-left px-4 py-2.5">Workflow</th>
              <th className="text-right px-4 py-2.5">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data!.data.map((t) => {
              const row = { ...t, kind } as LibRow
              const missing = missingRecommendedTags(row)
              const warnForMissing = missing.length > 0 && !!t.active && !!t.is_default
              return (
                <tr
                  key={t.id}
                  onClick={() => onRowClick(t.id)}
                  className="cursor-pointer hover:bg-amber-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 text-slate-600">{(t as any)[categoryField]}</td>
                  <td className="px-4 py-3 text-slate-700 truncate max-w-md">{(t as any)[titleField]}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                    {t.merge_tags.length === 0 ? '-' : t.merge_tags.slice(0, 3).join(', ')}
                    {t.merge_tags.length > 3 && ` +${t.merge_tags.length - 3}`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {warnForMissing ? (
                      <span className="text-amber-700">Default missing {missing.length}</span>
                    ) : t.is_default ? (
                      <span className="inline-flex rounded px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                        Default
                      </span>
                    ) : missing.length > 0 ? (
                      <span className="text-slate-500">Optional {missing.length}</span>
                    ) : (
                      <span className="text-emerald-700">Ready</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.active ? (
                      <span className="text-emerald-700 text-xs">●</span>
                    ) : (
                      <span className="text-slate-300 text-xs">○</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}


// -------- seed-defaults banner --------

function SeedDefaultsBanner() {
  const qc = useQueryClient()
  const emails = useQuery({
    queryKey: ['email-templates-count'],
    queryFn: () => apiRequest<{ data: unknown[] }>('/v1/email-templates'),
    staleTime: 30_000,
  })
  const docs = useQuery({
    queryKey: ['document-templates-count'],
    queryFn: () => apiRequest<{ data: unknown[] }>('/v1/document-templates'),
    staleTime: 30_000,
  })
  const sms = useQuery({
    queryKey: ['sms-templates-count'],
    queryFn: () => apiRequest<{ data: unknown[] }>('/v1/sms-templates'),
    staleTime: 30_000,
  })
  const [dismissed, setDismissed] = useState(false)

  const totalSaved = useMemo(
    () =>
      (emails.data?.data?.length ?? 0) +
      (docs.data?.data?.length ?? 0) +
      (sms.data?.data?.length ?? 0),
    [emails.data, docs.data, sms.data],
  )
  const isEmpty =
    !emails.isLoading && !docs.isLoading && !sms.isLoading && totalSaved === 0

  const seed = useMutation({
    mutationFn: () =>
      apiRequest<{
        data: { email_created: number; document_created: number; sms_created: number }
      }>('/v1/templates/seed-defaults', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] })
      qc.invalidateQueries({ queryKey: ['document-templates'] })
      qc.invalidateQueries({ queryKey: ['sms-templates'] })
      qc.invalidateQueries({ queryKey: ['email-templates-count'] })
      qc.invalidateQueries({ queryKey: ['document-templates-count'] })
      qc.invalidateQueries({ queryKey: ['sms-templates-count'] })
    },
  })

  if (!isEmpty || dismissed) return null

  return (
    <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-4">
      <div className="text-3xl">📥</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-amber-900">
          Start with a set of pre-designed templates
        </h3>
        <p className="text-xs text-amber-800 mt-1 leading-relaxed">
          Drop in a full core pack — invoices, receipts, estimates, work orders,
          completion sign-offs, NTE authorizations, agreements, inspection &amp; photo
          reports, warranty certificates, plus ready-to-send email &amp; text templates.
          All editable and grouped by use case. Use them as-is or customize — re-running
          is safe (it only adds what's missing).
        </p>
        {seed.isError && (
          <p className="text-xs text-red-700 mt-2">
            {(seed.error as Error).message}
          </p>
        )}
        {seed.data?.data && (
          <p className="text-xs text-emerald-700 mt-2 font-medium">
            ✓ Created {seed.data.data.document_created} document templates +{' '}
            {seed.data.data.email_created} email templates +{' '}
            {seed.data.data.sms_created} text templates.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
        >
          {seed.isPending ? 'Adding…' : '📥 Add starter pack'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[11px] text-slate-600 hover:text-slate-900 underline"
        >
          No thanks
        </button>
      </div>
    </div>
  )
}
