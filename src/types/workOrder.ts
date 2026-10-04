/**
 * WorkOrder types matching the API response shape from WorkOrderResource.
 * Keep in sync with: app/Http/Resources/WorkOrderResource.php
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

import type { WorkOrderLineItem } from '@/types/workOrderLineItem'

// ---------- Enums ----------

export type WorkOrderPriority = 'low' | 'normal' | 'urgent' | 'emergency'

export type WorkOrderStatusCategory = 'open' | 'in_progress' | 'blocked' | 'complete' | 'cancelled'

// ---------- Nested objects on the resource ----------

/**
 * The service agreement that already paid for this visit.
 *
 * Present only on the few jobs a contract booked. When it is there, the
 * fee has already covered the work — invoicing the job again bills the
 * customer twice for the same visit.
 */
export interface WorkOrderCoveredBy {
  visit_id: string
  contract_id: string | null
  title: string | null
  due_on: string | null
}

export interface WorkOrderJobType {
  id: string
  name: string
  color: string
  icon?: string | null
  category: string
}

export interface WorkOrderStatus {
  id: string
  name: string
  color: string
  category: WorkOrderStatusCategory
  is_terminal: boolean
}

export interface WorkOrderServiceCustomer {
  id: string
  display_name: string
  customer_type: 'residential' | 'commercial' | 'government'
  vip: boolean
}

export interface WorkOrderBillingCustomer {
  id: string
  display_name: string
}

export interface WorkOrderServiceLocation {
  id: string
  nickname: string | null
  street_address: string | null
  apt_unit: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
}

export interface WorkOrderLeadTech {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string
  /** Profile photo the tech picked in Settings → Account. Null = initials. */
  avatar_url?: string | null
}

export interface WorkOrderCrew {
  id: string
  name: string
  color: string | null
}

export interface WorkOrderCrewMember {
  id: string
  email: string | null
  name: string
  role: string | null
}

export interface WorkOrderSchedule {
  is_scheduled: boolean
  date: string | null
  start_time: string | null
  end_time: string | null
  /** Authoritative start/end timestamps. end_at on a later day than start_at
   *  means it's a multi-day job. */
  start_at?: string | null
  end_at?: string | null
  /** The job's SERVICE-LOCATION timezone (IANA) + the same instants rendered
   *  as that zone's naive wall-clock. Display these, not the device's zone. */
  timezone?: string | null
  start_local?: string | null
  end_local?: string | null
  tz_abbrev?: string | null
  estimated_duration_minutes: number | null
}

export interface WorkOrderMoney {
  subtotal_cents: number
  tax_cents: number
  /**
   * Tax backed out because the bill-to customer is exempt. Zero for everyone
   * else. tax_cents stays as computed and this cancels it, so a job foots the
   * same way as the invoice raised from it.
   */
  tax_exempt_adjustment_cents: number
  total_cents: number
  subtotal_formatted: string
  tax_formatted: string
  tax_exempt_adjustment_formatted: string
  total_formatted: string
}

export interface WorkOrderCoveredAsset {
  id: string
  name: string | null
  asset_code?: string | null
  asset_type_id?: string | null
}

// ---------- WorkOrder (top-level) ----------

export interface WorkOrder {
  id: string
  tenant_id: string
  work_order_number: number
  display_number: string

  title: string
  description: string | null
  priority: WorkOrderPriority

  // Type + status (with eager-loaded nested object)
  job_type_id: string
  job_type?: WorkOrderJobType

  status_id: string
  status?: WorkOrderStatus

  /** Only on a job a service agreement booked. Absent otherwise. */
  covered_by?: WorkOrderCoveredBy | null

  // Customers
  service_customer_id: string
  service_customer?: WorkOrderServiceCustomer

  billing_customer_id: string | null
  billing_customer?: WorkOrderBillingCustomer | null

  service_location_id: string
  service_location?: WorkOrderServiceLocation

  lead_tech_account_id: string | null
  project_manager_account_id: string | null
  lead_tech?: WorkOrderLeadTech | null

  crew_id: string | null
  crew?: WorkOrderCrew | null
  crew_members?: WorkOrderCrewMember[]

  // Grouped objects
  schedule: WorkOrderSchedule
  money: WorkOrderMoney

  // Third-party tracking
  their_work_order_number: string | null
  their_po_number: string | null

  // Inspection placeholder + repair-job chain
  parent_work_order_id: string | null
  inspection_checklist_id: string | null
  inspection_checklist?: {
    id: string
    name: string
    category: string | null
    is_system: boolean
    item_count: number
  } | null

