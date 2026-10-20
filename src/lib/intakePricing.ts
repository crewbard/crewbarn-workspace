import { apiRequest } from '@/lib/api'

export interface PricingSuggestion {
  breakdown?: PricingBreakdown | null
  review_inputs?: PricingReviewInputs
  status: 'ready_for_review' | 'partial' | 'needs_information'
  currency: string | null
  catalog_total_cents: number | null
  suggested_total_cents: number | null
  lines: Array<{
    catalog_item_id: string | null
    label: string
    quantity: number | null
    unit: string | null
    unit_price_cents: number | null
    total_cents: number | null
    source: { type: string; id: string; page?: number; label?: string } | null
  }>
  warnings: string[]
  questions: string[]
  assumptions: string[]
  calculated_at: string
  source_revision: string
}

export function formatPricingAmount(cents: number | null, currency: string | null): string {
  if (cents === null || !Number.isSafeInteger(cents)) return 'Not available'
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return 'Currency needed'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
  } catch {
    return 'Currency needed'
  }
}

export function hasPricingShortfall(pricing: PricingSuggestion): boolean {
  return pricing.catalog_total_cents !== null && pricing.suggested_total_cents !== null
    && Number.isSafeInteger(pricing.catalog_total_cents) && Number.isSafeInteger(pricing.suggested_total_cents)
    && pricing.suggested_total_cents > pricing.catalog_total_cents
}

/** Bound the request so an unavailable pricing source does not leave review loading. */
export async function getIntakePricing(id: string): Promise<PricingSuggestion> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const result = await apiRequest<{ data: PricingSuggestion }>(
      `/v1/ai/intake/drafts/${encodeURIComponent(id)}/pricing`,
      { signal: controller.signal },
    )
    return result.data
  } finally {
    clearTimeout(timer)
  }
}

export interface PricingReviewInputs {
  items: Array<{ description: string; catalog_item_id?: string | null; sku?: string | null; vendor_id?: string | null; quantity: number | null; unit?: string | null }>
  labor_hours: number | null
  labor_basis: 'stated' | 'estimate'
  scope_complete: boolean
  after_hours: boolean | null
}

export function pricingReviewInputs(pricing: PricingSuggestion): PricingReviewInputs {
  if (pricing.review_inputs) return structuredClone(pricing.review_inputs)
  return {
    items: pricing.lines.map(line => ({ description: line.label, catalog_item_id: line.catalog_item_id, quantity: line.quantity, unit: line.unit })),
    labor_hours: null, labor_basis: 'estimate', scope_complete: false, after_hours: null,
  }
}

export function pricingNumberInput(value: string): number | null {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

/** A scenario calculation only; this endpoint does not save any draft or quote changes. */
export async function previewIntakePricing(id: string, inputs: PricingReviewInputs): Promise<PricingSuggestion> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const result = await apiRequest<{ data: PricingSuggestion }>(
      `/v1/ai/intake/drafts/${encodeURIComponent(id)}/pricing/preview`,
      { method: 'POST', body: inputs, signal: controller.signal },
    )
    return result.data
  } finally {
    clearTimeout(timer)
  }
}

export type PricingBreakdownKey = 'materials' | 'labor' | 'overhead' | 'insurance' | 'profit' | 'growth'
export interface PricingBreakdown {
  status: 'complete' | 'incomplete'
  labor_hours: number | null
  monthly_billable_hours: number | null
  rows: Array<{ key: PricingBreakdownKey; amount_cents: number | null; target_percent?: number | null }>
  cost_total_cents: number | null
  price_total_cents: number | null
  notes: string[]
}

export const pricingBreakdownLabels: Record<PricingBreakdownKey, string> = {
  materials: 'Materials', labor: 'Labor', overhead: 'Overhead', insurance: 'Company insurance', profit: 'Profit', growth: 'Growth',
}
const breakdownKeys = Object.keys(pricingBreakdownLabels) as PricingBreakdownKey[]
const validAmount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const validNullableAmount = (value: unknown) => value === null || validAmount(value)
const validHours = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)

/** Treat an invalid optional cost explanation as unavailable; keep the sell-price card usable. */
export function getPricingBreakdown(pricing: Pick<PricingSuggestion, 'breakdown' | 'suggested_total_cents'>): PricingBreakdown | null {
  const value = pricing.breakdown
  if (!value || !['complete', 'incomplete'].includes(value.status) || !Array.isArray(value.rows)
    || value.rows.length !== breakdownKeys.length || !Array.isArray(value.notes) || !value.notes.every(note => typeof note === 'string')
    || !validHours(value.labor_hours) || !validHours(value.monthly_billable_hours)
    || !validNullableAmount(value.cost_total_cents) || !validNullableAmount(value.price_total_cents)) return null
  const seen = new Set<string>()
  for (const row of value.rows) {
    if (!row || !breakdownKeys.includes(row.key) || seen.has(row.key) || !validNullableAmount(row.amount_cents)
      || (row.target_percent != null && (typeof row.target_percent !== 'number' || !Number.isFinite(row.target_percent) || row.target_percent < 0 || row.target_percent > 100))) return null
    seen.add(row.key)
  }
  const rows = breakdownKeys.map(key => value.rows.find(row => row.key === key)!)
  if (value.status === 'complete') {
    if (!rows.every(row => validAmount(row.amount_cents)) || !validAmount(value.cost_total_cents) || !validAmount(value.price_total_cents)
      || rows.reduce((sum, row) => sum + row.amount_cents!, 0) !== value.price_total_cents
      || rows.slice(0, 4).reduce((sum, row) => sum + row.amount_cents!, 0) !== value.cost_total_cents
      || value.price_total_cents !== pricing.suggested_total_cents) return null
  }
  return { ...value, rows }
}

export function pricingShare(amount: number | null, total: number | null): number | null {
  return validAmount(amount) && validAmount(total) && total > 0 && amount <= total ? amount / total * 100 : null
}

export function formatPricingPercent(percent: number | null): string {
  return percent !== null && Number.isFinite(percent) && percent >= 0 && percent <= 100
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, style: 'percent' }).format(percent / 100) : 'Needs review'
}
