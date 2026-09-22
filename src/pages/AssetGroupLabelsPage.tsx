import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import { getAssetGroup, getAssetGroupQrCode } from '@/lib/assetGroups'
import { printLabelPdf, type PdfLabel } from '@/lib/pdfLabels'
import { downloadLabelPng } from '@/lib/pngLabels'
import { isWebBluetoothSupported, printLabelsViaBluetooth } from '@/lib/escposBluetooth'
import type { ThermalSizeKey } from '@/lib/thermalLabels'

/**
 * Placard for a building or area — /asset-groups/{id}/labels.
 *
 * Group QR codes have been mintable since the group work shipped, but nothing
 * could print one: the label pages only ever handled assets. So the lobby
 * sticker that opens a whole site — the thing the property roll-up is built
 * around — had no way to exist on paper.
 *
 * Deliberately not the asset label page with a different noun. A placard goes
 * on a wall and gets scanned from a few feet away, so it defaults to a large
 * format with a big quiet-zone QR, where an asset sticker defaults to a 2×1
 * thermal. Same PDF, PNG and Bluetooth paths underneath.
 */

const PLACARD_SIZES: { key: ThermalSizeKey; label: string; hint: string }[] = [
  { key: 'sheet', label: 'Letter sheet', hint: 'Print, laminate, mount in a lobby' },
  { key: 'full', label: 'Full page', hint: 'One giant QR — scannable across a lobby' },
  { key: '4x6', label: '4 × 6', hint: 'Thermal — riser rooms, plant rooms' },
  { key: '2x1', label: '2 × 1', hint: 'Thermal — small areas, cabinets' },
]

export function AssetGroupLabelsPage() {
  const { id } = useParams<{ id: string }>()
  const [search, setSearch] = useSearchParams()
  const size = (search.get('size') ?? 'sheet') as ThermalSizeKey
  const copies = Math.max(1, Math.min(50, Number(search.get('copies')) || 1))
  const [btBusy, setBtBusy] = useState(false)
  const [btError, setBtError] = useState<string | null>(null)

  const groupQ = useQuery({
    queryKey: ['asset-group', id],
    queryFn: () => getAssetGroup(id!),
    enabled: !!id,
  })
  // Minting the code is the side effect that makes the placard printable at
  // all — a group with no group_code gets one on first request.
  const qrQ = useQuery({
    queryKey: ['asset-group', id, 'qr'],
    queryFn: () => getAssetGroupQrCode(id!),
    enabled: !!id,
  })

  const group = groupQ.data
  const code = qrQ.data?.group_code

  // The placard has to resolve for someone who isn't signed in and isn't
  // holding the app, so it encodes the public scan URL, not a bare code.
  const scanUrl = useMemo(
    () => (code ? `${window.location.origin}/scan/${group?.tenant_id ?? ''}/${code}` : ''),
    [code, group?.tenant_id],
  )

  const labels: PdfLabel[] = useMemo(() => {
    if (!group || !scanUrl) return []
    return [
      {
        qrValue: scanUrl,
        title: group.name,
        subtitle: 'Scan for equipment records',
        details: [
          code ? `Code ${code}` : '',
          typeof group.assets_count === 'number'
            ? `${group.assets_count} item${group.assets_count === 1 ? '' : 's'} on file`
            : '',
        ].filter(Boolean),
      },
    ]
  }, [group, scanUrl, code])

  function setParam(key: string, value: string | null) {
    const np = new URLSearchParams(search)
    if (value === null) np.delete(key)
    else np.set(key, value)
    setSearch(np, { replace: true })
  }

  if (groupQ.isLoading || qrQ.isLoading) {
    return <Centered>Preparing placard…</Centered>
  }
  if (!group || !code) {
    return <Centered>Couldn't load this area.</Centered>
  }

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-6 py-3">
        <div>
          <div className="text-sm font-medium text-slate-800">Placard — {group.name}</div>
          <div className="text-xs text-slate-500">Ctrl+P to print, or use a button</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs">
            {PLACARD_SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                title={s.hint}
                onClick={() => setParam('size', s.key === 'sheet' ? null : s.key)}
                className={`px-3 py-1.5 font-medium ${
                  size === s.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Copies
            <input
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={(e) => setParam('copies', e.target.value)}
              className="w-16 rounded border border-slate-300 px-2 py-1"
            />
          </label>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Print
          </button>
          {size !== 'sheet' && (
            <button
              type="button"
              onClick={() =>
                printLabelPdf({
                  labels,
                  thermalSize: size as ThermalSizeKey,
                  copies,
                  filename: `${group.name}-placard.pdf`,
                })
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              PDF
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              void downloadLabelPng({
                label: labels[0],
                thermalSize: size,
                filename: `${group.name}-placard.png`,
              })
            }
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            PNG
          </button>
          {isWebBluetoothSupported() && size !== 'sheet' && (
            <button
              type="button"
              disabled={btBusy}
              onClick={async () => {
                setBtBusy(true)
                setBtError(null)
                try {
                  await printLabelsViaBluetooth({ labels, thermalSize: size, copies })
                } catch (e) {
                  setBtError((e as Error).message || 'Bluetooth print failed.')
                } finally {
                  setBtBusy(false)
                }
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {btBusy ? 'Printing…' : 'Bluetooth'}
            </button>
          )}
        </div>
      </div>

      {btError && (
        <div className="no-print border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">
          {btError}
        </div>
      )}

      <div className="flex flex-col items-center gap-8 p-8">
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            className={`flex flex-col items-center rounded-xl border-2 border-slate-900 bg-white text-center ${
              size === 'sheet' ? 'w-[7in] p-10' : 'w-[3.6in] p-5'
            }`}
            style={{ breakInside: 'avoid', pageBreakAfter: i < copies - 1 ? 'always' : 'auto' }}
          >
            <p className={`font-extrabold tracking-tight text-slate-900 ${size === 'sheet' ? 'text-4xl' : 'text-xl'}`}>
              {group.name}
            </p>
            <p className={`mt-1 text-slate-600 ${size === 'sheet' ? 'text-lg' : 'text-xs'}`}>
              Scan for equipment records and inspection status
            </p>

            {/* Generous quiet zone — a placard is read from a few feet away by
                a phone that is not being held still. */}
            <div className={`mt-6 rounded-lg bg-white ${size === 'sheet' ? 'p-4' : 'p-2'}`}>
              <QRCodeCanvas value={scanUrl} size={size === 'sheet' ? 300 : 150} level="M" includeMargin />
            </div>

            <p className={`mt-4 font-mono text-slate-500 ${size === 'sheet' ? 'text-base' : 'text-[10px]'}`}>
              {code}
            </p>
            {typeof group.assets_count === 'number' && (
              <p className={`mt-1 text-slate-400 ${size === 'sheet' ? 'text-sm' : 'text-[9px]'}`}>
                {group.assets_count} item{group.assets_count === 1 ? '' : 's'} on file
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      {children}
    </div>
  )
}
