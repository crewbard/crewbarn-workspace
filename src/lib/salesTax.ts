import { apiRequest } from '@/lib/api'
import type { TaxClass } from '@/types/taxClass'

export interface SalesTaxComponent {
  name: string
  rate_pct: number
  jurisdiction: string | null
  remit_to: string | null
}

export interface SalesTaxLookup {
  zip: string
  state: string | null
  county: string | null
  city: string | null
  combined_pct: number
  jurisdiction: string
  components: SalesTaxComponent[]
}

/**
 * Look up the state + county/city/district sales-tax rates for a ZIP (zip.tax,
 * via the backend). Throws ApiError on a bad ZIP or when the provider key
 * isn't configured (code: not_configured) — callers fall back to manual entry.
 */
export async function lookupSalesTaxRate(zip: string): Promise<SalesTaxLookup> {
  const res = await apiRequest<{ data: SalesTaxLookup }>(
    `/v1/sales-tax/rate-lookup?zip=${encodeURIComponent(zip)}`,
  )
  return res.data
}

export async function seedDefaultSalesTaxClass(zip: string): Promise<TaxClass> {
  const res = await apiRequest<{ data: TaxClass }>('/v1/sales-tax/seed-default', {
    method: 'POST',
    body: { zip },
  })
  return res.data
}
