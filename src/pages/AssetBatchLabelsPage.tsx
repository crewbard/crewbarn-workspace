import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { useQuery } from '@tanstack/react-query'
import { batchAssets } from '@/lib/assets'
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
import type { Asset } from '@/types/asset'

/**
 * Batch print labels for multiple assets in one job.
 *
 * URL: /assets/labels?ids=asset_a,asset_b,...&title=Group+Name
 *
 * Used by the AssetsTree's "Print all" action on a parent group node:
 * the tree walks the group's subtree client-side to collect every
 * descendant asset's id, builds the url, and opens this page in a
 * new tab. From there the same thermal/sheet/copies/PDF/PNG/Bluetooth
 * controls as the single-asset labels page apply.
 */
export function AssetBatchLabelsPage() {
  const [search, setSearch] = useSearchParams()

  const idList = useMemo(() => {
    const raw = search.get('ids') ?? ''
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }, [search])
  const title = search.get('title') ?? 'Asset labels'

  const sizeMode: 'regular' | 'mini' =
    search.get('size') === 'mini' ? 'mini' : 'regular'
  const thermal: ThermalSizeKey = parseThermalSize(search.get('thermal'))
  const isThermal = thermal !== 'sheet'
  const multiUp = isThermal && (isFullSheetSize(thermal) || search.get('multiup') === '1')
  const gap = Math.max(0, Math.min(0.5, Number(search.get('gap')) || 0))
  const isMini = !isThermal && sizeMode === 'mini'
  const copies = Math.max(1, Math.min(50, Number(search.get('copies')) || 1))

  // Resolve the requested ids server-side. This used to pull one page of 500
  // and match against it in the browser, so on a property past 500 assets the
  // missing ones just weren't in the page — their labels disappeared from the
  // print run with no error at all. You'd carry a stack of stickers to the
  // building and find doors with nothing to put on them.
  const assetsQuery = useQuery({
    queryKey: ['assets', 'batch', idList],
    queryFn: () => batchAssets(idList),
    enabled: idList.length > 0,
    staleTime: 60_000,
  })
  const assets: Asset[] = useMemo(() => assetsQuery.data?.data ?? [], [assetsQuery.data])
  const missingIds = assetsQuery.data?.meta?.missing ?? []

  // No auto-print: user picks size/copies on this configure page first,
  // then explicitly clicks Print or Ctrl/Cmd+P.

  function setParam(key: string, value: string | null) {
    const np = new URLSearchParams(search)
    if (value === null) np.delete(key)
    else np.set(key, value)
    setSearch(np, { replace: true })
  }

  function buildLabels(): PdfLabel[] {
    return assets.map((asset) => {
      const locationText =
        asset.service_location?.nickname ??
        asset.service_location?.street_address ??
        ''
      return {
        qrValue: asset.asset_code || asset.id,
        title: asset.name,
        subtitle: asset.asset_type?.name ?? undefined,
        details: [
          locationText ? `📍 ${locationText}` : '',
          asset.asset_group?.name ? `📦 ${asset.asset_group.name}` : '',
          asset.asset_code ?? '',
          [asset.manufacturer, asset.model].filter(Boolean).join(' · '),
        ].filter(Boolean),
      }
    })
  }

  function baseFilename(): string {
    return `${title}-labels`.replace(/[^A-Za-z0-9.-]+/g, '-')
  }

  if (assetsQuery.isLoading) {
    return <Centered>Loading assets…</Centered>
  }
  if (idList.length === 0) {
    return <Centered>No asset ids in URL.</Centered>
  }
  if (assets.length === 0) {
    return <Centered>No matching assets found.</Centered>
  }

  return (
    <div className="bg-white min-h-screen">
      <style>{thermalPrintCss(thermal, multiUp)}</style>

      <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-800">
            Labels — {title}
          </div>
          <div className="text-xs text-slate-500">
            {assets.length} asset{assets.length === 1 ? '' : 's'}
            {copies > 1 ? ` × ${copies} copies` : ''} · Ctrl+P to print
          </div>
          {/* A short run has to announce itself. Finding out at the building
              that some doors have no sticker is the failure this prevents. */}
          {missingIds.length > 0 && (
            <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              {missingIds.length} requested asset{missingIds.length === 1 ? '' : 's'} could not be
              found and {missingIds.length === 1 ? 'is' : 'are'} not in this run — they may have
              been deleted since the list was built.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
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
                title="Tiny stickers"
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
            title="Pick a thermal label size"
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
                title="Lay out N labels on a letter-sized PDF"
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
              title="Gap (inches) between adjacent labels"
            />
          )}
          {isThermal && !multiUp && (
            <>
              <button
                type="button"
                onClick={async () => {
                  const labels = buildLabels()
                  if (labels.length === 0) return
                  await downloadLabelPng({
                    label: labels[0],
                    thermalSize: thermal,
                    filename: `${baseFilename()}-${thermal}.png`,
                  })
                }}
                className="text-sm px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded"
                title="Download a PNG of the first label (single-image)"
              >
                🖼 PNG
              </button>
              {isWebBluetoothSupported() && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await printLabelsViaBluetooth({
                        labels: buildLabels(),
                        thermalSize: thermal,
                        copies,
                      })
                    } catch (err) {
                      alert(err instanceof Error ? err.message : String(err))
                    }
                  }}
                  className="text-sm px-3 py-1.5 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded"
                  title="Print directly to a Bluetooth thermal printer"
                >
                  📡 Bluetooth
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={
              isThermal
                ? async () => {
                    await printLabelPdf({
                      labels: buildLabels(),
                      thermalSize: thermal,
                      copies,
                      multiUp,
                      gap,
                      filename: `${baseFilename()}.pdf`,
                    })
                  }
                : () => window.print()
            }
            className="text-sm px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded"
          >
            Print
          </button>
        </div>
      </div>

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
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              mini={isMini}
              thermal={thermal}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function AssetCard({
  asset,
  mini,
  thermal,
}: {
  asset: Asset
  mini: boolean
  thermal: ThermalSizeKey
}) {
  const qrValue = asset.asset_code || asset.id
  const name = asset.name
  const typeName = asset.asset_type?.name ?? null
  const groupName = asset.asset_group?.name ?? null
  const locationText =
    asset.service_location?.nickname ??
    asset.service_location?.street_address ??
    null

  if (thermal !== 'sheet') {
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
            {name}
          </div>
          {size.showFullText && typeName && (
            <div className="font-mono uppercase tracking-wide text-blue-700" style={{ fontSize: '9px' }}>
              {typeName}
            </div>
          )}
          {size.showFullText && groupName && (
            <div className="text-slate-700 truncate" style={{ fontSize: '9px' }}>
              📦 {groupName}
            </div>
          )}
          {size.showFullText && locationText && (
            <div className="text-slate-600 truncate" style={{ fontSize: '9px' }}>
              📍 {locationText}
            </div>
          )}
          {size.showFullText && asset.asset_code && (
            <div className="font-mono text-slate-500 truncate" style={{ fontSize: '9px' }}>
              {asset.asset_code}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mini) {
    return (
      <div className="label-card border border-slate-300 rounded-sm p-0.5 flex flex-col items-center justify-center bg-white">
        <QRCodeCanvas value={qrValue} size={40} level="H" />
        <div className="mt-0.5 font-mono text-[6px] leading-none text-slate-800 text-center w-full truncate">
          {asset.asset_code ?? asset.name}
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
        <div className="font-bold text-slate-900 text-base truncate" title={name}>
          {name}
        </div>
        {typeName && (
          <div className="mt-0.5">
            <span className="inline-block px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-medium uppercase tracking-wide">
              {typeName}
            </span>
          </div>
        )}
        {groupName && (
          <div className="mt-1 text-slate-700 text-[10px] truncate">
            📦 {groupName}
          </div>
        )}
        {locationText && (
          <div className="mt-1 text-slate-600 text-[10px] truncate">
            📍 {locationText}
          </div>
        )}
        {asset.asset_code && (
          <div className="mt-1 font-mono text-slate-500 text-[10px] truncate">
            {asset.asset_code}
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
