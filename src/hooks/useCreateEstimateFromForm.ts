import {
  useCreateEstimate,
  useAttachCoveredAsset,
  useCreateEstimateLineItem,
} from '@/hooks/useEstimates'
import { uploadCreatedFormPdf } from '@/components/workorders/CreateFormPdfPicker'
import {
  uploadDraftAttachment,
  type DraftAttachment,
} from '@/components/workorders/CreateFormAttachmentsPicker'
import type { EstimateCreateFromFormInput } from '@/components/WorkOrderForm'
import type { Estimate } from '@/types/estimate'

export interface CreateEstimateFromFormResult {
  estimate: Estimate
  /** Non-fatal post-create problems (asset/line/PDF) for the caller to surface. */
  issues: string[]
}

/**
 * Single source of truth for creating an estimate from the unified
 * WorkOrderForm (kind=estimate). Used by BOTH /estimates/new
 * (EstimateCreatePage) and /jobs/new?kind=estimate (WorkOrderCreatePage)
 * so the two entry points can never drift — previously each page had its
 * own copy and the /estimates one had gone stale (it dropped line_type,
 * discounts, and show_image_on_doc on line items).
 *
 * Flow: create estimate → attach covered assets → POST line drafts (with
 * ALL fields) → upload the optional customer PDF. The create call may
 * throw (422 etc.) so the caller can map field errors; everything after
 * is best-effort and collected into `issues` (the estimate already exists).
 */
export function useCreateEstimateFromForm() {
  const createEstimate = useCreateEstimate()
  const attachAsset = useAttachCoveredAsset()
  const createEstimateLine = useCreateEstimateLineItem()

  return async function submit(
    input: EstimateCreateFromFormInput,
    opts: { templatePdf?: File | null; attachments?: DraftAttachment[] } = {},
  ): Promise<CreateEstimateFromFormResult> {
    const estimate = await createEstimate.mutateAsync({
      customer_id: input.customer_id,
      customer_service_location_id: input.customer_service_location_id,
      title: input.title,
      description: input.description,
      job_type_id: input.job_type_id,
      status_id: input.status_id,
      priority: input.priority,
      scheduled_start_at: input.scheduled_start_at,
      scheduled_end_at: input.scheduled_end_at,
      estimated_duration_minutes: input.estimated_duration_minutes,
      lead_tech_account_id: input.lead_tech_account_id,
      internal_notes: input.internal_notes,
      customer_notes: input.customer_notes,
      contract_template_id: input.contract_template_id,
    })

    const issues: string[] = []

    // Covered assets — best-effort.
    const assetFailures: string[] = []
    for (const aid of input.covered_asset_ids) {
      try {
        await attachAsset.mutateAsync({ estimateId: estimate.id, assetId: aid })
      } catch {
        assetFailures.push(aid)
      }
    }
    if (assetFailures.length > 0) {
      issues.push(`${assetFailures.length} asset(s) failed to attach`)
    }

    // Line drafts — best-effort. Carries the FULL field set so estimates
    // keep their line types, discounts/fees, and show-image-on-doc flag.
    const lineFailures: string[] = []
    for (const draft of input.line_drafts) {
      try {
        await createEstimateLine.mutateAsync({
          estimateId: estimate.id,
          input: {
            type: draft.type,
            line_type: draft.line_type,
            description: draft.description,
            quantity: draft.quantity,
            unit_price_cents: draft.unit_price_cents,
            service_catalog_item_id: draft.service_catalog_item_id,
            tax_class_id: draft.tax_class_id,
            asset_id: draft.asset_id,
            show_image_on_doc: draft.show_image_on_doc,
            discount_kind: draft.discount_kind,
            discount_value: draft.discount_value,
          },
        })
      } catch {
        lineFailures.push(draft.description || '(unnamed line)')
      }
    }
    if (lineFailures.length > 0) {
      issues.push(
        `${lineFailures.length} line item(s) failed to save:\n  - ${lineFailures.join('\n  - ')}`,
      )
    }

    // Customer PDF — best-effort. Carries over to the WO on convert.
    if (opts.templatePdf) {
      try {
        await uploadCreatedFormPdf(`/v1/estimates/${estimate.id}/template`, opts.templatePdf)
      } catch (e) {
        issues.push(`Customer PDF failed to upload: ${(e as Error).message}`)
      }
    }

    // Draft attachments (photos + docs) — best-effort, one POST each.
    // Mirrors WorkOrderCreatePage so estimates get creation-time upload
    // parity. The estimate already exists; a failed upload only surfaces
    // in `issues` for the user to re-add on the detail page.
    for (const draft of opts.attachments ?? []) {
      try {
        await uploadDraftAttachment(`/v1/estimates/${estimate.id}/attachments`, draft)
      } catch (e) {
        issues.push(`Attachment "${draft.file.name}" failed to upload: ${(e as Error).message}`)
      }
    }

    return { estimate, issues }
  }
}
