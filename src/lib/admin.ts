import { apiRequest } from './api'
import type {
  Tenant,
  TenantListParams,
  TenantListResponse,
  TenantWithAccounts,
  CreateTenantInput,
  CreateTenantResponse,
  UpdateTenantInput,
} from '@/types/tenant'

// ---- Vendor data importer (platform admin, read-only test harness) ----

export interface ImportPreviewCustomer {
  display_name: string | null
  business_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  account_number: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  [k: string]: unknown
}

export interface ImportCreds {
  provider: 'service_fusion'
  client_id: string
  client_secret: string
}

export async function testImportConnection(
  input: ImportCreds,
): Promise<{ ok: boolean; error?: string }> {
  return apiRequest('/v1/admin/importers/test-connection', { method: 'POST', body: input })
}

export async function previewImport(
  input: ImportCreds & { limit?: number },
): Promise<{
  ok: boolean
  error?: string
  provider?: string
  count?: number
  customers?: ImportPreviewCustomer[]
  raw_sample?: unknown[]
}> {
  return apiRequest('/v1/admin/importers/preview', { method: 'POST', body: input })
}

export async function startImport(
  input: ImportCreds & { tenant_id: string; entity?: 'customers' | 'locations' | 'work_orders' | 'invoices' | 'cache' },
): Promise<{ ok: boolean; error?: string; batch_id?: string; status?: string; entity?: string }> {
  return apiRequest('/v1/admin/importers/run', { method: 'POST', body: input })
}

export interface ImportStatus {
  ok: boolean
  error?: string
  status?: string
  created?: number
  skipped?: number
  errors?: number
  error_samples?: { row?: number; message?: string }[]
}

export async function getImportStatus(batchId: string): Promise<ImportStatus> {
  return apiRequest(`/v1/admin/importers/status/${batchId}`, { method: 'GET' })
}

/** One cached raw vendor record (Stage-1 import cache). */
export interface ImportCacheRecord {
  external_id: string
  payload: Record<string, unknown>
}

/** Read cached raw vendor records for inspection. `with` surfaces a shape fast. */
export async function cacheSampleImport(input: {
  tenant_id: string
  entity: 'customers' | 'jobs' | 'estimates' | 'techs'
  with?: 'tax' | 'discount' | 'dealer' | 'paid' | 'unpaid'
  limit?: number
}): Promise<{
  ok: boolean
  entity?: string
  with?: string | null
  count?: number
  records?: ImportCacheRecord[]
  error?: string
}> {
  const q = new URLSearchParams({ tenant_id: input.tenant_id, entity: input.entity })
  if (input.with) q.set('with', input.with)
  if (input.limit) q.set('limit', String(input.limit))
  return apiRequest(`/v1/admin/importers/cache-sample?${q.toString()}`, { method: 'GET' })
}

/** Wipe a tenant's cached vendor records once the import is verified clean. */
export async function wipeImportCache(input: {
  tenant_id: string
  provider?: string
}): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  return apiRequest('/v1/admin/importers/cache-wipe', { method: 'POST', body: input })
}

/**
 * Admin API client.
 *
 * All endpoints require platform_admin authorization (is_platform_admin = true
 * on the caller's account). Backend returns 403 otherwise.
 *
 * These endpoints BYPASS tenant scoping — they operate on the global tenant
 * set, not the caller's tenant.
 */

export async function listTenants(params: TenantListParams = {}): Promise<TenantListResponse> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))

  const queryString = query.toString()
  const path = queryString ? `/v1/admin/tenants?${queryString}` : '/v1/admin/tenants'

  return apiRequest<TenantListResponse>(path, { method: 'GET' })
}

// --- Platform ops dashboard ------------------------------------------------

export interface AdminSeriesPoint {
  label: string
  value: number
}

export interface AdminOverview {
  kpis: {
    tenants_total: number
    tenants_active: number
    tenants_new_7d: number
    tenants_new_30d: number
    accounts_total: number
    jobs_total: number
    jobs_30d: number
    revenue_paid_cents_total: number
    revenue_paid_cents_30d: number
    activity_24h: number
  }
  by_plan: { plan: string; count: number }[]
  series: {
    signups: AdminSeriesPoint[]
    logins: AdminSeriesPoint[]
    activity: AdminSeriesPoint[]
    jobs: AdminSeriesPoint[]
    revenue: AdminSeriesPoint[]
  }
  leaderboard: {
    tenant_id: string
    name: string
    activity_30d: number
    jobs_30d: number
    revenue_cents_30d: number
    last_active: string | null
  }[]
  feed: {
    id: string
    tenant_id: string | null
    tenant_name: string | null
    actor_email: string | null
    client: string
    method: string
    path: string
    response_status: number
    created_at: string | null
  }[]
  coverage: {
    cities: number
    states: number
    locations: number
    top_states: { state: string; count: number }[]
  }
  ops: { kms_enabled: boolean; kms_provider: string | null }
}

