/**
 * JobType types matching the API response shape from JobTypeResource.
 * Keep in sync with: app/Http/Resources/JobTypeResource.php
 *
 * Per-tenant categorization for work orders (e.g., "Annual Fire Door
 * Inspection", "Lockout", "Repair"). Settings-driven, vertical-pack-seeded.
 *
 * Used by:
 *   - WorkOrderForm job_type picker (loaded via useJobTypes, 5min stale)
 *   - Settings -> Workflow -> Types page (future)
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

// ---------- Enums ----------

/**
 * Loose category bucket for grouping types in pickers + reports.
 * Vertical packs use values like 'service', 'inspection', 'estimate', 'install', 'repair'.
 * Kept as string in case tenants add custom values later.
 */
export type JobTypeCategory = string

// ---------- JobType (top-level) ----------

export interface JobType {
  id: string
  tenant_id: string

  name: string
  slug: string
  color: string
  category: JobTypeCategory

  // Optional default status applied when this type is picked on a new WO
  default_status_id: string | null
  default_duration_minutes: number
  default_checklist_id: string | null

  sort_order: number
  active: boolean
  most_used: boolean

  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

// ---------- Input shapes ----------

/**
 * Shape sent to POST /v1/job-types.
 */
export interface JobTypeInput {
  name: string
  slug?: string
  color?: string
  category?: JobTypeCategory
  default_status_id?: string | null
  default_duration_minutes?: number
  default_checklist_id?: string | null
  sort_order?: number
  active?: boolean
  most_used?: boolean
}

/**
 * Shape sent to PATCH /v1/job-types/{id}.
 */
export type JobTypeUpdateInput = Partial<JobTypeInput>

// ---------- Query params ----------

export interface JobTypeListParams {
  q?: string
  category?: JobTypeCategory
  active?: boolean
  per_page?: number
  page?: number
}
