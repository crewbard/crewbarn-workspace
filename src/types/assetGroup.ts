/**
 * Asset group types - matches backend AssetGroupResource.
 *
 * Slice 8: hierarchical groups within a customer service location.
 * "Memorial Hospital -> Building C -> Floor 3" lives in this table.
 *
 * Backend: app/Http/Resources/AssetGroupResource.php
 */

import type { PaginatedResponse, ResourceResponse } from "@/types/api"
export type { PaginatedResponse, ResourceResponse }

export interface AssetGroup {
  id: string
  tenant_id: string
  customer_service_location_id: string
  parent_id: string | null
  name: string
  sort_order: number
  active: boolean

  /** Optionally loaded for tree mode (nested) */
  children?: AssetGroup[]
  /** Recursive descendants - present when as_tree=1 was requested */
  descendants?: AssetGroup[]
  /** Loaded via withCount on backend; present in list and tree responses */
  assets_count?: number

  created_at: string | null
  updated_at: string | null
}

/**
 * Slimmed asset_group included in Asset responses (when eager-loaded).
 */
export interface AssetGroupMini {
  id: string
  name: string
  parent_id: string | null
}

export interface AssetGroupInput {
  customer_service_location_id: string
  parent_id?: string | null
  name: string
  sort_order?: number
  active?: boolean
}

export interface AssetGroupUpdateInput {
  parent_id?: string | null
  name?: string
  sort_order?: number
  active?: boolean
}

export interface AssetGroupListParams {
  customer_service_location_id?: string
  /** Empty string or null filters to roots (parent_id IS NULL) */
  parent_id?: string | null
  /** When true, returns root nodes with descendants nested. Requires customer_service_location_id. */
  as_tree?: boolean
  active?: boolean
  per_page?: number
  page?: number
}

export interface AssetTreeBuilderLevelItem {
  name: string
  code?: string | null
  asset_count?: number | null
}

export interface AssetTreeBuilderLevel {
  name: string
  prefix?: string | null
  items: AssetTreeBuilderLevelItem[]
}

export interface AssetTreeBuilderBranch {
  path: string
  code?: string | null
  asset_count: number
}

export interface AssetTreeBuilderPayload {
  customer_service_location_id: string
  asset_type_id: string
  root_name: string
  asset_name_prefix?: string | null
  asset_code_prefix?: string | null
  levels?: AssetTreeBuilderLevel[]
  branches?: AssetTreeBuilderBranch[]
}

export interface AssetTreeBuilderPreview {
  root_name: string
  total_groups: number
  total_assets: number
  total_nodes: number
  branches: Array<{
    levels: string[]
    code_parts: string[]
    asset_count: number
  }>
  examples: string[]
}

export interface AssetTreeBuilderCreateResponse {
  message: string
  created: {
    groups: number
    assets: number
  }
  preview: AssetTreeBuilderPreview
}