export async function getAdminOverview(): Promise<{ data: AdminOverview }> {
  return apiRequest<{ data: AdminOverview }>('/v1/admin/overview', { method: 'GET' })
}

// --- Per-tenant feature switches -------------------------------------------

export interface TenantModules {
  toggleable: string[]
  disabled_modules: string[]
}

export async function getTenantModules(id: string): Promise<{ data: TenantModules }> {
  return apiRequest<{ data: TenantModules }>(`/v1/admin/tenants/${id}/modules`, { method: 'GET' })
}

export async function updateTenantModules(id: string, disabledModules: string[]): Promise<{ data: TenantModules }> {
  return apiRequest<{ data: TenantModules }>(`/v1/admin/tenants/${id}/modules`, {
    method: 'PATCH',
    body: { disabled_modules: disabledModules },
  })
}

// --- Platform billing (subscription plans + gateway) -----------------------

export interface BillingPlan {
  key: string
  name: string
  monthly_price_cents: number
  active: boolean
  sort_order: number
  stripe_price_id: string | null
  paddle_price_id: string | null
}

export async function getBillingPlans(): Promise<{ data: BillingPlan[] }> {
  return apiRequest<{ data: BillingPlan[] }>('/v1/admin/billing/plans', { method: 'GET' })
}

export async function updateBillingPlan(
  key: string,
  patch: Partial<Pick<BillingPlan, 'name' | 'monthly_price_cents' | 'active' | 'stripe_price_id' | 'paddle_price_id'>>,
): Promise<{ data: BillingPlan }> {
  return apiRequest<{ data: BillingPlan }>(`/v1/admin/billing/plans/${key}`, { method: 'PATCH', body: patch })
}

interface HiddenField {
  present: boolean
  last4: string | null
}
export interface BillingConfig {
  billing_provider: 'none' | 'stripe' | 'paddle'
  stripe_secret_key: HiddenField
  stripe_webhook_secret: HiddenField
  paddle_api_key: HiddenField
  paddle_webhook_secret: HiddenField
  /** Master on/off switch for public self-serve signup (crewbarn.com/sign-up). */
  public_signup_enabled: boolean
  /** Platform-wide default sales commission rate (%). */
  default_sales_commission_pct: number
}

export async function getBillingConfig(): Promise<BillingConfig> {
  const r = await apiRequest<{ data: BillingConfig }>('/v1/admin/platform-settings', { method: 'GET' })
  return r.data
}

export async function updateBillingConfig(patch: Record<string, unknown>): Promise<BillingConfig> {
  const r = await apiRequest<{ data: BillingConfig }>('/v1/admin/platform-settings', { method: 'PATCH', body: patch })
  return r.data
}

export interface TwilioNumber {
  phone_number: string
  friendly_name: string | null
  sms: boolean
}

/** The phone numbers on the CrewBarn Twilio account, for the From-number picker. */
export async function listTwilioNumbers(): Promise<TwilioNumber[]> {
  const r = await apiRequest<{ data: { numbers: TwilioNumber[] } }>(
    '/v1/admin/platform-settings/twilio/numbers',
    { method: 'GET' },
  )
  return r.data.numbers
}

// --- Marketplace trades ----------------------------------------------------

export interface Trade {
  id: string
  slug: string
  name: string
  icon: string | null
  sort_order: number
  tenant_count: number
  /** Seed pack that seeds this trade's starter business model (null = unlinked). */
  seed_pack_key: string | null
  /** Resolved label; null with a non-null key means the linked pack is missing. */
  seed_pack_label: string | null
}

export async function listTrades(): Promise<{ data: Trade[] }> {
  return apiRequest<{ data: Trade[] }>('/v1/admin/trades', { method: 'GET' })
}

export async function createTrade(input: { slug: string; name: string; icon?: string | null; sort_order?: number; seed_pack_key?: string | null }): Promise<{ data: Trade }> {
  return apiRequest<{ data: Trade }>('/v1/admin/trades', { method: 'POST', body: input })
}

