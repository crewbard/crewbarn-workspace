import { clearSnapshots } from './snapshots'

export const API_URL = import.meta.env.VITE_API_URL || 'https://api.crewbarn.com'

const TOKEN_STORAGE_KEY = 'crewbarn_token'
const ACTING_TENANT_STORAGE_KEY = 'crewbarn_acting_tenant'
const FRANCHISE_ACT_AS_KEY = 'crewbarn_franchise_act_as'

// ----------------------------------------------------------------
// Global 401 interceptor — installed once at module load so every
// fetch() call in the app (apiRequest + the raw fetch sites in
// modals / uploads / AI calls) gets the same "your session ended,
// go log in again" treatment.
//
// We only act on responses from our own API_URL — third-party
// requests (mapbox tiles, Google Places, etc.) keep their existing
// 401 behavior so a transient external auth blip doesn't kick the
// user out.
// ----------------------------------------------------------------
if (typeof window !== 'undefined' && !(window as Window & { __cbFetchPatched?: boolean }).__cbFetchPatched) {
  ;(window as Window & { __cbFetchPatched?: boolean }).__cbFetchPatched = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init)
    if (response.status === 401) {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.href
          : (input as Request).url
      if (url.startsWith(API_URL)) {
        handleUnauthorized(url)
      }
    }
    return response
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string): void {
  // A new session is a new person as far as the shell snapshots are concerned.
  clearSnapshots()
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  clearSnapshots()
}

/**
 * Get the tenant ID a platform admin is currently acting as, if any.
 * Used to set the X-Act-As-Tenant header on writes.
 */
export function getActingTenant(): string | null {
  return localStorage.getItem(ACTING_TENANT_STORAGE_KEY)
}

/**
 * Set or clear the acting tenant. Pass null to clear.
 */
export function setActingTenant(tenantId: string | null): void {
  clearSnapshots() // permissions, modules and subscription are per tenant
  if (tenantId === null) {
    localStorage.removeItem(ACTING_TENANT_STORAGE_KEY)
  } else {
    localStorage.setItem(ACTING_TENANT_STORAGE_KEY, tenantId)
  }
}

/**
 * Franchise drill-in (FR-4): a franchisor browsing one of its franchises.
 * Stores {id,name}; the id is forwarded as X-Franchise-Act-As so backend
 * ResolveTenant scopes the request to that franchise (read-only unless a
 * support grant is active). Cleared on logout / "Exit franchise".
 */
export function getFranchiseActAs(): { id: string; name: string } | null {
  const raw = localStorage.getItem(FRANCHISE_ACT_AS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as { id: string; name: string }
  } catch {
    return null
  }
}

export function setFranchiseActAs(franchise: { id: string; name: string } | null): void {
  clearSnapshots()
  if (franchise === null) {
    localStorage.removeItem(FRANCHISE_ACT_AS_KEY)
  } else {
    localStorage.setItem(FRANCHISE_ACT_AS_KEY, JSON.stringify(franchise))
  }
}

/**
 * Globally handle "your session ended" responses: clear the token +
 * acting-tenant, then bounce to /login while preserving where the
 * user was trying to go so we can return them there after re-auth.
 *
 * Idempotent — repeated 401s during a redirect storm collapse into
 * one bounce thanks to the in-flight guard.
 *
 * Suppressed on the /login + /accept-invite + /sign/* paths since a
 * 401 there is "bad credentials" / "expired token", not a session
 * timeout — those screens handle their own error messaging.
 */
