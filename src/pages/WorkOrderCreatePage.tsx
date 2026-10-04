import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { WorkOrderForm } from '@/components/WorkOrderForm'
import { SubJobForm } from '@/components/subs/SubJobForm'
import type { EstimateCreateFromFormInput } from '@/components/WorkOrderForm'
import { useCreateWorkOrder, useCreateLineItem } from '@/hooks/useWorkOrders'
import { useCreateEstimateFromForm } from '@/hooks/useCreateEstimateFromForm'
import { useCustomer } from '@/hooks/useCustomers'
import { getAiIntakeDraft, linkConversation } from '@/lib/comms'
import type { WorkOrderInput } from '@/types/workOrder'
import type { WorkOrderLineItemDraft } from '@/types/workOrderLineItem'
import { apiRequest } from '@/lib/api'
import { type CustomValues } from '@/components/CustomFieldsSection'
import { uploadCreatedFormPdf } from '@/components/workorders/CreateFormPdfPicker'
import {
  uploadDraftAttachment,
  type DraftAttachment,
} from '@/components/workorders/CreateFormAttachmentsPicker'

/**
 * WorkOrderCreatePage — two-step submit:
 *   1. POST /v1/work-orders with the form input.
 *   2. For each draft line item, POST /v1/work-orders/{id}/line-items.
 *   3. Navigate to /jobs/{id}.
 *
 * Service location creation is handled inside LocationPickerModal -- by the
 * time the form submits, input.service_location_id always references a real,
 * persisted location. No nested-create orchestration here.
 *
 * Failure modes:
 *   - Step 1 fails (422 or otherwise) -> show errors inline, leave form intact.
 *   - Step 2 partial failure -> WO exists; surface a non-blocking alert
 *     listing the failed line items, then navigate to detail so the user
 *     can re-add them there.
 */
