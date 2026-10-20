/**
 * Subcontractor types — mirror the backend SubcontractorResource shape.
 * Keep in sync with: app/Http/Resources/SubcontractorResource.php
 */

export type SubPaymentTerms = 'on_receipt' | 'net_15' | 'net_30' | 'net_60'

export interface Subcontractor {
  id: string
  tenant_id: string

  business_name: string
  contact_name: string | null
  phone: string | null
  email: string | null

  street_address: string | null
  apt_unit: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  full_address: string

  vendor_partner_number: string | null

  w9_on_file: boolean
  coi_on_file: boolean
  license_on_file: boolean

  default_payment_terms: SubPaymentTerms
  linked_tenant_id: string | null
  /**
   * Sub network (null while it's off): connected; requested (on CrewBarn,
   * its first job not accepted yet); invited (code out); none (not on
   * CrewBarn: invite it before sending a job).
   */
  network_status?: 'connected' | 'requested' | 'invited' | 'none' | null
  active: boolean
  notes: string | null

  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface SubcontractorInput {
  business_name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  street_address?: string | null
  apt_unit?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  vendor_partner_number?: string | null
  w9_on_file?: boolean
  coi_on_file?: boolean
  license_on_file?: boolean
  default_payment_terms?: SubPaymentTerms
  linked_tenant_id?: string | null
  active?: boolean
  notes?: string | null
}

export type SubcontractorUpdateInput = Partial<SubcontractorInput>

/**
 * POST /v1/work-orders/{id}/sub-out payload.
 */
export interface SubOutInput {
  subcontractor_id: string
  sub_nte_cents: number
  sub_special_instructions?: string | null
  /** Urgent: send to a sub whose documents aren't all in (noted on the job). */
  send_anyway?: boolean
}
