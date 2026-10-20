import type { PoParts } from '@/lib/poParts'
import type { ReceiveOverlayLine } from '@/components/inventory/receive/ReceiveOverlay'

/** The one asset on the job, or none when there are several (never guess). */
export function preselectAsset(parts: PoParts): string | null {
  const onJob = parts.assets.filter((a) => a.on_job)
  if (onJob.length === 1) return onJob[0].id
  return parts.assets.length === 1 ? parts.assets[0].id : null
}

/** What to place: what was just received, line by line (the server caps it at what is off the job). */
export function placeLines(lines: ReceiveOverlayLine[], assetId: string | null) {
  return lines.filter((l) => l.qty > 0).map((l) => ({ po_item_id: l.id, qty: l.qty, asset_id: assetId }))
}
