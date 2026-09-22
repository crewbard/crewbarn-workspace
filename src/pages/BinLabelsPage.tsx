import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { useInventoryBin, useBinContents } from '@/hooks/useInventoryBins'
import type { InventoryBin } from '@/types/inventoryBin'
import {
  THERMAL_SIZES,
  isFullSheetSize,
  parseThermalSize,
  thermalPrintCss,
  type ThermalSizeKey,
} from '@/lib/thermalLabels'
import { printLabelPdf, type PdfLabel } from '@/lib/pdfLabels'
import { downloadLabelPng } from '@/lib/pngLabels'
import { isWebBluetoothSupported, printLabelsViaBluetooth } from '@/lib/escposBluetooth'

/**
 * Print-friendly QR sticker sheet for an inventory bin.
 *
 * URL: /inventory-bins/:id/labels
 *      ?include=this | descendants | leaves   (default: this)
 *      ?size=regular | mini                   (default: regular)
 *      ?noprint=1                              (skip auto-print)
 *
 * - "this": one sticker for the bin you opened from
 * - "descendants": this bin + every bin underneath
 * - "leaves": only the leaf bins underneath (skip parents like racks)
 *
 * Each sticker QR encodes the bin's qr_code_value (auto-filled with the
 * bin id at create time). Existing /v1/inventory-bins/by-qr/{value}
 * resolves it back. Scanning a parent bin's sticker, paired with the
 * existing Contents modal, shows everything stored under it.
 */