export async function updateTrade(id: string, patch: Partial<{ slug: string; name: string; icon: string | null; sort_order: number; seed_pack_key: string | null }>): Promise<{ data: Trade }> {
  return apiRequest<{ data: Trade }>(`/v1/admin/trades/${id}`, { method: 'PATCH', body: patch })
}

export async function deleteTrade(id: string): Promise<void> {
  return apiRequest<void>(`/v1/admin/trades/${id}`, { method: 'DELETE' })
}

// --- Portal users (marketplace customer + field-tech logins) ---------------

export interface PortalUser {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  active: boolean
  email_verified: boolean
  last_login_at: string | null
  linked_tenants: number
  created_at: string | null
}

export interface PortalUserListResponse {
  data: PortalUser[]
  meta: { total: number; per_page: number; current_page: number; last_page: number }
}

export async function listPortalUsers(search?: string): Promise<PortalUserListResponse> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiRequest<PortalUserListResponse>(`/v1/admin/portal-users${qs}`, { method: 'GET' })
}

export async function setPortalUserActive(id: string, active: boolean): Promise<{ data: PortalUser }> {
  return apiRequest<{ data: PortalUser }>(`/v1/admin/portal-users/${id}`, { method: 'PATCH', body: { active } })
}

// --- Marketplace listings --------------------------------------------------

export type MarketplaceVisibility = 'private' | 'marketplace_listed' | 'hidden_paused'

export interface MarketplaceListing {
  tenant_id: string
  name: string
  vertical: string | null
  visibility_mode: MarketplaceVisibility
  accepting_requests: boolean
  blurb: string | null
  zip_count: number
  trades: string[]
}

export async function listMarketplaceListings(): Promise<{ data: MarketplaceListing[] }> {
  return apiRequest<{ data: MarketplaceListing[] }>('/v1/admin/marketplace/listings', { method: 'GET' })
}

export async function setMarketplaceVisibility(tenantId: string, mode: MarketplaceVisibility): Promise<{ data: { tenant_id: string; visibility_mode: MarketplaceVisibility } }> {
  return apiRequest(`/v1/admin/marketplace/listings/${tenantId}`, { method: 'PATCH', body: { visibility_mode: mode } })
}

export interface MarketplaceReview {
  id: string
  tenant_name: string | null
  reviewer: string | null
  rating: number
  comment: string | null
  is_published: boolean
  created_at: string | null
}

export async function listMarketplaceReviews(): Promise<{ data: MarketplaceReview[] }> {
  return apiRequest<{ data: MarketplaceReview[] }>('/v1/admin/marketplace/reviews', { method: 'GET' })
}

export async function setReviewPublished(id: string, published: boolean): Promise<{ data: { id: string; is_published: boolean } }> {
  return apiRequest(`/v1/admin/marketplace/reviews/${id}`, { method: 'PATCH', body: { is_published: published } })
}

// --- Seed packs (per-vertical onboarding starter business model) -----------

/** Section rows are loosely typed — shapes vary per section but are all
 *  arrays of flat string/number/bool records (plus string[] for the
 *  recommendation lists). The editor renders them from a column spec. */
export type SeedPackRow = Record<string, unknown>
export type SeedPackSection = SeedPackRow[] | string[]

export interface SeedPackData {
  statuses: SeedPackRow[]
  job_types: SeedPackRow[]
  asset_types: SeedPackRow[]
  service_categories: SeedPackRow[]
  product_categories: SeedPackRow[]
  service_items: SeedPackRow[]
  product_items: SeedPackRow[]
  inventory_locations: SeedPackRow[]
  custom_fields: SeedPackRow[]
  resource_recommendations: string[]
  company_asset_recommendations: SeedPackRow[]
  inventory_stock_recommendations: SeedPackRow[]
  [key: string]: SeedPackSection
}

export interface SeedPackSummary {
  id: string
  key: string
  label: string
  description: string | null
  is_builtin: boolean
  is_active: boolean
  sort_order: number
  tenant_count: number
  counts: Record<string, number>
}

export interface SeedPackFull {
  id: string
  key: string
  label: string
  description: string | null
  is_builtin: boolean
  is_active: boolean
  sort_order: number
  data: SeedPackData
}

export async function listSeedPacks(): Promise<{ data: SeedPackSummary[] }> {
  return apiRequest<{ data: SeedPackSummary[] }>('/v1/admin/seed-packs', { method: 'GET' })
}

