import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import { IconChecklist, IconFileInvoice, IconPaperclip, IconSignature } from '@tabler/icons-react'
import { useSearchParams } from 'react-router-dom'
import { useFormDrafts, newDraftId, type FormDraft } from '@/hooks/useFormDrafts'
import { TimeField } from '@/components/TimeField'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { Customer, CustomerServiceLocation } from '@/types/customer'
import type {
  WorkOrder,
  WorkOrderInput,
  WorkOrderPriority,
} from '@/types/workOrder'
import type { WorkOrderLineItemDraft } from '@/types/workOrderLineItem'
import { useJobTypes } from '@/hooks/useJobTypes'
import { useJobStatuses } from '@/hooks/useJobStatuses'
import { useCustomer, useCustomers } from '@/hooks/useCustomers'
import { getCustomer, listCustomers } from '@/lib/customers'
import { CustomerPicker } from '@/components/CustomerPicker'
import { AutoTextarea } from '@/components/AutoTextarea'
import { LocationPickerModal } from '@/components/LocationPickerModal'
import { InlineQuickAddCustomer, type InlineQuickAddCustomerDraft, type InlineQuickAddCustomerHandle } from '@/components/InlineQuickAddCustomer'
import { TenantAccountPicker } from '@/components/TenantAccountPicker'
import { useTenantAccounts } from '@/hooks/useTenantAccounts'
import type { TenantAccount } from '@/lib/tenantAccounts'
import { WorkOrderLineItemEditorBuffered } from '@/components/WorkOrderLineItemEditorBuffered'
import { CustomerAssetsPickerModal } from '@/components/CustomerAssetsPickerModal'
import { EstimateLineItemEditorBuffered } from '@/components/EstimateLineItemEditorBuffered'
import { useAssets } from '@/hooks/useAssets'
import type { EstimateLineItemDraft } from '@/types/estimateLineItem'
import { CustomFieldsSection, type CustomValues } from '@/components/CustomFieldsSection'
import { CreateFormPdfPicker, type ExtractedContent } from '@/components/workorders/CreateFormPdfPicker'
import {
  CreateFormAttachmentsPicker,
  type DraftAttachment,
} from '@/components/workorders/CreateFormAttachmentsPicker'
import type { AiIntakeDraft } from '@/lib/comms'
import { Modal } from '@/components/ui/Modal'
import { SavedDraftPanel } from '@/components/forms/SavedDraftPanel'

/**
 * WorkOrderForm — create + edit work orders.
 *
 * Service location pattern (locked Day 6, modal redesign):
 *   - On customer pick, auto-select the customer's primary location (or first
 *     if no primary). Display as "Service Location: 123 Main St (primary) [Change]".
 *   - "Change" opens LocationPickerModal -- list of saved locations + "+ Add new".
 *   - Adding a new location inside the modal POSTs immediately, attaches to
 *     the customer, and returns the new id. Form just receives an id.
 *   - Customer with zero locations -> inline "+ Add a service location" prompt
 *     opens the modal directly to add view.
 *
 * Submit contract: onSubmit(input, drafts). By submit time, input.service_location_id
 * always references a real, persisted location. No nested-create orchestration.
 */

export type WorkOrderFormKind = 'job' | 'estimate'

type JobSetupPanel = 'signable' | 'customer-pdf' | 'attachments' | 'inspection' | null

export interface EstimateCreateFromFormInput {
  customer_id: string
  customer_service_location_id: string | null
  title: string | null
  description: string | null
  job_type_id: string | null
  status_id: string | null
  priority: WorkOrderPriority
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  estimated_duration_minutes: number | null
  lead_tech_account_id: string | null
  project_manager_account_id: string | null
  internal_notes: string | null
  customer_notes: string | null
  contract_template_id: string | null
  covered_asset_ids: string[]
  line_drafts: EstimateLineItemDraft[]
}
// (Repeated property guard removed.)

interface ApprovedTimeOffBlock {
  id: string
  account_id: string
  account_name: string | null
  type: string
  start_date: string | null
  end_date: string | null
  all_day: boolean
  start_time: string | null
  end_time: string | null
  status: 'approved'
  reason: string | null
}

interface WorkOrderFormProps {
  mode: 'create' | 'edit'
  initialData?: WorkOrder
  initialServiceCustomer?: Customer | null
  initialBillingCustomer?: Customer | null
  /** Pre-select Kind. Defaults to 'job'. Pass 'estimate' to land on /estimates/new. */
  initialKind?: WorkOrderFormKind
  /** Hide the kind toggle (e.g. when route already commits to estimate). */
  lockKind?: boolean
  /** Full-page create mode uses the two-column workspace; guided mode stays single-column. */
  layout?: 'stacked' | 'workspace'
  guidedMode?: boolean
  onGuidedModeChange?: (guided: boolean) => void
  /** AI-parsed call/text intake draft used to prefill a dispatcher-reviewed create form. */
  aiIntakeDraft?: AiIntakeDraft | null
  /**
   * Optional customer-supplied PDF (the WO/PO they sent us). Lifted to
   * parent state so it can be uploaded AFTER the WO/Estimate is
   * created (we need the id). Renders between Customer & Location
   * and Job Basics when both setters are provided.
   */
  templatePdf?: File | null
  onTemplatePdfChange?: (f: File | null) => void
  /**
   * Optional draft attachments (photos + docs) collected at create
   * time. Each has a per-file `share_with_customer` toggle. Parent
   * uploads them after the WO/Estimate is saved.
   */
  attachments?: DraftAttachment[]
  onAttachmentsChange?: (next: DraftAttachment[]) => void
  onSubmit: (
    input: WorkOrderInput,
    drafts: WorkOrderLineItemDraft[],
    coveredAssetIds: string[],
    customValues?: CustomValues
  ) => Promise<void> | void
  /**
   * Called instead of onSubmit when the user selected Kind = Estimate on
   * the unified create form. Estimate line items are not collected on the
   * create page; the user adds them on the estimate detail page.
   */
  onSubmitEstimate?: (input: EstimateCreateFromFormInput) => Promise<void> | void
  onCancel?: () => void
  submitting?: boolean
  serverErrors?: Record<string, string[]>
}

interface FormState {
  // Section 0
  kind: WorkOrderFormKind
  /** Estimate-only: which assets this estimate covers. */
  covered_asset_ids: string[]
  /** Estimate-only: line item drafts (buffered until estimate saves). */
  line_drafts: EstimateLineItemDraft[]

  // Section 1
  title: string
  job_type_id: string
  status_id: string
  priority: WorkOrderPriority
  description: string

  // Section 2
  service_customer: Customer | null
  service_location_id: string
  selected_location: CustomerServiceLocation | null
  pending_customer: InlineQuickAddCustomerDraft | null
  intake_customer_name: string
  intake_customer_phone: string
  intake_customer_email: string

  has_billing_override: boolean
  billing_customer: Customer | null
  their_work_order_number: string
  their_po_number: string

  // Section 2.5 — field assignment. lead_tech_account_id is the primary
  // assignment used by dispatch, mobile, payroll, reports, and notifications.
  lead_tech_account_id: string | null
  /*
   * Who is ANSWERABLE, which on anything bigger than a single visit is
   * not who is doing it. Left null on purpose: the server resolves an
   * empty one to the lead tech, and copying the tech in here would mean
   * reassigning the job leaves the old one quietly holding it.
   */
  project_manager_account_id: string | null
  crew_id: string | null
  crew_member_account_ids: string[]

  // Section 3
  is_scheduled: boolean
  is_multi_day: boolean
  scheduled_date: string
  scheduled_end_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  estimated_duration_minutes: string

  // Section 4
  internal_notes: string
  public_notes: string

  // Section 4.5 — Signable document attached to the job/estimate. When set,
  // the customer must read + sign it before approving (estimate) or
  // before tech check-in (WO). '' means "(no signable document)".
  contract_template_id: string

  // Section 5 — inspection scope (optional). System slugs like
  // 'nfpa-80-annual' for the NFPA standards; tenant-owned ids for customs.
  inspection_checklist_id: string | null
}

const PRIORITIES: WorkOrderPriority[] = ['low', 'normal', 'urgent', 'emergency']

function normalizeDocumentMatch(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Today's date as "YYYY-MM-DD" in the browser's local zone — the default
 *  schedule date for a brand-new job so it lands on the calendar. */
function todayLocalDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** Current wall-clock time as "HH:MM" (24h), local zone. */
function nowLocalTime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function normalizeCompanyMatch(value: string | null | undefined): string {
  return normalizeDocumentMatch(value)
    .replace(/(llc|incorporated|inc|corporation|corp|company|co|limited|ltd)$/, '')
}

function companySearchTerm(value: string): string {
  return value
    .replace(/\s*,?\s*\b(llc|incorporated|inc|corporation|corp|company|co|limited|ltd)\.?\s*$/i, '')
    .trim()
}

function findDocumentLocation(
  locations: CustomerServiceLocation[],
  extracted: ExtractedContent,
): CustomerServiceLocation | null {
  const storeName = normalizeDocumentMatch(extracted.customer_name)
  const serviceAddress = normalizeDocumentMatch(extracted.service_address)
  const postalCode = extracted.service_address?.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? ''

  const scored = locations.map((location) => {
    const nickname = normalizeDocumentMatch(location.nickname)
    const formatted = normalizeDocumentMatch(location.address.formatted)
    const street = normalizeDocumentMatch(location.address.street_address)
    let score = 0

    if (storeName && nickname === storeName) score += 6
    if (serviceAddress && formatted === serviceAddress) score += 8
    if (serviceAddress && street && serviceAddress.includes(street)) score += 4
    if (postalCode && location.address.postal_code === postalCode) score += 2

    return { location, score }
  }).filter(({ score }) => score >= 4)

  scored.sort((a, b) => b.score - a.score)
  if (scored.length === 0 || scored[0].score === scored[1]?.score) return null
  return scored[0].location
}

function findInitialLocation(
  customer: Customer | null | undefined,
  preferredId?: string
): CustomerServiceLocation | null {
  const locations = customer?.service_locations ?? []
  if (preferredId) {
    const match = locations.find((l) => l.id === preferredId)
    if (match) return match
  }
  return locations.find((l) => l.is_primary) ?? locations[0] ?? null
}

function aiText(source: Record<string, unknown> | null | undefined, key: string): string {
  const value = source?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' ? value.trim() : ''
}

function aiObject(source: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  const value = source?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function firstAiText(...values: string[]): string {
  return values.find((value) => value.trim() !== '') ?? ''
}

function aiPriority(value: string): WorkOrderPriority {
  return PRIORITIES.includes(value as WorkOrderPriority) ? value as WorkOrderPriority : 'normal'
}

function aiDisplayName(customer: Record<string, unknown> | null | undefined): string {
  return firstAiText(
    aiText(customer, 'display_name'),
    aiText(customer, 'business_name'),
    [aiText(customer, 'first_name'), aiText(customer, 'last_name')].filter(Boolean).join(' '),
  )
}

function splitDisplayName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts.at(-1) ?? '' }
}

function hasAiCustomerSeed(
  customer: Record<string, unknown> | null | undefined,
  location: Record<string, unknown> | null | undefined,
): boolean {
  return !!(
    aiDisplayName(customer)
    || aiText(customer, 'phone')
    || aiText(customer, 'email')
    || aiText(location, 'street_address')
  )
}

function makeDraftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/** ISO timestamp → local "YYYY-MM-DD" (matches what an <input type="date"> holds). */
function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** True when a job's end lands on a later local day than its start. */
function isMultiDaySchedule(startAt?: string | null, endAt?: string | null): boolean {
  const s = isoToLocalDate(startAt)
  const e = isoToLocalDate(endAt)
  return !!s && !!e && e > s
}

function buildAiEstimateLineDrafts(draft: AiIntakeDraft): EstimateLineItemDraft[] {
  const requestedItems = draft.proposed_estimate_json?.requested_items
  if (!Array.isArray(requestedItems)) return []

  const drafts: EstimateLineItemDraft[] = []
  requestedItems.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const description = typeof row.description === 'string' ? row.description.trim() : ''
    if (!description) return
    const quantity = typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1
    drafts.push({
      draft_id: makeDraftId(),
      type: 'service' as const,
      line_type: 'item' as const,
      description,
      quantity,
      unit_price_cents: 0,
      service_catalog_item_id: null,
      tax_class_id: null,
      asset_id: null,
      show_image_on_doc: false,
      discount_id: null,
      discount_kind: null,
      discount_value: 0,
      line_total_cents: 0,
      tax_amount_cents: 0,
      total_cents: 0,
      discount_amount_cents: 0,
    })
  })
  return drafts
}

/**
 * Pick a sensible default job status so the user never has to choose one on
 * create (per the form-design doc). Scheduled jobs default to "Scheduled",
 * unscheduled to "Needs Scheduling"; falls back to the tenant's initial status,
 * then the first active one.
 */
function pickDefaultStatusId(
  statuses: Array<{ id: string; slug?: string | null; is_initial?: boolean }>,
  isScheduled: boolean,
): string {
  const bySlug = (slug: string) => statuses.find((s) => s.slug === slug)?.id
  const preferred = isScheduled ? bySlug('scheduled') : bySlug('needs-scheduling')
  if (preferred) return preferred
  const initial = statuses.find((s) => s.is_initial)?.id
  if (initial) return initial
  return statuses[0]?.id ?? ''
}

