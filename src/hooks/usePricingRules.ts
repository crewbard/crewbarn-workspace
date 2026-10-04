import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * The pricing rules from the Company Cost Model.
 *
 * One place decides what a markup or a floor is, and everywhere that prices
 * work reads it from here. Before this, the cost model was a page you typed
 * numbers into that nothing ever read.
 *
 * Every value can be null, and a null must stay a null: a shop that has not
 * been through the cost walkthrough has no markup, and inventing one would
 * change what their customers are charged without anybody choosing it.
 * Callers show nothing rather than guess.
 *
 * The query is allowed to fail quietly. It needs the catalog permission, and
 * somebody without it still has to be able to write an estimate — they just
 * do not get the suggestions.
 */
export interface PricingRules {
  material_markup_percent: number | null
  labor_markup_percent: number | null
  minimum_service_call: number | null
  minimum_job_profit: number | null
  after_hours_multiplier: number | null
  /** What to quote an hour at: break-even lifted by the target margin. */
  suggested_hourly_rate: number | null
}

export const PRICING_RULES_KEY = ['pricing-rules'] as const

export function usePricingRules() {
  const query = useQuery({
    queryKey: PRICING_RULES_KEY,
    queryFn: () => apiRequest<{ data: PricingRules }>('/v1/pricing-rules'),
    // They change about once a year. Re-asking on every line item is waste.
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  return query.data?.data ?? null
}

/**
 * What to charge for something that cost you this much.
 *
 * Returns null when there is no markup to apply, which the caller must treat
 * as "say nothing" rather than "charge cost".
 */
export function priceFromCost(costCents: number, markupPercent: number | null): number | null {
  if (markupPercent === null || costCents <= 0) return null
  return Math.round(costCents * (1 + markupPercent / 100))
}