  // Notes
  internal_notes: string | null
  public_notes: string | null
  /** Dormant force-notes gate (detail endpoint only). When true, the app
   *  blocks the job until the tech logs a note. */
  requires_note?: boolean
  /** COD force-collection gate (detail endpoint only). When true, the app
   *  blocks the job until payment is collected (or dispatch overrides). */
  requires_collection?: boolean
  /** Dispatch has unlocked the COD gate for this job. */
  collection_override?: boolean

  // Field-service workflow — snapshotted from customer at WO creation
  field_policy: {
    requires_check_in_out: boolean
    requires_signature: boolean
    min_photos_required: number
    requires_before_after_photos: boolean
    geofence_radius_m: number | null
    wo_template_id: string | null
  }
  nte: {
    cents: number | null
    status: 'pm_set' | 'quote_requested' | 'quote_submitted' | 'quote_approved' | 'quote_rejected' | null
    quote_cents: number | null
  }
  requested_by_platform_customer_id: string | null
  request_status: 'pending' | 'accepted' | 'declined' | null
  filled_wo_pdf_path: string | null
  template_pdf_url: string | null
  template_original_filename: string | null
  template_uploaded_at: string | null
  filled_wo_pdf_url: string | null
  ai_field_map: AiFieldMap | null
  ai_field_map_at: string | null

  // Lifecycle timestamps
  first_status_change_at: string | null
  on_site_at: string | null
  completed_at: string | null
  dashboard_cleared_at: string | null

  // Present only on the list endpoint (withCount('invoices')) — drives the
  // "Complete → Invoice" next-step hint.
  has_invoice?: boolean

  // Actual open invoice balance supplied by the list endpoint.
  communications?: {
    email_sent_at: string | null
    email_opened_at: string | null
    text_sent_at: string | null
    text_delivered_at: string | null
  }
  money_due_cents?: number

  // Standard timestamps
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null

  // Cross-tenant mirror linkage (Phase 4). Set when this WO is the
  // RECEIVING side of a cross-tenant sub-out — i.e. another tenant
  // subbed work to a subcontractor that points back to us. Null on
  // regular WOs and on the ORIGINATOR's row (they see mirror_status
  // reflected via a different field if/when needed).
  mirror?: {
    is_mirror: true
    of_wo_id: string
    of_tenant_id: string
    status: 'pending_accept' | 'accepted' | 'declined'
    declined_reason: string | null
    accepted_at: string | null
    declined_at: string | null
  } | null

  // Sub-out assignment — populated only when is_subbed=true.
  is_subbed?: boolean
  sub_assignment?: {
    subcontractor_id: string | null
    sub_wo_number: string | null
    sub_nte_cents: number
    effective_sub_nte_cents: number
    sub_status: 'dispatched' | 'in_progress_at_sub' | 'completed_by_sub' | 'paid_to_sub' | null
    sub_special_instructions: string | null
    sub_dispatched_at: string | null
    sub_completed_at: string | null
    sub_paid_at: string | null
    /** Sub-side acceptance (Phase 5). */
    sub_acceptance_status: 'pending' | 'accepted' | 'declined_by_sub' | null
    sub_accepted_at: string | null
    sub_declined_at: string | null
    sub_decline_reason: string | null
    subcontractor?: {
      id: string
      business_name: string
      contact_name: string | null
      phone: string | null
      email: string | null
    }
  } | null

  // Covered assets — only present when explicitly loaded on detail responses.
  covered_assets?: WorkOrderCoveredAsset[]

  // Nested children — only present when explicitly loaded
  line_items?: WorkOrderLineItem[]
}

// ---------- AI Vision field detection ----------

export interface AiFieldMapField {
  name: string
  label?: string
  field_type: 'date' | 'text' | 'textarea' | 'signature' | 'checkbox' | 'number'
  page: number
  x_pt: number
  y_pt: number
  w_pt: number
  h_pt: number
}

export interface AiFieldMap {
  model?: string
  error?: string
  detail?: string
  raw_excerpt?: string
  page_size?: { w_pt: number; h_pt: number }
  fields?: AiFieldMapField[]
}

// ---------- Field workflow sub-models ----------

