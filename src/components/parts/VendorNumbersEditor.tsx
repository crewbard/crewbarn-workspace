import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconPlus, IconX } from '@tabler/icons-react'
import { addSeller, changeSeller, removeSeller, sellersFor, type DraftVendorNumber, type Seller } from '@/lib/purchaseRequests'
import { useVendors } from '@/hooks/useVendors'
import { ApiError } from '@/lib/api'
import '@/components/inventory/bins/bins.css'


/**
 * "Vendor part numbers": which vendors sell this product and each one's own
 * part number (vendor_items, one row per vendor). Separate from the
 * product's Supplier field, which stays the product's vendor tag. A PO to a
 * vendor uses that vendor's number from here.
 *
 * With an item id it saves as you go; without one (a new product) it keeps
 * the rows in `draft` and the form saves them once the product exists.
 */
export function VendorNumbersEditor({
  catalogItemId,
  draft,
  onDraftChange,
  shopSku,
  compact = false,
}: {
  catalogItemId?: string
  draft?: DraftVendorNumber[]
  onDraftChange?: (rows: DraftVendorNumber[]) => void
  /** The shop's own SKU: refused as a vendor's number. */
  shopSku?: string
  /** Tighter, for the New product window over another one. */
  compact?: boolean
}) {
  const qc = useQueryClient()
  const { data: vendorsPage } = useVendors({ active: true, per_page: 200 })
  const vendors = vendorsPage?.data ?? []
  const key = ['vendor-numbers', catalogItemId ?? null]
  const saved = useQuery({
    queryKey: key,
    queryFn: () => sellersFor({ catalog_item_id: catalogItemId }),
    enabled: !!catalogItemId,
    select: (rows: Seller[]) => rows.filter((r) => r.catalog_item_id === catalogItemId),
  })
  const [vendorId, setVendorId] = useState('')
  const [number, setNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const rows: Array<{ id: string; vendor_id: string; vendor: string; number: string; saved?: Seller }> = catalogItemId
    ? (saved.data ?? []).map((r) => ({ id: r.id, vendor_id: r.vendor_id, vendor: r.vendor ?? 'Vendor', number: r.vendor_sku ?? '', saved: r }))
    : (draft ?? []).map((r, i) => ({ id: `d${i}`, vendor_id: r.vendor_id, vendor: vendors.find((v) => v.id === r.vendor_id)?.label ?? 'Vendor', number: r.vendor_sku }))
  const used = new Set(rows.map((r) => r.vendor_id))
  const choices = vendors.filter((v) => !used.has(v.id))
  const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const isShopSku = (s: string) => !!shopSku && fold(s) !== '' && fold(s) === fold(shopSku)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['vendor-numbers'] })
    void qc.invalidateQueries({ queryKey: ['who-sells'] })
  }

  const add = async () => {
    setError(null)
    if (!vendorId) return
    if (isShopSku(number)) {
      setError("That is your own SKU. Type the vendor's part number.")
      return
    }
    if (!catalogItemId) {
      onDraftChange?.([...(draft ?? []), { vendor_id: vendorId, vendor_sku: number.trim() }])
      setVendorId('')
      setNumber('')
      return
    }
    setBusy(true)
    try {
      await addSeller({ vendor_id: vendorId, catalog_item_id: catalogItemId, vendor_sku: number.trim() || undefined })
      setVendorId('')
      setNumber('')
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add that vendor.')
    } finally {
      setBusy(false)
    }
  }

  const saveNumber = async (row: (typeof rows)[number], value: string) => {
    setError(null)
    if (value.trim() === row.number.trim()) return
    if (isShopSku(value)) {
      setError("That is your own SKU. Type the vendor's part number.")
      return
    }
    if (!catalogItemId) {
      onDraftChange?.((draft ?? []).map((r) => (r.vendor_id === row.vendor_id ? { ...r, vendor_sku: value.trim() } : r)))
      return
    }
    try {
      await changeSeller(row.id, { vendor_sku: value.trim() || null })
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that number.')
    }
  }

  const remove = async (row: (typeof rows)[number]) => {
    if (!catalogItemId) {
      onDraftChange?.((draft ?? []).filter((r) => r.vendor_id !== row.vendor_id))
      return
    }
    await removeSeller(row.id)
    refresh()
  }

  return (
    <div data-bins-ui="" data-tour="prod-f-vendor-numbers" className={compact ? 'mt-2' : 'mt-4'}>
      <div className="text-xs font-medium text-[var(--bins-text-2)]">Vendor part numbers</div>
      {!compact && (
        <p className="mt-0.5 text-xs text-[var(--bins-muted)]">
          Each vendor&apos;s own number for this product. A PO to that vendor prints it. Your SKU stays yours.
        </p>
      )}
      {rows.length > 0 && (
        <ul className="mt-2 list-none divide-y divide-[var(--bins-border-soft)] rounded-md border border-[var(--bins-border)] p-0">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className={(compact ? 'w-28' : 'w-40') + ' shrink-0 truncate text-[var(--bins-text)]'}>{row.vendor}</span>
              <input
                aria-label={`${row.vendor} part number`}
                defaultValue={row.number}
                placeholder="Their part #"
                onBlur={(e) => void saveNumber(row, e.target.value)}
                className="min-w-0 flex-1 rounded border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 py-1 font-mono text-sm text-[var(--bins-text)]"
              />
              {!row.number && <span className="text-xs text-[var(--bins-accent-ink)]">No number</span>}
              <button type="button" onClick={() => void remove(row)} aria-label={`Remove ${row.vendor}`}
                className="rounded p-1 text-[var(--bins-muted)] hover:bg-[var(--bins-soft)] hover:text-[var(--bins-text)]">
                <IconX size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-2" data-tour="prod-f-add-vendor">
        <select
          aria-label="Add vendor"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className={(compact ? "w-32" : "w-44") + " rounded border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 py-1.5 text-sm text-[var(--bins-text)]"}
        >
          <option value="">Add vendor…</option>
          {choices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <input
          aria-label="Vendor part number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
          placeholder="Their part #"
          disabled={!vendorId}
          className="min-w-0 flex-1 rounded border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 py-1.5 font-mono text-sm text-[var(--bins-text)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!vendorId || busy}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--bins-accent-ink)] disabled:opacity-50"
        >
          <IconPlus size={13} /> Add
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-[var(--bins-accent-ink)]">{error}</p>}
    </div>
  )
}

