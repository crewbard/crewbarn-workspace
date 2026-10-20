import { useState, useMemo, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { useInventoryLocations } from "@/hooks/useInventoryLocations"
import { useAllInventoryBins } from "@/hooks/useInventoryBins"
import { useStockLevels, useCleanupOrphanStockLevels } from "@/hooks/useInventoryStockLevels"
import { useAuth } from "@/hooks/useAuth"
import { TransferStockModal } from "@/components/TransferStockModal"
import { formatQty } from "@/lib/unitsOfMeasure"
import { useHardwareScanner } from "@/hooks/useHardwareScanner"
import { QrScanButton } from "@/components/QrScanButton"
import { resolveScan } from "@/lib/scanResolve"
import { PERM, usePermissions } from "@/hooks/usePermissions"
import { StockWhereOverlay } from "@/components/catalog/StockWhereOverlay"
import { useStockInRules } from "@/hooks/usePoOverride"
import { StockInButton } from "@/components/inventory/StockInButton"
import { StockLevelFormModal } from "@/components/inventory/stock/StockLevelFormModal"
import type { InventoryStockLevel } from "@/types/inventoryStockLevel"
import { Modal } from "@/components/ui/Modal"
import { PrintQrSection } from "@/components/inventory/inventoryModalUi"
import { useInventoryMovements } from "@/hooks/useInventoryMovements"
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "@/types/inventoryMovement"
import { chipCounts, groupByLocation, matchesChip, stockStatus, type StockChip } from "@/lib/stockRows"
import "@/components/inventory/bins/bins.css"
import { FilterChip } from "@/components/ui/FilterChip"
import { StatusPill } from "@/components/ui/StockStatusPill"

// =================================================================
// STOCK LEVELS TAB
// =================================================================

export function StockTab() {
  const [chip, setChip] = useState<StockChip>('all')
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []
  const [filterLocationId, setFilterLocationId] = useState<string>("")
  const [filterBinId, setFilterBinId] = useState<string>("")
  const [hasStock, setHasStock] = useState<boolean>(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [search])

  /**
   * A barcode gun anywhere on this tab filters the list to what was scanned.
   *
   * Three label types reach this bench and a person cannot tell them apart by
   * looking, so the payload is decoded rather than trusted:
   *   CBSTK:v:unitId:hash  — a stock unit; the id is the discriminating part
   *   .../catalog/products/ID — a product label printed from this page
   *   anything else — a supplier barcode or SKU, which the text filter handles
   *
   * It sets the search box rather than navigating: the row stays on screen with
   * its Edit button, which is what someone at a receiving bench wants next.
   */
  // Which item's "where is it" overlay is open. A row here is ONE bin, so the
  // figures answer "how many here" — this answers "where else", which is the
  // question a dispatcher actually has when a van comes up short.
  const [whereItem, setWhereItem] = useState<{ id: string; name: string; unit: string } | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)
  // Set by scanning a container. Filters to that bin AND everything under it,
  // which is what "show me this rack" has to mean.
  const [scanSubtree, setScanSubtree] = useState<{ id: string; label: string } | null>(null)

  /**
   * One handler for the barcode gun AND the camera, so a label means the same
   * thing whichever way it was read.
   *
   * A stock unit used to dead-end here — the payload is a fingerprint with no
   * words in it, so there was nothing to search on and it just printed the id.
   * Resolving it server-side gets the catalog item and the bin it is sitting
   * in, which is the actual question ("what is this and where does it live").
   */
  const handleScan = useCallback(async (payload: string) => {
    const result = await resolveScan(payload)
    setScanNote(result.label)

    if (result.kind === 'stock_unit') {
      const item = result.unit.catalog_item
      setSearch(item?.sku || item?.name || '')
      // Both, because the bin filter is applied within a location — setting
      // one without the other silently returns nothing.
      if (result.unit.current_location_id) setFilterLocationId(result.unit.current_location_id)
      if (result.unit.current_bin_id) setFilterBinId(result.unit.current_bin_id)
    } else if (result.kind === 'product') {
      setSearch(result.productId)
    } else if (result.kind === 'bin') {
      // Scanning a container asks "what is in here", and that has to mean
      // EVERYTHING under it. Stock never sits on a rack — it sits in bins
      // several levels below — so an exact bin match shows an empty list for
      // every container above the leaf, which reads as "the rack is empty".
      if (result.bin.location_id) setFilterLocationId(result.bin.location_id)
      setFilterBinId('')
      setScanSubtree({ id: result.bin.id, label: result.bin.path_label || result.bin.name || 'bin' })
      setSearch('')
    } else if (result.kind === 'text') {
      setSearch(result.text)
    }

    window.setTimeout(() => setScanNote(null), 4000)
  }, [])

  useHardwareScanner((payload) => { void handleScan(payload) })

  const { data: binsData } = useAllInventoryBins(
    filterLocationId ? { location_id: filterLocationId } : {}
  )
  const bins = binsData?.data ?? []

  const stockQuery = useStockLevels({
    location_id: filterLocationId || undefined,
    bin_id: filterBinId || undefined,
    in_bin_subtree: scanSubtree?.id || undefined,
    has_stock: hasStock || undefined,
    per_page: 200,
  })

  const allLevels = stockQuery.data?.data ?? []
  // Client-side text search across catalog item name/sku, location, bin path.
  const levels = useMemo(() => {
    if (!debouncedSearch) return allLevels
    return allLevels.filter((sl) => {
      const sluggable = [
        sl.catalog_item?.name,
        sl.catalog_item?.sku,
        sl.location?.name,
        sl.bin?.path_label,
        sl.bin?.bin_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return sluggable.includes(debouncedSearch)
    })
  }, [allLevels, debouncedSearch])
  const counts = useMemo(() => chipCounts(levels), [levels])
  const shown = useMemo(() => levels.filter((sl) => matchesChip(sl, chip)), [levels, chip])
  const groups = useMemo(() => groupByLocation(shown, locationsData?.data ?? []), [shown, locationsData])

  const [editing, setEditing] = useState<InventoryStockLevel | null>(null)
  // "+ Stock in › Count correction" lands here: Edit on the counted row.
  const [stockParams, setStockParams] = useSearchParams()
  const correcting = stockParams.get('correct') === '1'
  const { poRequired: correctionPo, choices: stockInRules } = useStockInRules()
  const endCorrecting = () => { const n = new URLSearchParams(stockParams); n.delete('correct'); setStockParams(n) }
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferFrom, setTransferFrom] = useState<string | null>(null)
  // A row click opens its details (Patrick's plan: instead of Edit on every row).
  const [openRow, setOpenRow] = useState<InventoryStockLevel | null>(null)
  const cleanupMutation = useCleanupOrphanStockLevels()
  const noLocations = locations.length === 0
  // Maintenance action — only platform admins see it. SaaS tenants never
  // need this since orphans are auto-filtered from the list anyway.
  const { account } = useAuth()
  const isPlatformAdmin = account?.is_platform_admin === true
  const canEditStock = usePermissions().has(PERM.INVENTORY_EDIT)

  async function handleCleanup() {
    if (!confirm('Delete all stock-level rows whose item / location / bin has been removed? This is safe — those rows can\'t be edited or used.')) return
    try {
      const n = await cleanupMutation.mutateAsync()
      alert(`Cleaned up ${n} orphan row${n === 1 ? '' : 's'}.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div data-bins-ui="" className="space-y-4">
      <div className="bg-[var(--bins-surface)] border border-[var(--bins-border)] rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--bins-text)]">Stock</h3>
            <p className="text-sm text-[var(--bins-muted)] mt-0.5">
              What you have in each place and bin, what to keep there, and what is held for jobs.
            </p>
          </div>
          <div data-tour="inv-stock-actions" className="flex flex-wrap items-center gap-2">
            {isPlatformAdmin && (
              <button
                type="button"
                onClick={handleCleanup}
                disabled={cleanupMutation.isPending}
                className="text-sm px-3 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-md font-medium disabled:opacity-50"
                title="Platform admin: delete rows whose catalog item / location / bin has been removed (orphans)"
              >
                {cleanupMutation.isPending ? 'Cleaning…' : '🧹 Clean up orphans'}
              </button>
            )}
            {canEditStock && <>
            <button
              type="button"
              data-tour="inv-transfer-button"
              onClick={() => setShowTransfer(true)}
              disabled={noLocations}
              title={noLocations ? "Create a location first" : "Move stock from one location/bin to another"}
              className="text-sm px-3 py-2 border border-[var(--bins-border)] text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)] rounded-md font-medium disabled:opacity-50"
            >
              ⇄ Transfer stock
            </button>
            {noLocations ? (
              <button type="button" disabled data-tour="inv-stock-add" title="Create a location first" className="text-sm px-4 py-2 bg-slate-300 cursor-not-allowed text-white rounded-md font-medium">+ Stock in</button>
            ) : (
              <StockInButton tour="inv-stock-add" defaultLocationId={locations[0]?.id} />
            )}
            </>}
          </div>
        </div>

        {correcting && (
          <div data-count-correction-hint role="note" className="flex items-start gap-3 border-b border-[var(--accent-200,#f4d7a1)] bg-[var(--accent-50,#fdf7ee)] px-6 py-3 text-sm text-slate-800">
            <p className="flex-1">
              <strong className="font-semibold">Count correction:</strong> click the row you counted, then <strong>Edit levels</strong> to set the real count.
              {correctionPo ? ` ${(stockInRules.find((c) => c.key === 'count')?.hint ?? '').replace(/^Fix a count on a stock row(\. |; )/, '').replace(/^./, (c) => c.toUpperCase())}` : ''}
            </p>
            <button type="button" onClick={endCorrecting} className="text-[13px] font-medium text-slate-700 underline">Done</button>
          </div>
        )}

        {noLocations && (
          <div data-tour="inv-stock-nolocations" className="px-6 py-4 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
            No inventory locations yet. Add one in the Locations tab first.
          </div>
        )}

        {scanNote && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-[13px] text-amber-900">
            {scanNote}
          </div>
        )}
        {/* A subtree filter hides most of the list, so it has to announce
            itself and be one click to escape — otherwise the next person to
            walk up sees an inexplicably short inventory. */}
        {scanSubtree && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-[13px] text-slate-700 flex items-center gap-3">
            <span>Showing everything inside <strong>{scanSubtree.label}</strong></span>
            <button
              type="button"
              onClick={() => setScanSubtree(null)}
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
        <div data-easy-list-toolbar data-tour="inv-stock-toolbar" className="px-6 py-3 border-b border-slate-100 flex gap-3 items-center flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by item, location, bin… or just scan"
            className="flex-1 min-w-[200px] max-w-sm text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
          {/* The gun needs no button — it types. This is for the laptop or
              phone that doesn't have one, and it decodes identically. */}
          <QrScanButton
            onScan={(code) => { void handleScan(code) }}
            buttonLabel="📷 Scan"
            buttonClassName="text-sm px-3 py-2 border border-slate-200 rounded bg-white hover:border-amber-400 hover:bg-amber-50 font-medium text-slate-700"
          />
          <select
            value={filterLocationId}
            onChange={(e) => {
              setFilterLocationId(e.target.value)
              setFilterBinId("")
            }}
            className="text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={filterBinId}
            onChange={(e) => setFilterBinId(e.target.value)}
            disabled={!filterLocationId}
            className="text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All bins</option>
            {bins
              .filter((b) => !filterLocationId || b.location_id === filterLocationId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.path_label || b.name || b.bin_code}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hasStock}
              onChange={(e) => setHasStock(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            Only rows with qty &gt; 0
          </label>
        </div>

        {stockQuery.isError && (
          <div className="px-6 py-4 text-sm text-red-700 bg-red-50">
            Failed to load stock levels.{stockQuery.error instanceof Error ? ` ${stockQuery.error.message}` : ""}
            <button type="button" disabled={stockQuery.isFetching} className="ml-2 underline disabled:opacity-50" onClick={() => void stockQuery.refetch()}>Try again</button>
          </div>
        )}

        {stockQuery.isLoading && (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        )}

        {!stockQuery.isLoading && !stockQuery.isError && levels.length === 0 && (
          <div data-tour="inv-stock-empty" data-filtered={debouncedSearch || filterLocationId || filterBinId || hasStock ? 'yes' : 'no'} className="p-12 text-center">
            <p className="text-sm text-slate-600">
              {debouncedSearch || filterLocationId || filterBinId || hasStock
                ? "No stock levels match those filters."
                : "No stock levels yet. Use \"+ Stock in\" to record what's where."}
            </p>
          </div>
        )}

        {!stockQuery.isLoading && !stockQuery.isError && levels.length > 0 && (
          <>
          <div data-tour="inv-stock-chips" className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-[var(--bins-border-soft)]">
            {(['all', 'low', 'out', 'held'] as StockChip[]).map((c) => (
              <FilterChip key={c} chip={c} active={chip === c} onClick={() => setChip(c)} label={CHIP_LABEL[c]} count={counts[c]} />
            ))}
          </div>
          {shown.length === 0 ? (
            <div data-tour="inv-stock-chip-empty" className="p-10 text-center text-sm text-[var(--bins-muted)]">
              Nothing here is {CHIP_LABEL[chip].toLowerCase()} right now.
            </div>
          ) : (
          <div data-tour="inv-stock-table" className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-[var(--bins-softer)] text-xs uppercase tracking-wide text-[var(--bins-muted)]">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Bin</th>
                <th className="text-right px-4 py-3 font-medium">On hand</th>
                <th className="text-right px-4 py-3 font-medium">Keep at least</th>
                <th className="text-right px-4 py-3 font-medium">Held for jobs</th>
                <th className="text-right px-4 py-3 font-medium">Free to use</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            {groups.map((g) => {
              const closed = folded.has(g.locationId)
              return (
              <tbody key={g.locationId} data-stock-group={g.locationId} className="divide-y divide-[var(--bins-border-soft)] border-t border-[var(--bins-border)]">
                <tr className="bg-[var(--bins-soft)]">
                  <td colSpan={7} className="px-6 py-2">
                    <button type="button" aria-expanded={!closed} onClick={() => setFolded((prev) => { const n = new Set(prev); if (n.has(g.locationId)) n.delete(g.locationId); else n.add(g.locationId); return n })}
                      className="text-[13px] font-semibold text-[var(--bins-text)]">
                      {closed ? '▸' : '▾'} {g.name} <span className="font-normal text-[var(--bins-muted)]">· {g.rows.length} {g.rows.length === 1 ? 'item' : 'items'}</span>
                    </button>
                  </td>
                </tr>
                {!closed && g.rows.map((sl) => {
                  const unit = sl.catalog_item?.unit_label
                  const status = stockStatus(sl)
                  return (
                  <tr key={sl.id} data-tour="inv-stock-row" tabIndex={0} onClick={() => setOpenRow(sl)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenRow(sl) } }}
                    className="cursor-pointer hover:bg-[var(--bins-softer)] focus:outline-none focus-visible:bg-[var(--bins-accent-soft)]">
                    <td className="px-6 py-3">
                      <div className="font-medium text-[var(--bins-text)]">
                        {sl.catalog_item?.name ?? <span className="italic text-[var(--bins-muted)]">(no item name: <span className="font-mono">{sl.catalog_item_id}</span>)</span>}
                      </div>
                      {sl.catalog_item?.sku && <div className="font-mono text-xs text-[var(--bins-muted)]">{sl.catalog_item.sku}</div>}
                      {sl.quantities.sn_tracked && <div className="mt-0.5 text-[11px] text-[var(--bins-muted)]">Serial numbers: the count is the units on the shelf</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--bins-text-2)]">
                      {sl.bin_id ? (sl.bin ? (sl.bin.place_label || sl.bin.path_label || sl.bin.name || sl.bin.bin_code) : <span className="italic text-[var(--bins-muted)]">(bin gone)</span>) : <span className="text-[var(--bins-muted)]">No bin</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium text-[var(--bins-text)]">{formatQty(sl.quantities.qty_on_hand, unit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[var(--bins-text-2)]">{sl.quantities.par_qty == null ? <span className="text-[var(--bins-muted)]">—</span> : (
                      <>
                        {formatQty(sl.quantities.par_qty, unit)}
                        {!!sl.quantities.short_by && sl.quantities.short_by > 0 && (
                          <span data-short className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">short {formatQty(sl.quantities.short_by, unit)}</span>
                        )}
                      </>
                    )}</td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[var(--bins-text-2)]">{formatQty(sl.quantities.qty_reserved, unit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium text-[var(--bins-text)]">{formatQty(sl.quantities.qty_available, unit)}</td>
                    <td className="px-6 py-3"><StatusPill status={status} /></td>
                  </tr>
                  )
                })}
              </tbody>
              )
            })}
          </table>
          <p data-tour="inv-stock-hint" className="px-6 py-2 text-xs text-[var(--bins-muted)] border-t border-[var(--bins-border-soft)]">
            Click a row for details: edit levels, transfer, print QR, history.
          </p>
          </div>
          )}
          </>
        )}
      </div>

      {openRow && !editing && (
        <StockRowPanel
          row={openRow}
          canEdit={canEditStock}
          onClose={() => setOpenRow(null)}
          onEdit={() => setEditing(openRow)}
          onTransfer={() => { setTransferFrom(openRow.location_id); setShowTransfer(true); setOpenRow(null) }}
          onWhere={() => openRow.catalog_item_id && setWhereItem({ id: openRow.catalog_item_id, name: openRow.catalog_item?.name ?? 'Item', unit: openRow.catalog_item?.unit_label || 'each' })}
        />
      )}
      {editing && (
        <StockLevelFormModal
          stockLevel={editing}
          locations={locations}
          allBins={bins}
          onClose={() => { setEditing(null); setOpenRow(null) }}
        />
      )}
      {whereItem && (
        <StockWhereOverlay
          itemId={whereItem.id}
          itemName={whereItem.name}
          unitLabel={whereItem.unit}
          onClose={() => setWhereItem(null)}
        />
      )}
      {showTransfer && (
        <TransferStockModal defaultFromLocationId={transferFrom ?? undefined} onClose={() => { setShowTransfer(false); setTransferFrom(null) }} />
      )}
    </div>
  )
}

const CHIP_LABEL: Record<StockChip, string> = { all: 'All', low: 'Low', out: 'Out', held: 'Held for jobs' }

/**
 * One stock row's details, opened by clicking the row: its figures, Edit
 * levels (the existing StockLevelFormModal), Transfer (TransferStockModal),
 * Where else (StockWhereOverlay), Print QR (PrintQrSection) and the last
 * movements for this item here (the Movements list, filtered).
 */
function StockRowPanel({ row, canEdit, onClose, onEdit, onTransfer, onWhere }: {
  row: InventoryStockLevel
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onTransfer: () => void
  onWhere: () => void
}) {
  const unit = row.catalog_item?.unit_label
  const q = row.quantities
  const history = useInventoryMovements({ catalog_item_id: row.catalog_item_id, location_id: row.location_id, per_page: 6 })
  const moves = (history.data?.data ?? []).filter((m) => !row.bin_id || m.to?.bin_id === row.bin_id || m.from?.bin_id === row.bin_id)
  const where = [row.location?.name, row.bin ? (row.bin.place_label || row.bin.name || row.bin.bin_code) : null].filter(Boolean).join(' · ')
  const figure = (label: string, value: string) => (
    <div className="rounded-lg border border-[var(--bins-border)] bg-[var(--bins-softer)] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-[var(--bins-muted)]">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-[var(--bins-text)]">{value}</div>
    </div>
  )
  return (
    <Modal isOpen onClose={onClose} title={row.catalog_item?.name ?? 'Stock row'} subtitle={where} size="md">
      <div data-bins-ui="" data-tour="inv-stock-panel" className="space-y-4 px-5 py-4">
        <div className="flex items-center gap-2"><StatusPill status={stockStatus(row)} />{row.catalog_item?.sku && <span className="font-mono text-xs text-[var(--bins-muted)]">{row.catalog_item.sku}</span>}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {figure('On hand', formatQty(q.qty_on_hand, unit))}
          {figure('Keep at least', q.par_qty == null ? '—' : formatQty(q.par_qty, unit))}
          {figure('Held for jobs', formatQty(q.qty_reserved, unit))}
          {figure('Free to use', formatQty(q.qty_available, unit))}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <button type="button" data-tour="inv-stock-panel-edit" onClick={onEdit} className="rounded-md bg-[var(--bins-accent)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--bins-accent-strong)]">Edit levels</button>}
          {canEdit && <button type="button" onClick={onTransfer} className="rounded-md border border-[var(--bins-border)] px-3 py-1.5 text-sm font-medium text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">⇄ Transfer</button>}
          <button type="button" onClick={onWhere} className="rounded-md border border-[var(--bins-border)] px-3 py-1.5 text-sm font-medium text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Where else is it?</button>
        </div>
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--bins-muted)]">History here</h4>
          {history.isLoading ? <p className="text-sm text-[var(--bins-muted)]">Loading…</p> : moves.length === 0 ? (
            <p className="text-sm text-[var(--bins-muted)]">No movements here yet.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-[var(--bins-border-soft)] p-0 text-sm">
              {moves.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                  <span className="font-medium text-[var(--bins-text)]">{INVENTORY_MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</span>
                  <span className="tabular-nums text-[var(--bins-text-2)]">{m.quantity > 0 && m.type === 'adjustment' ? '+' : ''}{formatQty(m.quantity, unit)}</span>
                  {m.reason && <span className="text-xs text-[var(--bins-muted)]">{m.reason}</span>}
                  <span className="grow" />
                  <span className="text-xs text-[var(--bins-muted)]">{m.created_by_name ?? ''}{m.created_at ? ` · ${new Date(m.created_at).toLocaleDateString()}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <PrintQrSection stockLevel={row} />
      </div>
    </Modal>
  )
}
