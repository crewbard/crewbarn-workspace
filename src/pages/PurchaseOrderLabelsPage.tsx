import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { usePurchaseOrder } from '@/hooks/usePurchaseOrders'
import { useInventoryUnits } from '@/hooks/useInventoryUnits'
import {
  THERMAL_SIZES,
  isFullSheetSize,
  parseThermalSize,
  thermalPrintCss,
  type ThermalSizeKey,
} from '@/lib/thermalLabels'
import { printLabelPdf, type PdfLabel } from '@/lib/pdfLabels'
import { LabelStudio } from '@/components/labels/LabelStudio'
import type { LabelFaceData } from '@/components/labels/LabelFace'
import { downloadLabelPng } from '@/lib/pngLabels'
import { printLabelsViaBluetooth } from '@/lib/escposBluetooth'

/**
 * Print-friendly QR sticker sheet for a single PO line.
 *
 * URL: /purchase-orders/:id/labels?item_id=poi_xxx
 *
 * - SN-tracked items: one sticker per inventory_unit (linked via
 *   purchase_order_item_id). Each QR encodes the unit's serial_number;
 *   the existing /inventory-units/by-serial/{serial} lookup resolves it.
 * - Non-SN items: one sticker per qty_received, using the catalog
 *   item's sku (or qr_code_value if set) as the QR payload.
 *
 * Sticker text (printed visually beside the QR):
 *   - item name (largest)
 *   - sku (mono, small)
 *   - short_description (e.g. "Fits Ford Ranger 2008-2021")
 *   - location/bin
 *   - serial (SN only)
 */
export function PurchaseOrderLabelsPage() {
  const { id } = useParams<{ id: string }>()
  const [search, setSearch] = useSearchParams()
  const itemId = search.get('item_id') ?? undefined
  const sizeMode: 'regular' | 'mini' =
    search.get('size') === 'mini' ? 'mini' : 'regular'
  const thermal: ThermalSizeKey = parseThermalSize(search.get('thermal'))
  const isThermal = thermal !== 'sheet'
  const multiUp = isThermal && (isFullSheetSize(thermal) || search.get('multiup') === '1')
  const gap = Math.max(0, Math.min(0.5, Number(search.get('gap')) || 0))
  const copies = Math.max(1, Math.min(50, Number(search.get('copies')) || 1))

  const poQuery = usePurchaseOrder(id)
  const unitsQuery = useInventoryUnits(
    itemId ? { purchase_order_item_id: itemId, per_page: 200 } : undefined
  )

  // Auto-trigger print dialog on first paint when data is ready.
  // Disabled by query param ?noprint=1 for inspection.
  // No auto-print: user picks size/copies on this configure page first,
  // then explicitly clicks Print or Ctrl/Cmd+P.

  const lineItem = useMemo(() => {
    if (!poQuery.data?.items || !itemId) return null
    return poQuery.data.items.find((it) => it.id === itemId) ?? null
  }, [poQuery.data, itemId])

  if (poQuery.isLoading) {
    return <Centered>Loading purchase order…</Centered>
  }
  if (!poQuery.data || !lineItem) {
    return <Centered>PO line not found.</Centered>
  }

  const units = unitsQuery.data?.data ?? []
  const isSnTracked = units.length > 0
  const fallbackQrValue = lineItem.catalog_item?.sku ?? lineItem.id

  /** One face per label, serial-tracked or not, like the builder below. */
  const faces: LabelFaceData[] = buildFaces()

  function buildFaces(): LabelFaceData[] {
    if (!lineItem) return []
    return isSnTracked
      ? units.map((u) => ({
          qrValue: u.serial_number,
          name: itemName,
          code: `SN ${u.serial_number}`,
          tag: 'SERIAL',
          path: u.bin?.name ?? undefined,
        }))
      : Array.from({ length: fallbackCount }).map(() => ({
          qrValue: fallbackQrValue,
          name: itemName,
          code: itemSku ?? undefined,
          tag: 'ITEM',
          path: vendorOrderNumber ? `Vendor #${vendorOrderNumber}` : undefined,
        }))
  }

  function buildPoLabels(): PdfLabel[] {
    if (!lineItem) return []
    return isSnTracked
      ? units.map((u) => ({
          qrValue: u.serial_number,
          title: itemName,
          subtitle: itemSku ?? undefined,
          details: [
            `SN: ${u.serial_number}`,
            u.vendor_order_number || vendorOrderNumber
              ? `Vendor #: ${u.vendor_order_number ?? vendorOrderNumber}`
              : '',
            u.bin?.name ?? '',
            lineItem.catalog_item?.short_description ?? '',
          ].filter(Boolean),
        }))
      : Array.from({ length: fallbackCount }).map(() => ({
          qrValue: fallbackQrValue,
          title: itemName,
          subtitle: itemSku ?? undefined,
          details: [
            vendorOrderNumber ? `Vendor #: ${vendorOrderNumber}` : '',
            lineItem.catalog_item?.short_description ?? '',
          ].filter(Boolean),
        }))
  }

  const fallbackCount = isSnTracked ? 0 : Math.max(0, Math.floor(lineItem.qty_received ?? 0)) || 1

  const itemName = lineItem.catalog_item?.name ?? lineItem.description
  const itemSku = lineItem.catalog_item?.sku ?? null
  const vendorOrderNumber = poQuery.data.vendor_order_number ?? null

  function setParam(key: string, value: string | null) {
    const np = new URLSearchParams(search)
    if (value === null) np.delete(key)
    else np.set(key, value)
    setSearch(np, { replace: true })
  }

  const isMini = !isThermal && sizeMode === 'mini'

  return (
    <div className="bg-white min-h-screen">
      {/* Print CSS — applied via Tailwind print: variants below */}
      <style>{thermalPrintCss(thermal, multiUp)}</style>

      <LabelStudio
        backTo={{ href: `/purchase-orders/${id}`, label: 'the purchase order' }}
        faces={faces}
        size={thermal}
        onSize={(next) => setParam('thermal', next === 'sheet' ? null : next)}
        copies={copies}
        onCopies={(n) => setParam('copies', String(n))}
        gap={gap}
        onGap={(g) => setParam('gap', g === 0 ? null : String(g))}
        onPrint={async () => {
          await printLabelPdf({ labels: buildPoLabels(), thermalSize: thermal, copies, multiUp, gap })
        }}
        onBluetooth={async () => {
          try {
            await printLabelsViaBluetooth({ labels: buildPoLabels(), thermalSize: thermal, copies })
          } catch (err) {
            alert(err instanceof Error ? err.message : String(err))
          }
        }}
        onDownloadImage={async () => {
          const first = buildPoLabels()[0]
          if (first) await downloadLabelPng({ label: first, thermalSize: thermal, filename: `${itemName}.png` })
        }}
      />
      <div className={`print-stage ${isThermal ? 'p-0' : isMini ? 'p-2' : 'p-4'}`}>
        <div
          className={
            isThermal
              ? 'flex flex-col items-stretch gap-2 p-2'
              : isMini
                ? 'grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-14 gap-1'
                : 'grid grid-cols-2 sm:grid-cols-3 gap-3'
          }
        >
          {isSnTracked
            ? units.map((u) => (
                <LabelCard
                  key={u.id}
                  qrValue={u.serial_number}
                  itemName={itemName}
                  sku={itemSku}
                  shortDescription={lineItem.catalog_item?.short_description ?? null}
                  binText={u.bin?.place_label ?? u.bin?.name ?? lineItem.catalog_item?.default_bin?.name ?? null}
                  serial={u.serial_number}
                  vendorOrderNumber={u.vendor_order_number ?? vendorOrderNumber}
                  mini={isMini}
                  thermal={thermal}
                />
              ))
            : Array.from({ length: fallbackCount }).map((_, i) => (
                <LabelCard
                  key={`f-${i}`}
                  qrValue={fallbackQrValue}
                  itemName={itemName}
                  sku={itemSku}
                  shortDescription={lineItem.catalog_item?.short_description ?? null}
                  binText={lineItem.catalog_item?.default_bin?.place_label ?? lineItem.catalog_item?.default_bin?.name ?? null}
                  serial={null}
                  vendorOrderNumber={vendorOrderNumber}
                  mini={isMini}
                  thermal={thermal}
                />
              ))}
        </div>
      </div>
    </div>
  )
}