export async function getSeedPack(id: string): Promise<{ data: SeedPackFull }> {
  return apiRequest<{ data: SeedPackFull }>(`/v1/admin/seed-packs/${id}`, { method: 'GET' })
}

export async function createSeedPack(input: {
  key: string
  label: string
  description?: string | null
  sort_order?: number
  data?: Partial<SeedPackData>
}): Promise<{ data: SeedPackFull }> {
  return apiRequest<{ data: SeedPackFull }>('/v1/admin/seed-packs', { method: 'POST', body: input })
}

export async function updateSeedPack(
  id: string,
  patch: Partial<{
    label: string
    description: string | null
    is_active: boolean
    sort_order: number
    data: Partial<SeedPackData>
  }>,
): Promise<{ data: SeedPackFull }> {
  return apiRequest<{ data: SeedPackFull }>(`/v1/admin/seed-packs/${id}`, { method: 'PATCH', body: patch })
}

export async function deleteSeedPack(id: string): Promise<void> {
  return apiRequest<void>(`/v1/admin/seed-packs/${id}`, { method: 'DELETE' })
}

// --- Sales attribution + commission + onboarding/support tracking ----------

export interface PlatformUserLite {
  id: string
  email: string
  name: string | null
  role: string | null
}

export async function listPlatformUsersForSelect(): Promise<PlatformUserLite[]> {
  const r = await apiRequest<{ data: { id: string; email: string; name?: string | null; role?: string | null }[] }>(
    '/v1/admin/platform-users',
    { method: 'GET' },
  )
  return r.data.map((u) => ({ id: u.id, email: u.email, name: u.name ?? null, role: u.role ?? null }))
}

export interface SalesRepRollup {
  account_id: string
  email: string | null
  tenant_count: number
  plan_mrr_cents: number
  monthly_commission_cents: number
  onboarding_cents: number
  support_mrr_cents: number
}

export interface SalesTenantRow {
  tenant_id: string
  name: string
  plan: string | null
  status: string
  sales_rep_account_id: string | null
  rep_email: string | null
  commission_pct: number
  plan_mrr_cents: number
  monthly_commission_cents: number
  onboarding_choice: string
  onboarding_fee_cents: number
  support_plan: string | null
  support_plan_fee_cents: number
}

export interface SalesTracking {
  default_commission_pct: number
  reps: SalesRepRollup[]
  tenants: SalesTenantRow[]
  totals: { plan_mrr_cents: number; commission_cents: number; onboarding_cents: number; support_mrr_cents: number }
}

export async function getSalesTracking(): Promise<{ data: SalesTracking }> {
  return apiRequest<{ data: SalesTracking }>('/v1/admin/sales-tracking', { method: 'GET' })
}

export async function getTenant(id: string): Promise<{ data: TenantWithAccounts }> {
  return apiRequest<{ data: TenantWithAccounts }>(`/v1/admin/tenants/${id}`, { method: 'GET' })
}

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResponse> {
  return apiRequest<CreateTenantResponse>('/v1/admin/tenants', {
    method: 'POST',
    body: input,
  })
}

export async function updateTenant(id: string, input: UpdateTenantInput): Promise<{ data: Tenant }> {
  return apiRequest<{ data: Tenant }>(`/v1/admin/tenants/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export interface ResendInvitationResponse {
  data: {
    account_id: string
    email: string
    password: string
    invitation_email_sent: boolean
    invitation_email_error: string | null
  }
}

export async function resendTenantInvitation(
  tenantId: string,
  accountId: string,
): Promise<ResendInvitationResponse> {
  return apiRequest<ResendInvitationResponse>(
    `/v1/admin/tenants/${tenantId}/accounts/${accountId}/resend-invitation`,
    { method: 'POST' },
  )
}

export interface UpdateAccountInput {
  email?: string
  phone?: string | null
  cell_phone?: string | null
  role?: 'standard' | 'tester' | 'management' | 'sales'
  status?: 'active' | 'suspended'
  first_name?: string | null
  last_name?: string | null
}

export async function updateTenantAccount(
  tenantId: string,
  accountId: string,
  input: UpdateAccountInput,
): Promise<{ data: unknown }> {
  return apiRequest<{ data: unknown }>(
    `/v1/admin/tenants/${tenantId}/accounts/${accountId}`,
    { method: 'PATCH', body: input },
  )
}
