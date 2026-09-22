import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CustomerPicker } from '@/components/CustomerPicker'
import { LocationPickerModal } from '@/components/LocationPickerModal'
import { SubcontractorPicker } from '@/components/subs/SubcontractorPicker'
import {
  CreateFormAttachmentsPicker,
  type DraftAttachment,
  uploadDraftAttachment,
} from '@/components/workorders/CreateFormAttachmentsPicker'
import { CreateFormPdfPicker, uploadCreatedFormPdf } from '@/components/workorders/CreateFormPdfPicker'
import { useCreateWorkOrder } from '@/hooks/useWorkOrders'
import { useCustomer } from '@/hooks/useCustomers'
import { useJobTypes } from '@/hooks/useJobTypes'
import { useJobStatuses } from '@/hooks/useJobStatuses'
import { subOutWorkOrder } from '@/lib/subcontractors'
import type { Customer } from '@/types/customer'
import type { Subcontractor } from '@/types/subcontractor'
import { useFormDrafts, newDraftId, type FormDraft } from '@/hooks/useFormDrafts'
import { SavedDraftPanel } from '@/components/forms/SavedDraftPanel'

const SUB_STEPS = ['Customer', 'Subcontractor', 'Job basics', 'Schedule & NTE', 'Review & Create'] as const

type SubJobDraftState = {
  serviceCustomer: Customer | null
  serviceLocationId: string | null
  serviceLocationLabel: string
  sub: Subcontractor | null
  title: string
  description: string
  scheduledDate: string
  nteDollars: string
  specialInstructions: string
}

/**
 * SubJobForm — the form BODY only for creating a subbed-out work order.
 * Embedded inside WorkOrderCreatePage when ?kind=sub. Extracted from
 * the old SubJobCreatePage so the create-page host can swap between
 * Job / Estimate / Sub without route navigation.
 *
 * Submit is two API calls in sequence:
 *   1. POST /v1/work-orders — create the WO normally.
 *   2. POST /v1/work-orders/{id}/sub-out — flip is_subbed, set NTE,
 *      generate sub_wo_number, stamp dispatched.
 */
