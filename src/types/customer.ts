/**
 * Customer types matching the API response shape from CustomerResource.
 * Keep in sync with: app/Http/Resources/CustomerResource.php
 */
import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export type CustomerType = 'residential' | 'commercial' | 'government'

export type CustomerTag =
  | 'vip'
  | 'commercial'
  | 'recurring'
  | 'warning'
  | 'do-not-call'
  | 'referred'
  | 'priority'

// ---------- Nested sub-resource: Contact ----------

export interface CustomerContactMailingAddress {
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
}

export interface CustomerContact {
  id: string
  position: number
  prefix: string | null
  first_name: string | null
  last_name: string | null
  suffix: string | null
  full_name: string
  department: string | null
  job_title: string | null
  email: string | null
  email_alt: string | null
  phone: string | null
  phone_alt: string | null
  mailing_address: CustomerContactMailingAddress
  bill_to_service_address: boolean
  notes: string | null
  is_main_contact: boolean
  is_billing_contact: boolean
  is_service_contact: boolean
  is_intake_contact: boolean
  sms_consent: boolean
  consent_recorded_at: string | null
  birthday: string | null
  anniversary: string | null
  active: boolean
  // Portal sync — true when this contact's name/email/phone is being
  // kept in sync with a portal customer's profile
  linked_platform_customer_id: string | null
  is_managed_by_portal: boolean
  created_at: string | null
  updated_at: string | null
}

// ---------- Nested sub-resource: Service Location ----------

export interface CustomerServiceLocationAddress {
  street_address: string | null
  apt_unit: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  formatted: string
}

export interface CustomerServiceLocationCoordinates {
  latitude: number | null
  longitude: number | null
}

export interface CustomerServiceLocation {
  id: string
  position: number
  nickname: string | null
  address: CustomerServiceLocationAddress
  coordinates: CustomerServiceLocationCoordinates
  is_primary: boolean
  gated_property: boolean
  gate_code: string | null
  entry_notes: string | null
  location_contact_id: string | null
  active: boolean
  created_at: string | null
  updated_at: string | null
}

// ---------- Customer (top-level) ----------

export interface Customer {
  id: string
  account_number: string | null
  parent_customer_id: string | null
  /** FK → territories.id (FR-7). The county / operating area this customer
   *  belongs to. Null = unassigned. Only meaningful for franchise tenants. */
  territory_id: string | null
  display_name: string
  customer_type: CustomerType
  /** Chosen monogram color (#rrggbb) — overrides the auto/hashed color. */
  avatar_preset?: string | null
  /** Uploaded avatar photo URL (round-cropped). Wins over the monogram. */
  avatar_url?: string | null
  business_name: string | null
  first_name: string | null
  last_name: string | null

  // Derived from main contact server-side (accessor on Customer model)
  email: string | null

  // Status flags
  vip: boolean
  service_agreement: boolean
  active: boolean

  // Classification
  industry: string | null
  referral_source: string | null

  // Money / billing
  payment_method: string | null
  /** NET-terms customer — only cash-flow managers can record payments.
   *  Derived from payment_term_id on save (days > 0 → true). */
  is_net_account: boolean
  /** FK → payment_terms. Null = use tenant default; if no tenant default
   *  is configured, code falls back to COD (days_until_due = 0). */
  payment_term_id: string | null
  taxable: boolean
  tax_item: string | null
  tax_id: string | null
  /** Per-customer default tax class. Null → fall back to tenant default. */
  default_tax_class_id: string | null
  /** FK → customer_documents.id. The cert backing tax-exempt status. */
  tax_exempt_certificate_document_id: string | null
  default_currency: string

  // Notes
  internal_notes: string | null
  public_notes: string | null

  // Sales
  assigned_agent_id: string | null
  commission_pct: number | null
  assigned_contract_id: string | null

  // Relationship dates
  birthday: string | null
  anniversary: string | null

  sms_consent: boolean
  consent_recorded_at: string | null

  // Tags + activity
  tags: CustomerTag[]
  lifetime_value_cents: number
  lifetime_value: number
  last_contact_at: string | null

  // Field-service policy (snapshotted onto every WO at creation)
  requires_check_in_out: boolean
  requires_signature: boolean
  min_photos_required: number
  requires_before_after_photos: boolean
  geofence_radius_m: number | null
  default_nte_cents: number | null
  wo_template_id: string | null