function buildInitialState(
  initialData?: WorkOrder,
  serviceCustomer?: Customer | null,
  billingCustomer?: Customer | null,
  initialKind: WorkOrderFormKind = 'job',
): FormState {
  if (!initialData) {
    const initialLocation = findInitialLocation(serviceCustomer)
    return {
      kind: initialKind,
      covered_asset_ids: [],
      line_drafts: [],
      title: '',
      job_type_id: '',
      status_id: '',
      priority: 'normal',
      description: '',
      service_customer: serviceCustomer ?? null,
      service_location_id: initialLocation?.id ?? '',
      selected_location: initialLocation,
      pending_customer: null,
      intake_customer_name: '',
      intake_customer_phone: '',
      intake_customer_email: '',
      has_billing_override: false,
      billing_customer: null,
      their_work_order_number: '',
      their_po_number: '',
      lead_tech_account_id: null,
      project_manager_account_id: null,
      crew_id: null,
      crew_member_account_ids: [],
      // New jobs schedule to now by default so they always appear on the
      // calendar; either field is still editable (or clear the date to leave
      // it unscheduled). AI-intake / PDF extraction override this below.
      // Estimates aren't auto-scheduled.
      is_scheduled: initialKind === 'job',
      is_multi_day: false,
      scheduled_date: initialKind === 'job' ? todayLocalDate() : '',
      scheduled_end_date: '',
      scheduled_start_time: initialKind === 'job' ? nowLocalTime() : '',
      scheduled_end_time: '',
      estimated_duration_minutes: '',
      internal_notes: '',
      public_notes: '',
      contract_template_id: '',
      inspection_checklist_id: null,
    }
  }
  const initialLocation = findInitialLocation(
    serviceCustomer,
    initialData.service_location_id
  )
  return {
    kind: 'job',
    covered_asset_ids: [],
    line_drafts: [],
    title: initialData.title ?? '',
    job_type_id: initialData.job_type_id,
    status_id: initialData.status_id,
    priority: initialData.priority,
    description: initialData.description ?? '',
    service_customer: serviceCustomer ?? null,
    service_location_id: initialData.service_location_id,
    selected_location: initialLocation,
    pending_customer: null,
    intake_customer_name: '',
    intake_customer_phone: '',
    intake_customer_email: '',
    has_billing_override: !!initialData.billing_customer_id,
    billing_customer: billingCustomer ?? null,
    their_work_order_number: initialData.their_work_order_number ?? '',
    their_po_number: initialData.their_po_number ?? '',
    lead_tech_account_id: initialData.lead_tech_account_id ?? null,
    project_manager_account_id: initialData.project_manager_account_id ?? null,
    crew_id: initialData.crew_id ?? null,
    crew_member_account_ids: initialData.crew_members?.map((member) => member.id) ?? [],
    is_scheduled: initialData.schedule.is_scheduled,
    is_multi_day: isMultiDaySchedule(initialData.schedule.start_at, initialData.schedule.end_at),
    scheduled_date: initialData.schedule.date ?? '',
    scheduled_end_date: isMultiDaySchedule(initialData.schedule.start_at, initialData.schedule.end_at)
      ? isoToLocalDate(initialData.schedule.end_at)
      : '',
    scheduled_start_time: initialData.schedule.start_time ?? '',
    scheduled_end_time: initialData.schedule.end_time ?? '',
    estimated_duration_minutes:
      initialData.schedule.estimated_duration_minutes != null
        ? String(initialData.schedule.estimated_duration_minutes)
        : '',
    internal_notes: initialData.internal_notes ?? '',
    public_notes: initialData.public_notes ?? '',
    contract_template_id: (initialData as { contract_template_id?: string | null }).contract_template_id ?? '',
    inspection_checklist_id: initialData.inspection_checklist_id ?? null,
  }
}

