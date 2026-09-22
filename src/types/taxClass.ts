/**
 * TaxClass types matching the API response shape from TaxClassResource.
 * Keep in sync with: app/Http/Resources/TaxClassResource.php
 *
 * Components are the source of truth. The parent's rate_pct is a
 * denormalized cached SUM of active component rate_pcts, recomputed
 * automatically by TaxClassComponent model events whenever components
 * are created, updated, or deleted.
 *
 * Each component carries remit_to so reporting can break out:
 *   "Of $1,400 collected, $1,200 to FDOR, $200 to Brevard County."
 *
 * Used by:
 *   - Catalog item form tax_class_id picker (loaded via useTaxClasses, 5min stale)
 *   - Tax Classes page (/catalog/tax-classes) for CRUD
 *   - Work order line item tax snapshot (future)
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

// ---------- TaxClassComponent ----------

export interface TaxClassComponent {
  id: string
  tax_class_id: string
  name: string
  rate_pct: number
  jurisdiction: string | null
  remit_to: string | null
  sort_order: number
  active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface TaxClassComponentInput {
  name: string
  rate_pct: number
  jurisdiction?: string | null
  remit_to?: string | null
  sort_order?: number
  active?: boolean
}

// ---------- TaxClass ----------

export interface TaxClass {
  id: string
  name: string
  slug: string
  rate_pct: number              // denormalized cache: SUM(components.rate_pct)
  jurisdiction: string | null
  description: string | null
  active: boolean
  is_default: boolean           // tenant's default class — auto-applied to new invoice lines
  sort_order: number
  components: TaxClassComponent[]
  created_at: string | null
  updated_at: string | null
}

// ---------- Input shapes ----------

/**
 * POST /v1/tax-classes body. Components are nested - backend creates
 * them in a single transaction and recomputes rate_pct via model events.
 *
 * Recommended path: always send at least one component. A tax class
 * with zero components has rate_pct = 0 which is rarely useful.
 */
export interface TaxClassInput {
  name: string
  slug?: string
  jurisdiction?: string | null
  description?: string | null
  active?: boolean
  is_default?: boolean
  sort_order?: number
  components?: TaxClassComponentInput[]
}

/**
 * PATCH /v1/tax-classes/{id} body. Components NOT included here -
 * after creation, components are managed via /components endpoints
 * (which trigger the same auto-recompute on the parent).
 */
export type TaxClassUpdateInput = Partial<Omit<TaxClassInput, 'components'>>

// ---------- Query params ----------

export interface TaxClassListParams {
  q?: string
  active?: boolean
  per_page?: number
  page?: number
}
