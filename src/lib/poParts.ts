import { apiRequest } from '@/lib/api'

/**
 * An order's parts onto the job or estimate it is for, and onto the door
 * (PartsOntoJobs on the server); and what is fitted to an asset.
 */

export type PoPartsLine = {
  po_item_id: string
  description: string
  part_number: string | null
  catalog_item_id: string | null
  serialized: boolean
  ordered: number
  received: number
  /** Already put on the job or estimate. */
  placed: number
  /** Received and not on the job yet. */
  left: number
  sell_cents: number
  notes: string | null
}

export type PoParts = {
  job: { id: string; number: number | string; title: string | null } | null
  estimate: { id: string; number: string; title: string | null; status: string } | null
  for: 'job' | 'estimate' | null
  lines: PoPartsLine[]
  /** The job's assets, and the customer's others at the same address. */
  assets: Array<{ id: string; label: string; on_job: boolean }>
}

export const getPoParts = (poId: string) =>
  apiRequest<{ data: PoParts }>(`/v1/purchase-orders/${poId}/parts`).then((r) => r.data)

/** What the order is for: a job by number, an estimate by number, or neither. */
export const setPoFor = (poId: string, target: { job?: string | null; estimate?: string | null }) =>
  apiRequest<{ data: PoParts }>(`/v1/purchase-orders/${poId}/for`, { method: 'PATCH', body: target }).then((r) => r.data)

export const placePoParts = (poId: string, lines: Array<{ po_item_id: string; qty: number; asset_id?: string | null }>) =>
  apiRequest<{ data: PoParts; placed: number; for: string }>(`/v1/purchase-orders/${poId}/parts/place`, { method: 'POST', body: { lines } })

export type InstalledPart = {
  id: string
  part_number: string | null
  description: string
  quantity: number
  serial_number: string | null
  installed_at: string | null
  job: { id: string; number: number | string } | null
  purchase_order: { id: string; po_number: string } | null
  notes: string | null
  removed_at: string | null
  removed_reason: string | null
  by: string | null
  source: 'order' | 'by_hand'
}

export const installedPartsKey = (assetId: string) => ['asset-installed-parts', assetId] as const

export const listInstalledParts = (assetId: string) =>
  apiRequest<{ data: InstalledPart[] }>(`/v1/assets/${assetId}/installed-parts`).then((r) => r.data)

export const addInstalledPart = (
  assetId: string,
  part: { description: string; part_number?: string | null; quantity?: number; serial_number?: string | null; installed_at?: string | null; notes?: string | null },
) => apiRequest<{ data: InstalledPart }>(`/v1/assets/${assetId}/installed-parts`, { method: 'POST', body: part }).then((r) => r.data)

export const removeInstalledPart = (assetId: string, partId: string, reason: string) =>
  apiRequest<{ data: InstalledPart }>(`/v1/assets/${assetId}/installed-parts/${partId}/remove`, { method: 'POST', body: { reason } }).then((r) => r.data)