function LabelCard({
  qrValue,
  itemName,
  sku,
  shortDescription,
  binText,
  serial,
  vendorOrderNumber,
  mini,
  thermal,
}: {
  qrValue: string
  itemName: string
  sku: string | null
  shortDescription: string | null
  binText: string | null
  serial: string | null
  vendorOrderNumber: string | null
  mini?: boolean
  thermal?: ThermalSizeKey
}) {
  if (thermal && thermal !== 'sheet') {
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
          <div className="font-bold text-slate-900 truncate" style={{ fontSize: square ? '8px' : '12px' }}>
            {itemName}
          </div>
          {size.showFullText && sku && (
            <div className="font-mono text-slate-500 truncate" style={{ fontSize: '9px' }}>
              {sku}
            </div>
          )}
          {size.showFullText && serial && (
            <div className="font-mono text-slate-800 truncate" style={{ fontSize: '9px' }}>
              SN: {serial}
            </div>
          )}
          {size.showFullText && vendorOrderNumber && (
            <div className="font-mono text-slate-600 truncate" style={{ fontSize: '9px' }}>
              Vendor #: {vendorOrderNumber}
            </div>
          )}
          {size.showFullText && shortDescription && (
            <div className="text-slate-700 line-clamp-1" style={{ fontSize: '9px' }}>
              {shortDescription}
            </div>
          )}
          {size.showFullText && binText && (
            <div className="text-slate-600 truncate" style={{ fontSize: '9px' }}>
              📍 {binText}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mini) {
    // Mini layout — ~0.5" x 1" target. QR + bottom-line serial only.
    // Higher error correction so it's still readable when small + on
    // a slightly textured surface like a circuit board.
    return (
      <div className="label-card border border-slate-300 rounded-sm p-0.5 flex flex-col items-center justify-center bg-white">
        <QRCodeCanvas value={qrValue} size={40} level="H" />
        <div className="mt-0.5 font-mono text-[6px] leading-none text-slate-800 text-center w-full truncate">
          {serial ?? sku ?? qrValue}
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
        <div className="font-bold text-slate-900 text-sm truncate" title={itemName}>
          {itemName}
        </div>
        {sku && (
          <div className="font-mono text-slate-500 text-[10px] truncate">{sku}</div>
        )}
        {shortDescription && (
          <div className="mt-1 text-slate-700 text-[11px] leading-snug line-clamp-2">
            {shortDescription}
          </div>
        )}
        {binText && (
          <div className="mt-1 text-slate-600 text-[10px]">📍 {binText}</div>
        )}
        {serial && (
          <div className="mt-1 font-mono text-slate-800 text-[10px] truncate">
            SN: {serial}
          </div>
        )}
        {vendorOrderNumber && (
          <div className="mt-0.5 font-mono text-slate-600 text-[10px] truncate">
            Vendor #: {vendorOrderNumber}
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-600">
      {children}
    </div>
  )
}
