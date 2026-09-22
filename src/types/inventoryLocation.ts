/**
 * InventoryLocation types matching InventoryLocationResource.
 * Keep in sync with: app/Http/Resources/InventoryLocationResource.php
 *
 * Types: warehouse, truck, other (per InventoryLocation::TYPES on backend).
 *
 * Address is split into 4 separate fields (street_address, city, region,
 * postal_code) - NOT a single string. Region is the state/province.
 *
 * assigned_tech is a nested object containing the tech account's display info.
 * Only populated when assigned_tech_account_id is set AND the relation is loaded.
 *
 * display_label is server-computed: "Truck 1 (Mike Smith)" when tech is assigned,
 * else just the location name. Used in dashboards and search results.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export type InventoryLocationType = 'warehouse' | 'truck' | 'other'

export const INVENTORY_LOCATION_TYPES: readonly InventoryLocationType[] = ['warehouse', 'truck', 'other']

export const INVENTORY_LOCATION_TYPE_LABELS: Record<InventoryLocationType, string> = {
  warehouse: 'Warehouse',
  truck: 'Truck',
  other: 'Other',
}

export interface AssignedTech {
  id: string
  display_name: string
  email: string | null
}

export interface InventoryLocationAddress {
  street_address: string | null
  city: string | null
  region: string | null
  postal_code: string | null
}

export interface InventoryLocation {
  id: string
  name: string
  type: InventoryLocationType
  assigned_tech_account_id: string | null
  assigned_tech: AssignedTech | null
  address: InventoryLocationAddress
  display_label: string
  notes: string | null
  /** Present on the list only — absent means not counted, not zero. */
  bins_count?: number
  stock_value_cents?: number
  active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface InventoryLocationInput {
  name: string
  type: InventoryLocationType
  assigned_tech_account_id?: string | null
  street_address?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  notes?: string | null
  active?: boolean
}

export type InventoryLocationUpdateInput = Partial<InventoryLocationInput>

export interface InventoryLocationListParams {
  type?: InventoryLocationType
  active?: boolean
  q?: string
  per_page?: number
  page?: number
}
