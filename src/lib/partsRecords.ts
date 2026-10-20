import type { InstalledPart } from '@/lib/poParts'
import type { Asset } from '@/types/asset'
import type { PurchaseOrder } from '@/types/purchaseOrder'

export type PartRecord = {
  id: string
  part: string
  partNumber: string | null
  serial: string | null
  qty: number
  installedAt: string | null
  job: { id: string; number: number | string } | null
  where: string
  asset: { id: string; name: string }
  po: { id: string; po_number: string } | null
  removed: boolean
}

export function toRecords(asset: Asset, parts: InstalledPart[]): PartRecord[] {
  const sl = asset.service_location
  const where = sl ? [sl.nickname, sl.street_address, sl.city].filter(Boolean).join(', ') : ''
  return parts.map((p) => ({
    id: p.id,
    part: p.description,
    partNumber: p.part_number,
    serial: p.serial_number,
    qty: p.quantity,
    installedAt: p.installed_at,
    job: p.job,
    where,
    asset: { id: asset.id, name: asset.name },
    po: p.purchase_order,
    removed: !!p.removed_at,
  }))
}

/** The order line a fitted part came off: part number first, then the description. */
export function poLineFor(po: PurchaseOrder | undefined, r: PartRecord) {
  const items = po?.items ?? []
  return items.find((i) => r.partNumber && i.part_number === r.partNumber)
    ?? items.find((i) => i.description.trim().toLowerCase() === r.part.trim().toLowerCase())
    ?? null
}
