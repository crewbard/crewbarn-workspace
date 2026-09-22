import { apiRequest } from '@/lib/api'
import type {
  Subcontractor,
  SubcontractorInput,
  SubcontractorUpdateInput,
  SubOutInput,
} from '@/types/subcontractor'

interface ListEnvelope { data: Subcontractor[] }
interface ResourceEnvelope<T> { data: T }

export async function listSubcontractors(params: { q?: string; active?: boolean } = {}): Promise<Subcontractor[]> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.active !== undefined) query.set('active', params.active ? '1' : '0')
  const path = '/v1/subcontractors' + (query.toString() ? `?${query}` : '')
  const res = await apiRequest<ListEnvelope>(path)
  return res.data
}

export async function getSubcontractor(id: string): Promise<Subcontractor> {
  const res = await apiRequest<ResourceEnvelope<Subcontractor>>(`/v1/subcontractors/${id}`)
  return res.data
}

export async function createSubcontractor(input: SubcontractorInput): Promise<Subcontractor> {
  const res = await apiRequest<ResourceEnvelope<Subcontractor>>('/v1/subcontractors', {
    method: 'POST',
    body: input,
  })
  return res.data
}

export async function updateSubcontractor(id: string, input: SubcontractorUpdateInput): Promise<Subcontractor> {
  const res = await apiRequest<ResourceEnvelope<Subcontractor>>(`/v1/subcontractors/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return res.data
}

export async function deleteSubcontractor(id: string): Promise<void> {
  await apiRequest(`/v1/subcontractors/${id}`, { method: 'DELETE' })
}

/**
 * POST /v1/work-orders/{id}/sub-out — assigns a subcontractor + sets NTE.
 * Caller passes the workOrderId; the server marks is_subbed=true, sets
 * sub_status='dispatched', generates the sub_wo_number, and stamps
 * sub_dispatched_at.
 */
export async function subOutWorkOrder(workOrderId: string, input: SubOutInput): Promise<unknown> {
  const res = await apiRequest(`/v1/work-orders/${workOrderId}/sub-out`, {
    method: 'POST',
    body: input,
  })
  return res
}

/**
 * PATCH /v1/work-orders/{id}/sub-out — update an EXISTING assignment.
 * Used to swap the sub, revise the NTE, or change the special
 * instructions after the initial sub-out. All fields optional; only
 * what's sent gets updated.
 */
export async function updateSubOutWorkOrder(
  workOrderId: string,
  input: Partial<SubOutInput> & { sub_status?: string },
): Promise<unknown> {
  const res = await apiRequest(`/v1/work-orders/${workOrderId}/sub-out`, {
    method: 'PATCH',
    body: input,
  })
  return res
}

/**
 * DELETE /v1/work-orders/{id}/sub-out — un-sub the WO. Clears every
 * sub_* field and returns the WO to in-house. Intentionally destructive
 * (no soft-undo); the office can re-sub via subOutWorkOrder afterward.
 */
export async function unSubWorkOrder(workOrderId: string): Promise<unknown> {
  const res = await apiRequest(`/v1/work-orders/${workOrderId}/sub-out`, {
    method: 'DELETE',
  })
  return res
}
