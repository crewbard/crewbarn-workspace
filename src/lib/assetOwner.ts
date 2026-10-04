
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

export function setOwnerToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // As above: not being able to remember it is not a reason to fail.
  }
}

export function clearOwnerToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to do.
  }
}

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
  const res = await fetch(`${API_BASE}/v1/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    token?: string
    data?: { token?: string; customer?: OwnerIdentity }
    message?: string
  }

  if (!res.ok) {
    throw new Error(body.message ?? 'That email and password did not match.')
  }

  const token = body.token ?? body.data?.token

  if (!token) {
    throw new Error('Signed in, but no session came back. Try again.')
  }

  return {
    token,
    identity: body.data?.customer ?? { id: '', email, first_name: null, last_name: null },
  }
}

/** Who is signed in on this origin, or null. */
export async function fetchOwnerIdentity(token: string): Promise<OwnerIdentity | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/portal/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      // An expired or revoked session. Forget it rather than keep
      // sending a token that will never work again.
      clearOwnerToken()
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
