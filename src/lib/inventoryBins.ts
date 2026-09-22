import { apiRequest } from '@/lib/api'
import type {
  InventoryBin,
  InventoryBinInput,
  InventoryBinUpdateInput,
  InventoryBinListParams,
  InventoryBinSetupApplyResult,
  InventoryBinSetupInput,
  InventoryBinSetupPreview,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/inventoryBin'

function buildQuery<T extends object>(params: T): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'boolean') usp.set(k, v ? '1' : '0')
    else usp.set(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export async function listInventoryBins(
  params: InventoryBinListParams = {}
): Promise<PaginatedResponse<InventoryBin>> {
  return apiRequest<PaginatedResponse<InventoryBin>>(
    `/v1/inventory-bins${buildQuery(params)}`
  )
}

/**
 * Every bin matching the filter, following pagination to the end.
 *
 * A TREE cannot be paginated. Asking for one page and drawing the result meant
 * a shop with 754 bins showed 200 — all of them from the first location, so the
 * other three rendered as empty and the bins looked like they had vanished. The
 * API caps per_page at 200, so the only correct answer is to keep asking.
 *
 * Bounded at 25 pages (5,000 bins). Past that a tree is the wrong UI anyway,
 * and an unbounded loop against a mis-filtered query is how a page hangs.
 */
export async function listAllInventoryBins(
  params: InventoryBinListParams = {},
): Promise<{ data: InventoryBin[]; truncated: boolean; total: number }> {
  const perPage = 200
  const MAX_PAGES = 25

  // Page 1 tells us how many there are; the rest go out AT ONCE. Fetching
  // them in sequence meant four round-trips stacked end to end, and the user
  // waits for the sum rather than the slowest.
  const first = await listInventoryBins({ ...params, per_page: perPage, page: 1 })
  const lastPage = first.meta?.last_page ?? 1
  const total = first.meta?.total ?? first.data.length

  if (lastPage <= 1) {
    return { data: first.data, truncated: false, total }
  }

  const capped = Math.min(lastPage, MAX_PAGES)
  const rest = await Promise.all(
    Array.from({ length: capped - 1 }, (_, i) =>
      listInventoryBins({ ...params, per_page: perPage, page: i + 2 }),
    ),
  )

  return {
    data: [...first.data, ...rest.flatMap((r) => r.data)],
    truncated: lastPage > MAX_PAGES,
    total,
  }
}

export interface BinStockRollup {
  [binId: string]: { items: number; qty: number; units: number }
}

/** Direct contents per bin. Subtree totals are rolled up by the caller. */
export async function getBinStockRollup(locationId?: string): Promise<BinStockRollup> {
  const res = await apiRequest<{ data: BinStockRollup }>(
    `/v1/inventory-bins/stock-rollup${locationId ? `?location_id=${encodeURIComponent(locationId)}` : ''}`,
  )
  return res.data
}

export async function getInventoryBin(id: string): Promise<InventoryBin> {
  const res = await apiRequest<ResourceResponse<InventoryBin>>(
    `/v1/inventory-bins/${id}`
  )
  return res.data
}

export async function createInventoryBin(
  input: InventoryBinInput
): Promise<InventoryBin> {
  const res = await apiRequest<ResourceResponse<InventoryBin>>(
    '/v1/inventory-bins',
    { method: 'POST', body: input }
  )
  return res.data
}

export async function updateInventoryBin(
  id: string,
  input: InventoryBinUpdateInput
): Promise<InventoryBin> {
  const res = await apiRequest<ResourceResponse<InventoryBin>>(
    `/v1/inventory-bins/${id}`,
    { method: 'PATCH', body: input }
  )
  return res.data
}

export async function deleteInventoryBin(id: string, cascade = false): Promise<void> {
  // cascade removes the bin AND everything under it. The server still refuses
  // if anything inside holds stock.
  await apiRequest<void>(
    `/v1/inventory-bins/${id}${cascade ? '?cascade=1' : ''}`,
    { method: 'DELETE' },
  )
}

export async function previewInventoryBinSetup(
  input: InventoryBinSetupInput
): Promise<InventoryBinSetupPreview> {
  const res = await apiRequest<{ data: InventoryBinSetupPreview }>(
    '/v1/inventory-bins/setup-preview',
    { method: 'POST', body: input }
  )
  return res.data
}

export async function applyInventoryBinSetup(
  input: InventoryBinSetupInput
): Promise<InventoryBinSetupApplyResult> {
  const res = await apiRequest<{ data: InventoryBinSetupApplyResult }>(
    '/v1/inventory-bins/setup-apply',
    { method: 'POST', body: input }
  )
  return res.data
}
export interface BinContentsPayload {
  bin: InventoryBin
  bins: InventoryBin[]
  units: Array<{
    id: string
    catalog_item_id: string
    bin_id: string | null
    serial_number: string
    status: string
    catalog_item?: { id: string; name: string; sku?: string | null } | null
    bin?: { id: string; path_label: string; name?: string | null } | null
  }>
  stock_levels: Array<{
    id: string
    catalog_item_id: string
    bin_id: string | null
    // InventoryStockLevelResource NESTS this. Typed flat, it read as undefined
    // and every quantity in the contents modal rendered as a dash.
    quantities: { qty_on_hand: number }
    catalog_item?: { id: string; name: string; sku?: string | null } | null
    bin?: { id: string; path_label: string; name?: string | null } | null
  }>
}

export async function getBinContents(id: string): Promise<BinContentsPayload> {
  const res = await apiRequest<{ data: BinContentsPayload }>(
    `/v1/inventory-bins/${id}/contents`
  )
  return res.data
}
