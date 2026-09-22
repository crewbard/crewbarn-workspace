/**
 * Vendor types - mirrors VendorResource.
 * Slice 16a per-tenant supplier directory.
 */

import type { PaginatedResponse, ResourceResponse } from '@/types/api'
export type { PaginatedResponse, ResourceResponse }

export interface VendorBillingAddress {
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
}

export interface Vendor {
  id: string
  name: string
  display_name: string | null
  /** Computed display label (display_name ?: name) */
  label: string
  website: string | null
  phone: string | null
  email: string | null
  billing_address: VendorBillingAddress
  default_currency: string
  payment_terms: string | null
  account_number: string | null
  notes: string | null
  active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface VendorInput {
  name: string
  display_name?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
  billing_address_line1?: string | null
  billing_address_line2?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_postal_code?: string | null
  billing_country?: string | null
  default_currency?: string
  payment_terms?: string | null
  account_number?: string | null
  notes?: string | null
  active?: boolean
}

export type VendorUpdateInput = Partial<VendorInput>

export interface VendorListParams {
  q?: string
  active?: boolean
  per_page?: number
  page?: number
}
