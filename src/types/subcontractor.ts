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
  /** When set, the linked portal user sees this sub's WOs in their
   *  customer-portal Subbed Jobs section. */
  portal_account_id: string | null
  /** Email of the linked portal user (when eager-loaded server-side). */
  portal_account_email: string | null
  /** Outstanding portal invite, if any. Surfaces "pending to xyz, expires N" UI. */
  pending_invite: {
    id: string
    email: string
    expires_at: string | null
  } | null
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
  portal_account_id?: string | null
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
}
