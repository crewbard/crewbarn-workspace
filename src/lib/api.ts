import { ClockSyncError, StorageUnavailableError, readSessionToken, storeSession, clearSession, isDeviceUploadResponse, installDeviceTransport, isApiUrl, sendProgressUpload, signUpload, type BoundSession } from './deviceProof'
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
    const requestToken = getStoredToken()
    const authorization = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('Authorization')
    const sentCurrentSession = requestToken
      ? authorization === `Bearer ${requestToken}` || authorization === `DPoP ${requestToken}`
      : !authorization
    const response = await originalFetch(input, init)
    if (response.status === 401) {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.href
          : (input as Request).url
      if (isApiUrl(url, API_URL) && sentCurrentSession && getStoredToken() === requestToken) {
        handleUnauthorized(url)
      }
    }
    return response
  }
}

if (typeof window !== 'undefined') installDeviceTransport(API_URL, 'crewbarn_token', (token) => { if (getStoredToken() === token) handleUnauthorized('/v1/auth/me') })

export const signApiUpload = (xhr: XMLHttpRequest, url: string, token: string | null) => signUpload(xhr, url, API_URL, 'crewbarn_token', token).catch((error: unknown) => { if (!(error instanceof ClockSyncError) && !(error instanceof StorageUnavailableError) && getStoredToken() === token) handleUnauthorized('/v1/auth/me'); throw error })

export const sendApiUpload = (xhr: XMLHttpRequest, url: string, token: string | null, body: FormData, complete: (status: number, text: string) => void) => sendProgressUpload(xhr, url, API_URL, 'crewbarn_token', token, body, { Accept: 'application/json', ...(getActingTenant() ? { 'X-Act-As-Tenant': getActingTenant()! } : {}) }, complete)

export function getStoredToken(): string | null {
  try { return readSessionToken(TOKEN_STORAGE_KEY) } catch { return null }
}

export function setStoredToken(token: string, session?: BoundSession): void {
  storeSession(TOKEN_STORAGE_KEY, token, session)
  clearSnapshots()
}

export function clearStoredToken(): void {
  clearSession(TOKEN_STORAGE_KEY)
  clearSnapshots()
}

/**
 * Get the tenant ID a platform admin is currently acting as, if any.
 * Used to set the X-Act-As-Tenant header on writes.
 */
export function getActingTenant(): string | null {
  try { return localStorage.getItem(ACTING_TENANT_STORAGE_KEY) } catch { return null }
}

/**
 * Set or clear the acting tenant. Pass null to clear.
 */
