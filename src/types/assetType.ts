/**
 * AssetType types matching AssetTypeResource.
 *
 * Per-tenant taxonomy of physical things tracked as assets:
 * door, extinguisher, safe, rooftop AC unit, etc.
 *
 * custom_field_schema is JSONB on the backend, parsed array on the frontend.
 * It defines what custom fields appear when creating an asset of this type.
 *
 * Companion to: types/asset.ts
 * Backend: app/Http/Resources/AssetTypeResource.php
 */

import type { PaginatedResponse, ResourceResponse } from "@/types/api"
export type { PaginatedResponse, ResourceResponse }

export type InspectionCadence = "monthly" | "quarterly" | "annual" | "none"

export const INSPECTION_CADENCES: readonly InspectionCadence[] = ["monthly", "quarterly", "annual", "none"]

export const INSPECTION_CADENCE_LABELS: Record<InspectionCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  none: "None",
}

/**
 * One field definition in custom_field_schema.
 * Frontend renders forms dynamically from these.
 */
export interface AssetCustomField {
  key: string
  label: string
  type: "text" | "number" | "boolean" | "select" | "date"
  required?: boolean
  options?: string[] // for type=select
  help_text?: string
}

export interface AssetType {
  id: string
  tenant_id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
  custom_field_schema: AssetCustomField[]
  default_inspection_cadence: InspectionCadence | null
  default_checklist_id: string | null
  sort_order: number
  active: boolean
  assets_count?: number
  created_at: string | null
  updated_at: string | null
}

export interface AssetTypeInput {
  name: string
  slug?: string | null
  icon?: string | null
  color?: string | null
  custom_field_schema?: AssetCustomField[]
  default_inspection_cadence?: InspectionCadence | null
  default_checklist_id?: string | null
  sort_order?: number
  active?: boolean
}

export type AssetTypeUpdateInput = Partial<AssetTypeInput>

export interface AssetTypeListParams {
  active?: boolean
  q?: string
  per_page?: number
  page?: number
}
