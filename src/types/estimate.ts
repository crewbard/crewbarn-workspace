/**
 * Estimate types matching API response shape from EstimateResource.
 * Keep in sync with: app/Http/Resources/EstimateResource.php
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

import type { EstimateLineItem } from '@/types/estimateLineItem'

// ---------- Enums ----------

export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'expired'

// ---------- Nested objects on the resource ----------

export interface EstimateCustomer {
  id: string
  display_name: string
  customer_type: 'residential' | 'commercial' | 'government'
  vip: boolean
}

export interface EstimateServiceLocation {
  id: string
  nickname: string | null
  street_address: string | null
  apt_unit: string | null
  city: string | null
  state: string | null
  postal_code: string | null
}

export interface EstimateCreatedBy {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string
  email: string | null
}

export interface EstimateMoney {
  subtotal_cents: number
  tax_cents: number
  /**
   * Tax backed out because the customer is exempt. Zero for everyone else.
   * tax_cents stays as computed and this cancels it, so an estimate foots the
   * same way as the job and invoice it turns into.
   */
  tax_exempt_adjustment_cents: number
  total_cents: number
  subtotal_formatted: string
  tax_formatted: string
  tax_exempt_adjustment_formatted: string
  total_formatted: string
}

export interface EstimateSupersededRef {
  id: string
  estimate_number: string
  status: EstimateStatus
}

/**
 * Slim work order ref returned when an estimate has been converted.
 */
export interface EstimateConvertedRef {
  id: string
  work_order_number: string
  display_number: string
  title: string | null
}

export interface EstimateCoveredAsset {
  id: string
  name: string | null
  asset_type_id: string | null
}

// ---------- Estimate (top-level) ----------

export interface Estimate {
  id: string
  tenant_id: string
  estimate_number: string
  display_number: string

  status: EstimateStatus
  // State machine predicates from server - drive lifecycle button enablement
  can_send: boolean
  can_approve: boolean
  can_reject: boolean

  customer_id: string
  customer?: EstimateCustomer

  customer_service_location_id: string | null
  service_location?: EstimateServiceLocation | null

  created_by_account_id: string | null
  created_by?: EstimateCreatedBy | null

  // Job-form parity (Day 19) — estimate doubles as a scheduled walkthrough.
  title: string | null
  description: string | null
  job_type_id: string | null
  status_id: string | null
  priority: 'low' | 'normal' | 'urgent' | 'emergency'
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  estimated_duration_minutes: number | null
  lead_tech_account_id: string | null
  project_manager_account_id: string | null

  money: EstimateMoney

  internal_notes: string | null
  customer_notes: string | null
  terms: string | null
  /** Contract template attached to this estimate. Customer signs it
   *  on approval; the signed snapshot lives in contract_signatures. */
  contract_template_id: string | null
  contract_template_name?: string | null

  // Lifecycle timestamps
  sent_at: string | null
  approved_at: string | null
  rejected_at: string | null
  expires_at: string | null

  // Re-quote chain
  superseded_estimate_id: string | null
  superseded_estimate?: EstimateSupersededRef | null

  // Conversion to work order (Slice 7)
  converted_to_work_order_id: string | null
  converted_to_work_order?: EstimateConvertedRef | null

  // Standard timestamps
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null

  // Nested children - only present when explicitly loaded
  line_items?: EstimateLineItem[]
  covered_assets?: EstimateCoveredAsset[]
}

// ---------- Input shapes for POST/PATCH ----------

/**
 * Shape sent to POST /v1/estimates.
 * tenant_id auto-filled by BelongsToTenant trait, estimate_number
 * auto-assigned via TenantSetting::nextEstimateNumber().
 */
export interface EstimateInput {
  customer_id: string
  customer_service_location_id?: string | null
  created_by_account_id?: string | null
  customer_notes?: string | null
  internal_notes?: string | null
  terms?: string | null
  contract_template_id?: string | null
  expires_at?: string | null

  // Job-form parity (Day 19): added when Estimate became a kind of Job on
  // the unified create form.
  title?: string | null
  description?: string | null
  job_type_id?: string | null
  status_id?: string | null
  priority?: 'low' | 'normal' | 'urgent' | 'emergency' | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  estimated_duration_minutes?: number | null
  lead_tech_account_id?: string | null
  project_manager_account_id?: string | null
}

/**
 * Shape sent to PATCH /v1/estimates/{id} - all fields optional.
 * Status transitions go through dedicated lifecycle endpoints
 * (send/approve/reject), NOT through PATCH.
 */
export type EstimateUpdateInput = Partial<EstimateInput>

// ---------- Query params ----------

export interface EstimateListParams {
  q?: string
  status?: EstimateStatus
  customer_id?: string
  customer_service_location_id?: string
  filing_year?: number
  filing_month?: number
  include_filing_counts?: boolean
  /** Folder tile filter. */
  bucket?: 'won' | 'lost' | 'open' | 'dormant'
  per_page?: number
  page?: number
}
