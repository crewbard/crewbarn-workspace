import { apiRequest } from '@/lib/api'

export type WarrantyStatus = 'active' | 'expired' | 'voided' | 'claimed'

export interface WarrantyRow {
  id: string
  customer: { id: string; display_name: string } | null
  asset: { id: string; name: string; asset_code: string | null } | null
  source_invoice: { id: string; invoice_number: string } | null
  catalog_item_id: string | null
  catalog_item_name: string
  /** Box serial of the sold unit — what a manufacturer claim needs. */
  manufacturer_serial: string | null
  starts_at: string | null
  mfr_expires_at: string | null
  co_expires_at: string | null
  labor_expires_at: string | null
  mfr_duration_days: number | null
  co_duration_days: number | null
  labor_duration_days: number | null
  status: WarrantyStatus
  void_reason: string | null
  voided_at: string | null
  claim_count: number
  last_claimed_at: string | null
  notes: string | null
  extended_mfr_days: number | null
  extended_co_days: number | null
  extended_labor_days: number | null
  extended_paid_cents: number | null
  extended_via_line_ids: string[] | null
  latest_expires_at: string | null
  is_active_now: boolean
  created_at: string | null
  updated_at: string | null
  tenant_id: string
}

export interface WarrantyListParams {
  customer_id?: string
  asset_id?: string
  status?: WarrantyStatus
  expiring_within?: number
  per_page?: number
}

export async function listWarranties(params: WarrantyListParams = {}): Promise<WarrantyRow[]> {
  const qs = new URLSearchParams()
  if (params.customer_id)     qs.set('customer_id', params.customer_id)
  if (params.asset_id)        qs.set('asset_id', params.asset_id)
  if (params.status)          qs.set('status', params.status)
  if (params.expiring_within) qs.set('expiring_within', String(params.expiring_within))
  if (params.per_page)        qs.set('per_page', String(params.per_page))
  const res = await apiRequest<{ data: WarrantyRow[] }>(
    `/v1/warranties${qs.toString() ? `?${qs.toString()}` : ''}`,
  )
  return res.data
}

export async function voidWarranty(id: string, reason: string): Promise<WarrantyRow> {
  const res = await apiRequest<{ data: WarrantyRow }>(
    `/v1/warranties/${id}/void`,
    { method: 'POST', body: { reason } },
  )
  return res.data
}

export async function claimWarranty(id: string): Promise<WarrantyRow> {
  const res = await apiRequest<{ data: WarrantyRow }>(
    `/v1/warranties/${id}/claim`,
    { method: 'POST' },
  )
  return res.data
}