export function SubJobForm({ guidedMode }: { guidedMode: boolean }) {
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const createWorkOrder = useCreateWorkOrder()
  const { data: jobTypesData } = useJobTypes({ active: true })
  const { data: jobStatusesData } = useJobStatuses({ active: true })

  const [serviceCustomer, setServiceCustomer] = useState<Customer | null>(null)
  const [serviceLocationId, setServiceLocationId] = useState<string | null>(null)
  const [serviceLocationLabel, setServiceLocationLabel] = useState<string>('')
  const [sub, setSub] = useState<Subcontractor | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [nteDollars, setNteDollars] = useState<string>('')
  const [specialInstructions, setSpecialInstructions] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverErr, setServerErr] = useState<string | null>(null)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [templatePdf, setTemplatePdf] = useState<File | null>(null)
  const [attachments, setAttachments] = useState<DraftAttachment[]>([])
  const [step, setStep] = useState(0)
  const draftId = useRef(newDraftId())
  const { drafts: savedDrafts, saveDraft, deleteDraft } = useFormDrafts<SubJobDraftState>('sub-job')
  const otherDrafts = savedDrafts.filter((draft) => draft.id !== draftId.current)
  const [selectedSavedDraft, setSelectedSavedDraft] = useState<FormDraft<SubJobDraftState> | null>(null)
  const restoringDraftRef = useRef(false)

  useEffect(() => {
    const hasContent = !!(serviceCustomer || sub || title.trim() || description.trim() || scheduledDate || nteDollars)
    if (!hasContent) return
    const timer = window.setTimeout(() => {
      saveDraft(
        draftId.current,
        { serviceCustomer, serviceLocationId, serviceLocationLabel, sub, title, description, scheduledDate, nteDollars, specialInstructions },
        `${title.trim() || serviceCustomer?.display_name || sub?.business_name || 'Untitled'} (sub)`,
      )
    }, 700)
    return () => window.clearTimeout(timer)
  }, [serviceCustomer, serviceLocationId, serviceLocationLabel, sub, title, description, scheduledDate, nteDollars, specialInstructions, saveDraft])

  const resumeDraft = (draft: FormDraft<SubJobDraftState>) => {
    const data = draft.data
    restoringDraftRef.current = true
    setServiceCustomer(data.serviceCustomer)
    setServiceLocationId(data.serviceLocationId)
    setServiceLocationLabel(data.serviceLocationLabel)
    setSub(data.sub)
    setTitle(data.title)
    setDescription(data.description)
    setScheduledDate(data.scheduledDate)
    setNteDollars(data.nteDollars)
    setSpecialInstructions(data.specialInstructions)
    draftId.current = draft.id
    setSelectedSavedDraft(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const enrichedCustomerQ = useCustomer(serviceCustomer?.id)
  const enrichedCustomer = enrichedCustomerQ.data ?? serviceCustomer

  useEffect(() => {
    if (restoringDraftRef.current) {
      restoringDraftRef.current = false
      return
    }
    setServiceLocationId(null)
    setServiceLocationLabel('')
  }, [serviceCustomer?.id])

  useEffect(() => {
    if (!enrichedCustomer || serviceLocationId) return
    const primary = (enrichedCustomer.service_locations ?? []).find((l) => l.is_primary)
      ?? enrichedCustomer.service_locations?.[0]
    if (primary) {
      setServiceLocationId(primary.id)
      setServiceLocationLabel(formatLocationLabel(primary))
    }
  }, [enrichedCustomer, serviceLocationId])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!serviceCustomer) e.service_customer_id = 'Pick the customer being serviced.'
    if (!serviceLocationId) e.service_location_id = 'Pick a service location.'
    if (!sub) e.subcontractor_id = 'Pick the subcontractor doing the work.'
    if (!title.trim()) e.title = 'Give this sub job a short title.'
    if (!description.trim()) e.description = 'Describe the scope of work.'
    const nteN = parseFloat(nteDollars)
    if (!nteDollars.trim() || isNaN(nteN) || nteN < 0) e.sub_nte_cents = 'NTE must be a non-negative number.'
    setErrors(e)
    if (Object.keys(e).length > 0 && guidedMode) setStep(firstInvalidStep(e))
    return Object.keys(e).length === 0
  }

  function validateStep(stepIndex: number): boolean {
    const e: Record<string, string> = {}
    if (stepIndex === 0) {
      if (!serviceCustomer) e.service_customer_id = 'Pick the customer being serviced.'
      if (!serviceLocationId) e.service_location_id = 'Pick a service location.'
    }
    if (stepIndex === 1 && !sub) {
      e.subcontractor_id = 'Pick the subcontractor doing the work.'
    }
    if (stepIndex === 2) {
      if (!title.trim()) e.title = 'Give this sub job a short title.'
      if (!description.trim()) e.description = 'Describe the scope of work.'
    }
    if (stepIndex === 3) {
      const nteN = parseFloat(nteDollars)
      if (!nteDollars.trim() || isNaN(nteN) || nteN < 0) e.sub_nte_cents = 'NTE must be a non-negative number.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function firstInvalidStep(e: Record<string, string>): number {
    if (e.service_customer_id || e.service_location_id) return 0
    if (e.subcontractor_id) return 1
    if (e.title || e.description) return 2
    if (e.sub_nte_cents) return 3
    return 4
  }

  function tryAdvanceStep() {
    if (validateStep(step)) setStep((s) => Math.min(SUB_STEPS.length - 1, s + 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setServerErr(null)
    if (!validate()) return

    const jobTypeId = jobTypesData?.data?.[0]?.id
    const statusId = jobStatusesData?.data?.[0]?.id
    if (!jobTypeId || !statusId) {
      setServerErr(
        'No job types or statuses found for this tenant. Open Tool Shed → Job Types / Job Statuses to add at least one of each, then come back.',
      )
      return
    }

    setSubmitting(true)
    try {
      const nteCents = Math.round(parseFloat(nteDollars) * 100)
      const wo = await createWorkOrder.mutateAsync({
        job_type_id: jobTypeId,
        status_id: statusId,
        title: title.trim(),
        description: description.trim(),
        service_customer_id: serviceCustomer!.id,
        service_location_id: serviceLocationId!,
        is_scheduled: !!scheduledDate,
        scheduled_date: scheduledDate || null,
      })

      try {
        await subOutWorkOrder(wo.id, {
          subcontractor_id: sub!.id,
          sub_nte_cents: nteCents,
          sub_special_instructions: specialInstructions.trim() || null,
        })
        // Best-effort: PDF + attachments. None of these block the
        // navigate-to-detail; failures just print to the console.
        if (templatePdf) {
          try {
            await uploadCreatedFormPdf(`/v1/work-orders/${wo.id}/template`, templatePdf)
          } catch (e) {
            console.warn('Customer PDF upload failed', e)
          }
        }
        for (const draft of attachments) {
          try {
            await uploadDraftAttachment(`/v1/work-orders/${wo.id}/attachments`, draft)
          } catch (e) {
            console.warn('Attachment upload failed', draft.file.name, e)
          }
        }
        deleteDraft(draftId.current)
        navigate('/jobs/' + wo.id)
      } catch (subErr) {
        const msg = (subErr as { payload?: { message?: string } })?.payload?.message
          ?? 'Sub-out step failed. The work order was created but is not yet flagged as subbed; retry from its detail page.'
        alert(msg)
        deleteDraft(draftId.current)
        navigate('/jobs/' + wo.id)
      }
    } catch (err) {
      const e = err as { payload?: { message?: string; errors?: Record<string, string[]> } }
      if (e?.payload?.errors) {
        const flat: Record<string, string> = {}
        for (const [k, v] of Object.entries(e.payload.errors)) flat[k] = v[0]
        setErrors(flat)
        if (guidedMode) setStep(firstInvalidStep(flat))
      } else {
        setServerErr(e?.payload?.message ?? String(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500'
  const lastStep = SUB_STEPS.length - 1
  const onLastStep = step >= lastStep
  const ntePreview = Number.isFinite(parseFloat(nteDollars))
    ? `$${parseFloat(nteDollars).toFixed(2)}`
    : 'Not set'

  // Section blocks — composed one-per-step in Step-by-step, or into a 2-column
  // workspace in Full page (matching the Job/Estimate form).
  const customerLocationSection = (
    <Section title="Customer & Location">
      <Field label="Customer *" error={errors.service_customer_id}>
        <CustomerPicker value={serviceCustomer} onChange={setServiceCustomer} error={errors.service_customer_id} />
      </Field>
      {serviceCustomer && (
        <Field label="Service location *" error={errors.service_location_id}>
          <div className={`flex items-center justify-between px-3 py-2 border ${errors.service_location_id ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'} rounded-md`}>
            <div className="min-w-0 flex-1">
              {serviceLocationLabel ? (
                <span className="text-sm text-slate-900">{serviceLocationLabel}</span>
              ) : (
                <span className="text-sm text-slate-500 italic">No location picked</span>
              )}
            </div>
            <button type="button" onClick={() => setLocationModalOpen(true)} className="ml-3 text-xs text-amber-700 hover:text-amber-800 underline shrink-0">
              {serviceLocationId ? 'Change' : 'Pick'}
            </button>
          </div>
        </Field>
      )}
    </Section>
  )
  const pdfBlock = (
    <div className="mb-4">
      <CreateFormPdfPicker file={templatePdf} onChange={setTemplatePdf} />
    </div>
  )
  const attachmentsBlock = <CreateFormAttachmentsPicker attachments={attachments} onChange={setAttachments} />
  const subcontractorSection = (
    <Section title="Subcontractor">
      <Field label="Sub doing the work *" error={errors.subcontractor_id}>
        <SubcontractorPicker value={sub} onChange={setSub} error={errors.subcontractor_id} />
      </Field>
    </Section>
  )
  const jobBasicsSection = (
    <Section title="Job Basics">
      <Field label="Title *" error={errors.title}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Replace lobby cylinder, AC condenser swap, etc." className={inputCls} />
      </Field>
      <Field label="Scope of work *" error={errors.description}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe what you're authorizing the sub to do." className={inputCls} />
      </Field>
    </Section>
  )
  const authorizationSection = (
    <Section title="Authorization">
      <Field label="Service date" error={errors.scheduled_date}>
        <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Not-To-Exceed (NTE) — USD *" error={errors.sub_nte_cents}>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">$</span>
          <input type="number" min="0" step="0.01" value={nteDollars} onChange={(e) => setNteDollars(e.target.value)} placeholder="350.00" className={`${inputCls} max-w-[180px]`} />
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Max payout authorized to the sub. Includes labor, materials, and taxes. They must contact you before exceeding.</p>
      </Field>
      <Field label="Special instructions for the sub" error={errors.sub_special_instructions}>
        <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} rows={3} placeholder="Site access, on-site contact, what to do if no one's there, etc." className={inputCls} />
      </Field>
    </Section>
  )
  const reviewSection = (
    <Section title="Review & Create">
      <div className="grid gap-3 md:grid-cols-2">
        <ReviewItem label="Customer" value={serviceCustomer?.display_name ?? 'Not selected'} />
        <ReviewItem label="Service location" value={serviceLocationLabel || 'Not selected'} />
        <ReviewItem label="Subcontractor" value={sub?.business_name ?? 'Not selected'} />
        <ReviewItem label="NTE" value={ntePreview} />
        <ReviewItem label="Title" value={title.trim() || 'Not set'} />
        <ReviewItem label="Service date" value={scheduledDate || 'Not scheduled'} />
      </div>
      {description.trim() && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scope</div>
          <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{description.trim()}</div>
        </div>
      )}
    </Section>
  )

  return (
    <form onSubmit={handleSubmit} className="pb-24">
      {/* Record type — same card + segmented control as WorkOrderForm, so
          Job / Estimate / Sub share identical chrome. */}
      <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Record type</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="rounded-md px-3 py-1.5 text-sm font-semibold capitalize text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              >
                Job
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ kind: 'estimate' })}
                className="rounded-md px-3 py-1.5 text-sm font-semibold capitalize text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              >
                Estimate
              </button>
              <button
                type="button"
                aria-current="page"
                className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold capitalize text-white shadow-sm"
              >
                Sub
              </button>
            </div>
          </div>
          <span className="max-w-2xl text-xs text-slate-500 lg:text-right">
            Sub job — outsourced to a vendor partner with an authorized NTE.
          </span>
        </div>
      </div>

      {serverErr && (
        <div className="mb-4 text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2">
          {serverErr}
        </div>
      )}

      {guidedMode && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-900">
              Step {step + 1} of {SUB_STEPS.length}: {SUB_STEPS[step]}
            </div>
            <div className="text-xs text-slate-500">{Math.round(((step + 1) / SUB_STEPS.length) * 100)}%</div>
          </div>
          <div className="flex gap-1">
            {SUB_STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
      )}

      {guidedMode ? (
        <>
          {step === 0 && <>{customerLocationSection}{pdfBlock}{attachmentsBlock}</>}
          {step === 1 && subcontractorSection}
          {step === 2 && jobBasicsSection}
          {step === 3 && authorizationSection}
          {step === 4 && reviewSection}
        </>
      ) : (
        // Full page — 2-column workspace, matching the Job/Estimate form.
        <div className="grid grid-cols-1 items-start gap-x-3 xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]">
          <div className="min-w-0">
            {customerLocationSection}
            {pdfBlock}
            {attachmentsBlock}
            {jobBasicsSection}
          </div>
          <div className="min-w-0 self-start xl:sticky xl:top-20">
            <SavedDraftPanel
              drafts={otherDrafts}
              selected={selectedSavedDraft}
              onSelect={setSelectedSavedDraft}
              onClose={() => setSelectedSavedDraft(null)}
              onDiscard={(draft) => {
                deleteDraft(draft.id)
                setSelectedSavedDraft(null)
              }}
              onUse={resumeDraft}
              useLabel={() => 'Create sub job from draft'}
              reviewFields={(draft) => [
                { label: 'Type', value: 'Sub job' },
                { label: 'Customer', value: draft.data.serviceCustomer?.display_name ?? '' },
                { label: 'Subcontractor', value: draft.data.sub?.business_name ?? '', wide: true },
                { label: 'Title', value: draft.data.title, wide: true },
                { label: 'Service date', value: draft.data.scheduledDate || 'Unscheduled' },
                { label: 'NTE', value: draft.data.nteDollars ? `$${draft.data.nteDollars}` : '' },
                { label: 'Scope of work', value: draft.data.description, wide: true },
                { label: 'Special instructions', value: draft.data.specialInstructions, wide: true },
              ]}
            />
            {subcontractorSection}
            {authorizationSection}
          </div>
        </div>
      )}

      {/* Unified fixed action bar — same sticky footer as the Job/Estimate form
          (Back on the left in guided mode; Cancel + Next/Create on the right).
          The form's pb-24 reserves space so nothing hides behind it. */}
      <div className="fixed bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-3 shadow-lg sm:gap-3 sm:px-6">
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
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
          {guidedMode && !onLastStep ? (
            <button
              type="button"
              onClick={() => tryAdvanceStep()}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
            >
              {submitting ? 'Creating sub job…' : 'Create sub job'}
            </button>
          )}
        </div>
      </div>

      {enrichedCustomer && (
        <LocationPickerModal
          isOpen={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
          customer={enrichedCustomer}
          selectedLocationId={serviceLocationId ?? undefined}
          onSelect={(locId, location) => {
            setServiceLocationId(locId)
            setServiceLocationLabel(formatLocationLabel(location))
            setLocationModalOpen(false)
          }}
        />
      )}
    </form>
  )
}

interface LocationLike {
  nickname?: string | null
  street_address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

function formatLocationLabel(loc: LocationLike): string {
  const parts = [loc.nickname, loc.street_address, [loc.city, loc.state].filter(Boolean).join(', '), loc.postal_code]
    .filter((p) => p && String(p).trim() !== '')
  return parts.join(' · ')
}

// Matches the Section helper in WorkOrderForm so the cards render
// identically across the three kinds (Job / Estimate / Sub).
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
      <h2 className="text-base font-semibold text-slate-900 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </label>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  )
}