import { apiRequest } from './api'

/**
 * Public self-serve signup API (crewbarn.com/sign-up). All calls are
 * unauthenticated (requireAuth: false) — the visitor has no session yet.
 */

export interface PublicTrade {
  id: string
  slug: string
  name: string
  icon: string | null
}

export interface TenantSignupInput {
  company_name: string
  trade: string
  plan?: string
  applicant_type: 'trade' | 'developer'
  accepted_terms: boolean
  owner_first_name: string
  owner_last_name?: string
  owner_email: string
  owner_phone?: string
  password: string
  /** Beta invite (30-day token) — opens sign-up while it's closed to the public. */
  invite_token?: string
  /** From the /beta form: crew who get phone-app logins on verify. */
  employees_count?: string
  employee_emails?: string[]
  turnstile_token?: string
  /** Browser-detected IANA zone — set automatically by tenantSignup(). */
  timezone?: string
}

export interface TenantSignupResponse {
  data: { tenant_id: string; email: string; verification_email_sent: boolean }
}

export interface VerifySignupResponse {
  data: { verified?: boolean; already_verified?: boolean; login_url: string }
}

export interface SignupInvite {
  valid: boolean
  reason?: string
  business_name?: string | null
  email?: string | null
  trade?: string | null
  first_name?: string
  last_name?: string
  phone?: string | null
  crew_count?: number
  expires_at?: string
}
export async function getSignupStatus(invite?: string | null): Promise<{ data: { enabled: boolean; invite: SignupInvite | null; turnstile_site_key?: string | null } }> {
  const qs = invite ? `?invite=${encodeURIComponent(invite)}` : ''
  return apiRequest<{ data: { enabled: boolean; invite: SignupInvite | null; turnstile_site_key?: string | null } }>(`/v1/auth/signup-status${qs}`, { method: 'GET', requireAuth: false })
}

export interface BetaApplyInput {
  contact_name: string
  business_name: string
  trade?: string
  email: string
  phone?: string
  employees_count: string
  employee_emails: string[]
  current_software?: string
  notes?: string
  source?: string
  turnstile_token?: string
}
export async function betaApply(input: BetaApplyInput): Promise<{ data: { received: boolean; email: string } }> {
  return apiRequest('/v1/auth/beta-apply', { method: 'POST', body: input, requireAuth: false })
}
export async function getBetaStatus(): Promise<{ data: { open: boolean; spots: number; taken: number; left: number; turnstile_site_key?: string | null } }> {
  return apiRequest('/v1/auth/beta-status', { method: 'GET', requireAuth: false })
}

/** Join the early-access list while public signup is closed. */
export async function joinWaitlist(input: {
  email: string
  trade?: string
  business_name?: string
}): Promise<{ data: { joined: boolean; email: string } }> {
  return apiRequest<{ data: { joined: boolean; email: string } }>('/v1/auth/waitlist', {
    method: 'POST',
    body: input,
    requireAuth: false,
  })
}

export async function listPublicTrades(): Promise<{ data: PublicTrade[] }> {
  return apiRequest<{ data: PublicTrade[] }>('/v1/portal/trades', { method: 'GET', requireAuth: false })
}

export async function tenantSignup(input: TenantSignupInput): Promise<TenantSignupResponse> {
  // Detect the shop's timezone from the browser so the tenant never starts
  // with a null timezone (calendar, imports, GPS rollups all read it).
  let timezone: string | undefined
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    timezone = undefined
  }
  return apiRequest<TenantSignupResponse>('/v1/auth/tenant-signup', {
    method: 'POST',
    body: { timezone, ...input },
    requireAuth: false,
  })
}

export async function verifyTenantSignup(t: string, token: string): Promise<VerifySignupResponse> {
  return apiRequest<VerifySignupResponse>('/v1/auth/tenant-signup/verify', {
    method: 'POST',
    body: { t, token },
    requireAuth: false,
  })
}