export function WorkOrderCreatePage() {
  const { theme } = useTheme()
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
  const createWorkOrder = useCreateWorkOrder()
  const createLineItem = useCreateLineItem()
  const submitEstimate = useCreateEstimateFromForm()

  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({})
  const [templatePdf, setTemplatePdf] = useState<File | null>(null)
  const [attachments, setAttachments] = useState<DraftAttachment[]>([])
  const [guidedMode, setGuidedMode] = useState(() => {
    const easyDefault = theme === 'easy-side' || theme === 'easy-top'
    try {
      const saved = localStorage.getItem('crewbarn:job-form:guided')
      return saved === null ? easyDefault : saved === '1'
    } catch { return easyDefault }
  })

  function setEntryMode(nextGuidedMode: boolean) {
    setGuidedMode(nextGuidedMode)
    try { localStorage.setItem('crewbarn:job-form:guided', nextGuidedMode ? '1' : '0') } catch { /* ignore */ }
  }

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

  async function handleSubmit(
    input: WorkOrderInput,
    drafts: WorkOrderLineItemDraft[],
    coveredAssetIds: string[],
    customValues?: CustomValues,
  ) {
    setSubmitting(true)
    setServerErrors({})

    try {
      const wo = await createWorkOrder.mutateAsync({ ...input, ai_intake_draft_id: aiIntakeDraftId, custom_values: customValues ?? {} })

      // Sequentially POST drafts. Failures don't abort.
      const lineFailures: string[] = []
      for (const draft of drafts) {
        try {
          await createLineItem.mutateAsync({
            workOrderId: wo.id,
            input: {
              line_type: draft.line_type,
              description: draft.description,
              quantity: draft.quantity,
              unit_label: draft.unit_label,
              customer_cost_cents: draft.customer_cost_cents,
              owner_cost_cents: draft.owner_cost_cents,
              is_taxable: draft.is_taxable,
              tax_rate_pct: draft.tax_rate_pct,
              notes: draft.notes,
              show_image_on_doc: draft.show_image_on_doc,
              // Carry catalog/tax-class/asset/discount refs so create-form
              // lines match detail-page (live) lines — without these, a
              // catalog pick during job creation lands untaxed (no tax_class).
              catalog_item_id: draft.catalog_item_id,
              tax_class_id: draft.tax_class_id,
              asset_id: draft.asset_id,
              discount_id: draft.discount_id,
              discount_kind: draft.discount_kind,
              discount_value: draft.discount_value,
            },
          })
        } catch (err) {
          lineFailures.push(draft.description || '(unnamed line)')
          console.error('Line item failed:', err)
        }
      }

      // Attach covered assets — POST /v1/work-orders/{id}/covered-assets
      // for each picked asset. Same shape as estimate attach.
      const assetFailures: string[] = []
      for (const aid of coveredAssetIds) {
        try {
          await apiRequest(`/v1/work-orders/${wo.id}/covered-assets`, {
            method: 'POST',
            body: { asset_id: aid },
          })
        } catch (err) {
          assetFailures.push(aid)
          console.error('Asset attach failed:', err)
        }
      }

      const issues: string[] = []
      if (lineFailures.length > 0)
        issues.push(`${lineFailures.length} line item(s) failed to save:\n  - ${lineFailures.join('\n  - ')}`)
      if (assetFailures.length > 0)
        issues.push(`${assetFailures.length} asset(s) failed to attach`)

      // Upload the customer PDF (if attached) — best-effort
      if (templatePdf) {
        try {
          await uploadCreatedFormPdf(`/v1/work-orders/${wo.id}/template`, templatePdf)
        } catch (e) {
          issues.push(`Customer PDF failed to upload: ${(e as Error).message}`)
        }
      }

      // Upload each draft attachment sequentially. Best-effort: a
      // single failure surfaces in the issues list but doesn't roll
      // back the parent WO.
      for (const draft of attachments) {
        try {
          await uploadDraftAttachment(`/v1/work-orders/${wo.id}/attachments`, draft)
        } catch (e) {
          issues.push(`Attachment "${draft.file.name}" failed to upload: ${(e as Error).message}`)
        }
      }

      // If this job came from a call/text thread, move that thread onto the job
      // so it drops out of the Communications action queue and shows on the job.
      // Prefer the explicit URL param (set when launched from the thread); fall
      // back to the draft's nested relation for older links.
      const sourceConversationId =
        searchParams.get('source_conversation_id') ??
        aiIntakeDraftQuery.data?.comms_message?.conversation_id
      if (sourceConversationId) {
        try {
          await linkConversation(sourceConversationId, wo.id)
        } catch (e) {
          issues.push(`Couldn't attach the call thread to the job: ${(e as Error).message}`)
        }
      }

      if (issues.length > 0) {
        alert(
          `Job created with issues — re-add on the detail page:\n\n` + issues.join('\n\n'),
        )
      }

      navigate(`/jobs/${wo.id}`)
    } catch (err) {
      const errObj = err as {
        status?: number
        payload?: { errors?: Record<string, string[]> }
      }
      if (errObj?.status === 422 && errObj?.payload?.errors) {
        setServerErrors(errObj.payload.errors)
      } else {
        alert('Failed to create job: ' + String(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ?kind=sub renders the SubJobForm body (extracted from the old
  // SubJobCreatePage); ?kind=job|estimate (or absent) renders the
  // standard WorkOrderForm. Toggling between the three is just a
  // search-param update — no route navigation — so the user can
  // bounce between kinds without losing scroll position or page
  // chrome.
  const kindParam = searchParams.get('kind')
  const isSubKind = kindParam === 'sub'
  // Resolve the kind for WorkOrderForm in one shot so its initial
  // state is correct — avoids the "bounce" where WorkOrderForm
  // mounts with kind='job', paints the Job layout, then a useEffect
  // flips it to 'estimate' and re-renders.
  const initialFormKind: 'job' | 'estimate' = kindParam === 'estimate' ? 'estimate' : 'job'
  // Both the Job/Estimate workspace and the Sub form now use the 2-column
  // workspace layout, so both get the wide container.
  const isWorkspaceLayout = true
  const easy = theme === 'easy-side' || theme === 'easy-top'

  return (
    <div className={`${isWorkspaceLayout ? 'max-w-[1640px]' : 'max-w-5xl'} mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6`}>
      <div className={easy ? 'mb-5 rounded-2xl border border-emerald-900 bg-emerald-950 px-5 py-6 shadow-sm sm:px-7' : 'mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5'}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link to="/jobs" className={`inline-flex items-center gap-1 text-sm font-medium hover:underline mb-1 ${easy ? 'text-emerald-200' : 'text-amber-700'}`}>
              ← Back to Jobs
            </Link>
            <div className="flex flex-wrap items-end gap-3">
              <h1 className={easy ? 'text-3xl font-semibold tracking-tight text-white sm:text-4xl' : 'text-2xl font-semibold tracking-tight text-slate-950'}>
                {isSubKind ? 'New Sub Job' : 'New Job'}
              </h1>
              {!isSubKind && (
                <span className={`mb-1 text-xs font-medium uppercase tracking-[0.18em] ${easy ? 'text-emerald-200' : 'text-slate-400'}`}>
                  Intake workspace
                </span>
              )}
            </div>
            {!isSubKind && (
              <p className={`mt-2 max-w-3xl text-sm ${easy ? 'text-emerald-100' : 'text-slate-500'}`}>
                Capture the customer, scope, schedule, files, and billing details without leaving the form.
              </p>
            )}
          </div>
          <div className="inline-flex shrink-0 self-start rounded-md border border-slate-300 bg-slate-100 p-1 lg:self-center" role="group" aria-label="Job entry mode">
            <button type="button" data-easy-view-option onClick={() => setEntryMode(true)} aria-pressed={guidedMode} className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${guidedMode ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
              Step-by-step
            </button>
            <button type="button" data-easy-view-option onClick={() => setEntryMode(false)} aria-pressed={!guidedMode} className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${!guidedMode ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
              Full page
            </button>
          </div>
        </div>
      </div>
      {(theme === 'easy-side' || theme === 'easy-top') && !isSubKind && <aside className="mb-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Creating a job">
        <h2 className="text-sm font-semibold text-slate-900">Start with the customer. Build the job from there.</h2>
        <p className="mt-1 text-sm text-slate-600">Choose the customer and service location, describe the work, then review scheduling, line items, files, and billing before submitting. Use Step-by-step or Full page above without leaving this form.</p>
      </aside>}
      {isSubKind ? (
        <SubJobForm guidedMode={guidedMode} />
      ) : (
        <WorkOrderForm
          // Stable key: job⇄estimate switches IN PLACE (they share customer/
          // scope/lines), so we don't remount — the toggle syncs the URL and
          // updates form.kind without a jump or losing entered data.
          key="wo-create-form"
          mode="create"
          initialKind={initialFormKind}
          layout="workspace"
          guidedMode={guidedMode}
          onGuidedModeChange={setEntryMode}
          initialServiceCustomer={customerQuery.data ?? null}
          aiIntakeDraft={aiIntakeDraftQuery.data ?? null}
          templatePdf={templatePdf}
          onTemplatePdfChange={setTemplatePdf}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onSubmit={handleSubmit}
          onSubmitEstimate={handleSubmitEstimate}
          onCancel={() => navigate('/jobs')}
          submitting={submitting}
          serverErrors={serverErrors}
        />
      )}
    </div>
  )
}