export function WorkOrderForm({
  mode,
  initialData,
  initialServiceCustomer,
  initialBillingCustomer,
  initialKind = 'job',
  lockKind = false,
  layout = 'stacked',
  guidedMode: controlledGuidedMode,
  onGuidedModeChange,
  aiIntakeDraft = null,
  templatePdf,
  onTemplatePdfChange,
  attachments,
  onAttachmentsChange,
  onSubmit,
  onSubmitEstimate,
  onCancel,
  submitting = false,
  serverErrors = {},
}: WorkOrderFormProps) {
  const [form, setForm] = useState<FormState>(() => {
    const base = buildInitialState(initialData, initialServiceCustomer, initialBillingCustomer)
    return { ...base, kind: initialKind }
  })
  const [drafts, setDrafts] = useState<WorkOrderLineItemDraft[]>([])
  const [appliedAiDraftId, setAppliedAiDraftId] = useState<string | null>(null)
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  /**
   * Tenant-defined custom field values, keyed by custom_field_id.
   * CustomFieldsSection seeds these from /v1/custom-fields/values when
   * editing an existing WO; in create mode they start blank.
   * onSubmit forwards them so the parent page can persist them via
   * uploadCustomValues() after the WO is created.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const [customValues, setCustomValues] = useState<CustomValues>({})
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false)
  const quickAddCustomerRef = useRef<InlineQuickAddCustomerHandle | null>(null)
  const lastPdfDescriptionBlockRef = useRef('')
  const lastPdfTitlePrefixRef = useRef('')
  const skipDefaultLocationForCustomerRef = useRef<string | null>(null)
  const autoDefaultJobTypeIdRef = useRef<string | null>(null)
  const jobTypeWasManuallySelectedRef = useRef(false)
  const statusWasManuallySelectedRef = useRef(false)

  // Tenant chooses the default workflow. A dispatcher can override it on this
  // device without changing the tenant-wide setting.
  const hasGuidedModeOverride = useRef(false)
  const [internalGuidedMode, setInternalGuidedMode] = useState(() => {
    if (mode !== 'create') return false
    try {
      const stored = localStorage.getItem('crewbarn:job-form:guided')
      hasGuidedModeOverride.current = stored !== null
      return stored === '1'
    } catch {
      return false
    }
  })
  const guidedMode = controlledGuidedMode ?? internalGuidedMode
  const [step, setStep] = useState(0)
  const [activeSetupPanel, setActiveSetupPanel] = useState<JobSetupPanel>(null)

  const workspaceLayout = mode === 'create' && !guidedMode && layout === 'workspace'
  const formShellClass = workspaceLayout
    ? 'pb-24 grid grid-cols-1 xl:grid-cols-[minmax(720px,1fr)_minmax(440px,540px)] 2xl:grid-cols-[minmax(860px,1fr)_minmax(460px,560px)] gap-x-3 gap-y-3 items-start grid-flow-row-dense'
    : mode === 'create' ? `pb-32 w-full ${layout === 'workspace' ? '' : 'max-w-5xl mx-auto'}` : 'pb-32'
  const fullSpanClass = workspaceLayout ? 'xl:col-span-2' : ''
  const leftTopClass = workspaceLayout ? 'xl:col-start-1 xl:order-10' : ''
  const leftMidClass = workspaceLayout ? 'xl:col-start-1 xl:order-20' : ''
  const lineItemsClass = workspaceLayout ? 'xl:col-start-1 xl:order-30' : ''
  const rightRailClass = workspaceLayout ? 'xl:col-start-2 xl:row-span-6 xl:order-10 xl:sticky xl:top-20 self-start flex flex-col gap-0 job-form-right-rail' : ''
  const bottomLeftClass = workspaceLayout ? 'xl:col-start-1 xl:order-40' : ''
  const sectionVariant: SectionVariant = workspaceLayout ? 'workspace' : 'default'
  // MUST be a stable reference: if this component is re-created on every render
  // React remounts the whole subtree each keystroke — inputs lose focus after
  // one letter and the page jumps on select. Memoize on the only value it uses.
  const FormSection = useCallback(
    (props: SectionProps) => <Section {...props} variant={sectionVariant} />,
    [sectionVariant],
  )

  // Estimates have a different step set: no Schedule (moves to convert),
  // plus Line items step. Both kinds get Assets — repair work usually
  // targets a specific tracked asset.
  // Optional setup tools live with Job Basics; the final step is for notes and tenant fields.
  const STEPS = form.kind === 'estimate'
    ? (['Customer', 'Basics', 'Assets', 'Line items', 'Notes'] as const)
    : (['Customer', 'Job basics', 'Assets', 'Notes'] as const)
  const lastStep = STEPS.length - 1
  const currentStepName: string = STEPS[step] ?? ''
  const onLastStep = step >= lastStep

  // ---------- Picker data ----------
  const jobTypesQuery = useJobTypes({ active: true, per_page: 100 })
  const jobStatusesQuery = useJobStatuses({ active: true, per_page: 100 })

  const jobTypes = jobTypesQuery.data?.data ?? []
  const jobStatuses = jobStatusesQuery.data?.data ?? []

  // Company-configured required fields (admin sets these in Company
  // Preferences). Readable by anyone who can make jobs. Defaults: all off.
  const intakeQuery = useQuery({
    queryKey: ['intake-requirements'],
    queryFn: () => apiRequest<{ data: Record<string, boolean> }>('/v1/intake-requirements'),
    staleTime: 60_000,
  })
  const intake = intakeQuery.data?.data ?? {}

  useEffect(() => {
    if (mode !== 'create' || !intakeQuery.isSuccess || hasGuidedModeOverride.current) return
    setInternalGuidedMode(!!intake.guided_default)
    onGuidedModeChange?.(!!intake.guided_default)
  }, [intake.guided_default, intakeQuery.isSuccess, mode])

  // ---------- Enrich service customer with full detail (includes service_locations) ----------
  // The /v1/customers list endpoint returns "skinny" customer objects without
  // the nested service_locations array (just service_locations_count). The
  // detail endpoint returns the full record. Fetch detail when a customer is
  // picked so the location modal has real data.
  // Customer's assets — loaded once at the form level when kind=estimate
  // so both the Covered Assets picker and the Line items per-line asset
  // dropdown share the same list (avoids two queries + lets us map ids
  // to real names in the line editor).
  const customerAssetsQuery = useAssets(
    form.service_customer?.id
      ? { customer_id: form.service_customer.id, per_page: 200 }
      : undefined,
  )
  const customerAssets = customerAssetsQuery.data?.data ?? []

  const serviceCustomerDetailQuery = useCustomer(form.service_customer?.id)
  const enrichedServiceCustomer =
    serviceCustomerDetailQuery.data ?? form.service_customer
  const matchedAiCustomerQuery = useCustomer(
    mode === 'create' ? aiIntakeDraft?.matched_customer_id ?? undefined : undefined,
  )

  // ---------- Auto-select primary location when enriched customer arrives (create mode only) ----------
  // Effect runs when:
  //   - The picked customer changes (id differs)
  //   - The enriched detail finishes loading (locations array becomes available)
  useEffect(() => {
    if (mode !== 'create') return
    const customerId = enrichedServiceCustomer?.id
    if (!customerId) {
      if (form.service_location_id || form.selected_location) {
        update({ service_location_id: '', selected_location: null })
      }
      return
    }
    // Wait for the detail fetch to finish before deciding anything
    const locations = enrichedServiceCustomer.service_locations
    if (!locations) return
    if (skipDefaultLocationForCustomerRef.current === customerId) {
      skipDefaultLocationForCustomerRef.current = null
      if (!form.selected_location) return
    }
    // If the currently selected location belongs to this customer, leave it alone.
    const stillBelongsToCustomer =
      form.selected_location &&
      locations.some((l) => l.id === form.selected_location?.id)
    if (!stillBelongsToCustomer) {
      const newLocation = findInitialLocation(enrichedServiceCustomer, form.service_location_id || undefined)
      update({
        service_location_id: newLocation?.id ?? '',
        selected_location: newLocation,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedServiceCustomer?.id, enrichedServiceCustomer?.service_locations?.length])

  // ---------- Auto-default status (create mode, jobs only) ----------
  // The user shouldn't have to pick a starting status. Prefer the chosen job
  // type's default; otherwise a schedule-aware default (Scheduled vs Needs
  // Scheduling). Only fills when empty, so a manual pick is never overwritten.
  useEffect(() => {
    if (mode !== 'create' || form.kind !== 'job') return
    if (form.status_id) return
    if (jobStatuses.length === 0) return
    const picked = jobTypes.find((t) => t.id === form.job_type_id)
    const next = picked?.default_status_id || pickDefaultStatusId(jobStatuses, form.is_scheduled)
    if (next) update({ status_id: next })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.job_type_id, form.is_scheduled, form.status_id, jobStatuses.length, jobTypes.length])

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  async function applyExtractedCustomerDocument(extracted: ExtractedContent): Promise<string> {
    const workOrderNumber = extracted.wo_number?.trim() ?? ''
    const purchaseOrderNumber = extracted.po_number?.trim() ?? ''
    const referencePrefix = [
      workOrderNumber && `WO #${workOrderNumber}`,
      purchaseOrderNumber && `PO #${purchaseOrderNumber}`,
    ].filter(Boolean).join(' | ')

    const referenceLines = [
      workOrderNumber && `Customer WO #: ${workOrderNumber}`,
      purchaseOrderNumber && `Customer PO #: ${purchaseOrderNumber}`,
      extracted.vendor_partner_number?.trim() && `Vendor partner #: ${extracted.vendor_partner_number.trim()}`,
      extracted.nte_dollars != null && `NTE: $${Number(extracted.nte_dollars).toFixed(2)}`,
      extracted.service_date?.trim() && `Requested service date: ${extracted.service_date.trim()}`,
      extracted.customer_name?.trim() && `Customer: ${extracted.customer_name.trim()}`,
      extracted.customer_contact_name?.trim() && `Site contact: ${extracted.customer_contact_name.trim()}`,
      extracted.customer_phone?.trim() && `Contact phone: ${extracted.customer_phone.trim()}`,
      extracted.customer_email?.trim() && `Contact email: ${extracted.customer_email.trim()}`,
      extracted.service_address?.trim() && `Service address: ${extracted.service_address.trim()}`,
      extracted.billing_address?.trim() && `Billing address: ${extracted.billing_address.trim()}`,
      extracted.scope_of_work?.trim() && `Scope of work:\n${extracted.scope_of_work.trim()}`,
      extracted.special_instructions?.trim() && `Special instructions:\n${extracted.special_instructions.trim()}`,
      extracted.issuer_name?.trim() && `Issued by: ${extracted.issuer_name.trim()}`,
      extracted.issuer_phone?.trim() && `Issuer phone: ${extracted.issuer_phone.trim()}`,
    ].filter(Boolean) as string[]

    const extractedBlock = referenceLines.join('\n')
    if (!extractedBlock) return 'Nothing was applied to the draft.'
    const previousBlock = lastPdfDescriptionBlockRef.current
    let existingDescription = form.description.trim()
    if (previousBlock && existingDescription.startsWith(previousBlock)) {
      existingDescription = existingDescription.slice(previousBlock.length).trim()
    }

    const previousPrefix = lastPdfTitlePrefixRef.current
    let existingTitle = form.title.trim()
    if (previousPrefix && existingTitle.startsWith(`${previousPrefix} - `)) {
      existingTitle = existingTitle.slice(previousPrefix.length + 3).trim()
    }
    const scopeHeadline = extracted.scope_of_work?.split(/[.\n]/)[0]?.trim().slice(0, 100) ?? ''
    const baseTitle = existingTitle || scopeHeadline || extracted.customer_name?.trim() || 'Customer work order'
    const nextTitle = (referencePrefix ? `${referencePrefix} - ${baseTitle}` : baseTitle).slice(0, 180)

    const normalizedPriority = extracted.priority?.trim().toLowerCase()
    const nextPriority = PRIORITIES.includes(normalizedPriority as WorkOrderPriority)
      ? normalizedPriority as WorkOrderPriority
      : form.priority
    const extractedDate = extracted.service_date?.trim() ?? ''
    // Apply an extracted date when the field is empty OR still sitting on the
    // auto-defaulted "today" (a user's own explicit date is left alone).
    const canUseExtractedDate = /^\d{4}-\d{2}-\d{2}$/.test(extractedDate)
      && (!form.scheduled_date || form.scheduled_date === todayLocalDate())
    const matchedJobType = jobTypes.find((jobType) =>
      jobType.id === extracted.job_type_id
      || normalizeDocumentMatch(jobType.name) === normalizeDocumentMatch(extracted.job_type_name),
    )
    const matchedJobTypeId = matchedJobType?.id ?? extracted.job_type_id ?? ''
    const canApplyExtractedJobType = !!matchedJobTypeId
      && !jobTypeWasManuallySelectedRef.current
      && (!form.job_type_id || form.job_type_id === autoDefaultJobTypeIdRef.current)
    if (canApplyExtractedJobType) {
      autoDefaultJobTypeIdRef.current = matchedJobTypeId
    }
    const matchedJobTypeStatus = canApplyExtractedJobType && !statusWasManuallySelectedRef.current
      ? matchedJobType?.default_status_id || pickDefaultStatusId(jobStatuses, canUseExtractedDate || form.is_scheduled)
      : null

    update({
      title: nextTitle,
      description: [extractedBlock, existingDescription].filter(Boolean).join('\n\n'),
      their_work_order_number: form.their_work_order_number || workOrderNumber,
      their_po_number: form.their_po_number || purchaseOrderNumber,
      priority: nextPriority,
      ...(canApplyExtractedJobType ? { job_type_id: matchedJobTypeId } : {}),
      ...(matchedJobTypeStatus ? { status_id: matchedJobTypeStatus } : {}),
      ...(canUseExtractedDate ? {
        is_scheduled: true,
        scheduled_date: extractedDate,
        scheduled_end_date: extractedDate,
      } : {}),
    })

    lastPdfDescriptionBlockRef.current = extractedBlock
    lastPdfTitlePrefixRef.current = referencePrefix

    try {
      let matchedCustomer = form.service_customer
        ? await getCustomer(form.service_customer.id)
        : null

      if (!matchedCustomer && extracted.matched_customer_id) {
        matchedCustomer = await getCustomer(extracted.matched_customer_id)
      }

      if (!matchedCustomer && extracted.issuer_name?.trim()) {
        const issuerName = normalizeCompanyMatch(extracted.issuer_name)
        const result = await listCustomers({
          q: companySearchTerm(extracted.issuer_name.trim()),
          active: true,
          per_page: 25,
        })
        const exactMatches = result.data.filter((customer) =>
          [customer.display_name, customer.business_name]
            .some((name) => normalizeCompanyMatch(name) === issuerName),
        )
        if (exactMatches.length === 1) {
          matchedCustomer = await getCustomer(exactMatches[0].id)
        }
      }

      if (!matchedCustomer) {
        return 'Draft only: job details filled. Choose the existing maintenance-company customer and service location.'
      }

      const matchedLocation = matchedCustomer.service_locations?.find(
        (location) => location.id === extracted.matched_location_id,
      ) ?? findDocumentLocation(
        matchedCustomer.service_locations ?? [],
        extracted,
      )
      if (!form.service_customer && !matchedLocation) {
        skipDefaultLocationForCustomerRef.current = matchedCustomer.id
      }
      setForm((current) => {
        if (current.service_customer && current.service_customer.id !== matchedCustomer.id) {
          if (skipDefaultLocationForCustomerRef.current === matchedCustomer.id) {
            skipDefaultLocationForCustomerRef.current = null
          }
          return current
        }
        const shouldFillLocation = !current.service_location_id && !current.selected_location
        return {
          ...current,
          service_customer: current.service_customer ?? matchedCustomer,
          ...(matchedLocation && shouldFillLocation ? {
            service_location_id: matchedLocation.id,
            selected_location: matchedLocation,
          } : {}),
        }
      })

      if (!matchedLocation) {
        return `Draft only: selected ${matchedCustomer.display_name}. Choose its existing service location; none matched uniquely.`
      }
      return `Draft only: selected ${matchedCustomer.display_name} and ${locationLabel(matchedLocation)}. Nothing has been saved.`
    } catch {
      return 'Draft only: job details filled. Existing customer/location matching was unavailable; choose them manually.'
    }
  }
  const updatePendingCustomer = useCallback((pending_customer: InlineQuickAddCustomerDraft) => {
    setForm((prev) => ({ ...prev, pending_customer }))
  }, [])

  // ---------- Local draft autosave (create only) ----------
  // Survives a dropped connection / reload / accidental navigation, and holds
  // several drafts so a new job never overwrites one already in progress.
  const draftId = useRef(newDraftId())
  if (aiIntakeDraft?.id) draftId.current = `intake_${aiIntakeDraft.id}`
  const { drafts: savedDrafts, saveDraft, deleteDraft } = useFormDrafts<FormState>('work-order')
  const otherDrafts = mode === 'create' ? savedDrafts.filter((d) => d.id !== draftId.current) : []
  const [selectedSavedDraft, setSelectedSavedDraft] = useState<FormDraft<FormState> | null>(null)
  const [selectedDraftCustomer, setSelectedDraftCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    if (!aiIntakeDraft?.id || appliedAiDraftId !== aiIntakeDraft.id) return
    const canonicalId = `intake_${aiIntakeDraft.id}`
    const duplicates = savedDrafts.filter((draft) =>
      draft.id !== canonicalId
      && draft.data.title === form.title
      && draft.data.description === form.description
      && draft.data.kind === form.kind
    )
    duplicates.forEach((draft) => deleteDraft(draft.id))
  }, [aiIntakeDraft?.id, appliedAiDraftId, deleteDraft, form.description, form.kind, form.title, savedDrafts])

  useEffect(() => {
    if (mode !== 'create') return
    // Only start saving once the form has something worth keeping.
    const hasContent = !!(form.title.trim() || form.service_customer || form.pending_customer || form.description.trim())
    if (!hasContent) return
    const t = setTimeout(() => {
      const pendingName = form.pending_customer?.businessName || [form.pending_customer?.firstName, form.pending_customer?.lastName].filter(Boolean).join(' ')
      const label = form.title.trim() || form.service_customer?.display_name || pendingName || form.intake_customer_name || 'Untitled job'
      saveDraft(draftId.current, form, `${label}${form.kind === 'estimate' ? ' (estimate)' : ''}`)
    }, 700)
    return () => clearTimeout(t)
  }, [form, mode, saveDraft])

  const resumeDraft = (d: FormDraft<FormState>) => {
    // Merge over current state so a draft saved before a field existed (e.g.
    // is_multi_day) keeps a defined value and inputs stay controlled.
    setForm((prev) => ({ ...prev, ...d.data }))
    setIsQuickAddCustomerOpen(!!d.data.pending_customer && !d.data.service_customer)
    draftId.current = d.id
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // The parent no longer remounts on job⇄estimate, so keep form.kind in sync
  // with the URL kind on browser back/forward or a deep-link.
  useEffect(() => {
    if ((initialKind === 'job' || initialKind === 'estimate') && initialKind !== form.kind) {
      update({ kind: initialKind })
      setStep(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKind])

  // Keep message/transcript drafts moving: pick the tenant's most-used
  // job type (or first active type) when create opens with no type set.
  useEffect(() => {
    if (mode !== 'create') return
    if (form.job_type_id) return
    if (jobTypes.length === 0) return
    const preferred = jobTypes.find((t) => t.most_used) ?? jobTypes[0]
    if (preferred?.id) {
      autoDefaultJobTypeIdRef.current = preferred.id
      update({ job_type_id: preferred.id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, form.job_type_id, jobTypes.length])

  useEffect(() => {
    if (mode !== 'create') return
    if (!initialServiceCustomer || form.service_customer) return
    update({ service_customer: initialServiceCustomer })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialServiceCustomer?.id])

  useEffect(() => {
    if (mode !== 'create' || form.service_customer) return
    const matched = matchedAiCustomerQuery.data
    if (!matched) return
    const location = findInitialLocation(
      matched,
      aiIntakeDraft?.matched_location_id ?? undefined,
    )
    update({
      service_customer: matched,
      service_location_id: location?.id ?? '',
      selected_location: location,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedAiCustomerQuery.data?.id, aiIntakeDraft?.matched_location_id, mode])

  useEffect(() => {
    if (mode !== 'create' || !aiIntakeDraft) return
    if (appliedAiDraftId === aiIntakeDraft.id) return

    const job = aiIntakeDraft.proposed_job_json ?? null
    const estimate = aiIntakeDraft.proposed_estimate_json ?? null
    const customer = aiIntakeDraft.proposed_customer_json ?? null
    const location = aiIntakeDraft.proposed_location_json ?? null
    const intakeFirstName = aiText(customer, 'first_name')
    const intakeLastName = aiText(customer, 'last_name')
    const intakeCustomerName = firstAiText(
      aiText(customer, 'business_name'),
      aiText(customer, 'display_name'),
      [intakeFirstName, intakeLastName].filter(Boolean).join(' '),
    )
    const vehicle = aiObject(job, 'vehicle') ?? aiObject(aiIntakeDraft.extracted_json, 'vehicle')
    const keyFob = aiObject(job, 'key_fob') ?? aiObject(aiIntakeDraft.extracted_json, 'key_fob')
    const equipment = aiObject(job, 'equipment') ?? aiObject(aiIntakeDraft.extracted_json, 'equipment')
    const asset = aiObject(job, 'asset') ?? aiObject(aiIntakeDraft.extracted_json, 'asset')
    const parts = aiObject(job, 'parts') ?? aiObject(aiIntakeDraft.extracted_json, 'parts')
    const dealer = aiObject(job, 'dealer') ?? aiObject(aiIntakeDraft.extracted_json, 'dealer')
    const billing = aiObject(job, 'billing') ?? aiObject(aiIntakeDraft.extracted_json, 'billing')
    const isEstimate = aiIntakeDraft.classification === 'estimate'
    const requestedDate = aiText(job, 'requested_date')
    const requestedTime = aiText(job, 'requested_time')
    const customerNotes = aiText(job, 'customer_notes')
    const entryNotes = aiText(location, 'entry_notes')
    const budgetText = aiText(estimate, 'budget_text')
    const vehicleLine = [
      aiText(vehicle, 'vin') && `VIN: ${aiText(vehicle, 'vin')}`,
      [aiText(vehicle, 'year'), aiText(vehicle, 'make'), aiText(vehicle, 'model'), aiText(vehicle, 'trim')]
        .filter(Boolean)
        .join(' '),
      aiText(vehicle, 'stock_number') && `Stock: ${aiText(vehicle, 'stock_number')}`,
      aiText(vehicle, 'license_plate') && `Plate: ${aiText(vehicle, 'license_plate')}`,
    ].filter(Boolean).join(' | ')
    const keyFobLine = [
      aiText(keyFob, 'button_count') && `${aiText(keyFob, 'button_count')} buttons`,
      aiText(keyFob, 'blade_type'),
      aiText(keyFob, 'fcc_id') && `FCC: ${aiText(keyFob, 'fcc_id')}`,
      aiText(keyFob, 'logo_or_markings'),
    ].filter(Boolean).join(' | ')
    const equipmentLine = [
      aiText(equipment, 'unit_type') || aiText(asset, 'type'),
      aiText(equipment, 'brand') || aiText(asset, 'brand'),
      aiText(equipment, 'model_number') || aiText(asset, 'model'),
      aiText(equipment, 'serial_number') || aiText(asset, 'serial'),
      aiText(equipment, 'tonnage') && `Tonnage: ${aiText(equipment, 'tonnage')}`,
      aiText(equipment, 'refrigerant') && `Refrigerant: ${aiText(equipment, 'refrigerant')}`,
    ].filter(Boolean).join(' | ')
    const partLine = [
      aiText(parts, 'best_guess') && `Part guess: ${aiText(parts, 'best_guess')}`,
      aiText(parts, 'confidence') && `Confidence: ${aiText(parts, 'confidence')}`,
    ].filter(Boolean).join(' | ')
    const billingLine = [
      aiText(dealer, 'name') && `Dealer: ${aiText(dealer, 'name')}`,
      aiText(dealer, 'po_or_ro_number') && `RO/PO: ${aiText(dealer, 'po_or_ro_number')}`,
      aiText(billing, 'bill_to') && `Bill to: ${aiText(billing, 'bill_to')}`,
      aiText(billing, 'dealer_authorized_amount') && `Dealer auth: ${aiText(billing, 'dealer_authorized_amount')}`,
      aiText(billing, 'customer_responsibility') && `Customer part: ${aiText(billing, 'customer_responsibility')}`,
    ].filter(Boolean).join(' | ')
    const notes = [
      customerNotes,
      vehicleLine && `Vehicle: ${vehicleLine}`,
      keyFobLine && `Key/fob: ${keyFobLine}`,
      equipmentLine && `Equipment: ${equipmentLine}`,
      partLine,
      billingLine && `Dealer/billing: ${billingLine}`,
      entryNotes && `Entry notes: ${entryNotes}`,
      budgetText && `Budget: ${budgetText}`,
    ]
      .filter(Boolean)
      .join('\n')

    const patch: Partial<FormState> = {
      kind: isEstimate ? 'estimate' : 'job',
      intake_customer_name: intakeCustomerName,
      intake_customer_phone: aiText(customer, 'phone'),
      intake_customer_email: aiText(customer, 'email'),
      title: firstAiText(
        aiText(job, 'title'),
        aiText(job, 'requested_service'),
        aiText(estimate, 'title'),
        aiText(estimate, 'scope'),
      ),
      description: firstAiText(
        aiText(job, 'description'),
        aiText(job, 'requested_service'),
        aiText(estimate, 'scope'),
      ),
      priority: aiPriority(aiText(job, 'priority')),
      public_notes: notes,
    }

    if (requestedDate) {
      patch.is_scheduled = true
      patch.scheduled_date = requestedDate
      patch.scheduled_start_time = requestedTime
    }

    if (aiIntakeDraft.matched_location_id) {
      patch.service_location_id = aiIntakeDraft.matched_location_id
    }

    if (isEstimate) {
      const lineDrafts = buildAiEstimateLineDrafts(aiIntakeDraft)
      if (lineDrafts.length > 0) {
        patch.line_drafts = lineDrafts
      }
    }

    update(patch)
    if (!aiIntakeDraft.matched_customer_id && !form.service_customer && hasAiCustomerSeed(customer, location)) {
      setIsQuickAddCustomerOpen(true)
    }
    setAppliedAiDraftId(aiIntakeDraft.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiIntakeDraft?.id, appliedAiDraftId, mode])

  function handleLocationSelect(
    locationId: string,
    location: CustomerServiceLocation
  ) {
    update({ service_location_id: locationId, selected_location: location })
  }

  // ---------- Validation ----------
  function validate(current: FormState = form): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!current.title.trim()) errs.title = 'Title is required'
    if (!current.job_type_id) errs.job_type_id = 'Job type is required'
    // Status only applies to Jobs. Estimates don't surface a status
    // field on the form — backend defaults it from job_type.
    if (current.kind === 'job' && !current.status_id) errs.status_id = 'Status is required'
    if (!current.service_customer) errs.service_customer_id = 'Service customer is required'
    // Jobs need a real location (dispatch / geofence / service history depend on
    // it). Estimates don't — a phone quote may not have one yet.
    if (current.kind === 'job' && !current.service_location_id) {
      errs.service_location_id = 'Service location is required'
    }
    if (current.has_billing_override && !current.billing_customer) {
      errs.billing_customer_id = 'Pick a billing customer or turn off the override'
    }
    if (current.is_scheduled && !current.scheduled_date) {
      errs.scheduled_date = 'Date is required when scheduled'
    }
    if (current.is_scheduled && current.is_multi_day) {
      if (!current.scheduled_end_date) {
        errs.scheduled_end_date = 'End date is required for a multi-day job'
      } else if (current.scheduled_date && current.scheduled_end_date < current.scheduled_date) {
        errs.scheduled_end_date = 'End date can’t be before the start date'
      }
    }

    // Company-configured intake requirements (admin → Company Preferences).
    if (current.kind === 'estimate' && intake.estimate_location && !current.service_location_id) {
      errs.service_location_id = 'Service location is required'
    }
    if (intake.schedule && (!current.is_scheduled || !current.scheduled_date)) {
      errs.scheduled_date = 'A scheduled date is required'
    }
    if (current.kind === 'job' && intake.lead_tech && !current.lead_tech_account_id && !current.crew_id && current.crew_member_account_ids.length === 0) {
      errs.lead_tech_account_id = 'Assign a lead tech or crew helper'
    }
    if (intake.description && !current.description.trim()) {
      errs.description = 'A description is required'
    }
    return errs
  }

  async function saveInlineQuickAddCustomer(): Promise<Partial<FormState> | null> {
    const created = await quickAddCustomerRef.current?.save()
    if (!created) return null
    const primary = created.service_locations?.find((l) => l.is_primary)
      ?? created.service_locations?.[0]
      ?? null
    const patch: Partial<FormState> = {
      service_customer: created,
      service_location_id: primary?.id ?? '',
      selected_location: primary ?? null,
      pending_customer: null,
    }
    update(patch)
    setIsQuickAddCustomerOpen(false)
    return patch
  }

  /**
   * Combine a YYYY-MM-DD date + HH:MM time into a NAIVE wall-clock string
   * (no timezone offset). The backend converts it to UTC using the job's
   * SERVICE-LOCATION timezone — the scheduling browser's zone must not decide
   * when a west-coast job happens.
   */
  function combineToIso(date: string, time: string | null): string | null {
    if (!date) return null
    const t = (time && time.length >= 5) ? time.slice(0, 5) : '00:00'
    return `${date}T${t}:00`
  }

  async function confirmLeadTechTimeOff(current: FormState): Promise<boolean> {
    if (!current.is_scheduled || !current.scheduled_date || !current.lead_tech_account_id) return true

    const scheduledWindow = workOrderScheduleWindow(current)
    if (!scheduledWindow) return true

    try {
      const response = await apiRequest<{ data: ApprovedTimeOffBlock[] }>(
        `/v1/time-off-requests?status=approved&account_id=${encodeURIComponent(current.lead_tech_account_id)}&from=${encodeURIComponent(current.scheduled_date)}&to=${encodeURIComponent(current.scheduled_date)}`,
      )
      const conflicts = (response.data ?? []).filter((block) => timeOffOverlapsWindow(block, scheduledWindow))
      if (conflicts.length === 0) return true

      const name = conflicts[0].account_name ?? 'This tech'
      const lines = [
        `${name} has approved time off during this scheduled window:`,
        ...conflicts.map((block) => `  - ${humanizeTimeOffType(block.type)} (${formatTimeOffRange(block)})`),
        '',
        `Save this ${current.kind} anyway?`,
      ]
      return window.confirm(lines.join('\n'))
    } catch {
      // If this user cannot view staff-wide PTO, do not block the save. Schedule page
      // and manager screens still enforce the warning for dispatch users.
      return true
    }
  }

  /** Per-step pre-advance validation so users can't Next past required gates. */
  function canAdvanceFromCurrentStep(current: FormState = form): true | string {
    if (currentStepName === 'Customer') {
      if (!current.service_customer) return 'Pick or enter a customer before continuing.'
      // Location required for jobs always, and for estimates when the company
      // turned on that intake requirement.
      const locationRequired = current.kind === 'job' || !!intake.estimate_location
      if (locationRequired && !current.service_location_id) {
        return 'Pick a service location before continuing.'
      }
    }
    if (currentStepName === 'Job basics' || currentStepName === 'Basics') {
      if (!current.title.trim()) return 'Title is required.'
      if (!current.job_type_id) return 'Job type is required.'
      if (intake.schedule && (!current.is_scheduled || !current.scheduled_date)) {
        return 'Schedule is required.'
      }
      if (current.kind === 'job' && intake.lead_tech && !current.lead_tech_account_id && !current.crew_id && current.crew_member_account_ids.length === 0) {
        return 'Assign a lead tech or crew helper.'
      }
    }
    return true
  }

  async function tryAdvanceStep() {
    let effectiveForm = form
    if (currentStepName === 'Customer' && !effectiveForm.service_customer && isQuickAddCustomerOpen) {
      const createdPatch = await saveInlineQuickAddCustomer()
      if (!createdPatch) return
      effectiveForm = { ...effectiveForm, ...createdPatch }
    }

    const check = canAdvanceFromCurrentStep(effectiveForm)
    if (check !== true) {
      setClientErrors({ _step: check })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setClientErrors({})
    setStep((s) => Math.min(lastStep, s + 1))
  }

  // ---------- Submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // In guided mode, Enter / submit on a non-final step just advances.
    if (guidedMode && !onLastStep) {
      await tryAdvanceStep()
      return
    }

    let effectiveForm = form
    if (!effectiveForm.service_customer && isQuickAddCustomerOpen) {
      const createdPatch = await saveInlineQuickAddCustomer()
      if (createdPatch) {
        effectiveForm = { ...effectiveForm, ...createdPatch }
      }
    }

    const errs = validate(effectiveForm)
    setClientErrors(errs)
    if (Object.keys(errs).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const okToSchedule = await confirmLeadTechTimeOff(effectiveForm)
    if (!okToSchedule) return

    const input: WorkOrderInput = {
      title: effectiveForm.title.trim(),
      job_type_id: effectiveForm.job_type_id,
      status_id: effectiveForm.status_id,
      priority: effectiveForm.priority,
      description: effectiveForm.description.trim() || null,

      service_customer_id: effectiveForm.service_customer!.id,
      service_location_id: effectiveForm.service_location_id,
      billing_customer_id:
        effectiveForm.has_billing_override && effectiveForm.billing_customer
          ? effectiveForm.billing_customer.id
          : null,
      lead_tech_account_id: effectiveForm.lead_tech_account_id || null,
      project_manager_account_id: effectiveForm.project_manager_account_id || null,
      crew_id: effectiveForm.crew_id || null,
      crew_member_account_ids: effectiveForm.crew_member_account_ids,

      their_work_order_number: effectiveForm.their_work_order_number.trim() || null,
      their_po_number: effectiveForm.their_po_number.trim() || null,

      is_scheduled: effectiveForm.is_scheduled,
      scheduled_date: effectiveForm.is_scheduled ? effectiveForm.scheduled_date || null : null,
      scheduled_start_time: effectiveForm.is_scheduled
        ? effectiveForm.scheduled_start_time || null
        : null,
      scheduled_end_time: effectiveForm.is_scheduled
        ? effectiveForm.scheduled_end_time || null
        : null,
      // Multi-day jobs: send explicit timestamps so the end lands on the END
      // date (not collapsed onto scheduled_date). The backend saving hook
      // prefers scheduled_start_at/scheduled_end_at when present. Omit for
      // single-day so its date+time composition is unchanged.
      scheduled_start_at:
        effectiveForm.is_scheduled && effectiveForm.is_multi_day
          ? combineToIso(effectiveForm.scheduled_date, effectiveForm.scheduled_start_time)
          : undefined,
      scheduled_end_at:
        effectiveForm.is_scheduled && effectiveForm.is_multi_day
          ? combineToIso(effectiveForm.scheduled_end_date, effectiveForm.scheduled_end_time)
          : undefined,
      estimated_duration_minutes:
        effectiveForm.is_scheduled && effectiveForm.estimated_duration_minutes
          ? parseInt(effectiveForm.estimated_duration_minutes, 10) || null
          : null,

      internal_notes: effectiveForm.internal_notes.trim() || null,
      public_notes: effectiveForm.public_notes.trim() || null,
      contract_template_id: effectiveForm.contract_template_id || null,
      inspection_checklist_id: effectiveForm.inspection_checklist_id,
    }

    // Estimate branch: re-shape the form payload into the estimate POST
    // body and hand it to the parent's estimate handler, including buffered
    // line items entered on this create page.
    if (effectiveForm.kind === 'estimate' && mode === 'create') {
      if (!onSubmitEstimate) {
        // Surface as a client-side error so dev catches missing handler.
        setClientErrors({ kind: 'Estimate creation isn’t wired up on this page.' })
        return
      }
      const startIso = effectiveForm.is_scheduled
        ? combineToIso(effectiveForm.scheduled_date, effectiveForm.scheduled_start_time)
        : null
      const endIso = effectiveForm.is_scheduled
        ? combineToIso(
            effectiveForm.is_multi_day
              ? effectiveForm.scheduled_end_date
              : effectiveForm.scheduled_date,
            effectiveForm.scheduled_end_time,
          )
        : null
      const estInput: EstimateCreateFromFormInput = {
        customer_id: effectiveForm.service_customer!.id,
        customer_service_location_id: effectiveForm.service_location_id || null,
        title: effectiveForm.title.trim() || null,
        description: effectiveForm.description.trim() || null,
        job_type_id: effectiveForm.job_type_id || null,
        status_id: effectiveForm.status_id || null,
        priority: effectiveForm.priority,
        covered_asset_ids: effectiveForm.covered_asset_ids,
        line_drafts: effectiveForm.line_drafts,
        scheduled_start_at: startIso,
        scheduled_end_at: endIso,
        estimated_duration_minutes:
          effectiveForm.is_scheduled && effectiveForm.estimated_duration_minutes
            ? parseInt(effectiveForm.estimated_duration_minutes, 10) || null
            : null,
        lead_tech_account_id: effectiveForm.lead_tech_account_id || null,
        project_manager_account_id: effectiveForm.project_manager_account_id || null,
        internal_notes: effectiveForm.internal_notes.trim() || null,
        customer_notes: effectiveForm.public_notes.trim() || null,
        contract_template_id: effectiveForm.contract_template_id || null,
      }
      await onSubmitEstimate(estInput)
      return
    }

    await onSubmit(input, mode === 'create' ? drafts : [], effectiveForm.covered_asset_ids, customValues)
    // Success (onSubmit throws on failure, so a failed save keeps the draft).
    if (mode === 'create') deleteDraft(draftId.current)
  }

  // ---------- Error helpers ----------
  function fieldError(name: string): string | undefined {
    if (clientErrors[name]) return clientErrors[name]
    const server = serverErrors[name]
    if (server && server.length > 0) return server[0]
    return undefined
  }

  const allErrors = useMemo(() => {
    const messages: string[] = []
    Object.values(clientErrors).forEach((v) => v && messages.push(v))
    Object.entries(serverErrors).forEach(([k, v]) => {
      if (v && v.length > 0) messages.push(`${k}: ${v[0]}`)
    })
    return messages
  }, [clientErrors, serverErrors])

  const aiCustomer = aiIntakeDraft?.proposed_customer_json ?? null
  const aiLocation = aiIntakeDraft?.proposed_location_json ?? null
  const aiCustomerDisplayName = aiDisplayName(aiCustomer)
  const aiNameParts = splitDisplayName(aiCustomerDisplayName)
  const aiBusinessName = aiText(aiCustomer, 'business_name')
  const aiFirstName = firstAiText(aiText(aiCustomer, 'first_name'), aiBusinessName ? '' : aiNameParts.first)
  const aiLastName = firstAiText(aiText(aiCustomer, 'last_name'), aiBusinessName ? '' : aiNameParts.last)
  const aiQuickAddKind = aiBusinessName ? 'business' : 'personal'
  const aiQuickAddPhone = firstAiText(
    aiText(aiCustomer, 'phone'),
    typeof aiIntakeDraft?.extracted_json?.from_number === 'string' ? aiIntakeDraft.extracted_json.from_number : '',
  )
  const aiQuickAddEmail = aiText(aiCustomer, 'email')
  const aiHasCustomerSeed = hasAiCustomerSeed(aiCustomer, aiLocation)
  const aiWarnings = Array.isArray(aiIntakeDraft?.extracted_json?.warnings)
    ? aiIntakeDraft.extracted_json.warnings.filter((warning): warning is string => typeof warning === 'string')
    : []

  const selectedDraftPending = selectedSavedDraft?.data.pending_customer
  const selectedDraftCustomerName = selectedSavedDraft?.data.service_customer?.display_name
    || selectedDraftPending?.businessName
    || [selectedDraftPending?.firstName, selectedDraftPending?.lastName].filter(Boolean).join(' ')
    || selectedSavedDraft?.data.intake_customer_name
    || ''
  const selectedDraftPhone = selectedDraftPending?.phone || selectedSavedDraft?.data.intake_customer_phone || ''
  const selectedDraftPhoneDigits = selectedDraftPhone.replace(/\D+/g, '')
  const draftNameMatchesQuery = useCustomers(
    { q: selectedDraftCustomerName, fuzzy: true, per_page: 6, sort: 'display_name', direction: 'asc' },
    { enabled: !!selectedSavedDraft && !selectedSavedDraft.data.service_customer && selectedDraftCustomerName.trim().length >= 2 },
  )
  const draftPhoneMatchesQuery = useCustomers(
    { phone: selectedDraftPhoneDigits, per_page: 3 },
    { enabled: !!selectedSavedDraft && !selectedSavedDraft.data.service_customer && selectedDraftPhoneDigits.length >= 7 },
  )
  const draftCustomerMatches = Array.from(new Map([
    ...(draftPhoneMatchesQuery.data?.data ?? []),
    ...(draftNameMatchesQuery.data?.data ?? []),
  ].map((customer) => [customer.id, customer])).values())

  const renderScheduleFields = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-slate-900">
            {form.kind === 'estimate' ? 'Walkthrough schedule' : 'Job schedule'}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">2-hour default window, override as needed.</p>
        </div>
        <div
          className="inline-flex w-fit rounded-lg border border-slate-300 bg-slate-100 p-1"
          role="group"
          aria-label="Schedule mode"
        >
          <button
            type="button"
            aria-pressed={form.is_scheduled}
            onClick={() => {
              const defaults = defaultScheduleValues()
              update({
                is_scheduled: true,
                scheduled_date: form.scheduled_date || defaults.scheduled_date,
                scheduled_start_time: form.scheduled_start_time || defaults.scheduled_start_time,
                scheduled_end_time: form.scheduled_end_time || defaults.scheduled_end_time,
                estimated_duration_minutes: form.estimated_duration_minutes || defaults.estimated_duration_minutes,
              })
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              form.is_scheduled
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Scheduled
          </button>
          <button
            type="button"
            aria-pressed={!form.is_scheduled}
            onClick={() => update({ is_scheduled: false })}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              !form.is_scheduled
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Unscheduled
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 pt-1 text-sm">
        <input
          type="checkbox"
          checked={form.is_multi_day}
          disabled={!form.is_scheduled}
          onChange={(e) => {
            const checked = e.target.checked
            update({
              is_multi_day: checked,
              // Default the end date to the start date when turning multi-day
              // on, so the picker opens on a sensible day.
              scheduled_end_date: checked
                ? form.scheduled_end_date || form.scheduled_date
                : '',
            })
          }}
          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed"
        />
        <span className="font-medium">Multi-day job</span>
        <span className="text-slate-500">(spans a start and end date)</span>
      </label>

      <div
        className={`grid grid-cols-1 gap-4 pt-2 md:grid-cols-4 ${
          form.is_scheduled ? '' : 'opacity-55'
        }`}
        aria-disabled={!form.is_scheduled}
      >
        <Field
          label={form.is_multi_day ? 'Start date' : 'Date'}
          required={form.is_scheduled}
          error={fieldError('scheduled_date')}
        >
          <input
            type="date"
            value={form.scheduled_date}
            disabled={!form.is_scheduled}
            onChange={(e) => {
              const nextStart = e.target.value
              // Keep the end date from drifting before the start date.
              const bumpEnd =
                form.is_multi_day &&
                (!form.scheduled_end_date || form.scheduled_end_date < nextStart)
              update({
                scheduled_date: nextStart,
                ...(bumpEnd ? { scheduled_end_date: nextStart } : {}),
              })
            }}
            className={inputClass(fieldError('scheduled_date'))}
          />
        </Field>
        {form.is_multi_day && (
          <Field label="End date" required error={fieldError('scheduled_end_date')}>
            <input
              type="date"
              value={form.scheduled_end_date}
              min={form.scheduled_date || undefined}
              disabled={!form.is_scheduled}
              onChange={(e) => update({ scheduled_end_date: e.target.value })}
              className={inputClass(fieldError('scheduled_end_date'))}
            />
          </Field>
        )}
        <Field label="Start Time">
          <TimeField
            value={form.scheduled_start_time}
            disabled={!form.is_scheduled}
            onChange={(newStart) => {
              const oldExpectedEnd = addHours(form.scheduled_start_time, 2)
              const shouldSlideEnd =
                !form.scheduled_end_time ||
                form.scheduled_end_time === oldExpectedEnd
              update({
                scheduled_start_time: newStart,
                scheduled_end_time: shouldSlideEnd
                  ? addHours(newStart, 2)
                  : form.scheduled_end_time,
              })
            }}
          />
        </Field>
        <Field label="End Time">
          <TimeField
            value={form.scheduled_end_time}
            disabled={!form.is_scheduled}
            onChange={(v) => update({ scheduled_end_time: v })}
          />
        </Field>
        <Field label="Duration (min)">
          <input
            type="number"
            min="0"
            value={form.estimated_duration_minutes}
            disabled={!form.is_scheduled}
            onChange={(e) =>
              update({ estimated_duration_minutes: e.target.value })
            }
            placeholder="60"
            className={inputClass()}
          />
        </Field>
      </div>
    </div>
  )
  const renderScheduleSection = () => (
    <FormSection title="Schedule">{renderScheduleFields()}</FormSection>
  )

  const renderInspectionSection = () => (
    <FormSection
      title="Inspection Scope"
      collapsible={!workspaceLayout}
      defaultOpen={workspaceLayout}
      summary={form.inspection_checklist_id ? 'Checklist attached' : 'Optional'}
    >
      <InspectionChecklistPicker
        value={form.inspection_checklist_id}
        onChange={(id) => setForm({ ...form, inspection_checklist_id: id })}
      />
    </FormSection>
  )

  const renderContractSection = () => (
    <ContractFormSection
      kind={form.kind}
      value={form.contract_template_id}
      onChange={(v) => update({ contract_template_id: v })}
      jobTitle={form.title}
      jobDescription={form.description}
      customerName={form.service_customer?.display_name ?? ''}
      variant={sectionVariant}
    />
  )
  // ---------- Render ----------
  return (
    <form onSubmit={handleSubmit} className={formShellClass}>
      {mode === 'create' && !workspaceLayout && otherDrafts.length > 0 && (
        <div className={`${fullSpanClass} mb-3 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm`}>
          <div className="font-semibold text-slate-800 mb-1.5">
            Unsaved draft{otherDrafts.length === 1 ? '' : 's'} — pick up where you left off
          </div>
          <ul className="space-y-1">
            {otherDrafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => resumeDraft(d)}
                  className="text-left text-amber-700 hover:text-amber-800 font-medium truncate"
                >
                  {d.label}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {new Date(d.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteDraft(d.id)}
                  className="text-xs text-slate-400 hover:text-red-600 flex-shrink-0"
                >
                  Discard
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {mode === 'create' && aiIntakeDraft && (
        <div className={`${fullSpanClass} mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">AI draft from transcript</span>
            {aiIntakeDraft.classification && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-amber-800">
                {aiIntakeDraft.classification}
              </span>
            )}
            {typeof aiIntakeDraft.confidence === 'number' && (
              <span className="text-xs text-slate-500">{Math.round(aiIntakeDraft.confidence * 100)}% confidence</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Review against the transcript before saving. CrewBarn has not created a job, estimate, customer, or location yet.
          </p>
          {(aiText(aiCustomer, 'display_name') || aiText(aiLocation, 'street_address') || aiWarnings.length > 0) && (
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {aiCustomerDisplayName && <div>Customer heard: {aiCustomerDisplayName}</div>}
              {aiText(aiLocation, 'street_address') && (
                <div>
                  Location heard: {[aiText(aiLocation, 'street_address'), aiText(aiLocation, 'city'), aiText(aiLocation, 'state')]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              {aiWarnings.map((warning) => (
                <div key={warning} className="text-amber-800">Needs review: {warning}</div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Kind selector — Job (default) / Estimate / Sub. Job and Estimate
          stay in this form (they share customer/location/scope/lines).
          Sub navigates to /sub-jobs/new because the sub form has a
          different shape (subcontractor picker + NTE + sub instructions,
          no line items at create time). Create-mode only; edit-mode
          operates on a fixed record. Hidden when the route already
          commits to a kind (e.g. /estimates/new uses lockKind). */}
      {mode === 'create' && !lockKind && (
        <div className={`${fullSpanClass} mb-0 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Record type</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                {(['job', 'estimate'] as const).map((k) => {
                  const active = form.kind === k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        update({ kind: k })
                        setStep(0)
                        // Keep the URL in sync (?kind=job|estimate) without a
                        // remount, so it matches the Sub tab and is shareable.
                        const next = new URLSearchParams(searchParams)
                        if (k === 'job') next.delete('kind')
                        else next.set('kind', k)
                        setSearchParams(next, { replace: true })
                      }}
                      className={`px-3 py-1.5 text-sm font-semibold capitalize rounded-md transition-colors ${
                        active
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      {k}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.set('kind', 'sub')
                    setSearchParams(next)
                  }}
                  title="Outsource the job to a vendor partner"
                  className="px-3 py-1.5 text-sm font-semibold capitalize rounded-md text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                >
                  Sub
                </button>
              </div>
            </div>
            <span className="max-w-2xl text-xs text-slate-500 lg:text-right">
              {form.kind === 'estimate'
                ? 'Estimate workflow: draft, sent, approved, then converted into a job.'
                : 'Job workflow: create the work order, assign schedule and crew, then invoice from the completed job.'}
            </span>
          </div>
        </div>
      )}

      {guidedMode && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-900">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </div>
            <div className="text-xs text-slate-500">{Math.round(((step + 1) / STEPS.length) * 100)}%</div>
          </div>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
      )}

      {allErrors.length > 0 && (
        <div className={`${fullSpanClass} mb-6 p-4 bg-red-50 border border-red-200 rounded-md`}>
          <div className="text-sm font-medium text-red-800 mb-1">
            Please fix the following:
          </div>
          <ul className="text-sm text-red-700 list-disc list-inside space-y-0.5">
            {allErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {workspaceLayout && (
        <div className={rightRailClass}>
          <SavedDraftPanel
            drafts={otherDrafts}
            selected={selectedSavedDraft}
            onSelect={(draft) => {
              setSelectedSavedDraft(draft)
              setSelectedDraftCustomer(draft.data.service_customer ?? null)
            }}
            onClose={() => {
              setSelectedSavedDraft(null)
              setSelectedDraftCustomer(null)
            }}
            onDiscard={(draft) => {
              deleteDraft(draft.id)
              setSelectedSavedDraft(null)
              setSelectedDraftCustomer(null)
            }}
            onUse={(draft) => {
              resumeDraft(selectedDraftCustomer ? {
                ...draft,
                data: { ...draft.data, service_customer: selectedDraftCustomer, pending_customer: null },
              } : draft)
              setSelectedSavedDraft(null)
              setSelectedDraftCustomer(null)
            }}
            useLabel={(draft) => draft.data.kind === 'estimate' ? 'Create estimate from draft' : 'Create job from draft'}
            reviewContent={(draft) => {
              if (draft.data.service_customer) {
                return (
                  <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Using existing customer</div>
                    <div className="mt-0.5 text-sm font-semibold text-emerald-900">{draft.data.service_customer.display_name}</div>
                  </div>
                )
              }
              return (
                <div className="mb-4 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Customer check</div>
                  {selectedDraftCustomer ? (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Use existing customer</div>
                      <div className="mt-0.5 text-sm font-semibold text-emerald-900">{selectedDraftCustomer.display_name}</div>
                      <button type="button" onClick={() => setSelectedDraftCustomer(null)} className="mt-1 text-xs font-semibold text-emerald-700 underline">Not them — keep as new customer</button>
                    </div>
                  ) : draftCustomerMatches.length > 0 ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                      <div className="mb-1.5 text-[11px] font-bold text-amber-800">Similar customers already exist — use one instead?</div>
                      <div className="space-y-1">
                        {draftCustomerMatches.map((customer) => (
                          <button key={customer.id} type="button" onClick={() => setSelectedDraftCustomer(customer)} className="flex w-full items-center justify-between gap-2 rounded-md bg-white/80 px-2.5 py-2 text-left hover:bg-white">
                            <span className="truncate text-sm font-medium text-slate-800">{customer.display_name}</span>
                            <span className="shrink-0 text-[11px] font-bold text-amber-700">Use this →</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {draftNameMatchesQuery.isFetching || draftPhoneMatchesQuery.isFetching
                        ? 'Checking existing customers…'
                        : selectedDraftCustomerName
                          ? 'No existing customer match found. A new customer can be created from this draft.'
                          : 'No customer name was captured in this draft.'}
                    </div>
                  )}
                </div>
              )
            }}
            reviewFields={(draft) => [
              { label: 'Type', value: draft.data.kind === 'estimate' ? 'Estimate' : 'Job' },
              { label: 'Customer', value: draft.data.service_customer?.display_name || draft.data.pending_customer?.businessName || [draft.data.pending_customer?.firstName, draft.data.pending_customer?.lastName].filter(Boolean).join(' ') || draft.data.intake_customer_name },
              { label: 'Title', value: draft.data.title, wide: true },
              { label: 'Schedule date', value: draft.data.scheduled_date || 'Unscheduled' },
              { label: 'Lead tech', value: draft.data.lead_tech_account_id ? 'Assigned' : 'Unassigned' },
              { label: 'Description / scope', value: draft.data.description, wide: true },
              { label: 'Internal notes', value: draft.data.internal_notes, wide: true },
            ]}
          />
          <div data-tour="job-schedule">
            {renderScheduleSection()}
          </div>

          {(form.kind === 'job' || form.kind === 'estimate') && (
            <CrewSection
              leadTechAccountId={form.lead_tech_account_id}
              onLeadTechChange={(lead_tech_account_id) => update({ lead_tech_account_id })}
              projectManagerAccountId={form.project_manager_account_id}
              onProjectManagerChange={(project_manager_account_id) => update({ project_manager_account_id })}
              leadTechError={fieldError('lead_tech_account_id')}
              crewMemberAccountIds={form.crew_member_account_ids}
              onCrewMemberChange={(crew_member_account_ids) => update({ crew_member_account_ids })}
              showCrew={form.kind === 'job'}
              compact
            />
          )}

        </div>
      )}
      {/* ---------- Section 1: Customer & Location ----------
          Customer first — it's the very first thing dispatch asks for
          when answering the phone. Title / type / schedule come after. */}
      {(!guidedMode || step === 0) && (
      <div data-tour={form.kind === 'estimate' ? 'estimate-customer' : 'job-customer'} className={leftTopClass}>
      <FormSection title="Customer & Location" allowOverflow>
        <Field
          label="Service Customer"
          required
          error={fieldError('service_customer_id')}
        >
          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <CustomerPicker
                value={form.service_customer}
                onChange={(c) => update({ service_customer: c })}
                error={fieldError('service_customer_id')}
                disabled={mode === 'edit' || isQuickAddCustomerOpen}
                autoFocus={mode === 'create'}
              />
            </div>
            {mode === 'create' && !form.service_customer && !isQuickAddCustomerOpen && (
              <button
                type="button"
                onClick={() => setIsQuickAddCustomerOpen(true)}
                className="text-sm font-medium px-3 py-2 rounded-md border border-amber-500 text-amber-700 hover:bg-amber-50 whitespace-nowrap"
              >
                {aiHasCustomerSeed ? 'Review AI customer' : '+ New customer'}
              </button>
            )}
          </div>
        </Field>

        {isQuickAddCustomerOpen && (
          <InlineQuickAddCustomer
            ref={quickAddCustomerRef}
            initialKind={aiQuickAddKind}
            initialFirstName={aiFirstName}
            initialLastName={aiLastName}
            initialBusinessName={aiBusinessName}
            initialPhone={aiQuickAddPhone}
            initialEmail={aiQuickAddEmail}
            initialServiceAddress={{
              street_address: aiText(aiLocation, 'street_address'),
              apt_unit: aiText(aiLocation, 'apt_unit'),
              city: aiText(aiLocation, 'city'),
              state: aiText(aiLocation, 'state'),
              postal_code: aiText(aiLocation, 'postal_code'),
              country: aiText(aiLocation, 'country'),
              entry_notes: aiText(aiLocation, 'entry_notes'),
            }}
            initialDraft={form.pending_customer}
            onDraftChange={updatePendingCustomer}
            hideActions
            onCreated={(c) => {
              // New customer's primary service_location is pre-set in the
              // POST response; pick it up so the form is fully populated.
              const primary = c.service_locations?.find((l) => l.is_primary)
                ?? c.service_locations?.[0]
                ?? null
              update({
                service_customer: c,
                service_location_id: primary?.id ?? '',
                selected_location: primary ?? null,
                pending_customer: null,
              })
              setIsQuickAddCustomerOpen(false)
            }}
            onCancel={() => {
              update({ pending_customer: null })
              setIsQuickAddCustomerOpen(false)
            }}
          />
        )}

        {form.service_customer && (
          <Field
            label="Service Location"
            required
            error={fieldError('service_location_id')}
          >
            {form.selected_location ? (
              <div className="flex items-start justify-between gap-3 px-3 py-2 border border-slate-300 rounded-md bg-white">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>{locationLabel(form.selected_location)}</span>
                    {form.selected_location.is_primary && (
                      <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                  {locationAddress(form.selected_location) ? (
                    <div className="text-xs text-slate-600 mt-0.5">
                      {locationAddress(form.selected_location)}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic mt-0.5">
                      No address on file
                    </div>
                  )}
                  {form.selected_location.gated_property && (
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <span aria-hidden>🔒</span>
                      <span>Gated property</span>
                      {form.selected_location.entry_notes && (
                        <span className="text-slate-400">
                          — {form.selected_location.entry_notes}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="text-sm font-medium text-amber-700 hover:text-amber-800 flex-shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="px-3 py-3 border border-slate-300 border-dashed rounded-md bg-slate-50 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">
                  No service location selected.
                </span>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="px-3 py-1.5 text-sm font-medium border border-amber-600 text-amber-700 hover:bg-amber-50 rounded-md flex-shrink-0"
                >
                  + Add a service location
                </button>
              </div>
            )}
          </Field>
        )}

        {/* Billing override */}
        <div className="border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.has_billing_override}
              onChange={(e) =>
                update({
                  has_billing_override: e.target.checked,
                  billing_customer: e.target.checked ? form.billing_customer : null,
                })
              }
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="font-medium">Bill a different customer</span>
            <span className="text-slate-500">
              (e.g., property manager, warranty company)
            </span>
          </label>

          {form.has_billing_override && (
            <div className="mt-3 space-y-4 pl-6 border-l-2 border-amber-200">
              <Field
                label="Billing Customer"
                required
                error={fieldError('billing_customer_id')}
              >
                <CustomerPicker
                  value={form.billing_customer}
                  onChange={(c) => update({ billing_customer: c })}
                  error={fieldError('billing_customer_id')}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Their Work Order #">
                  <input
                    type="text"
                    value={form.their_work_order_number}
                    onChange={(e) =>
                      update({ their_work_order_number: e.target.value })
                    }
                    placeholder="As provided by billing party"
                    className={inputClass()}
                  />
                </Field>
                <Field label="PO #">
                  <input
                    type="text"
                    value={form.their_po_number}
                    onChange={(e) => update({ their_po_number: e.target.value })}
                    placeholder="Purchase order number"
                    className={inputClass()}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
      </FormSection>
      </div>
      )}

      {/* ---------- Section 2: Job Basics ---------- */}
      {(!guidedMode || step === 1) && (
      <div className={leftMidClass}>
      {mode === 'create' && (
        <>
          <div
            role="toolbar"
            aria-label="Additional job setup"
            className="mb-4 grid grid-cols-2 gap-2 overflow-visible rounded-lg border border-slate-300 bg-slate-200 p-2 shadow-inner md:grid-cols-4"
          >
            <IntakeSetupTab
              icon={<IconSignature size={18} />}
              label="Signable document"
              status={form.contract_template_id ? 'Selected' : 'Optional'}
              description="Choose a signable template or generate one with AI. The customer signs it during the configured job or estimate workflow."
              active={activeSetupPanel === 'signable'}
              filled={!!form.contract_template_id}
              align="left"
              previewFallback={form.contract_template_id ? 'A signable template is attached to this job.' : undefined}
              onClick={() => setActiveSetupPanel('signable')}
            />
            <IntakeSetupTab
              icon={<IconFileInvoice size={18} />}
              label="Customer's WO / PO"
              status={templatePdf?.name ?? 'No PDF'}
              description="Upload the customer's work order or purchase order PDF. CBI reads it for customer, scope, priority, dates, and reference numbers."
              active={activeSetupPanel === 'customer-pdf'}
              filled={!!templatePdf}
              previewFile={templatePdf ?? undefined}
              onClick={() => setActiveSetupPanel('customer-pdf')}
            />
            <IntakeSetupTab
              icon={<IconPaperclip size={18} />}
              label="Photos & Documents"
              status={(attachments?.length ?? 0) > 0 ? `${attachments?.length} ready` : 'None yet'}
              description="Add job photos, PDFs, and supporting documents. Preview each file and choose whether the customer can see it in the portal."
              active={activeSetupPanel === 'attachments'}
              filled={(attachments?.length ?? 0) > 0}
              previewFile={attachments?.find((attachment) => attachment.kind === 'image')?.file ?? attachments?.[0]?.file}
              onClick={() => setActiveSetupPanel('attachments')}
            />
            <IntakeSetupTab
              icon={<IconChecklist size={18} />}
              label="Inspection Scope"
              status={form.inspection_checklist_id ? 'Checklist attached' : 'Optional'}
              description="Attach a tenant inspection checklist that defines the field questions, required checks, and completion scope for this job."
              active={activeSetupPanel === 'inspection'}
              filled={!!form.inspection_checklist_id}
              align="right"
              previewFallback={form.inspection_checklist_id ? 'An inspection checklist is attached to this job.' : undefined}
              onClick={() => setActiveSetupPanel('inspection')}
            />
          </div>

          <Modal
            isOpen={activeSetupPanel === 'signable'}
            onClose={() => setActiveSetupPanel(null)}
            title="Signable document"
            subtitle="Choose the document the customer must sign, or generate one from this job's scope."
            size="lg"
          >
            <Modal.Body>{renderContractSection()}</Modal.Body>
            <Modal.Footer>
              <button type="button" onClick={() => setActiveSetupPanel(null)} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Done</button>
            </Modal.Footer>
          </Modal>

          {onTemplatePdfChange && (
            <Modal
              isOpen={activeSetupPanel === 'customer-pdf'}
              onClose={() => setActiveSetupPanel(null)}
              title="Customer's WO / PO"
              subtitle="Upload the customer's PDF and review the details CBI extracts before creating the job."
              size="xl"
            >
              <Modal.Body>
                <CreateFormPdfPicker
                  file={templatePdf ?? null}
                  onChange={onTemplatePdfChange}
                  onExtracted={applyExtractedCustomerDocument}
                />
              </Modal.Body>
              <Modal.Footer>
                <button type="button" onClick={() => setActiveSetupPanel(null)} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Done</button>
              </Modal.Footer>
            </Modal>
          )}

          {onAttachmentsChange && (
            <CreateFormAttachmentsPicker
              attachments={attachments ?? []}
              onChange={onAttachmentsChange}
              open={activeSetupPanel === 'attachments'}
              onOpenChange={(open) => { if (!open) setActiveSetupPanel(null) }}
              hideLauncher
            />
          )}

          <Modal
            isOpen={activeSetupPanel === 'inspection'}
            onClose={() => setActiveSetupPanel(null)}
            title="Inspection Scope"
            subtitle="Choose the checklist the technician will complete for this job."
            size="lg"
          >
            <Modal.Body>{renderInspectionSection()}</Modal.Body>
            <Modal.Footer>
              <button type="button" onClick={() => setActiveSetupPanel(null)} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Done</button>
            </Modal.Footer>
          </Modal>
        </>
      )}
      <div className="mb-4">
        <FormSection title="Required custom fields">
          <CustomFieldsSection
            requirement="required"
            entityType="work_order"
            customerIds={[form.service_customer?.id, form.has_billing_override ? form.billing_customer?.id : enrichedServiceCustomer?.parent_customer_id ?? form.service_customer?.id]}
            entityId={initialData?.id ?? null}
            values={customValues}
            onChange={setCustomValues}
          />
        </FormSection>
      </div>
      <FormSection title="Job Basics">
        <Field label="Title" required error={fieldError('title')}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g., Annual fire door inspection"
            className={inputClass(fieldError('title'))}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Job Type" required error={fieldError('job_type_id')}>
            <select
              value={form.job_type_id}
              onChange={(e) => {
                jobTypeWasManuallySelectedRef.current = true
                update({ job_type_id: e.target.value })
              }}
              className={inputClass(fieldError('job_type_id'))}
              disabled={jobTypesQuery.isLoading}
            >
              <option value="">
                {jobTypesQuery.isLoading ? 'Loading...' : 'Select job type'}
              </option>
              {jobTypes.map((jt) => (
                <option key={jt.id} value={jt.id}>
                  {jt.name}
                  {jt.most_used ? ' ★' : ''}
                </option>
              ))}
            </select>
          </Field>

          {form.kind === 'job' && (
            <Field label="Status" required error={fieldError('status_id')}>
              <select
                value={form.status_id}
                onChange={(e) => {
                  statusWasManuallySelectedRef.current = true
                  update({ status_id: e.target.value })
                }}
                className={inputClass(fieldError('status_id'))}
                disabled={jobStatusesQuery.isLoading}
              >
                <option value="">
                  {jobStatusesQuery.isLoading ? 'Loading...' : 'Select status'}
                </option>
                {jobStatuses.map((js) => (
                  <option key={js.id} value={js.id}>
                    {js.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(e) => update({ priority: e.target.value as WorkOrderPriority })}
              className={inputClass()}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <AutoTextarea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="What needs to be done?"
            minRows={5}
            className={inputClass()}
          />
        </Field>

        {!workspaceLayout && (
          <div className="mt-5 space-y-5 border-t border-slate-200 pt-5" data-tour="job-dispatch">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Dispatch</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Assign the responsible technician and schedule the work now, or leave it unscheduled.
              </p>
            </div>
            <CrewSection
              leadTechAccountId={form.lead_tech_account_id}
              onLeadTechChange={(lead_tech_account_id) => update({ lead_tech_account_id })}
              projectManagerAccountId={form.project_manager_account_id}
              onProjectManagerChange={(project_manager_account_id) => update({ project_manager_account_id })}
              leadTechError={fieldError('lead_tech_account_id')}
              crewMemberAccountIds={form.crew_member_account_ids}
              onCrewMemberChange={(crew_member_account_ids) => update({ crew_member_account_ids })}
              showCrew={form.kind === 'job'}
              embedded
            />
            {renderScheduleFields()}
          </div>
        )}
      </FormSection>
      </div>
      )}
      {/* ---------- Line Items (hidden for Estimate-kind) ----------
          Estimate line items live on the estimate detail page (different
          schema — type: service|product, snapshot semantics). Adding them
          inline here would duplicate that surface. */}
      {(!guidedMode || currentStepName === 'Assets') && form.kind === 'job' && mode === 'create' && (
        <div data-tour="job-lineitems" className={lineItemsClass}>
        <FormSection
          title="Line Items"
          collapsible={!workspaceLayout}
          defaultOpen={workspaceLayout}
          summary={drafts.length > 0 ? `${drafts.length} item${drafts.length === 1 ? '' : 's'}` : 'None yet'}
        >
          <div className="text-xs text-slate-500 mb-2">
            Add line items now or later. They&apos;ll be saved together with the
            work order.
          </div>
          <WorkOrderLineItemEditorBuffered
            drafts={drafts}
            onChange={setDrafts}
            availableAssets={customerAssets
              .filter((a) => form.covered_asset_ids.includes(a.id))
              .map((a) => ({ id: a.id, name: a.name }))}
            disabled={submitting}
          />
        </FormSection>
        </div>
      )}
      {!guidedMode && form.kind === 'job' && mode === 'edit' && (
        <FormSection title="Line Items" collapsible={!workspaceLayout} defaultOpen={workspaceLayout}>
          <div className="text-xs text-slate-500">
            Line items are managed live on the job detail page after saving.
          </div>
        </FormSection>
      )}
      {/* ---------- Covered Assets ----------
          Both Jobs and Estimates use this. Repair work usually targets
          a specific tracked asset (the AC the company installed, the
          fire extinguisher being inspected, etc.). For estimates, sits
          BEFORE Line items so the per-line asset dropdown is scoped. */}
      {(!guidedMode || currentStepName === 'Assets') && (
        <div className={lineItemsClass}>
        <FormSection
          title="Covered assets"
          collapsible={!workspaceLayout && !guidedMode}
          defaultOpen={workspaceLayout}
          summary={form.covered_asset_ids.length > 0 ? `${form.covered_asset_ids.length} selected` : 'None'}
        >
          {form.service_customer ? (
            <CoveredAssetsSection
              customerId={form.service_customer.id}
              selectedIds={form.covered_asset_ids}
              onChange={(ids) => update({ covered_asset_ids: ids })}
            />
          ) : (
            <NoCustomerYet
              hint="Assets live on the customer's record — pick one first to see what's available."
              guidedMode={guidedMode}
              onGoBack={() => setStep(0)}
            />
          )}
        </FormSection>
        </div>
      )}

      {/* ---------- Estimate Line Items (step 3) ----------
          Buffered editor — drafts live in form state until estimate is
          POSTed. Per-line asset_id picker scopes to the covered assets
          chosen in the previous step. */}
      {form.kind === 'estimate' && (!guidedMode || currentStepName === 'Line items') && (
        <div data-tour="estimate-lineitems" className={lineItemsClass}>
        <FormSection
          title="Line items"
          collapsible={!workspaceLayout && !guidedMode}
          defaultOpen={workspaceLayout}
          summary={form.line_drafts.length > 0 ? `${form.line_drafts.length} item${form.line_drafts.length === 1 ? '' : 's'}` : 'None yet'}
        >
          <div className="text-xs text-slate-500 mb-2">
            Add service, product, fee, or discount lines now. Choose a customer
            when you need to associate a line with one of their tracked assets.
          </div>
          <EstimateLineItemEditorBuffered
            drafts={form.line_drafts}
            onChange={(d) => update({ line_drafts: d })}
            availableAssets={customerAssets
              .filter((a) => form.covered_asset_ids.includes(a.id))
              .map((a) => ({ id: a.id, name: a.name }))}
            disabled={submitting}
          />
        </FormSection>
        </div>
      )}

      {/* ---------- Notes ---------- */}
      {(!guidedMode || step === lastStep) && (
        <div className={bottomLeftClass}>
          <FormSection title="Optional custom fields">
            <CustomFieldsSection
              requirement="optional"
              entityType="work_order"
              customerIds={[form.service_customer?.id, form.has_billing_override ? form.billing_customer?.id : enrichedServiceCustomer?.parent_customer_id ?? form.service_customer?.id]}
              entityId={initialData?.id ?? null}
              values={customValues}
              onChange={setCustomValues}
            />
          </FormSection>
        </div>
      )}
      {(!guidedMode || step === lastStep) && (
      <div className={bottomLeftClass}>
      <FormSection
        title="Notes"
        collapsible={!workspaceLayout && !guidedMode}
        defaultOpen={workspaceLayout}
        summary={(form.internal_notes.trim() || form.public_notes.trim()) ? 'Has notes' : 'Optional'}
      >
        <Field label="Internal Notes (not visible to customer)">
          <textarea
            value={form.internal_notes}
            onChange={(e) => update({ internal_notes: e.target.value })}
            rows={3}
            placeholder="Anything the team should know..."
            className={inputClass()}
          />
        </Field>
        <Field label="Public Notes (may appear on customer-facing docs)">
          <textarea
            value={form.public_notes}
            onChange={(e) => update({ public_notes: e.target.value })}
            rows={3}
            placeholder="Notes for the customer..."
            className={inputClass()}
          />
        </Field>
      </FormSection>
      </div>
      )}

      {/* Inline step nav — sits directly below the current step's content
          so dispatch doesn't have to hunt for the sticky footer. Only
          renders in guided mode; the sticky footer still works as a
          backup for power users. */}
      {guidedMode && (
        <div className={`${fullSpanClass} mt-4 mb-2 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3`}>
          <div>
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50 rounded-md disabled:opacity-50"
              >
                ← Back
              </button>
            ) : (
              <span className="text-xs text-slate-500">First step.</span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </div>
          <div>
            {!onLastStep ? (
              <button
                type="button"
                onClick={() => { void tryAdvanceStep() }}
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50 shadow-sm"
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50 shadow-sm"
              >
                {submitting
                  ? 'Saving...'
                  : (form.kind === 'estimate' ? 'Create Estimate' : 'Create Job')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------- Sticky footer ---------- */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3 z-10 shadow-lg flex-wrap">
        <div>
          {guidedMode && step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium border border-slate-300 hover:bg-slate-50 rounded-md disabled:opacity-50"
            >
              ← Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {guidedMode && !onLastStep ? (
            <button
              type="button"
              onClick={() => { void tryAdvanceStep() }}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md"
            >
              Next →
            </button>
          ) : (
            <button
              type="submit"
              data-tour={form.kind === 'estimate' ? 'estimate-save' : 'job-save'}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : mode === 'create'
                ? (form.kind === 'estimate' ? 'Create Estimate' : 'Create Job')
                : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* ---------- Location picker modal ---------- */}
      {enrichedServiceCustomer && (
        <LocationPickerModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          customer={enrichedServiceCustomer}
          selectedLocationId={form.service_location_id}
          onSelect={handleLocationSelect}
        />
      )}
    </form>
  )
}

// ---------- Crew section helper ----------

function CrewMemberMultiPicker({
  value,
  leadTechAccountId,
  onChange,
}: {
  value: string[]
  leadTechAccountId: string | null
  onChange: (accountIds: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data = [], isLoading } = useTenantAccounts(query, 100)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectedAccounts = useMemo(() => {
    const byId = new Map<string, TenantAccount>()
    data.forEach((account) => byId.set(account.id, account))
    return value.map((id) => byId.get(id) ?? { id, name: id, email: null, role: null, app_access: false })
  }, [data, value])

  const options = useMemo(
    () => data.filter((account) => account.id !== leadTechAccountId && !value.includes(account.id)),
    [data, leadTechAccountId, value],
  )

  function addAccount(account: TenantAccount) {
    if (value.includes(account.id)) return
    onChange([...value, account.id])
    setQuery('')
    setIsOpen(false)
  }

  function removeAccount(accountId: string) {
    onChange(value.filter((id) => id !== accountId))
  }

  return (
    <div ref={containerRef} className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">Crew helpers (optional)</span>
      {selectedAccounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedAccounts.map((account) => (
            <span
              key={account.id}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800"
            >
              <span className="max-w-[12rem] truncate">{account.name}</span>
              <button
                type="button"
                onClick={() => removeAccount(account.id)}
                className="text-slate-400 hover:text-red-600"
                aria-label={`Remove ${account.name}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search techs or temp crew…"
          autoComplete="off"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        {isOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-auto">
            {isLoading ? (
              <div className="px-3 py-3 text-sm text-slate-500">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">
                {query ? <>No staff found for &ldquo;{query}&rdquo;</> : 'No more staff available.'}
              </div>
            ) : (
              <ul role="listbox" className="py-1">
                {options.map((account) => (
                  <li
                    key={account.id}
                    role="option"
                    aria-selected={false}
                    onClick={() => addAccount(account)}
                    className="px-3 py-2 cursor-pointer text-sm border-l-2 border-transparent hover:bg-amber-50 hover:border-amber-500"
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{account.name}</span>
                      {!account.app_access && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">temp crew · no login</span>
                      )}
                    </div>
                    {account.email && <div className="text-xs text-slate-500 truncate">{account.email}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
/**
 * Field assignment section. The lead tech is explicit because dispatch,
 * mobile, payroll, reports, and notifications all key off lead_tech_account_id.
 * Saved crew remains an optional job roster/template selection.
 */
function CrewSection({
  leadTechAccountId,
  onLeadTechChange,
  leadTechError,
  projectManagerAccountId = null,
  onProjectManagerChange,
  crewMemberAccountIds,
  onCrewMemberChange,
  showCrew = true,
  compact = false,
  embedded = false,
}: {
  leadTechAccountId: string | null
  onLeadTechChange: (accountId: string | null) => void
  leadTechError?: string
  projectManagerAccountId?: string | null
  onProjectManagerChange?: (accountId: string | null) => void
  crewMemberAccountIds: string[]
  onCrewMemberChange: (accountIds: string[]) => void
  showCrew?: boolean
  compact?: boolean
  embedded?: boolean
}) {
  const body = (
    <div className={compact ? 'px-4 py-3 space-y-3' : 'space-y-4'}>
      <p className="text-xs text-slate-500">
        Select the lead tech responsible for the {showCrew ? 'job' : 'estimate'}. Add crew helpers when extra hands are assigned.
      </p>
      <label className="block">
        <span className="block text-xs font-medium text-slate-700 mb-1">
          Lead tech
          {leadTechError && <span className="ml-2 text-red-600 font-normal">{leadTechError}</span>}
        </span>
        <TenantAccountPicker
          value={leadTechAccountId}
          onChange={onLeadTechChange}
          placeholder="Search techs..."
          techOnly
        />
      </label>
      {onProjectManagerChange && (
        <label className="block">
          <span className="block text-xs font-medium text-slate-700 mb-1">
            Project manager
            <span className="ml-2 font-normal text-slate-400">optional</span>
          </span>
          {/*
            No techOnly: an office manager can hold a project and never
            opens the phone app. Gating this the way the lead tech is
            gated would make the field useless for the people it exists
            for.
          */}
          <TenantAccountPicker
            value={projectManagerAccountId}
            onChange={onProjectManagerChange}
            placeholder="Search staff..."
          />
          <span className="mt-1 block text-xs text-slate-500">
            Who is answerable for this going right. Leave it empty and the lead tech holds it.
          </span>
        </label>
      )}
      {showCrew && (
        <CrewMemberMultiPicker
          value={crewMemberAccountIds}
          leadTechAccountId={leadTechAccountId}
          onChange={onCrewMemberChange}
        />
      )}
    </div>
  )

  if (embedded) return body

  if (compact) {
    return (
      <section className="bg-white border border-slate-200 rounded-lg shadow-sm mb-0">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 rounded-t-lg">
          <h2 className="text-sm font-semibold text-slate-950 tracking-tight">Assignment</h2>
        </div>
        {body}
      </section>
    )
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
      <h2 className="text-sm font-semibold text-slate-950 tracking-tight mb-1">Assignment</h2>
      {body}
    </section>
  )
}
function humanizeTimeOffType(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Time off'
}

function workOrderScheduleWindow(form: FormState): { start: Date; end: Date } | null {
  if (!form.scheduled_date) return null

  if (form.scheduled_start_time) {
    const start = new Date(`${form.scheduled_date}T${form.scheduled_start_time.slice(0, 5)}:00`)
    const endTime = form.scheduled_end_time || addMinutes(form.scheduled_start_time, parseInt(form.estimated_duration_minutes, 10) || 120)
    const end = new Date(`${form.scheduled_date}T${endTime.slice(0, 5)}:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    if (end <= start) end.setDate(end.getDate() + 1)
    return { start, end }
  }

  const start = new Date(`${form.scheduled_date}T00:00:00`)
  const end = new Date(`${form.scheduled_date}T23:59:59.999`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start, end }
}

function timeOffBlockWindow(block: ApprovedTimeOffBlock): { start: Date; end: Date } | null {
  if (!block.start_date || !block.end_date) return null

  if (!block.all_day && block.start_time && block.end_time && block.start_date === block.end_date) {
    const start = new Date(`${block.start_date}T${block.start_time.slice(0, 5)}:00`)
    const end = new Date(`${block.end_date}T${block.end_time.slice(0, 5)}:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    if (end <= start) end.setDate(end.getDate() + 1)
    return { start, end }
  }

  const start = new Date(`${block.start_date}T00:00:00`)
  const end = new Date(`${block.end_date}T23:59:59.999`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start, end }
}

function timeOffOverlapsWindow(block: ApprovedTimeOffBlock, scheduledWindow: { start: Date; end: Date }): boolean {
  const timeOffWindow = timeOffBlockWindow(block)
  if (!timeOffWindow) return false
  return scheduledWindow.start.getTime() < timeOffWindow.end.getTime()
    && scheduledWindow.end.getTime() > timeOffWindow.start.getTime()
}

function formatHourLabel(value: string): string {
  const [hourRaw, minuteRaw = '00'] = value.split(':')
  const hour = Number(hourRaw)
  if (!Number.isFinite(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteRaw.padStart(2, '0')} ${suffix}`
}

function formatTimeOffRange(block: Pick<ApprovedTimeOffBlock, 'start_date' | 'end_date' | 'all_day' | 'start_time' | 'end_time'>): string {
  if (!block.start_date || !block.end_date) return 'date not set'
  const start = new Date(`${block.start_date}T00:00:00`)
  const end = new Date(`${block.end_date}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'date not set'
  const startLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`

  if (block.all_day || !block.start_time || !block.end_time) return dateLabel

  const startTime = formatHourLabel(block.start_time.slice(0, 5))
  const endTime = formatHourLabel(block.end_time.slice(0, 5))
  return `${dateLabel}, ${startTime}-${endTime}`
}

// ---------- Inspection checklist picker ----------

interface ChecklistRow {
  id: string
  name: string
  category: string | null
  is_system: boolean
  asset_type_slug: string | null
  description: string | null
  item_count: number
  // Compliance metadata.
  standard?: string
  template_type?: string
  jurisdiction?: string | null
  approved_format_required?: string
  requires_owner_signature?: boolean
  requires_ahj_submission?: boolean
  requires_inspector_permit_number?: boolean
}

const STANDARD_LABEL: Record<string, string> = {
  nfpa_10: 'NFPA 10',
  nfpa_25: 'NFPA 25',
  nfpa_72: 'NFPA 72',
  nfpa_80: 'NFPA 80',
  osha: 'OSHA',
  custom: 'Custom standard',
  none: '',
}

const TEMPLATE_TYPE_LABEL: Record<string, string> = {
  internal: 'Internal checklist',
  customer: 'Customer report',
  ahj: 'AHJ / compliance report',
  warranty: 'Manufacturer / warranty form',
  state: 'State-required form',
}

function InspectionChecklistPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const q = useQuery({
    queryKey: ['inspection-checklists'],
    queryFn: () => apiRequest<{ data: ChecklistRow[] }>('/v1/inspection-checklists'),
    staleTime: 5 * 60_000,
  })

  const rows = q.data?.data ?? []
  const selected = rows.find((r) => r.id === value) ?? null

  return (
    <div className="space-y-2">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full text-sm rounded border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="">— None (not an inspection job) —</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.item_count} items){r.is_system ? '' : ' · custom'}
          </option>
        ))}
      </select>
      {selected && (
        <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <strong>{selected.name}</strong>
          {selected.description && (
            <span className="text-slate-500"> — {selected.description}</span>
          )}
          {/* Compliance badges */}
          {(selected.standard && selected.standard !== 'none') ||
          (selected.template_type && selected.template_type !== 'internal') ||
          selected.requires_owner_signature ||
          selected.requires_inspector_permit_number ||
          selected.requires_ahj_submission ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {selected.standard && selected.standard !== 'none' && (
                <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-red-100 text-red-800">
                  {STANDARD_LABEL[selected.standard] ?? selected.standard}
                </span>
              )}
              {selected.template_type && selected.template_type !== 'internal' && (
                <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-indigo-100 text-indigo-800">
                  {TEMPLATE_TYPE_LABEL[selected.template_type] ?? selected.template_type}
                </span>
              )}
              {selected.jurisdiction && (
                <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-slate-200 text-slate-700">
                  {selected.jurisdiction}
                </span>
              )}
              {selected.requires_inspector_permit_number && (
                <span className="text-[10px] rounded px-1.5 py-0.5 bg-white border border-slate-300 text-slate-600">
                  Permit # required
                </span>
              )}
              {selected.requires_owner_signature && (
                <span className="text-[10px] rounded px-1.5 py-0.5 bg-white border border-slate-300 text-slate-600">
                  Owner signature
                </span>
              )}
              {selected.requires_ahj_submission && (
                <span className="text-[10px] rounded px-1.5 py-0.5 bg-white border border-slate-300 text-slate-600">
                  AHJ submission
                </span>
              )}
            </div>
          ) : null}
          <div className="text-[11px] text-slate-500 mt-0.5">
            {selected.item_count} checklist items will be available for the tech
            on the job detail page.
          </div>
          {selected.approved_format_required === 'ahj' && (
            <div className="text-[11px] text-amber-800 mt-1">
              ⚠ Confirm your local AHJ / customer accepts this report format —
              some jurisdictions require a specific form or third-party portal.
            </div>
          )}
        </div>
      )}
      {!q.isLoading && rows.length === 0 && (
        <p className="text-xs text-slate-500 italic">
          No checklists configured yet. Run the inspection checklists seeder.
        </p>
      )}
    </div>
  )
}

// ---------- Layout helpers ----------

type SectionVariant = 'default' | 'workspace'

interface SectionProps {
  title: string
  children: React.ReactNode
  /** When true, the section header becomes a toggle and the body hides. */
  collapsible?: boolean
  /** Initial open state when collapsible (ignored when not collapsible). */
  defaultOpen?: boolean
  /** Compact preview shown next to the title while collapsed. */
  summary?: React.ReactNode
  /** Full-page create mode uses a tighter, calmer card treatment. */
  variant?: SectionVariant
  /** Allows typeahead menus to float outside workspace card bounds. */
  allowOverflow?: boolean
}

function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  summary,
  variant = 'default',
  allowOverflow = false,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const shellClass = variant === 'workspace'
    ? 'bg-white border border-slate-200 rounded-lg shadow-sm mb-0 ' + (allowOverflow ? 'overflow-visible' : 'overflow-hidden')
    : 'bg-white border border-slate-200 rounded-lg p-6 mb-4'
  const collapsibleShellClass = variant === 'workspace'
    ? 'bg-white border border-slate-200 rounded-lg shadow-sm mb-0 overflow-hidden'
    : 'bg-white border border-slate-200 rounded-lg mb-4'
  const headerButtonClass = variant === 'workspace'
    ? 'w-full flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left hover:bg-slate-100 transition-colors'
    : 'w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 rounded-lg transition-colors'
  const headerClass = variant === 'workspace'
    ? 'border-b border-slate-200 bg-slate-50 px-4 py-2.5'
    : ''
  const bodyClass = variant === 'workspace'
    ? 'px-4 py-3 space-y-3'
    : 'px-6 pb-6 space-y-4'

  // Non-collapsible: render exactly as before (always-open core section).
  if (!collapsible) {
    return (
      <section className={shellClass}>
        {variant === 'workspace' ? (
          <>
            <div className={headerClass}>
              <h2 className="text-sm font-semibold text-slate-950 tracking-tight">{title}</h2>
            </div>
            <div className={bodyClass}>{children}</div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-slate-950 tracking-tight mb-4">{title}</h2>
            <div className="space-y-4">{children}</div>
          </>
        )}
      </section>
    )
  }

  return (
    <section className={collapsibleShellClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={headerButtonClass}
      >
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 4.21a1 1 0 0 1 1.42 0l5 5a1 1 0 0 1 0 1.42l-5 5a1 1 0 0 1-1.42-1.42L11.59 10 7.21 5.62a1 1 0 0 1 0-1.41z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-semibold text-slate-950 tracking-tight">{title}</span>
        {!open && (
          <span className="ml-auto text-xs text-slate-500 truncate">
            {summary ?? 'Optional'}
          </span>
        )}
      </button>
      {open && <div className={bodyClass}>{children}</div>}
    </section>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function inputClass(error?: string): string {
  const base =
    'w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500'
  return base + (error ? ' border-red-300' : ' border-slate-300')
}

function locationLabel(loc: CustomerServiceLocation): string {
  if (loc.nickname) return loc.nickname
  const addr = loc.address
  if (!addr) return 'Unnamed location'
  const parts = [addr.street_address, addr.city, addr.state].filter(Boolean)
  return parts.join(', ') || 'Unnamed location'
}

function locationAddress(loc: CustomerServiceLocation): string {
  const addr = loc.address
  if (!addr) return ''
  if (addr.formatted) return addr.formatted
  const parts = [
    addr.street_address,
    addr.apt_unit,
    addr.city,
    addr.state,
    addr.postal_code,
  ].filter(Boolean)
  return parts.join(', ')
}

function addMinutes(time: string, minutes: number): string {
  if (!time) return ''
  const [h, m] = time.split(':').map((n) => parseInt(n, 10))
  if (isNaN(h) || isNaN(m)) return ''
  const totalMinutes = (h * 60 + m + minutes) % (24 * 60)
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

function addHours(time: string, hours: number): string {
  return addMinutes(time, hours * 60)
}

function defaultScheduleValues() {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return {
    scheduled_date: `${yyyy}-${mm}-${dd}`,
    scheduled_start_time: '09:00',
    scheduled_end_time: '11:00',
    estimated_duration_minutes: '120',
  }
}

/**
 * Estimate-kind covered-assets row. Shows a summary of selected assets
 * (loaded via useAssets) + a button to open the multi-select modal.
 * Lets dispatch attach assets without leaving the create page — useful
 * for phone-in quotes where there's no walkthrough.
 */
function CoveredAssetsSection({
  customerId,
  selectedIds,
  onChange,
}: {
  customerId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  // Pull the customer's asset list so we can show names for what's selected.
  const { data } = useAssets({ customer_id: customerId, per_page: 200 })
  const all = data?.data ?? []
  const selected = all.filter((a) => selectedIds.includes(a.id))

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        Pick which assets this estimate covers. Optional — skip when the estimate is
        a phone-in for one-off work that doesn&apos;t tie back to a specific asset.
      </p>
      {selected.length === 0 ? (
        <div className="text-sm text-slate-400 italic">No assets selected.</div>
      ) : (
        <ul className="space-y-1">
          {selected.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between border border-slate-200 rounded px-3 py-1.5 text-sm"
            >
              <span className="text-slate-800">
                {a.asset_type?.icon && <span className="mr-1">{a.asset_type.icon}</span>}
                {a.name}
                {a.asset_code && <span className="text-xs text-slate-500 ml-2 font-mono">{a.asset_code}</span>}
              </span>
              <button
                type="button"
                onClick={() => onChange(selectedIds.filter((id) => id !== a.id))}
                className="text-xs text-slate-400 hover:text-red-700"
                aria-label="Remove asset"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="text-sm px-3 py-1.5 rounded border border-amber-500 text-amber-700 hover:bg-amber-50"
      >
        {selected.length === 0 ? '+ Pick assets' : 'Edit selection'}
      </button>

      {pickerOpen && (
        <CustomerAssetsPickerModal
          isOpen
          onClose={() => setPickerOpen(false)}
          customerId={customerId}
          selectedAssetIds={selectedIds}
          onChange={(ids) => onChange(ids)}
        />
      )}
    </div>
  )
}

/**
 * Placeholder rendered inside Covered Assets / Line items sections when
 * the user hasn't picked a customer yet. Gives them a clear path back.
 */
function NoCustomerYet({
  hint,
  guidedMode,
  onGoBack,
}: {
  hint: string
  guidedMode: boolean
  onGoBack: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
      <div className="text-sm text-amber-900 flex-1">
        <strong>Pick a customer first.</strong>
        <span className="block text-xs text-amber-800 mt-0.5">{hint}</span>
      </div>
      {guidedMode ? (
        <button
          type="button"
          onClick={onGoBack}
          className="text-xs px-3 py-1.5 rounded border border-amber-600 text-amber-800 hover:bg-amber-100 whitespace-nowrap"
        >
          ← Go to step 1
        </button>
      ) : (
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="text-xs px-3 py-1.5 rounded border border-amber-600 text-amber-800 hover:bg-amber-100 whitespace-nowrap"
        >
          ↑ Scroll to customer
        </a>
      )}
    </div>
  )
}

function IntakeSetupTab({
  icon,
  label,
  status,
  description,
  active,
  filled,
  previewFile,
  previewFallback,
  align = 'center',
  onClick,
}: {
  icon: ReactNode
  label: string
  status: string
  description: string
  active: boolean
  filled: boolean
  previewFile?: File
  previewFallback?: string
  align?: 'left' | 'center' | 'right'
  onClick: () => void
}) {
  const previewUrl = useMemo(
    () => previewFile ? URL.createObjectURL(previewFile) : null,
    [previewFile],
  )

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const isImage = previewFile?.type.startsWith('image/') ?? false
  const isPdf = previewFile?.type === 'application/pdf' || previewFile?.name.toLowerCase().endsWith('.pdf')
  const tooltipPosition = align === 'left'
    ? 'left-0'
    : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2'

  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onClick}
        className={`flex h-full min-h-20 w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left shadow-sm transition-all ${
          active
            ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-200'
            : filled
              ? 'border-emerald-300 bg-emerald-50/80 text-slate-950 hover:border-emerald-500'
              : 'border-slate-300 bg-white text-slate-800 hover:border-amber-400 hover:bg-amber-50/40'
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
            filled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold sm:text-sm">{label}</span>
          <span
            className={`mt-1 inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
              filled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {status}
          </span>
        </span>
      </button>

      <div
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-40 mt-2 w-80 rounded-md border border-slate-300 bg-white p-3 text-xs text-slate-700 opacity-0 shadow-2xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${tooltipPosition}`}
      >
        {(previewUrl || previewFallback) && (
          <div className="mb-3 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            {previewUrl && isImage && (
              <img src={previewUrl} alt="" className="h-36 w-full object-contain" />
            )}
            {previewUrl && isPdf && (
              <iframe
                src={`${previewUrl}#page=1&view=FitH&toolbar=0`}
                title={`${label} preview`}
                className="h-36 w-full bg-white"
              />
            )}
            {previewUrl && !isImage && !isPdf && (
              <div className="flex h-28 flex-col items-center justify-center gap-2 text-slate-600">
                <IconFileInvoice size={30} />
                <span className="max-w-[90%] truncate font-medium">{previewFile?.name}</span>
              </div>
            )}
            {!previewUrl && previewFallback && (
              <div className="flex h-24 items-center gap-3 px-4 text-slate-700">
                <span className="text-amber-700">{icon}</span>
                <span className="font-medium">{previewFallback}</span>
              </div>
            )}
          </div>
        )}
        <span className="block font-semibold text-slate-950">{label}</span>
        <span className="mt-1 block leading-5 text-slate-600">{description}</span>
        {previewFile && (
          <span className="mt-2 block truncate border-t border-slate-200 pt-2 font-medium text-slate-800">
            {previewFile.name}
          </span>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Signable document section — picker + AI generate overlay
// ----------------------------------------------------------------

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

/**
 * Signable document attach section for the create form. Lets the user pick an
 * existing signable template OR generate a fresh contract with AI (saved to
 * Custom Documents + auto-selected). Mirrors the inline section on the
 * Estimate edit form so the experience is consistent between create +
 * edit surfaces.
 *
 * `kind` drives the help text — estimates sign at approve time, WOs
 * sign at tech check-in.
 */
function ContractFormSection({
  kind,
  value,
  onChange,
  jobTitle,
  jobDescription,
  customerName,
  variant = 'default',
}: {
  kind: 'job' | 'estimate'
  value: string
  onChange: (v: string) => void
  jobTitle: string
  jobDescription: string
  customerName: string
  variant?: SectionVariant
}) {
  const [aiOpen, setAiOpen] = useState(false)

  const contractsQ = useQuery({
    queryKey: ['document-templates', 'signable'],
    queryFn: () => apiRequest<{ data: ContractTemplateRow[] }>('/v1/document-templates'),
  })
  const signableTemplates = (contractsQ.data?.data ?? []).filter(
    (template) => template.active && isSignableDocumentTemplate(template)
  )

  const whenSigned =
    kind === 'estimate'
      ? 'Customer signs it on the portal when approving the estimate.'
      : 'Customer signs it on the field tech’s phone before check-in.'

  return (
    <section className={variant === 'workspace' ? 'bg-white border border-slate-200 rounded-lg shadow-sm mb-0 overflow-hidden' : 'bg-white border border-slate-200 rounded-xl p-4 mb-4'}>
      <div className={variant === 'workspace' ? 'flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5' : 'flex items-center justify-between gap-3 mb-3'}>
        <h3 className="text-base font-semibold text-slate-900">Signable document</h3>
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="text-xs font-semibold border border-sky-300 text-sky-700 hover:bg-sky-50 rounded px-2 py-1 inline-flex items-center gap-1"
          title="Describe the scope; AI drafts a contract + saves it to Templates & Forms"
        >
          <span>✨</span> Generate with AI
        </button>
      </div>
      <label className={variant === 'workspace' ? 'block px-4 py-3' : 'block'}>
        <span className="block text-xs font-semibold text-slate-700 mb-1">
          Attached signable document (optional)
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={contractsQ.isLoading}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        >
          <option value="">(no signable document)</option>
          {signableTemplates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {formatTemplateType(c.type)}
            </option>
          ))}
        </select>
        <span className="block text-[11px] text-slate-500 mt-1">
          {value
            ? whenSigned
            : 'Pick a contract, estimate, or work-order template to require a signature, or click Generate with AI above.'}
        </span>
      </label>

      {aiOpen && (
        <CreateFormAiContractModal
          jobTitle={jobTitle}
          jobDescription={jobDescription}
          customerName={customerName}
          onClose={() => setAiOpen(false)}
          onCreated={(id) => {
            onChange(id)
            setAiOpen(false)
          }}
        />
      )}
    </section>
  )
}

/**
 * Same flow as the EstimateEditForm AiContractModal but works without
 * an existing estimate row — the description is composed from the
 * create-form's current title + description + customer name. Save
 * persists a fresh DocumentTemplate then calls onCreated(id).
 */
function CreateFormAiContractModal({
  jobTitle,
  jobDescription,
  customerName,
  onClose,
  onCreated,
}: {
  jobTitle: string
  jobDescription: string
  customerName: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const defaultScope = [jobTitle, jobDescription].filter(Boolean).join('. ').trim()
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
      const description = [
        customerName ? `Contract for customer "${customerName}".` : 'Contract for new customer.',
        scope ? `Scope of work: ${scope}.` : '',
        extra ? `Additional terms / considerations: ${extra}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const suggestedName =
        `Contract — ${customerName || 'Customer'} (new)`.slice(0, 120)

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
      onCreated(res.data.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center px-0 sm:px-4 py-0 sm:py-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl sm:max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col"
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
                  Pre-seeded from the form's title + description. Edit before generating.
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
                  placeholder="Warranty, payment schedule, liability language, etc."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </>
          )}

          {phase === 'preview' && draft && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template name
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
                  Title on the contract
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
              {busy ? 'Saving…' : 'Save + attach'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
