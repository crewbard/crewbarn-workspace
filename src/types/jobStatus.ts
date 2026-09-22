/**
 * JobStatus types matching the API response shape from JobStatusResource.
 * Keep in sync with: app/Http/Resources/JobStatusResource.php
 *
 * Per-tenant lifecycle states for work orders (Lead, Scheduled, On Site,
 * Complete, etc.). Drag-to-reorder. Vertical-pack-seeded.
 *
 * Used by:
 *   - WorkOrderForm status picker (loaded via useJobStatuses, 5min stale)
 *   - WorkOrderDetailPage status changer (future)
 *   - Settings -> Workflow -> Statuses page (future)
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

// ---------- Enums ----------

/**
 * Status category drives reporting buckets and dashboard tiles.
 *   - open: lead, scheduled, etc. (not yet started)
 *   - in_progress: actively being worked on
 *   - blocked: awaiting parts, customer response, etc.
 *   - complete: terminal states (paid, invoiced, complete, cancelled)
 */
export type JobStatusCategory = 'open' | 'in_progress' | 'blocked' | 'complete' | 'cancelled'
export type JobStatusFieldAction = 'travel' | 'arrive' | 'return_needed' | 'complete' | 'cancel'

// ---------- JobStatus (top-level) ----------

export interface JobStatus {
  id: string
  tenant_id: string

  name: string
  slug: string
  color: string
  color_secondary: string | null
  icon: string | null
  category: JobStatusCategory
  field_action: JobStatusFieldAction | null

  is_initial: boolean
  is_terminal: boolean
  sort_order: number
  active: boolean

  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

// ---------- Input shapes ----------

/**
 * Shape sent to POST /v1/job-statuses.
 */
export interface JobStatusInput {
  name: string
  slug?: string
  color?: string
  color_secondary?: string | null
  icon?: string | null
  category?: JobStatusCategory
  field_action?: JobStatusFieldAction | null
  is_initial?: boolean
  is_terminal?: boolean
  sort_order?: number
  active?: boolean
}

/**
 * Shape sent to PATCH /v1/job-statuses/{id}.
 */
export type JobStatusUpdateInput = Partial<JobStatusInput>

// ---------- Query params ----------

export interface JobStatusListParams {
  q?: string
  category?: JobStatusCategory
  active?: boolean
  per_page?: number
  page?: number
}
