import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { LabelStudio } from '@/components/labels/LabelStudio'
import type { LabelFaceData } from '@/components/labels/LabelFace'
import { useCatalogItem } from '@/hooks/useCatalogItems'
import {
  THERMAL_SIZES,
  isFullSheetSize,
  parseThermalSize,
  thermalPrintCss,
  type ThermalSizeKey,
} from '@/lib/thermalLabels'

/**
 * Print-friendly QR sticker for a catalog item (typically a stocked product).
 *
 * URL: /catalog-items/:id/labels?size=mini&thermal=full-2x1&copies=N
 *
 * Renders without AppLayout chrome. Lands on a size-selection toolbar at
 * the top — user picks Sheet / Full sheet of N×M / Thermal preset / Mini
 * / copies, then clicks Print. No auto-print.
 *
 * The QR encodes a deep-link to the item page, so a tech scanning while
 * authenticated lands on the catalog item.
 */
export function CatalogItemLabelsPage() {
  const { id } = useParams<{ id: string }>()
  const [search, setSearch] = useSearchParams()

  const sizeMode: 'regular' | 'mini' = search.get('size') === 'mini' ? 'mini' : 'regular'
  const thermal: ThermalSizeKey = parseThermalSize(search.get('thermal'))
  const isThermal = thermal !== 'sheet'
  const isFullSheet = isFullSheetSize(thermal)
  // multiUp = letter paper with grid of label tiles. Full-sheet presets
  // imply this; the regular thermal sizes use one label per print.
  const multiUp = isFullSheet
  const isMini = !isThermal && sizeMode === 'mini'
  const copies = Math.max(1, Math.min(50, Number(search.get('copies')) || 1))
  // Sticker-sheet spacing, the same parameter every other labels page reads.
  const gap = Math.max(0, Math.min(0.5, Number(search.get('gap')) || 0))
  // Detail level: short = QR + name only; long = adds SKU, qr value, bin
  // info (when bin_id is passed). Default short for tile-style printing,
  // long when called from stock level rows.
  const detail: 'short' | 'long' = search.get('detail') === 'long' ? 'long' : 'short'
  const binIdFromUrl = search.get('bin_id') ?? null
  const binLabelFromUrl = search.get('bin_label') ?? null
  const qtyFromUrl = search.get('qty') ?? null
  const locationIdFromUrl = search.get('location_id') ?? null
  /**
   * Per-unit mode. A stock level of "4 on hand" is four physical items, each
   * with its own qr_payload fingerprint — so it needs four DIFFERENT labels.
   * Printing four copies of the product QR produces four labels nothing can
   * tell apart, which defeats scanning one to consume it.
   */
  const perUnit = search.get('per_unit') === '1'


  const itemQuery = useCatalogItem(id)

  const unitsQuery = useQuery({
    queryKey: ['stock-units-for-labels', id, locationIdFromUrl, binIdFromUrl],
    queryFn: () =>
      apiRequest<{ data: { id: string; qr_payload: string; internal_serial?: string | null }[] }>(
        `/v1/inventory-stock-units?catalog_item_id=${encodeURIComponent(id ?? '')}` +
          (locationIdFromUrl ? `&location_id=${encodeURIComponent(locationIdFromUrl)}` : '') +
          `&bin_id=${encodeURIComponent(binIdFromUrl ?? '')}&per_page=200`,
      ),
    enabled: perUnit && !!id,
  })


  function setParam(key: string, value: string | null) {
    const np = new URLSearchParams(search)
    if (value === null) np.delete(key)
    else np.set(key, value)
    setSearch(np, { replace: true })
  }

  if (itemQuery.isLoading) {
    return <div className="p-12 text-center text-slate-500">Loading item…</div>
  }
  if (!itemQuery.data) {
    return <div className="p-12 text-center text-slate-500">Item not found.</div>
  }

  const item = itemQuery.data
  const qrValue = item.qr_code_value || item.barcode || item.id
  const qrUrl = `${window.location.origin}/catalog/products/${item.id}`
  const units = unitsQuery.data?.data ?? []
  const unitCount = units.length

  /**
   * What the studio draws. Per-unit labels carry the unit's own payload,
   * which is the whole point of the mode: four copies of the product code
   * are four labels that identify nothing in particular.
   */
  const faces: LabelFaceData[] = perUnit
    ? units.map((u) => ({
        qrValue: u.qr_payload,
        name: item.name,
        code: u.internal_serial ?? item.sku ?? undefined,
        tag: 'UNIT',
      }))
    : [{ qrValue, name: item.name, code: item.sku ?? undefined, tag: 'ITEM' }]

  return (
    <div className="bg-white min-h-screen">
      <style>{thermalPrintCss(thermal, multiUp)}</style>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: white; } }
      `}</style>

      <LabelStudio
        backTo={{ href: `/catalog/products/${item.id}`, label: item.name }}
        faces={faces}
        size={thermal}
        onSize={(next) => setParam('thermal', next === 'sheet' ? null : next)}
        copies={copies}
        onCopies={(n) => setParam('copies', n === 1 ? null : String(n))}
        gap={gap}
        onGap={(g) => setParam('gap', g === 0 ? null : String(g))}
        scope={{
          value: perUnit ? 'units' : 'product',
          onChange: (next) => setParam('per_unit', next === 'units' ? '1' : null),
          options: [
            {
              value: 'product',
              title: 'One label for the product',
              help: 'Scans to the product page — the same code however many you have',
              count: 1,
            },
            {
              value: 'units',
              title: 'One label per tracked unit',
              help: 'Each label scans to that one unit, not to the product',
              count: unitCount,
            },
          ],
        }}
        onPrint={() => window.print()}
      />
      <div className={`print-stage ${isThermal && !multiUp ? 'p-0' : 'p-4'}`}>
        <div
          className={
            isThermal && !multiUp
              ? 'flex flex-col items-stretch gap-2'
              : multiUp
                ? 'flex flex-wrap'
                : isMini
                  ? 'grid grid-cols-3 sm:grid-cols-6 gap-2'
                  : 'grid grid-cols-2 gap-3'
          }
          style={multiUp ? { gap: '0in' } : undefined}
        >
          {/* Per-unit mode has three ways to legitimately render nothing —
              still loading, the endpoint is unavailable, or this row genuinely
              has no tracked units yet. Falling through to an empty grid for any
              of them gives a blank sheet with no clue which, so each says so. */}
          {perUnit && unitsQuery.isLoading && (
            <div className="p-10 text-center text-sm text-slate-500">Loading units…</div>
          )}
          {perUnit && unitsQuery.isError && (
            <div className="mx-auto max-w-md p-8 text-center text-sm text-rose-700">
              Could not load the units for this row.
              <div className="mt-1 text-xs text-rose-600">
                {unitsQuery.error instanceof Error ? unitsQuery.error.message : 'Request failed.'}
              </div>
            </div>
          )}
          {perUnit && !unitsQuery.isLoading && !unitsQuery.isError && (unitsQuery.data?.data ?? []).length === 0 && (
            <div className="mx-auto max-w-md p-8 text-center text-sm text-slate-600">
              No tracked units for this item in this bin, so there is nothing to
              label one-per-item.
              <div className="mt-1 text-xs text-slate-500">
                Units are created to match the quantity when a stock level is saved.
                Open Edit stock, save it, then print again.
              </div>
            </div>
          )}
          {perUnit
            ? (unitsQuery.data?.data ?? []).map((u) => (
                <CatalogLabelCard
                  key={u.id}
                  isThermal={isThermal}
                  isFullSheet={isFullSheet}
                  isMini={isMini}
                  thermal={thermal}
                  detail={detail}
                  binIdFromUrl={binIdFromUrl}
                  binLabelFromUrl={binLabelFromUrl}
                  qtyFromUrl={null}
                  item={item}
                  // The unit's own fingerprint — this is what the mobile
                  // scanner matches to consume exactly this item.
                  qrUrl={u.qr_payload}
                  qrValue={u.internal_serial || u.qr_payload}
                />
              ))
            : Array.from({ length: copies }).map((_, idx) => (
                <CatalogLabelCard
                  key={idx}
                  isThermal={isThermal}
                  isFullSheet={isFullSheet}
                  isMini={isMini}
                  thermal={thermal}
                  detail={detail}
                  binIdFromUrl={binIdFromUrl}
                  binLabelFromUrl={binLabelFromUrl}
                  qtyFromUrl={qtyFromUrl}
                  item={item}
                  qrUrl={qrUrl}
                  qrValue={qrValue}
                />
              ))}
        </div>
      </div>
    </div>
  )
}

function CatalogLabelCard({
  isThermal,
  isFullSheet,
  isMini,
  thermal,
  detail,
  binIdFromUrl: _binIdFromUrl,
  binLabelFromUrl,
  qtyFromUrl,
  item,
  qrUrl,
  qrValue,
}: {
  isThermal: boolean
  isFullSheet: boolean
  isMini: boolean
  thermal: ThermalSizeKey
  detail: 'short' | 'long'
  binIdFromUrl: string | null
  binLabelFromUrl: string | null
  qtyFromUrl: string | null
  item: { id: string; name: string; sku: string | null; barcode?: string | null; default_bin?: { name?: string | null; path_label?: string | null } | null }
  qrUrl: string
  qrValue: string
}) {
  const isLong = detail === 'long'
  // Bin label preference: URL-supplied (exact bin clicked from stock level)
  // > item.default_bin (hint when printing from catalog page only).
  const binLabel = isLong
    ? (binLabelFromUrl || item.default_bin?.path_label || item.default_bin?.name || null)
    : null

  // Thermal (single per page) and full-sheet tiles both use the size from
  // THERMAL_SIZES so the printed dimensions match the label stock.
  if (isThermal) {
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
          <QRCodeCanvas value={qrUrl} size={size.qrPx} level={size.showFullText ? 'M' : 'H'} />
        </div>
        <div
          className={`flex-1 min-w-0 leading-tight ${square ? 'text-center w-full' : ''}`}
          style={{ fontSize: square ? '7px' : '10px' }}
        >
          <div className="font-bold text-slate-900 truncate" style={{ fontSize: square ? '8px' : '13px' }}>
            {item.name}
          </div>
          {isLong && size.showFullText && item.sku && (
            <div className="font-mono text-slate-600">SKU: {item.sku}</div>
          )}
          {isLong && size.showFullText && binLabel && (
            <div className="font-mono text-slate-600 truncate">📍 {binLabel}</div>
          )}
          {isLong && size.showFullText && qtyFromUrl && (
            <div className="font-mono text-slate-600">Qty: {qtyFromUrl}</div>
          )}
          {isLong && size.showFullText && !isFullSheet && (
            <div className="font-mono text-slate-400 break-all" style={{ fontSize: '7px' }}>
              {qrValue}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Mini (cut sheet) — short form only; mini is too small for long detail
  if (isMini) {
    return (
      <div className="label-card border border-slate-300 rounded-sm p-1 flex flex-col items-center justify-center bg-white">
        <QRCodeCanvas value={qrUrl} size={70} level="H" />
        <div className="mt-1 text-[8px] leading-none text-slate-800 text-center w-full truncate font-semibold">
          {item.name}
        </div>
      </div>
    )
  }

  // Regular cut sheet
  return (
    <div className="label-card border border-slate-300 rounded p-3 flex items-center gap-3 break-inside-avoid">
      <QRCodeCanvas value={qrUrl} size={120} level="H" includeMargin />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 text-base leading-tight">
          {item.name}
        </div>
        {isLong && item.sku && (
          <div className="font-mono text-xs text-slate-600 mt-1">SKU: {item.sku}</div>
        )}
        {isLong && binLabel && (
          <div className="text-xs text-slate-700 mt-1">📍 {binLabel}</div>
        )}
        {isLong && qtyFromUrl && (
          <div className="text-xs text-slate-600 mt-0.5">On hand: {qtyFromUrl}</div>
        )}
        {isLong && (
          <div className="font-mono text-[10px] text-slate-400 mt-1 break-all">
            {qrValue}
          </div>
        )}
      </div>
    </div>
  )
}