export interface WorkOrderVisit {
  id: string
  work_order_id: string
  visit_number: number
  tech_account_id: string
  check_in_at: string
  check_in_lat: string | number | null
  check_in_lng: string | number | null
  check_in_accuracy_m: number | null
  check_in_distance_m: number | null
  geofence_overridden: boolean
  geofence_override_reason: string | null
  check_out_at: string | null
  check_out_lat: string | number | null
  check_out_lng: string | number | null
  check_out_accuracy_m?: number | null
  outcome: 'completed' | 'return_needed' | null
  return_reason: string | null
  notes: string | null
  // Visit lifecycle (geofence field-tracking).
  visit_state?: string | null
  auto_checked_in?: boolean
  auto_checked_in_at?: string | null
  auto_checkin_source?: string | null
  left_site_at?: string | null
  left_site_reminded_at?: string | null
  dispatcher_alerted_at?: string | null
  gps_issue_reported_at?: string | null
  gps_issue_note?: string | null
  /*
   * display_name, not name. `accounts` has no name column — a person's
   * name lives on tenant_admin_accounts — so `name` was always
   * undefined here and the field log printed the raw account id.
   */
  tech?: { id: string; display_name: string | null; email: string | null } | null
  created_at: string | null
  updated_at: string | null
}

export interface WorkOrderSignature {
  id: string
  work_order_id: string
  visit_id: string
  signer_name: string
  signer_role: string | null
  signature_image_path: string
  captured_at: string
  captured_lat: string | number | null
  captured_lng: string | number | null
  captured_by_account_id: string
  created_at: string | null
}

export interface WorkOrderNteExtension {
  id: string
  work_order_id: string
  requested_by_account_id: string
  requested_at: string
  requested_increase_cents: number
  reason: string
  photo_path: string | null
  status: 'pending' | 'approved' | 'denied'
  reviewed_at: string | null
  reviewed_by_account_id: string | null
  reviewed_by_platform_customer_id: string | null
  review_notes: string | null
}

// ---------- Input shapes for POST/PATCH ----------

/**
 * Shape sent to POST /v1/work-orders.
 * tenant_id is auto-filled by BelongsToTenant trait, work_order_number
 * is auto-assigned via TenantSetting::nextWorkOrderNumber().
 */
export interface WorkOrderInput {
  custom_values?: import('@/components/CustomFieldsSection').CustomValues
  ai_intake_draft_id?: string
  job_type_id: string
  status_id: string
  title: string
  description?: string | null
  service_customer_id: string
  billing_customer_id?: string | null
  service_location_id: string
  lead_tech_account_id?: string | null
  project_manager_account_id?: string | null
  crew_id?: string | null
  crew_member_account_ids?: string[]
  parent_work_order_id?: string | null

  is_scheduled?: boolean
  scheduled_date?: string | null
  scheduled_start_time?: string | null
  scheduled_end_time?: string | null
  /** Explicit start/end timestamps — sent for multi-day jobs so the span
   *  isn't collapsed onto scheduled_date. The backend saving hook prefers
   *  these over date+time when present. */
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  estimated_duration_minutes?: number | null

  priority?: WorkOrderPriority
  their_work_order_number?: string | null
  their_po_number?: string | null
  inspection_checklist_id?: string | null

  internal_notes?: string | null
  public_notes?: string | null
  /** Contract template attached to the WO. Customer signs it before
   *  the field tech can check in. */
  contract_template_id?: string | null
}

/**
 * Shape sent to PATCH /v1/work-orders/{id} — all fields optional.
 */
export type WorkOrderUpdateInput = Partial<WorkOrderInput>

// ---------- Query params ----------

export interface WorkOrderListParams {
  q?: string
  status_id?: string
  job_type_id?: string
  service_customer_id?: string
  /** With service_customer_id: also include jobs billed TO that customer from sub-accounts. */
  include_bill_to?: boolean
  /** true = only invoiced jobs, false = only uninvoiced. Omit for all. */
  invoiced?: boolean
  scheduled_date?: string
  /** 'current' = only jobs scheduled in the current tenant-local week (Mon–Sun). */
  scheduled_week?: 'current'
  /** Tech account id, or the literal 'unassigned' for jobs with no lead tech. */
  lead_tech_account_id?: string
  project_manager_account_id?: string
  /** Needs-attention deep link: stale/ops buckets such as dormant, past_scheduled_open, needs_parts, parts_ordered. */
  stale?: string
  /** When true, only subbed-out jobs. When false, only in-house jobs. Omit for all. */
  is_subbed?: boolean
  /** Payment sub-filter for the in-folder Collected/Uncollected money roll-ups. */
  payment?: 'collected' | 'unpaid_balance' | 'not_invoiced'
  /** Folder tile filter: done vs still open. */
  progress?: 'complete' | 'open'
  /** Server-backed folder filters for the Jobs Year > Month filing view. */
  filing_year?: number
  filing_month?: number
  include_filing_counts?: boolean
  /** Request the per-status count+money aggregate (Status folder view). */
  include_status_money?: boolean
  per_page?: number
  page?: number
}
