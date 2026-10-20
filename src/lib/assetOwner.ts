import { installDeviceTransport, isApiUrl, storeSession, clearSession, type BoundSession } from './deviceProof'

/**
 * Signing in as the owner of the thing you just scanned.
 *
 * A private label used to be a dead end for the person who owns the
 * building: it offered a code they had to ask their servicer for, and the
 * servicer decided whether they got one. This is the other item — the same
 * portal login they already use, on the page they are already looking at.
 *
 * **The token lives on this origin only.** assets.crewbarn.com and
 * portal.crewbarn.com are different origins, so a portal session does not
 * carry over; signing in here stores its own. Kept apart from the staff
 * token for the same reason the portal keeps its own: two different people
 * use this browser.
 */

// Defined here rather than imported from publicScan, which imports this
// file for the token — one duplicated line beats a circular import.
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.crewbarn.com'

const TOKEN_KEY = 'crewbarn_asset_owner_token'
let transport: typeof fetch | undefined
/** This credential namespace never borrows the dashboard's identity or tenant. */
export function ownerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init)
  if (!isApiUrl(request.url, API_BASE)) throw new Error('That address cannot be opened with this sign-in.')
  transport ??= installDeviceTransport(API_BASE, TOKEN_KEY, token => {
    if (getOwnerToken() === token) clearOwnerToken()
  }, false)
  return transport(request)
}


export interface OwnerIdentity {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

export function getOwnerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Private windows and blocked storage. Signing in still works for
    // this page view; it just will not be remembered.
    return null
  }
}

export function setOwnerToken(token: string, session?: BoundSession): void {
  // The existing card stores the same response token a second time.
  if (session === undefined && getOwnerToken() === token) return
  storeSession(TOKEN_KEY, token, session)
}

export function clearOwnerToken(): void { clearSession(TOKEN_KEY) }

/**
 * The same `/v1/portal/auth/login` the customer portal uses.
 *
 * Deliberately not a second account system: somebody who owns a building
 * should not need one login for their invoices and another for their
 * items.
 */
export async function signInAsOwner(
  email: string,
  password: string,
): Promise<{ token: string; identity: OwnerIdentity }> {
  const res = await ownerFetch(`${API_BASE}/v1/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const body = (await res.json().catch(() => ({}))) as BoundSession & {
    token?: string
    customer?: OwnerIdentity
    data?: BoundSession & { token?: string; customer?: OwnerIdentity }
    message?: string
  }

  if (!res.ok) {
    throw new Error(body.message ?? 'That email and password did not match.')
  }

  const token = body.token ?? body.data?.token

  if (!token) {
    throw new Error('Sign-in did not finish. Please try again.')
  }

  setOwnerToken(token, body.token ? body : body.data)
  return {
    token,
    identity: body.customer ?? body.data?.customer ?? { id: '', email, first_name: null, last_name: null },
  }
}

/** Who is signed in on this origin, or null. */
export async function fetchOwnerIdentity(token: string): Promise<OwnerIdentity | null> {
  try {
    const res = await ownerFetch(`${API_BASE}/v1/portal/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      // Only a matching expired or revoked session forgets this credential.
      // A 5xx or other hiccup keeps it, so a brief outage doesn't sign the owner out.
      if (res.status === 401 && getOwnerToken() === token) clearOwnerToken()
      return null
    }

    const body = (await res.json()) as { data?: OwnerIdentity }
    return body.data ?? null
  } catch {
    return null
  }
}

/** A name to greet them by, falling back to their email. */
export function ownerName(identity: OwnerIdentity | null): string {
  if (!identity) return ''

  const full = [identity.first_name, identity.last_name].filter(Boolean).join(' ').trim()

  return full || identity.email || 'your account'
}
