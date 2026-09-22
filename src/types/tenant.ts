/**
 * Tenant types — shared between admin tenant management and core auth flows.
 * Mirrors the backend Tenant model + AdminTenantController response shapes.
 */

export type TenantStatus = 'active' | 'suspended' | 'trial'
export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan: TenantPlan
  vertical: string | null
  billing_email: string | null
  is_hosted_plan?: boolean
  // Franchise feature (FR-3)
  parent_tenant_id?: string | null
  franchise_feature_enabled?: boolean
  franchise_seat_limit?: number | null
  settings: Record<string, unknown> | unknown[]
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Only present in list responses
  accounts_count?: number
}

export interface TenantWithAccounts extends Tenant {
  accounts?: Array<{
    id: string
    email: string
    phone: string | null
    account_type: string
    status: string
    is_platform_admin: boolean
    last_login_at: string | null
    created_at: string
  }>
}

export interface TenantListParams {
  search?: string
  status?: TenantStatus
  page?: number
}

export interface TenantListResponse {
  data: Tenant[]
  meta: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export interface CreateTenantInput {
  name: string
  slug: string
  plan?: TenantPlan
  vertical?: string
  /** Marketplace trade slug. When set, its linked seed pack is applied and the
   *  onboarding trade choice is locked to it. Supersedes `vertical`. */
  trade?: string
  // Sales attribution + onboarding/support (SALES-1)
  sales_rep_account_id?: string | null
  sales_commission_pct?: number | null
  onboarding_choice?: 'self' | 'paid'
  onboarding_fee_cents?: number
  support_plan?: string | null
  support_plan_fee_cents?: number
  billing_email?: string
  phone?: string
  status?: TenantStatus
  // Optional first owner account, created in same transaction.
  // password is optional — backend auto-generates a strong one if omitted.
  owner?: {
    email: string
    password?: string
    first_name?: string
    last_name?: string
    phone?: string
    cell_phone?: string
    role?: 'standard' | 'tester' | 'management' | 'sales'
  }
}

export interface CreateTenantResponse {
  data: {
    tenant: Tenant
    owner_account: {
      id: string
      email: string
      tenant_id: string
      account_type: string
      status: string
      is_platform_admin: boolean
    } | null
    /** Plaintext password used at creation. Returned ONCE, never retrievable again. */
    owner_password: string | null
    owner_password_generated: boolean
    invitation_email_sent: boolean
    invitation_email_error: string | null
    seed_vertical: string | null
    seed_summary: Record<string, number | string> | null
    seed_error: string | null
  }
}

export interface UpdateTenantInput {
  name?: string
  plan?: TenantPlan
  status?: TenantStatus
  vertical?: string
  billing_email?: string
  is_hosted_plan?: boolean
}