export function setActingTenant(tenantId: string | null): void {
  clearSnapshots() // permissions, modules and subscription are per tenant
  if (tenantId === null) {
    try { localStorage.removeItem(ACTING_TENANT_STORAGE_KEY) } catch { /* Storage may be blocked on sign-out. */ }
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
  try {
    const raw = localStorage.getItem(FRANCHISE_ACT_AS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { id: string; name: string }
  } catch {
    return null
  }
}

export function setFranchiseActAs(franchise: { id: string; name: string } | null): void {
  clearSnapshots()
  if (franchise === null) {
    try { localStorage.removeItem(FRANCHISE_ACT_AS_KEY) } catch { /* Storage may be blocked on sign-out. */ }
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
/** Screens anyone can open without signing in (see the public routes in main.tsx). */
const PUBLIC_SCREEN = /^\/(login|sign-up|beta|verify-signup|forgot-password|reset-password\/|download|scan\/|verify\/|r\/|accept-invite\/|auth\/accept-invite|sub-onboarding|sign\/|sign-agreement\/|staff-onboarding)/
export function handleUnauthorized(reqPath: string): void {
  if (bouncingToLogin) return
  // The login + public sign / accept-invite flows surface their own
  // error UX for 401 — don't redirect-loop them.
  const path = reqPath.startsWith('http') ? new URL(reqPath).pathname : reqPath
  if (
    path.startsWith('/v1/auth/login') ||
    path.startsWith('/v1/auth/accept-invite') ||
    path.startsWith('/v1/sub-onboarding') ||
    path.startsWith('/v1/sign/')
  ) {
    return
  }
  // Don't bounce if we're already on a public screen: login, sign-up and
  // the beta gate, password reset, signing and invite links, QR scans,
  // public reports. A stale sign-in left in this browser answers 401 when
  // the app checks it, and that must not throw someone off the beta page
  // onto the login screen. Drop the dead sign-in quietly and stay put.
  if (typeof window !== 'undefined' && PUBLIC_SCREEN.test(window.location.pathname)) {
    clearStoredToken()
    setActingTenant(null)
    setFranchiseActAs(null)
    return
  }

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

/**
 * The free Sub plan answers 402 plan_upgrade_required for what it leaves out.
 * When the person did something (not a page loading), this event opens the
 * upgrade sheet (components/SubPlan.tsx).
 */
export const PLAN_UPGRADE_EVENT = 'crewbarn:plan-upgrade'

export interface PlanUpgradeDetail {
  feature: string
  message: string
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
  signal?: AbortSignal
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
  /** Internal: set true once the completion dialog has answered. */
  _retriedCompletion?: boolean
  /** Internal: set true once the text-agreement dialog has answered. */
  _retriedSmsConsent?: boolean
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
 * The delete prompt that's open, if any. DELETEs that hit the gate while it
 * is open wait for the same answer: removing two items in one save sends
 * them together, and the second used to replace the first prompt so the
 * first never finished (the save sat on "saving" for good). The prompt
 * covers the screen, so anything arriving while it's up comes from the same
 * action.
 */
let pendingDeleteConfirm: Promise<{ password: string; reason: string } | null> | null = null

/**
 * Prompts that each need their own answer (which job, which person) are
 * asked one after another, never on top of each other: a second one used
 * to replace the first, which then never finished.
 */
function oneAtATime<T>(queue: { tail: Promise<unknown> }, ask: () => Promise<T>): Promise<T> {
  const run = queue.tail.then(ask, ask)
  queue.tail = run.catch(() => undefined)
  return run
}
const completionQueue = { tail: Promise.resolve() as Promise<unknown> }
const smsConsentQueue = { tail: Promise.resolve() as Promise<unknown> }

/**
 * Global completion-requirements bridge. Completing a job (any move to a
 * Complete status, or a check-out) without the proof its customer account,
 * job type or company asks for is refused with 422 completion_requirements
 * and a list of what's missing. apiRequest hands that to the registered
 * handler (CompletionRequirementsProvider), which shows the list; someone
 * with jobs.override_requirements can give a reason, and the request is
 * retried once with override_reason. Every status control gets this
 * without its own wiring.
 */
export type CompletionRequirementsRequest = {
  path: string
  message: string
  violations: { code: string; message: string }[]
}
export type CompletionRequirementsHandler = (req: CompletionRequirementsRequest) => Promise<string | null>

let completionHandler: CompletionRequirementsHandler | null = null
export function setCompletionRequirementsHandler(fn: CompletionRequirementsHandler | null): void {
  completionHandler = fn
}

/**
 * Global text-agreement bridge. A text to somebody who hasn't agreed to
 * texts (and hasn't texted the company first) is refused with 422
 * needs_sms_consent. apiRequest asks the registered handler
 * (SmsConsentProvider) whether they agreed; yes retries once with
 * consent_confirmed, which also saves the agreement on their record.
 */
export type SmsConsentRequest = { path: string; message: string; name: string | null }
export type SmsConsentHandler = (req: SmsConsentRequest) => Promise<boolean>

let smsConsentHandler: SmsConsentHandler | null = null
export function setSmsConsentHandler(fn: SmsConsentHandler | null): void {
  smsConsentHandler = fn
}

/**
 * True when an error is a benign "the user closed the dialog" signal: the
 * delete-confirm modal, the completion-requirements dialog (which already
 * showed what's missing), or "Don't send" on the text-agreement question.
 * Callers use this to suppress error toasts/alerts.
 */
export function isDeleteCancelled(err: unknown): boolean {
  return err instanceof ApiError
    && (err.code === 'delete_cancelled' || err.code === 'completion_cancelled' || err.code === 'sms_consent_cancelled')
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
  const requestToken = requireAuth ? readSessionToken(TOKEN_STORAGE_KEY) : getStoredToken()

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }

  if (options.confirmPassword) headers['X-Confirm-Password'] = options.confirmPassword
  if (options.deleteReason) headers['X-Delete-Reason'] = options.deleteReason

  if (requireAuth) {
    const token = requestToken
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
    signal: options.signal,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const stagedFinal = isDeviceUploadResponse(response)
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
    if (response.status === 401 && getStoredToken() === requestToken) {
      handleUnauthorized(path)
    }

    // Delete-confirm gate: prompt for password + reason, then retry once.
    const gateCode = typeof errorBody.error === 'string' ? errorBody.error : undefined
    if (
      !stagedFinal &&
      method === 'DELETE' &&
      response.status === 422 &&
      (gateCode === 'password_required' || gateCode === 'reason_required') &&
      !options._retriedDeleteConfirm &&
      deleteConfirmHandler
    ) {
      const handler = deleteConfirmHandler
      if (!pendingDeleteConfirm) {
        pendingDeleteConfirm = handler({
          path,
          code: gateCode,
          message: errorText(errorBody.message) || errorText(errorBody.error) || 'Confirm this deletion.',
        }).finally(() => {
          pendingDeleteConfirm = null
        })
      }
      const creds = await pendingDeleteConfirm
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

    // Completion requirements: show what's missing; someone allowed may
    // give a reason and complete anyway (retried once with override_reason).
    if (
      response.status === 422 &&
      !stagedFinal &&
      gateCode === 'completion_requirements' &&
      (method === 'PATCH' || method === 'POST') &&
      body !== null && typeof body === 'object' && !Array.isArray(body) &&
      !options._retriedCompletion &&
      completionHandler
    ) {
      const violations = Array.isArray((errorBody as { violations?: unknown }).violations)
        ? ((errorBody as { violations: { code: string; message: string }[] }).violations)
        : []
      const message = errorText(errorBody.message) || "This job can't be completed yet."
      const handler = completionHandler
      const reason = await oneAtATime(completionQueue, () => handler({ path, message, violations }))
      if (reason) {
        return apiRequest<T>(path, {
          ...options,
          body: { ...(body as Record<string, unknown>), override_reason: reason },
          _retriedCompletion: true,
        })
      }
      throw new ApiError(response.status, 'completion_cancelled', message, errorBody.details)
    }

    // Text agreement: ask whether they agreed, then send once more with
    // consent_confirmed, or not at all.
    if (
      response.status === 422 &&
      !stagedFinal &&
      (errorBody as { needs_sms_consent?: unknown }).needs_sms_consent === true &&
      method === 'POST' &&
      body !== null && typeof body === 'object' && !Array.isArray(body) &&
      !options._retriedSmsConsent &&
      smsConsentHandler
    ) {
      const consent = (errorBody as { consent?: { name?: unknown } }).consent
      const message = errorText(errorBody.error) || errorText(errorBody.message) || 'This person hasn’t agreed to get texts.'
      const handler = smsConsentHandler
      const agreed = await oneAtATime(smsConsentQueue, () => handler({
        path,
        message,
        name: typeof consent?.name === 'string' ? consent.name : null,
      }))
      if (agreed) {
        return apiRequest<T>(path, {
          ...options,
          body: { ...(body as Record<string, unknown>), consent_confirmed: true },
          _retriedSmsConsent: true,
        })
      }
      throw new ApiError(response.status, 'sms_consent_cancelled', 'Not sent.', errorBody.details)
    }

    // Step-up gate: platform admin acting in a tenant without a live grant.
    // Run the verify flow (deduped per tenant), then retry the request once.
    if (
      response.status === 403 &&
      !stagedFinal &&
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

    const planCode = (errorBody as { code?: unknown }).code
    if (response.status === 402 && planCode === 'plan_upgrade_required') {
      const rawFeature = (errorBody as { feature?: unknown }).feature
      const detail: PlanUpgradeDetail = {
        feature: typeof rawFeature === 'string' ? rawFeature : 'this',
        message: errorText(errorBody.message) || 'This needs a paid plan.',
      }
      if (method !== 'GET') window.dispatchEvent(new CustomEvent(PLAN_UPGRADE_EVENT, { detail }))
      throw new ApiError(402, 'plan_upgrade_required', detail.message, detail)
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
