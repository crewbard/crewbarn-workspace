import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { useAsset } from '@/hooks/useAssets'
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
import type { Asset } from '@/types/asset'

/**
 * Print-friendly QR sticker for an Asset.
 *
 * URL: /assets/:id/labels?size=...&thermal=...&copies=N
 *   - size=mini       — smaller sheet sticker
 *   - thermal=2x1     — pick a thermal label preset (Sheet by default)
 *   - copies=N        — print N copies of the sticker (default 1)
 *
 * QR encodes the asset_code (the public scan target). Existing public
 * /scan/{tenantId}/{code} resolves it. Stickered onto the physical
 * asset (door, extinguisher, panel) for inspection lookup.
 */
export function AssetLabelsPage() {
  const { id } = useParams<{ id: string }>()
  const [search, setSearch] = useSearchParams()

  const sizeMode: 'regular' | 'mini' =
    search.get('size') === 'mini' ? 'mini' : 'regular'
  const thermal: ThermalSizeKey = parseThermalSize(search.get('thermal'))
  const isThermal = thermal !== 'sheet'
  const multiUp = isThermal && (isFullSheetSize(thermal) || search.get('multiup') === '1')
  const gap = Math.max(0, Math.min(0.5, Number(search.get('gap')) || 0))
  const isMini = !isThermal && sizeMode === 'mini'
  const copies = Math.max(1, Math.min(50, Number(search.get('copies')) || 1))

  const assetQuery = useAsset(id)
  // No auto-print: user picks size/copies on this configure page first,
  // then explicitly clicks Print or Ctrl/Cmd+P.

  function setParam(key: string, value: string | null) {
    const np = new URLSearchParams(search)
    if (value === null) np.delete(key)
    else np.set(key, value)
    setSearch(np, { replace: true })
  }

  if (assetQuery.isLoading) {
    return <Centered>Loading asset…</Centered>
  }
  if (!assetQuery.data) {
    return <Centered>Asset not found.</Centered>
  }

  const asset = assetQuery.data

  function buildAssetLabel(): PdfLabel | null {
    if (!asset) return null
    const locationText =
      asset.service_location?.nickname ??
      asset.service_location?.street_address ??
      ''
    return {
      qrValue: asset.asset_code || asset.id,
      title: asset.name,
      subtitle: asset.asset_type?.name ?? undefined,
      details: [
        locationText,
        asset.asset_code ?? '',
        [asset.manufacturer, asset.model].filter(Boolean).join(' · '),
      ].filter(Boolean),
    }
  }

  /** What the studio draws, from the same builder the printers use. */
  const faces: LabelFaceData[] = (() => {
    const label = buildAssetLabel()
    if (!label) return []
    return [
      {
        qrValue: label.qrValue,
        name: label.title,
        code: asset.asset_code ?? undefined,
        tag: asset.asset_type?.name ?? undefined,
        path:
          asset.service_location?.nickname ??
          asset.service_location?.street_address ??
          undefined,
      },
    ]
  })()

  return (
    <div className="bg-white min-h-screen">
      <style>{thermalPrintCss(thermal, multiUp)}</style>

      <LabelStudio
        backTo={{ href: `/assets/${asset.id}`, label: asset.name }}
        faces={faces}
        size={thermal}
        onSize={(next) => setParam('thermal', next === 'sheet' ? null : next)}
        copies={copies}
        onCopies={(n) => setParam('copies', String(n))}
        gap={gap}
        onGap={(g) => setParam('gap', g === 0 ? null : String(g))}
        onPrint={async () => {
          const label = buildAssetLabel()
          if (label) {
            await printLabelPdf({ labels: [label], thermalSize: thermal, copies, multiUp, gap })
          }
        }}
        onBluetooth={async () => {
          const label = buildAssetLabel()
          if (!label) return
          try {
            await printLabelsViaBluetooth({ labels: [label], thermalSize: thermal, copies })
          } catch (err) {
            alert(err instanceof Error ? err.message : String(err))
          }
        }}
        onDownloadImage={async () => {
          const label = buildAssetLabel()
          if (label) {
            await downloadLabelPng({ label, thermalSize: thermal, filename: `${asset.asset_code || asset.id}.png` })
          }
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
          {Array.from({ length: copies }).map((_, i) => (
            <AssetLabelCard
              key={i}
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

function AssetLabelCard({
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
        {locationText && (
          <div className="mt-1 text-slate-600 text-[10px] leading-snug truncate">
            📍 {locationText}
          </div>
        )}
        {asset.asset_code && (
          <div className="mt-1 font-mono text-slate-500 text-[10px] truncate">
            {asset.asset_code}
          </div>
        )}
        {(asset.manufacturer || asset.model) && (
          <div className="mt-1 text-slate-500 text-[10px] truncate">
            {[asset.manufacturer, asset.model].filter(Boolean).join(' · ')}
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
