import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { WorkOrderForm } from '@/components/WorkOrderForm'
import type { EstimateCreateFromFormInput } from '@/components/WorkOrderForm'
import { useCreateEstimateFromForm } from '@/hooks/useCreateEstimateFromForm'
import { useCustomer } from '@/hooks/useCustomers'
import { getAiIntakeDraft } from '@/lib/comms'
import type { DraftAttachment } from '@/components/workorders/CreateFormAttachmentsPicker'

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
  const easy = theme === 'easy-side' || theme === 'easy-top'
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
    <div className={easy ? 'w-full min-w-0 px-3 sm:px-6 py-4 sm:py-6' : 'max-w-[1640px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6'}>
      {easy ? <EasyPageHeading title="New estimate" description="Choose the customer, describe the work, and review pricing. Skip scheduling for a phone quote, or schedule a walkthrough using the same form." /> : <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">New Estimate</h1>
        <p className="text-sm text-slate-500 mt-1">
          Phone-in quote? Skip scheduling and pick the covered assets below.
          Walkthrough visit? Schedule it like a normal job — same form.
        </p>
      </div>}
      <WorkOrderForm
        mode="create"
        initialServiceCustomer={customerQuery.data ?? null}
        aiIntakeDraft={aiIntakeDraftQuery.data ?? null}
        initialKind="estimate"
        lockKind
        layout="workspace"
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
