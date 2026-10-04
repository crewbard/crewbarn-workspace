// Public scan API client ? Slice 3.
//
// DELIBERATELY separated from the auth-aware API client. It must never
// send a STAFF token or X-Act-As-Tenant, even by mistake: tenant context
// is absent here and the endpoint is anonymous by default.
//
// The one exception is the OWNER's portal token, when this browser has
// signed in on assets.crewbarn.com. That is what lets somebody see their
// own private items without asking their servicer for a code. No token
// means no header and exactly the anonymous request this always sent.
//
// Falls back to production API URL if VITE_API_URL is not set, so the
// deployed Cloudflare Pages build works without env config.

import type { PublicScanNode, PublicScanResponse, SecuredScanUnlock, SecuredScanUnlockResponse } from '@/types/publicScan'

import { getOwnerToken } from '@/lib/assetOwner'

export const API_BASE = import.meta.env.VITE_API_URL || 'https://api.crewbarn.com'

export class PublicScanNotFoundError extends Error {
  constructor() {
    super('Asset not found')
    this.name = 'PublicScanNotFoundError'
  }
}

export async function getPublicScan(code: string, tenantId?: string): Promise<PublicScanNode> {
  const url = tenantId
    ? `${API_BASE}/v1/scan/${encodeURIComponent(tenantId)}/${encodeURIComponent(code)}`
    : `${API_BASE}/v1/scan/${encodeURIComponent(code)}`

  /*
   * The owner's token, when this browser has one.
   *
   * Anonymous is unchanged — no token means no header and exactly the
   * request that was sent before. What this adds is the signed-in owner
   * seeing their own private record instead of a locked card.
   */
  const ownerToken = getOwnerToken()

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {}),
    },
  })

  if (res.status === 404) {
    throw new PublicScanNotFoundError()
  }

  if (!res.ok) {
    throw new Error(`Public scan failed: ${res.status} ${res.statusText}`)
  }

  const json: PublicScanResponse = await res.json()
  return json.data
}

/**
 * Submit a secured-asset access request (Slice 9 Phase 1). Anonymous, no
 * auth headers — POSTs to the tenant-scoped public endpoint.
 */
export async function submitAccessRequest(
  tenantId: string,
  code: string,
  payload: {
    requester_name: string
    requester_email?: string
    requester_phone?: string
    message?: string
    /** 'tree' asks for the whole property in one approval. The owner still decides. */
    access_scope?: 'item' | 'tree'
  },
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/v1/scan/${encodeURIComponent(tenantId)}/${encodeURIComponent(code)}/access-requests`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const j = await res.json()
      msg = j?.message ?? msg
    } catch {
      // keep default
    }
    throw new Error(msg)
  }
}

export async function unlockSecuredScan(
  tenantId: string,
  code: string,
  accessCode: string,
): Promise<SecuredScanUnlock> {
  const res = await fetch(
    `${API_BASE}/v1/scan/${encodeURIComponent(tenantId)}/${encodeURIComponent(code)}/unlock`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_code: accessCode }),
    },
  )
  if (!res.ok) {
    let msg = `Unlock failed (${res.status})`
    try {
      const j = await res.json()
      msg = j?.message ?? msg
    } catch {
      // keep default
    }
    throw new Error(msg)
  }

  const json: SecuredScanUnlockResponse = await res.json()
  return json.data
}