let bouncingToLogin = false
export function handleUnauthorized(reqPath: string): void {
  if (bouncingToLogin) return
  // The login + public sign / accept-invite flows surface their own
  // error UX for 401 — don't redirect-loop them.
  const path = reqPath.startsWith('http') ? new URL(reqPath).pathname : reqPath
  if (
    path.startsWith('/v1/auth/login') ||
    path.startsWith('/v1/auth/accept-invite') ||
    path.startsWith('/v1/sign/')
  ) {
    return
  }
  // Don't bounce if we're already on a public screen (no auth needed
  // to view login / sign / accept-invite).
  const onPublic = typeof window !== 'undefined' && /^\/(login|sign\/|auth\/accept-invite)/.test(window.location.pathname)
  if (onPublic) return

  bouncingToLogin = true
  clearStoredToken()
  setActingTenant(null)
  setFranchiseActAs(null)
  if (typeof window !== 'undefined') {
    const next = window.location.pathname + window.location.search
    const target = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'
    // Full reload so any in-flight React Query caches, websocket
    // subscriptions, mutable refs etc. get torn down cleanly.
    window.location.replace(target)
  }
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiRequestOptions {
  responseType?: 'json' | 'blob'
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  requireAuth?: boolean
  /** Re-auth password forwarded as X-Confirm-Password (delete gate). */
  confirmPassword?: string
  /** Required reason forwarded as X-Delete-Reason (delete gate). */
  deleteReason?: string
  /** Internal: set true once we've already prompted to avoid loops. */
  _retriedDeleteConfirm?: boolean
  /** Internal: set true once we've stepped up to avoid loops. */
  _retriedStepUp?: boolean
}

/**
 * Global delete-confirm bridge. The backend ConfirmDelete middleware
 * 422s every DELETE that lacks a re-auth password + reason. Rather than
 * thread a modal through all ~50 delete call sites, apiRequest catches
 * that 422, asks the registered handler (a React provider mounts one)
 * for {password, reason}, then retries the request once with headers.
 *
 * Returns null if the user cancels → the original error propagates.
 */
export type DeleteConfirmRequest = {
  path: string
  /** 'password_required' | 'reason_required' */
  code: string
  message: string
}
export type DeleteConfirmHandler = (
  req: DeleteConfirmRequest,
) => Promise<{ password: string; reason: string } | null>

let deleteConfirmHandler: DeleteConfirmHandler | null = null
export function setDeleteConfirmHandler(fn: DeleteConfirmHandler | null): void {
  deleteConfirmHandler = fn
}

/**
 * True when an error is the benign "user cancelled the delete-confirm
 * modal" signal. Callers use this to suppress error toasts/alerts on
 * cancel (the user chose not to delete — nothing went wrong).
 */
export function isDeleteCancelled(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'delete_cancelled'
}

/**
 * Step-up bridge. A platform/management user acting inside a tenant
 * (X-Act-As-Tenant) that lacks a live step-up grant gets a 403
 * {error: step_up_required}. Rather than wire a modal into every query,
 * apiRequest catches it, asks the registered handler (StepUpProvider) to
 * run the SMS/email verify flow, then retries the original request once.
 *
 * Concurrency: a tenant page mounts many queries that all 403 at once —
 * pendingStepUp dedupes them onto ONE modal + ONE verify per tenant.
 */
export type StepUpRequest = { tenantId: string; message: string }
export type StepUpHandler = (req: StepUpRequest) => Promise<boolean>

let stepUpHandler: StepUpHandler | null = null
export function setStepUpHandler(fn: StepUpHandler | null): void {
  stepUpHandler = fn
}
export function isStepUpCancelled(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'step_up_cancelled'
}
const pendingStepUp = new Map<string, Promise<boolean>>()

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, requireAuth = true } = options

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }

  if (options.confirmPassword) headers['X-Confirm-Password'] = options.confirmPassword
  if (options.deleteReason) headers['X-Delete-Reason'] = options.deleteReason

  if (requireAuth) {
    const token = getStoredToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Platform admins can set an acting tenant in localStorage. When set,
    // forward it as X-Act-As-Tenant so backend ResolveTenant middleware
    // routes the request to that tenant instead of bypass mode.
    const actingTenant = getActingTenant()
    if (actingTenant) {
      headers['X-Act-As-Tenant'] = actingTenant
    }

    // Franchisor drilling into one of its franchises (FR-4). Forwarded as
    // X-Franchise-Act-As; backend scopes to that franchise (read-only unless a
    // support grant is active).
    const franchiseActAs = getFranchiseActAs()
    if (franchiseActAs) {
      headers['X-Franchise-Act-As'] = franchiseActAs.id
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    let errorBody: {
      error?: unknown
      message?: unknown
      details?: unknown
      errors?: unknown
    } = {}
    try {
      errorBody = await response.json()
    } catch {
      // Response wasn't JSON
    }

    // Session expired / token revoked / wasn't sent — kick the user
    // to the login screen. handleUnauthorized() is idempotent and
    // skips public auth paths.
    if (response.status === 401) {
      handleUnauthorized(path)
    }

    // Delete-confirm gate: prompt for password + reason, then retry once.
    const gateCode = typeof errorBody.error === 'string' ? errorBody.error : undefined
    if (
      method === 'DELETE' &&
      response.status === 422 &&
      (gateCode === 'password_required' || gateCode === 'reason_required') &&
      !options._retriedDeleteConfirm &&
      deleteConfirmHandler
    ) {
      const creds = await deleteConfirmHandler({
        path,
        code: gateCode,
        message: errorText(errorBody.message) || errorText(errorBody.error) || 'Confirm this deletion.',
      })
      if (creds) {
        return apiRequest<T>(path, {
          ...options,
          confirmPassword: creds.password,
          deleteReason: creds.reason,
          _retriedDeleteConfirm: true,
        })
      }
      // User cancelled — surface a benign cancel error the callers can ignore.
      throw new ApiError(response.status, 'delete_cancelled', 'Deletion cancelled.', errorBody.details)
    }

    // Step-up gate: platform admin acting in a tenant without a live grant.
    // Run the verify flow (deduped per tenant), then retry the request once.
    if (
      response.status === 403 &&
      gateCode === 'step_up_required' &&
      !options._retriedStepUp &&
      stepUpHandler
    ) {
      const tenantId =
        typeof (errorBody as { tenant_id?: unknown }).tenant_id === 'string'
          ? ((errorBody as { tenant_id: string }).tenant_id)
          : getActingTenant() || ''
      let prompt = pendingStepUp.get(tenantId)
      if (!prompt) {
        prompt = stepUpHandler({
          tenantId,
          message: errorText(errorBody.message) || 'Verify your identity to open this tenant.',
        }).finally(() => pendingStepUp.delete(tenantId))
        pendingStepUp.set(tenantId, prompt)
      }
      const unlocked = await prompt
      if (unlocked) {
        return apiRequest<T>(path, { ...options, _retriedStepUp: true })
      }
      throw new ApiError(response.status, 'step_up_cancelled', 'Tenant access cancelled.', errorBody.details)
    }

    throw new ApiError(
      response.status,
      errorCode(errorBody.error),
      errorText(errorBody.message)
        || errorText(errorBody.error)
        || firstValidationError(errorBody.errors)
        || `Request failed with status ${response.status}`,
      errorBody.details ?? errorBody.errors
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (options.responseType === 'blob') return await response.blob() as T
  return response.json()
}

function errorCode(value: unknown): string {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : 'unknown_error'
}

function errorText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) {
    return value.map(errorText).find(Boolean) ?? null
  }
  if (value && typeof value === 'object') {
    const maybeMessage = (value as { message?: unknown; error?: unknown }).message
      ?? (value as { message?: unknown; error?: unknown }).error
    const nested = errorText(maybeMessage)
    if (nested) return nested
  }
  return null
}

function firstValidationError(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null
  for (const value of Object.values(errors as Record<string, unknown>)) {
    const text = errorText(value)
    if (text) return text
  }
  return null
}
