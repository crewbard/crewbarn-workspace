/**
 * Asset types matching AssetResource.
 *
 * Physical thing at a customer service location.
 * Belongs to customer_service_location_id and asset_type_id.
 *
 * SLICE-9 NOTE: secured_data is NOT in the standard JSON output even when
 * is_secured=true. Slice 9 access-request flow is the only path that
 * returns secured_data.
 *
 * Companion to: types/assetType.ts
 * Backend: app/Http/Resources/AssetResource.php
 */

import type { PaginatedResponse, ResourceResponse } from "@/types/api"
import type { InspectionCadence } from "@/types/assetType"
import type { AssetGroupMini } from "@/types/assetGroup"
export type { PaginatedResponse, ResourceResponse }
export type { InspectionCadence }

/**
 * Slimmed asset_type included in asset responses.
 * Full type lives in types/assetType.ts.
 */
export interface AssetTypeMini {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
}

/**
 * Slimmed service_location included in asset responses.
 */
export interface AssetServiceLocation {
  id: string
  customer_id: string
  nickname: string | null
  street_address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
}

export interface Asset {
  id: string
  tenant_id: string
  name: string
  asset_code: string | null

  asset_type_id: string
  asset_type: AssetTypeMini | null

  customer_service_location_id: string
  service_location: AssetServiceLocation | null

  /** Slice 8: optional sub-group within the service location */
  asset_group_id: string | null
  asset_group: AssetGroupMini | null

  manufacturer: string | null
  model: string | null
  serial_number: string | null
  install_date: string | null

  /** Custom field values matching parent asset_type's custom_field_schema */
  custom_fields: Record<string, unknown>

  notes: string | null

  // SLICE-9: only is_secured exposed; secured_data NEVER in standard responses
  is_secured: boolean
  /** Per-field public visibility; null means the is_secured default. */
  public_fields?: Record<string, boolean> | null

  // SLICE-FUTURE (inspections)
  inspection_cadence: InspectionCadence | null
  next_inspection_due_at: string | null

  /** Server-computed: "Door 4B at Memorial Hospital" */
  display_label: string

  active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface AssetInput {
  name: string
  asset_type_id: string
  customer_service_location_id: string
  asset_group_id?: string | null
  asset_code?: string | null
  manufacturer?: string | null
  model?: string | null
  serial_number?: string | null
  install_date?: string | null
  custom_fields?: Record<string, unknown>
  notes?: string | null
  is_secured?: boolean
  // SLICE-9: secured_data can be set in Slice 1 (encrypted at rest by backend)
  // but not exposed in responses. Slice 9 builds the request/access flow.
  secured_data?: unknown
  inspection_cadence?: InspectionCadence | null
  next_inspection_due_at?: string | null
  active?: boolean
}

export type AssetUpdateInput = Partial<AssetInput>

export interface AssetListParams {
  customer_id?: string
  customer_service_location_id?: string
  asset_type_id?: string
  asset_group_id?: string
  include_descendants?: boolean
  active?: boolean
  is_secured?: boolean
  q?: string
  per_page?: number
  page?: number
}
