import { apiRequest, setStoredToken, clearStoredToken } from './api'

export type AccountRole = 'standard' | 'tester' | 'management' | 'sales'

export interface Account {
  id: string
  email: string
  phone: string | null
  account_type: string
  role: AccountRole
  status: string
  is_platform_admin: boolean
  /** Platform role + what it may do. Cross-tenant work needs 'tenant_data.access'. */
  platform_role?: string | null
  platform_capabilities?: string[]
  last_login_at: string | null
  /** Profile photo URL (dispatch-map avatar + top bar). Null until set. */
  avatar_url?: string | null
  tenant: {
    id: string
    name: string
    slug: string
    status: string
    plan: string
    /** Beta / free-for-life workspaces: bring-your-own keys only — CrewBarn-managed providers hidden. */
    byo_only?: boolean
    /** Franchise feature (FR-3): drives the Franchise Dashboard nav tab. */
    franchise_feature_enabled?: boolean
    is_franchise?: boolean
  } | null
  extension: {
    first_name: string | null
    last_name: string | null
    role: string | null
    /** Allowed dashboard widget ids; null = no restriction (all widgets). */
    dashboard_widget_ids?: string[] | null
    /** Lands in the employee portal (/me) on sign-in. */
    employee_portal?: boolean | null
    app_access?: boolean | null
    /** Per-member product-tour prefs (avatar-menu switch + auto-show-once). */
    tours_enabled?: boolean | null
    tour_completed_at?: string | null
  } | null
}

interface LoginResponse {
  token: string
  token_type: string
  expires_at: string
  account: Account
  trusted_device_token?: string | null
}

/** localStorage key holding this browser's "trust this device" token — sent
 *  on every login so a trusted browser skips the 2FA code challenge. */
const TRUSTED_DEVICE_KEY = 'crewbarn_trusted_device'

/** Backend returns this (HTTP 200, no token) when 2FA is needed. method may be
 *  'push' (an approval prompt went to the phone — poll login_approval_id) with
 *  fallback_method the code type, or a code method directly. */
interface TwoFactorRequiredResponse {
  two_factor_required: true
  method: string
  fallback_method?: string
  login_approval_id?: string | null
}

export type LoginResult =
  | { account: Account }
  | {
      twoFactorRequired: true
      method: string
      fallbackMethod?: string
      loginApprovalId?: string | null
    }

/** Poll whether the phone has approved a push-to-approve sign-in. */
export async function checkLoginApproval(email: string, approvalId: string): Promise<string> {
  const r = await apiRequest<{ status: string }>(
    `/v1/auth/login-approval?email=${encodeURIComponent(email)}&approval_id=${encodeURIComponent(approvalId)}`,
    { requireAuth: false },
  )
  return r.status
}

export async function login(
  email: string,
  password: string,
  device_name: string,
  twoFactorCode?: string,
  trustDevice?: boolean,
  loginApprovalId?: string,
): Promise<LoginResult> {
  const trustedToken =
    typeof localStorage !== 'undefined' ? localStorage.getItem(TRUSTED_DEVICE_KEY) : null

  const response = await apiRequest<LoginResponse | TwoFactorRequiredResponse>('/v1/auth/login', {
    method: 'POST',
    body: {
      email,
      password,
      device_name,
      ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
      // Present after the phone approved — lets the backend skip the code.
      ...(loginApprovalId ? { login_approval_id: loginApprovalId } : {}),
      // Replay this browser's trust token (skips the code if still valid);
      // ask to remember this device when the user ticked the box.
      ...(trustedToken ? { trusted_device_token: trustedToken } : {}),
      ...(trustDevice ? { trust_device: true } : {}),
    },
    requireAuth: false,
  })

  if ('two_factor_required' in response && response.two_factor_required) {
    return {
      twoFactorRequired: true,
      method: response.method,
      fallbackMethod: response.fallback_method,
      loginApprovalId: response.login_approval_id,
    }
  }

  const ok = response as LoginResponse
  setStoredToken(ok.token)
  // Persist a freshly-issued trust token for next time.
  if (ok.trusted_device_token && typeof localStorage !== 'undefined') {
    localStorage.setItem(TRUSTED_DEVICE_KEY, ok.trusted_device_token)
  }
  return { account: ok.account }
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/v1/auth/logout', { method: 'POST' })
  } finally {
    clearStoredToken()
  }
}

export async function getCurrentAccount(): Promise<Account> {
  const response = await apiRequest<{ account: Account }>('/v1/auth/me')
  return response.account
}

/** Request a password-reset email. Always resolves (backend never reveals
 *  whether the account exists). Throws only on rate-limit / network errors. */
export async function forgotPassword(email: string): Promise<void> {
  await apiRequest('/v1/auth/forgot-password', {
    method: 'POST',
    body: { email },
    requireAuth: false,
  })
}

/** Complete a reset using the emailed token. Backend expects password +
 *  password_confirmation (Laravel `confirmed` rule). */
export async function resetPassword(input: {
  email: string
  token: string
  password: string
  password_confirmation: string
}): Promise<void> {
  await apiRequest('/v1/auth/reset-password', {
    method: 'POST',
    body: input,
    requireAuth: false,
  })
}
