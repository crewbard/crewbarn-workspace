/**
 * ProductCatalogCategory types matching ProductCatalogCategoryResource.
 * Keep in sync with: app/Http/Resources/ProductCatalogCategoryResource.php
 *
 * Distinct from ServiceCatalogCategory because Stage 11 customer-facing
 * product catalog displays ONLY product categories. Service categories like
 * "Lockout labor" should never mix with product categories like "Padlocks".
 *
 * Categories form a hierarchy via parent_id self-FK. Backend supports
 * shape=flat (default, all rows) and shape=tree (roots only, children
 * eager-loaded). v1 frontend uses flat for simplicity.
 *
 * Slug is auto-generated server-side from name on create; UI does not
 * send it. Cycle prevention is enforced server-side on PATCH parent_id.
 *
 * NOTE: Unlike CatalogCategory (service version), product categories do
 * NOT have icon or color columns - simpler schema. They DO have depth.
 */

import type { ResourceResponse } from '@/types/api'
export type { ResourceResponse }

export interface ProductCatalogCategory {
  id: string
  parent_id: string | null
  name: string
  slug: string
  depth: number
  sort_order: number
  active: boolean
  description: string | null
  images: {
    thumb_url: string | null
    medium_url: string | null
    full_url: string | null
  }
  children?: ProductCatalogCategory[]
  created_at: string | null
  updated_at: string | null
}

export interface ProductCatalogCategoryInput {
  name: string
  parent_id?: string | null
  sort_order?: number
  active?: boolean
}

export type ProductCatalogCategoryUpdateInput = Partial<ProductCatalogCategoryInput>

export interface ProductCatalogCategoryListParams {
  shape?: 'flat' | 'tree'
  active?: boolean
  per_page?: number
}