export function BinLabelsPage() {
  const { id } = useParams<{ id: string }>()
  const [search, setSearch] = useSearchParams()

  const includeMode: 'this' | 'descendants' | 'leaves' =
    search.get('include') === 'descendants' ? 'descendants'
      : search.get('include') === 'leaves' ? 'leaves'
        : 'this'
  const sizeMode: 'regular' | 'mini' =
    search.get('size') === 'mini' ? 'mini' : 'regular'
  const thermal: ThermalSizeKey = parseThermalSize(search.get('thermal'))
  const isThermal = thermal !== 'sheet'
  const multiUp = isThermal && (isFullSheetSize(thermal) || search.get('multiup') === '1')
  const gap = Math.max(0, Math.min(0.5, Number(search.get('gap')) || 0))
  const isMini = !isThermal && sizeMode === 'mini'
  const copies = Math.max(1, Math.min(50, Number(search.get('copies')) || 1))
  const includeItems = search.get('items') === '1'

  const binQuery = useInventoryBin(id)
  // Fetch bin contents whenever we need the descendant subtree OR the
  // stock items in the bin (so the items toggle pulls them in).
  const wantSubtree = includeMode !== 'this'
  const wantContents = wantSubtree || includeItems
  const contentsQuery = useBinContents(wantContents ? id : undefined)

  const bins: InventoryBin[] = useMemo(() => {
    if (!binQuery.data) return []
    if (includeMode === 'this') return [binQuery.data]
    const all = contentsQuery.data?.bins ?? []
    if (includeMode === 'descendants') return all
    // 'leaves' — only bins with no children inside the subtree
    const childByParent = new Map<string, number>()
    for (const b of all) {
      if (b.parent_bin_id) {
        childByParent.set(b.parent_bin_id, (childByParent.get(b.parent_bin_id) ?? 0) + 1)
      }
    }
    return all.filter((b) => !childByParent.has(b.id))
  }, [binQuery.data, contentsQuery.data, includeMode])

  /**
   * The individual tracked units in these bins.
   *
   * A stock level saying "3 on hand" is three PHYSICAL things, and each has its
   * own qr_payload fingerprint. Printing one product QR for all three gives
   * three identical stickers, so scanning one to consume it cannot say WHICH
   * one left the shelf — which is the entire point of the fingerprints.
   */
  const binIdsForItems = useMemo(() => bins.map((b) => b.id), [bins])
  const unitsQuery = useQuery({
    queryKey: ['bin-label-stock-units', binIdsForItems],
    enabled: includeItems && binIdsForItems.length > 0,
    queryFn: () =>
      apiRequest<{ data: Array<{ id: string; catalog_item_id: string; current_bin_id: string | null; qr_payload: string; catalog_item?: { id: string; name?: string | null; sku?: string | null } | null }> }>(
        `/v1/inventory-stock-units?per_page=500&${binIdsForItems.map((b) => `bin_ids[]=${encodeURIComponent(b)}`).join('&')}`,
      ),
  })

  // When "items" toggle is on, group catalog items by the bin that holds
  // them. Each bin's section will print its bin label, then a label per
  // unique catalog item in that bin.
  const itemsByBin: Map<string, Array<{ id: string; name: string; sku?: string | null; qrValue: string; qrUrl: string }>> = useMemo(() => {
    const out = new Map<string, Array<{ id: string; name: string; sku?: string | null; qrValue: string; qrUrl: string }>>()
    if (!includeItems) return out
    const stockLevels = contentsQuery.data?.stock_levels ?? []
    const seenPerBin = new Map<string, Set<string>>()
    const visibleBinIds = new Set(bins.map((b) => b.id))
    const origin = window.location.origin
    // ONE LABEL PER PHYSICAL UNIT, each carrying its own fingerprint.
    const units = unitsQuery.data?.data ?? []
    const coveredByUnits = new Set<string>()
    for (const u of units) {
      if (!u.current_bin_id || !visibleBinIds.has(u.current_bin_id)) continue
      coveredByUnits.add(`${u.current_bin_id}|${u.catalog_item_id}`)
      const arr = out.get(u.current_bin_id) ?? []
      arr.push({
        id: u.id,
        name: u.catalog_item?.name ?? 'Item',
        sku: u.catalog_item?.sku ?? null,
        // The fingerprint IS the label. Scanning it identifies this one unit,
        // not merely the product it happens to be.
        qrValue: u.qr_payload,
        qrUrl: u.qr_payload,
      })
      out.set(u.current_bin_id, arr)
    }

    // Fall back to a product label only where a stock level has no tracked
    // units behind it — otherwise the bin would print nothing at all.
    for (const sl of stockLevels) {
      if (!sl.bin_id || !sl.catalog_item) continue
      if (!visibleBinIds.has(sl.bin_id)) continue
      if (coveredByUnits.has(`${sl.bin_id}|${sl.catalog_item.id}`)) continue
      const seen = seenPerBin.get(sl.bin_id) ?? new Set()
      if (seen.has(sl.catalog_item.id)) continue
      seen.add(sl.catalog_item.id)
      seenPerBin.set(sl.bin_id, seen)
      const arr = out.get(sl.bin_id) ?? []
      arr.push({
        id: sl.catalog_item.id,
        name: sl.catalog_item.name,
        sku: sl.catalog_item.sku ?? null,
        qrValue: sl.catalog_item.id,
        qrUrl: `${origin}/catalog/products/${sl.catalog_item.id}`,
      })
      out.set(sl.bin_id, arr)
    }
    return out
  }, [includeItems, contentsQuery.data, unitsQuery.data, bins])

  // No auto-print: user picks size/copies on this configure page first,
  // then explicitly clicks Print or Ctrl/Cmd+P.

  /**
   * Labels for PDF / PNG / Bluetooth.
   *
   * This used to map bins ONLY, so "+ items in bin" changed what you saw on
   * screen and nothing about what came out of the printer — the item stickers,
   * fingerprints and all, were simply absent from every real print path. The
   * screen and the printer now build from the same itemsByBin map, in the same
   * order, so the preview is the output.
   */
  function buildBinLabels(): PdfLabel[] {
    const out: PdfLabel[] = []
    for (const b of bins) {
      out.push({
        qrValue: b.qr_code_value || b.id,
        title: b.bin_code || b.name || b.id,
        subtitle: b.kind ?? undefined,
        details: [
          b.name && b.bin_code && b.name !== b.bin_code ? b.name : '',
          b.path_label,
        ].filter(Boolean),
      })

      for (const it of itemsByBin.get(b.id) ?? []) {
        out.push({
          // The unit's fingerprint when there is one, so the printed sticker
          // identifies THIS unit rather than the product it belongs to.
          qrValue: it.qrValue,
          title: it.name,
          subtitle: 'ITEM',
          details: [it.sku ? `SKU: ${it.sku}` : ''].filter(Boolean),
        })
      }
    }
    return out
  }

  function baseFilename(): string {
    return (rootBin?.path_label || rootBin?.name || rootBin?.bin_code || 'bin')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  async function handlePrint() {
    await printLabelPdf({
      labels: buildBinLabels(),
      thermalSize: thermal,
      copies,
      multiUp,
      gap,
      filename: `${baseFilename()}-labels.pdf`,
    })
  }

  async function handleDownloadPng() {
    // PNG export is single-label by design (multi-PNG would need a zip
    // and is rarely useful — users tend to upload one image per print
    // job in their printer software).
    if (!rootBin) return
    await downloadLabelPng({
      label: buildBinLabels()[0],
      thermalSize: thermal,
      filename: `${baseFilename()}-${thermal}.png`,
    })
  }

  async function handleBluetoothPrint() {
    try {
      await printLabelsViaBluetooth({
        labels: buildBinLabels(),
        thermalSize: thermal,
        copies,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  function setParam(key: string, value: string | null) {
    const np = new URLSearchParams(search)
    if (value === null) np.delete(key)
    else np.set(key, value)
    setSearch(np, { replace: true })
  }

  if (binQuery.isLoading) {
    return <Centered>Loading bin…</Centered>
  }
  if (!binQuery.data) {
    return <Centered>Bin not found.</Centered>
  }

  const rootBin = binQuery.data

  return (
    <div className="bg-white min-h-screen">
      <style>{thermalPrintCss(thermal, multiUp)}</style>

      <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-800">
            Bin labels — {rootBin.path_label || rootBin.name || rootBin.bin_code}
          </div>
          <div className="text-xs text-slate-500">
            {bins.length} sticker{bins.length === 1 ? '' : 's'} · Ctrl+P to print
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-xs">
            <ToggleBtn
              active={includeMode === 'this'}
              onClick={() => setParam('include', null)}
              title="Print only this bin"
            >
              This bin
            </ToggleBtn>
            <ToggleBtn
              active={includeMode === 'descendants'}
              onClick={() => setParam('include', 'descendants')}
              title="Print this bin + every bin underneath"
              borderLeft
            >
              + descendants
            </ToggleBtn>
            <ToggleBtn
              active={includeMode === 'leaves'}
              onClick={() => setParam('include', 'leaves')}
              title="Print only leaf bins (skip racks/shelves above)"
              borderLeft
            >
              Leaves only
            </ToggleBtn>
          </div>
          <label className="flex items-center gap-1 text-xs text-slate-700" title="Also print a QR label for every catalog item currently stored in the bin(s) above">
            <input
              type="checkbox"
              checked={includeItems}
              onChange={(e) => setParam('items', e.target.checked ? '1' : null)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            + items in bin
          </label>
          {!isThermal && (
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-xs">
              <ToggleBtn
                active={!isMini}
                onClick={() => setParam('size', null)}
              >
                Regular
              </ToggleBtn>
              <ToggleBtn
                active={isMini}
                onClick={() => setParam('size', 'mini')}
                title="Tiny stickers for inside-bin labels"
                borderLeft
              >
                Mini
              </ToggleBtn>
            </div>
          )}
          <select
            value={thermal}
            onChange={(e) =>
              setParam('thermal', e.target.value === 'sheet' ? null : e.target.value)
            }
            className="text-xs px-3 py-1.5 border border-slate-300 rounded bg-white"
            title="Pick a thermal label size when using a Dymo / Brother / Zebra printer. Sheet mode uses letter-sized paper."
          >
            {Object.values(THERMAL_SIZES).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          {isThermal && (
            <select
              value={String(copies)}
              onChange={(e) =>
                setParam('copies', e.target.value === '1' ? null : e.target.value)
              }
              className="text-xs px-3 py-1.5 border border-slate-300 rounded bg-white"
              title="Print this many of each sticker"
            >
              {[1, 2, 3, 4, 5, 10, 20, 50].map((n) => (
                <option key={n} value={String(n)}>
                  {n} cop{n === 1 ? 'y' : 'ies'} each
                </option>
              ))}
            </select>
          )}
          {isThermal && (
            <label className="flex items-center gap-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={multiUp}
                onChange={(e) => setParam('multiup', e.target.checked ? '1' : null)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                title="Lay out N labels on a letter-sized PDF for pre-cut label sheets"
              />
              Multi-up sheet
            </label>
          )}
          {isThermal && multiUp && (
            <input
              type="number"
              step="0.0625"
              min="0"
              max="0.5"
              value={String(gap)}
              onChange={(e) => setParam('gap', e.target.value === '0' ? null : e.target.value)}
              className="text-xs px-2 py-1 border border-slate-300 rounded w-20"
              title="Gap (inches) between adjacent labels — match the die-cut spec of your label sheet"
            />
          )}
          {isThermal && !multiUp && (
            <>
              <button
                type="button"
                onClick={handleDownloadPng}
                className="text-sm px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded"
                title="Download a PNG image of one label — upload it to your printer's software"
              >
                🖼 PNG
              </button>
              {isWebBluetoothSupported() && (
                <button
                  type="button"
                  onClick={handleBluetoothPrint}
                  className="text-sm px-3 py-1.5 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded"
                  title="Print directly to a Bluetooth thermal printer (ESC/POS). Browser will prompt to pair the first time."
                >
                  📡 Bluetooth
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={isThermal ? handlePrint : () => window.print()}
            className="text-sm px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded"
            title={
              isThermal
                ? multiUp
                  ? 'Generate a letter-size PDF with multiple labels per page'
                  : 'Generate the labels and open your printer dialog — pick printer + copies there'
                : 'Print the sticker sheet'
            }
          >
            Print
          </button>
        </div>
      </div>

      <div className={`print-stage ${isThermal && !multiUp ? 'p-0' : isMini ? 'p-2' : 'p-4'}`}>
        <div
          className={
            isThermal && !multiUp
              ? 'flex flex-col items-stretch gap-2 p-2'
              : multiUp
                ? 'flex flex-wrap p-2'
                : isMini
                  ? 'grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-14 gap-1'
                  : 'grid grid-cols-2 sm:grid-cols-3 gap-3'
          }
          style={multiUp ? { gap: `${gap}in` } : undefined}
        >
          {bins.flatMap((b) => {
            const items = includeItems ? (itemsByBin.get(b.id) ?? []) : []
            return [
              <BinLabelCard key={`bin-${b.id}`} bin={b} mini={isMini} thermal={thermal} />,
              ...items.map((it) => (
                <CatalogItemLabelCard
                  key={`item-${b.id}-${it.id}`}
                  item={it}
                  mini={isMini}
                  thermal={thermal}
                />
              )),
            ]
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Catalog item label — sizing parity with BinLabelCard so items + bins
 * sit on the same uniform grid for sheet/mini/thermal printing. Emerald
 * border distinguishes items from bins (slate border) on screen; both
 * print fine.
 */
function CatalogItemLabelCard({
  item,
  mini,
  thermal,
}: {
  item: { id: string; name: string; sku?: string | null; qrValue: string; qrUrl: string }
  mini: boolean
  thermal: ThermalSizeKey
}) {
  if (thermal !== 'sheet') {
    const size = THERMAL_SIZES[thermal]
    const square = size.w === size.h
    return (
      <div
        className="label-card border border-emerald-300 bg-white flex items-center gap-2 p-1 overflow-hidden"
        style={{
          width: `${size.w}in`,
          height: `${size.h}in`,
          flexDirection: square ? 'column' : 'row',
        }}
      >
        <div className="flex-shrink-0 flex items-center justify-center">
          <QRCodeCanvas value={item.qrUrl} size={size.qrPx} level={size.showFullText ? 'M' : 'H'} />
        </div>
        <div
          className={`flex-1 min-w-0 leading-tight ${square ? 'text-center w-full' : ''}`}
          style={{ fontSize: square ? '7px' : '10px' }}
        >
          <div className="font-bold text-slate-900 truncate" style={{ fontSize: square ? '8px' : '13px' }}>
            {item.name}
          </div>
          {size.showFullText && item.sku && (
            <div className="font-mono text-slate-600">SKU: {item.sku}</div>
          )}
        </div>
      </div>
    )
  }

  if (mini) {
    return (
      <div className="label-card border border-emerald-300 rounded-sm p-0.5 flex flex-col items-center justify-center bg-white">
        <QRCodeCanvas value={item.qrUrl} size={40} level="H" />
        <div className="mt-0.5 font-mono text-[6px] leading-none text-slate-800 text-center w-full truncate">
          {item.name}
        </div>
      </div>
    )
  }

  return (
    <div className="label-card border border-emerald-300 rounded-md p-3 flex gap-3 bg-white">
      <div className="flex-shrink-0">
        <QRCodeCanvas value={item.qrUrl} size={96} level="M" />
      </div>
      <div className="flex-1 min-w-0 text-xs leading-tight">
        <div className="font-bold text-slate-900 text-base truncate" title={item.name}>
          {item.name}
        </div>
        <div className="mt-0.5">
          <span className="inline-block px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 rounded font-medium uppercase tracking-wide">
            item
          </span>
        </div>
        {item.sku && (
          <div className="mt-1 font-mono text-slate-700 text-[11px]">
            SKU: {item.sku}
          </div>
        )}
      </div>
    </div>
  )
}

function BinLabelCard({
  bin,
  mini,
  thermal,
}: {
  bin: InventoryBin
  mini: boolean
  thermal: ThermalSizeKey
}) {
  const qrValue = bin.qr_code_value || bin.id
  const codeOrName = bin.bin_code || bin.name || bin.id

  if (thermal !== 'sheet') {
    return <ThermalBinLabel bin={bin} thermal={thermal} qrValue={qrValue} codeOrName={codeOrName} />
  }

  if (mini) {
    return (
      <div className="label-card border border-slate-300 rounded-sm p-0.5 flex flex-col items-center justify-center bg-white">
        <QRCodeCanvas value={qrValue} size={40} level="H" />
        <div className="mt-0.5 font-mono text-[6px] leading-none text-slate-800 text-center w-full truncate">
          {codeOrName}
        </div>
      </div>
    )
  }

  return (
    <div className="label-card border border-slate-300 rounded-md p-3 flex gap-3 bg-white">
      <div className="flex-shrink-0">
        <QRCodeCanvas value={qrValue} size={96} level="M" />
      </div>
      <div className="flex-1 min-w-0 text-xs leading-tight">
        <div className="font-bold text-slate-900 text-base truncate" title={codeOrName}>
          {codeOrName}
        </div>
        {bin.kind && (
          <div className="mt-0.5">
            <span className="inline-block px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-medium uppercase tracking-wide">
              {bin.kind}
            </span>
          </div>
        )}
        {bin.name && bin.bin_code && bin.name !== bin.bin_code && (
          <div className="mt-1 text-slate-700 text-[11px] leading-snug truncate">
            {bin.name}
          </div>
        )}
        <div className="mt-1 text-slate-500 text-[10px] leading-snug line-clamp-2" title={bin.path_label}>
          📍 {bin.path_label}
        </div>
      </div>
    </div>
  )
}

/**
 * Thermal-printer-friendly bin label. Renders into a fixed-dim card sized
 * for the chosen thermal stock. CSS @page sizing in thermalPrintCss
 * makes each card lay one-per-page on the printer.
 */
function ThermalBinLabel({
  bin,
  thermal,
  qrValue,
  codeOrName,
}: {
  bin: InventoryBin
  thermal: ThermalSizeKey
  qrValue: string
  codeOrName: string
}) {
  const size = THERMAL_SIZES[thermal]
  const square = size.w === size.h
  return (
    <div
      className="label-card border border-slate-300 bg-white flex items-center gap-2 p-1 overflow-hidden"
      style={{
        width: `${size.w}in`,
        height: `${size.h}in`,
        flexDirection: square ? 'column' : 'row',
      }}
    >
      <div className="flex-shrink-0 flex items-center justify-center">
        <QRCodeCanvas value={qrValue} size={size.qrPx} level={size.showFullText ? 'M' : 'H'} />
      </div>
      <div
        className={`flex-1 min-w-0 leading-tight ${square ? 'text-center w-full' : ''}`}
        style={{ fontSize: square ? '7px' : '10px' }}
      >
        <div className="font-bold text-slate-900 truncate" style={{ fontSize: square ? '8px' : '13px' }}>
          {codeOrName}
        </div>
        {size.showFullText && bin.kind && (
          <div className="font-mono uppercase tracking-wide text-blue-700">
            {bin.kind}
          </div>
        )}
        {size.showFullText && (
          <div
            className="text-slate-600 leading-tight"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
            title={bin.path_label}
          >
            {bin.path_label}
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleBtn({
  active,
  onClick,
  children,
  title,
  borderLeft,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
  borderLeft?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-3 py-1.5 ${borderLeft ? 'border-l border-slate-300' : ''} ${
        active
          ? 'bg-amber-600 text-white'
          : 'bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-600">
      {children}
    </div>
  )
}
