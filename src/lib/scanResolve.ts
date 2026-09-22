import { apiRequest } from '@/lib/api'

/**
 * One decoder for every code CrewBarn prints, shared by the barcode gun and
 * the camera.
 *
 * Four different labels reach the same bench and a person cannot tell them
 * apart by looking — a stock-unit fingerprint, a product label, a bin sticker,
 * and a supplier's own barcode. Whoever is scanning shouldn't have to know
 * which is which, and every screen that accepts a scan should agree about what
 * a given code MEANS. Keeping that in one place is the only way the gun on the
 * Inventory page and the camera on a job can't drift apart.
 *
 * Resolution costs a request for the two kinds that need one; the rest is
 * pattern matching.
 */

export interface ScannedStockUnit {
  id: string
  catalog_item_id: string | null
  qr_payload: string
  status: string
  current_location_id: string | null
  current_bin_id: string | null
  catalog_item?: { id: string; name?: string | null; sku?: string | null; unit?: string | null } | null
  current_bin?: { id: string; path_label?: string | null; name?: string | null } | null
}

export interface ScannedBin {
  id: string
  name?: string | null
  bin_code?: string | null
  path_label?: string | null
  location_id?: string | null
}

export type ScanResult =
  | { kind: 'stock_unit'; unit: ScannedStockUnit; label: string }
  | { kind: 'product'; productId: string; label: string }
  | { kind: 'bin'; bin: ScannedBin; label: string }
  | { kind: 'text'; text: string; label: string }
  | { kind: 'unknown'; text: string; label: string }

/** A tracked unit: CBSTK:<version>:<unitId>:<hash> */
const STOCK_UNIT = /^CBSTK:\d+:([A-Za-z0-9_-]+):/
/** A product label printed from the catalog page. */
const PRODUCT_URL = /\/catalog\/products\/([A-Za-z0-9_-]+)/
/** A bin sticker. Bin QR values are the bin's own id. */
const BIN_ID = /^bin_[A-Za-z0-9]+$/

export async function resolveScan(payload: string): Promise<ScanResult> {
  const raw = payload.trim()
  if (raw === '') {
    return { kind: 'unknown', text: raw, label: 'Nothing scanned' }
  }

  if (STOCK_UNIT.test(raw)) {
    try {
      const res = await apiRequest<{ data: ScannedStockUnit }>('/v1/inventory-stock-units/scan', {
        method: 'POST',
        body: { qr_payload: raw },
      })
      const unit = res.data
      return {
        kind: 'stock_unit',
        unit,
        label: unit.catalog_item?.name
          ? `Scanned ${unit.catalog_item.name}`
          : 'Scanned a tracked unit',
      }
    } catch {
      // A printed-but-deleted label, or a label from another tenant. Say so
      // rather than silently falling through to a text search that finds
      // nothing and looks like the scanner failed.
      return { kind: 'unknown', text: raw, label: 'That unit label is not in inventory' }
    }
  }

  const product = raw.match(PRODUCT_URL)
  if (product) {
    return { kind: 'product', productId: product[1], label: 'Scanned a product label' }
  }

  if (BIN_ID.test(raw)) {
    try {
      const res = await apiRequest<{ data: ScannedBin }>(
        `/v1/inventory-bins/by-qr/${encodeURIComponent(raw)}`,
      )
      const bin = res.data
      const where = bin.path_label || bin.name || bin.bin_code || 'a bin'
      return { kind: 'bin', bin, label: `Scanned ${where}` }
    } catch {
      return { kind: 'unknown', text: raw, label: 'That bin label is not in inventory' }
    }
  }

  // A supplier barcode or a SKU. Not ours, but perfectly usable as a search.
  return { kind: 'text', text: raw, label: `Scanned ${raw}` }
}
