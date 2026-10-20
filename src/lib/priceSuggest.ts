import { apiRequest } from '@/lib/api'
import type { PricingSuggestion } from '@/lib/intakePricing'

/** Pricing plan part 1, steps 2 and 3. Both calls are read only. */

export type BooksStatus = 'matches' | 'differs' | 'not_entered' | 'not_in_books'

export interface BooksRow {
  type: string
  typed_monthly_cents: number
  books_monthly_cents: number
  difference_cents: number
  months_with_data: number
  status: BooksStatus
}

export interface BooksCheck {
  window: { from: string; to: string; months: number }
  enough_history: boolean
  rows: BooksRow[]
  totals: { typed_monthly_cents: number; books_monthly_cents: number }
  billable_hours: { expected_monthly: number | null; clocked_on_jobs_monthly: number; months_with_data: number }
  notes: string[]
}

export async function getBooksCheck(months: 3 | 6): Promise<BooksCheck> {
  const res = await apiRequest<{ data: BooksCheck }>(`/v1/company-cost-model/books-check?months=${months}`)
  return res.data
}

export type BooksChoice = 'typed' | 'books' | 'average'

/** The monthly amount, in dollars, a choice stands for. */
export function chosenMonthly(row: BooksRow, choice: BooksChoice): number {
  const cents = choice === 'typed' ? row.typed_monthly_cents
    : choice === 'books' ? row.books_monthly_cents
    : Math.round((row.typed_monthly_cents + row.books_monthly_cents) / 2)
  return Math.round(cents) / 100
}

export interface SuggestPriceInput {
  items: { catalog_item_id?: string | null; sku?: string | null; description?: string | null; quantity: number }[]
  labor_hours: number | null
  after_hours: boolean | null
}

export type PriceSuggestion = PricingSuggestion & { costs_visible: boolean }

export async function suggestPrice(input: SuggestPriceInput): Promise<PriceSuggestion> {
  const res = await apiRequest<{ data: PriceSuggestion }>('/v1/pricing/suggest', { method: 'POST', body: input })
  return res.data
}

/**
 * The unit price for a line of `quantity` so the line never totals more than
 * the suggested price: rounded down to the cent. `remainderCents` is what the
 * line comes to under the suggestion (0 when it divides evenly), shown to the
 * person so nothing is hidden.
 */
export function linePriceFor(totalCents: number, quantity: number): { unitCents: number; lineCents: number; remainderCents: number } | null {
  if (!Number.isFinite(totalCents) || totalCents <= 0 || !Number.isFinite(quantity) || quantity <= 0) return null
  let unitCents = Math.floor(totalCents / quantity)
  // Guard against float error: the line (rounded as the estimate rounds it) must not pass the total.
  while (unitCents > 0 && Math.round(unitCents * quantity) > totalCents) unitCents -= 1
  if (unitCents <= 0) return null
  const lineCents = Math.round(unitCents * quantity)
  return { unitCents, lineCents, remainderCents: totalCents - lineCents }
}

/** The unit price alone (see linePriceFor). */
export function unitPriceFor(totalCents: number, quantity: number): number | null {
  return linePriceFor(totalCents, quantity)?.unitCents ?? null
}