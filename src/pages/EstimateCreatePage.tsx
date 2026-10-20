import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { WorkOrderForm } from '@/components/WorkOrderForm'
import { FocusFormSectionNav } from '@/components/workorders/FocusFormSectionNav'
import type { EstimateCreateFromFormInput } from '@/components/WorkOrderForm'
import { useCreateEstimateFromForm } from '@/hooks/useCreateEstimateFromForm'
import { useCustomer } from '@/hooks/useCustomers'
import { getAiIntakeDraft } from '@/lib/comms'
import type { DraftAttachment } from '@/components/workorders/CreateFormAttachmentsPicker'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { IntakePriceSuggestion } from '@/components/comms/IntakePriceSuggestion'

/**
 * EstimateCreatePage — unified-create-form path with Kind locked to
 * 'estimate'. Same workflow as /jobs/new but submits to /v1/estimates
 * and exposes a Covered Assets picker for phone-in quotes that don't
 * need a walkthrough.
 *
 * URL params (back-compat with the older dedicated estimate flow):
 *   - customer_id              → preselect customer
 *   - customer_service_location_id → handled in form's location picker
 *   - asset_id                 → seed not yet auto-applied; user picks
 *                                via the Covered Assets section.
 */
export function EstimateCreatePage() {
  const { theme } = useTheme()
  const { has } = usePermissions()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const focus = theme === 'focus'
  const [guidedMode, setGuidedMode] = useState(() => {
    try {
      return localStorage.getItem('crewbarn:focus-estimate-guided') !== '0'
    } catch {
      return true
    }
  })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerId = searchParams.get('customer_id') ?? undefined
  const aiIntakeDraftId = searchParams.get('ai_intake_draft_id') ?? undefined

  const customerQuery = useCustomer(customerId)
  const aiIntakeDraftQuery = useQuery({
    queryKey: ['ai-intake-draft', aiIntakeDraftId],
    queryFn: () => getAiIntakeDraft(aiIntakeDraftId!),
    enabled: !!aiIntakeDraftId,
  })
  const submitEstimate = useCreateEstimateFromForm()

  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({})
  const [templatePdf, setTemplatePdf] = useState<File | null>(null)
  const [attachments, setAttachments] = useState<DraftAttachment[]>([])
  const [pdfPickerRequest, setPdfPickerRequest] = useState(0)

  async function handleSubmitEstimate(input: EstimateCreateFromFormInput) {
    setSubmitting(true)
    setServerErrors({})
    try {
      const { estimate, issues } = await submitEstimate(input, { templatePdf, attachments })

      if (issues.length > 0) {
        alert(
          `Estimate created with issues — re-add on the detail page:\n\n` + issues.join('\n\n'),
        )
      }

      navigate(`/estimates/${estimate.id}`)
    } catch (err) {
      const errObj = err as {
        status?: number
        payload?: { errors?: Record<string, string[]> }
      }
      if (errObj?.status === 422 && errObj?.payload?.errors) {
        setServerErrors(errObj.payload.errors)
      } else {
        alert('Failed to create estimate: ' + String(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div data-focus-form="estimate" className={easy ? 'w-full min-w-0 px-3 sm:px-6 py-4 sm:py-6' : 'max-w-[1640px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6'}>
      {easy ? <div data-tour="estimate-new-header"><EasyPageHeading title="New estimate" description="Choose the customer, describe the work, and review pricing. Skip scheduling for a phone quote, or schedule a walkthrough using the same form." /></div> : <div data-tour="estimate-new-header" className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">New Estimate</h1>
        <p className="text-sm text-slate-500 mt-1">
          Phone-in quote? Skip scheduling and pick the covered assets below.
          Walkthrough visit? Schedule it like a normal job — same form.
        </p>
      </div>}
      {focus && <div data-tour="estimate-order-book" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <strong className="text-sm text-slate-900">Quote with the catalog in front of you</strong>
          <p className="mt-0.5 text-xs text-slate-600">Pick an item from the company PDF book to add it to this estimate. Matching shop catalog items use their saved price and tax; review PDF-only prices before sending. Good / Better / Best options stay available.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {has(PERM.CATALOG_VIEW) && <button type="button" onClick={() => setPdfPickerRequest((request) => request + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Add from PDF order book</button>}
          {!guidedMode && <button type="button" onClick={() => document.querySelector('[data-tour="estimate-lineitems"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-lg bg-[var(--accent-500,#e8902c)] px-3 py-2 text-sm font-semibold text-white">Line items & options</button>}
        </div>
      </div>}
      {focus && <div data-tour="estimate-entry-mode" role="group" aria-label="Estimate form layout" className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {([['guided', 'Step by step'], ['full', 'Full page']] as const).map(([mode, label]) => <button key={mode} type="button" data-tour={`estimate-entry-${mode}`} aria-pressed={guidedMode === (mode === 'guided')} onClick={() => {
          const next = mode === 'guided'
          setGuidedMode(next)
          try { localStorage.setItem('crewbarn:focus-estimate-guided', next ? '1' : '0') } catch { /* optional local preference */ }
        }} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${guidedMode === (mode === 'guided') ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
      </div>}
      {focus && !guidedMode && <FocusFormSectionNav kind="estimate" />}
      {aiIntakeDraftId && <section className="mb-5" aria-label="Call pricing review">
        <h2 className="text-base font-semibold text-slate-900">Review the price from this call</h2>
        <p className="mt-1 text-sm text-slate-600">Check the recommendation before preparing your estimate. Changes to the estimate below do not change this call’s price review.</p>
        <IntakePriceSuggestion key={aiIntakeDraftId} draftId={aiIntakeDraftId} fetchOnMount />
      </section>}
      <WorkOrderForm
        mode="create"
        initialServiceCustomer={customerQuery.data ?? null}
        aiIntakeDraft={aiIntakeDraftQuery.data ?? null}
        initialKind="estimate"
        lockKind
        layout="workspace"
        guidedMode={focus ? guidedMode : undefined}
        pdfPickerRequest={pdfPickerRequest}
        templatePdf={templatePdf}
        onTemplatePdfChange={setTemplatePdf}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        onSubmit={() => { /* unreachable — kind is locked to estimate */ }}
        onSubmitEstimate={handleSubmitEstimate}
        onCancel={() => navigate('/estimates')}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </div>
  )
}