  // Nested children â€” only present when eager-loaded server-side
  contacts?: CustomerContact[]
  service_locations?: CustomerServiceLocation[]
  contacts_count?: number
  service_locations_count?: number

  // List "activity counts" (Slice 2) — only present on the index endpoint
  open_jobs_count?: number
  pending_estimates_count?: number
  unpaid_invoices_count?: number
  /** Bill-to aware totals (own + billed-to) — list endpoint only. */
  responsible_open_jobs?: number
  responsible_unpaid_count?: number
  responsible_unpaid_cents?: number
  responsible_paid_cents?: number

  created_at: string | null
  updated_at: string | null
}

// ---------- Input shapes for POST/PATCH ----------

export interface CustomerContactInput {
  id?: string
  position?: number
  prefix?: string | null
  first_name?: string | null
  last_name?: string | null
  suffix?: string | null
  department?: string | null
  job_title?: string | null
  email?: string | null
  email_alt?: string | null
  phone?: string | null
  phone_alt?: string | null
  mailing_address_line1?: string | null
  mailing_address_line2?: string | null
  mailing_city?: string | null
  mailing_state?: string | null
  mailing_postal_code?: string | null
  mailing_country?: string | null
  bill_to_service_address?: boolean
  notes?: string | null
  is_main_contact?: boolean
  is_billing_contact?: boolean
  is_service_contact?: boolean
  is_intake_contact?: boolean
  sms_consent?: boolean
  consent_recorded_at?: string | null
  birthday?: string | null
  anniversary?: string | null
  active?: boolean
}

export interface CustomerServiceLocationInput {
  id?: string
  position?: number
  nickname?: string | null
  is_primary?: boolean
  street_address?: string | null
  latitude?: number | null
  longitude?: number | null
  apt_unit?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  gated_property?: boolean
  gate_code?: string | null
  entry_notes?: string | null
  location_contact_id?: string | null
  active?: boolean
}

/**
 * Shape sent to POST /v1/customers â€” supports nested contacts + service_locations
 * for atomic create.
 */
export interface CustomerInput {
  account_number?: string | null
  parent_customer_id?: string | null
  territory_id?: string | null
  display_name: string
  customer_type: CustomerType
  business_name?: string | null
  first_name?: string | null
  last_name?: string | null
  vip?: boolean
  service_agreement?: boolean
  active?: boolean
  industry?: string | null
  referral_source?: string | null
  payment_method?: string | null
  is_net_account?: boolean
  payment_term_id?: string | null
  taxable?: boolean
  tax_item?: string | null
  tax_id?: string | null
  default_tax_class_id?: string | null
  tax_exempt_certificate_document_id?: string | null
  default_currency?: string
  internal_notes?: string | null
  public_notes?: string | null
  assigned_agent_id?: string | null
  commission_pct?: number | null
  assigned_contract_id?: string | null
  birthday?: string | null
  anniversary?: string | null
  sms_consent?: boolean
  consent_recorded_at?: string | null
  tags?: CustomerTag[]
  last_contact_at?: string | null

  // Nested for atomic create only â€” NOT sent on PATCH (use sub-resource endpoints instead)
  contacts?: CustomerContactInput[]
  service_locations?: CustomerServiceLocationInput[]
}

/**
 * Shape sent to PATCH /v1/customers/{id} â€” customer fields ONLY.
 * Contacts and service_locations are managed via separate endpoints.
 */
export type CustomerUpdateInput = Omit<CustomerInput, 'contacts' | 'service_locations'>

// ---------- Query params ----------

export interface CustomerListParams {
  q?: string
  /** Trigram fuzzy name match (typo-tolerant) — used by intake dedup search. */
  fuzzy?: boolean
  /** Normalized phone match (last-10-digits) — used by intake dedup search. */
  phone?: string
  customer_type?: CustomerType
  filing_letter?: string
  has_tag?: CustomerTag
  vip?: boolean
  active?: boolean
  sort?: 'display_name' | 'account_number' | 'last_contact_at' | 'lifetime_value_cents' | 'created_at' | 'updated_at'
  direction?: 'asc' | 'desc'
  per_page?: number
  page?: number
}
