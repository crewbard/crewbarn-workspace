import { useState } from 'react'
import type { CatalogItem } from '@/types/catalogItem'
import { getCatalogItem } from '@/lib/catalogItems'
import { QrScanButton } from '@/components/QrScanButton'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { resolveScan } from '@/lib/scanResolve'

/**
 * Scan a part straight onto a job or an estimate.
 *
 * Both line-item editors already know how to add a catalog item — that is what
 * "+ Search catalog" does. A scan is the same act with the searching removed:
 * resolve the code to a catalog item and hand it to the exact same handler. So
 * this deliberately reuses onPickFromCatalog rather than building a second
 * path that could price or tax an item differently from the picker.
 *
 * Both input methods are live at once, because both happen: a tech at the van
 * uses the phone camera, and the office bench has a USB gun. The gun needs no
 * button — it types — but it is enabled here so a scan works anywhere the
 * line items are on screen.
 *
 * Only PRODUCTS resolve. A bin sticker or a supplier barcode is a real thing
 * to scan elsewhere and meaningless as a line item, so it says so rather than
 * adding something arbitrary.
 */
export function ScanToAddLineItem({
  onPick,
  disabled = false,
}: {
  onPick: (item: CatalogItem) => void
  disabled?: boolean
}) {
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handle(payload: string) {
    if (disabled || busy) return
    setBusy(true)
    try {
      const result = await resolveScan(payload)

      // A tracked unit carries the catalog item it IS, so scanning the thing in
      // your hand is the most direct route to the right line.
      const catalogItemId =
        result.kind === 'stock_unit' ? result.unit.catalog_item_id
        : result.kind === 'product' ? result.productId
        : null

      if (!catalogItemId) {
        setNote(
          result.kind === 'bin'
            ? "That's a bin label — scan the part itself."
            : result.kind === 'text'
              ? `No product matches "${result.text}".`
              : result.label,
        )
        return
      }

      try {
        const item = await getCatalogItem(catalogItemId)
        onPick(item)
        setNote(`Added ${item.name}`)
      } catch {
        // Resolved to an id the catalog won't return — a deleted product, or
        // one this role can't read. Either way, not silence.
        setNote('That code resolved to a product that is no longer in the catalog.')
      }
    } finally {
      setBusy(false)
      window.setTimeout(() => setNote(null), 4000)
    }
  }

  useHardwareScanner((payload) => { void handle(payload) })

  return (
    <span className="inline-flex items-center gap-2">
      <QrScanButton
        onScan={(code) => { void handle(code) }}
        disabled={disabled || busy}
        buttonLabel={busy ? 'Scanning…' : '📷 Scan part'}
        buttonClassName="text-sm font-medium px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
      />
      {note && <span className="text-xs text-slate-600">{note}</span>}
    </span>
  )
}
