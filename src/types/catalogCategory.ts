/**
 * CatalogCategory types matching ServiceCatalogCategoryResource.
 * Keep in sync with: app/Http/Resources/ServiceCatalogCategoryResource.php
 *
 * Categories form a hierarchy via parent_id self-FK. Backend supports
 * shape=flat (default, all rows) and shape=tree (roots only, children
 * eager-loaded). v1 frontend uses flat for simplicity.
 *
 * Slug is auto-generated server-side from name on create; UI does not
 * send it. Cycle prevention is enforced server-side on PATCH parent_id.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export interface CatalogCategory {
  id: string
  parent_id: string | null
  name: string
  slug: string
  icon: string | null
  color: string | null
  sort_order: number
  active: boolean
  children?: CatalogCategory[]
  created_at: string | null
  updated_at: string | null
}

export interface CatalogCategoryInput {
  name: string
  parent_id?: string | null
  icon?: string | null
  color?: string | null
  sort_order?: number
  active?: boolean
}

export type CatalogCategoryUpdateInput = Partial<CatalogCategoryInput>

export interface CatalogCategoryListParams {
  shape?: 'flat' | 'tree'
  active?: boolean
  per_page?: number
}
