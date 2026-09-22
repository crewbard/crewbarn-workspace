import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Where this item actually is.
 *
 * A single on-hand figure is the one number that cannot be acted on: "3 each"
 * does not tell a tech which shelf to walk to, and once the same item sits in a
 * van and a shop it stops meaning anything at all. This breaks the total back
 * apart into the places it came from, and lists the individual tracked units
 * under each — which is the only view where the fingerprints are legible as
 * things rather than as rows in a table.
 *
 * Both the placements and the units are fetched here, item-wide, so the answer
 * does not depend on how the calling page happened to be filtered.
 */

interface Placement {
  key: string
  label: string
  qty: number
}

interface Unit {
  id: string
  status: string
  qr_payload: string
  internal_serial?: string | null
  current_location_id: string | null
  current_bin_id: string | null
}

export function StockWhereOverlay({
  itemId,
  itemName,
  unitLabel,
  onClose,
}: {
  itemId: string
  itemName: string
  unitLabel: string
  onClose: () => void
}) {
  /**
   * Placements are fetched here rather than passed in.
   *
   * The first version took them from whatever the calling page had loaded,
   * which is wrong the moment that page is filtered or paginated: filter Stock
   * levels to one location and "where is it" would confidently list only that
   * location. The question is item-wide, so the query has to be too.
   */
  const { data: levelData } = useQuery({
    queryKey: ['stock-where-levels', itemId],
    queryFn: () =>
      apiRequest<{
        data: {
          location_id: string
          bin_id: string | null
          location?: { name?: string } | null
          bin?: { path_label?: string | null; name?: string | null; bin_code?: string | null } | null
          quantities: { qty_on_hand: number }
        }[]
      }>(`/v1/inventory-stock-levels?catalog_item_id=${encodeURIComponent(itemId)}&per_page=200`),
  })

  const placements: Placement[] = []
  let total = 0
  for (const sl of levelData?.data ?? []) {
    total += sl.quantities.qty_on_hand
    const label =
      sl.bin?.path_label ||
      (sl.bin?.name || sl.bin?.bin_code
        ? `${sl.location?.name ?? '—'} / ${sl.bin?.name || sl.bin?.bin_code}`
        : sl.location?.name ?? '—')
    const key = `${sl.location_id}|${sl.bin_id ?? ''}`
    const found = placements.find((p) => p.key === key)
    if (found) found.qty += sl.quantities.qty_on_hand
    else placements.push({ key, label, qty: sl.quantities.qty_on_hand })
  }
  placements.sort((a, b) => b.qty - a.qty)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-units-where', itemId],
    queryFn: () =>
      apiRequest<{ data: Unit[] }>(
        `/v1/inventory-stock-units?catalog_item_id=${encodeURIComponent(itemId)}&per_page=200`,
      ),
  })

  const units = data?.data ?? []
  // Same key the stock-level map uses, so a unit lands under the placement it
  // belongs to rather than in an "other" bucket.
  const unitsByPlacement = new Map<string, Unit[]>()
  for (const u of units) {
    const key = `${u.current_location_id ?? ''}|${u.current_bin_id ?? ''}`
    unitsByPlacement.set(key, [...(unitsByPlacement.get(key) ?? []), u])
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{itemName}</h2>
            <p className="text-sm text-slate-500">
              {total} {unitLabel} on hand across {placements.length}{' '}
              {placements.length === 1 ? 'place' : 'places'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {placements.length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-500">
              None on hand anywhere.
            </p>
          )}

          {placements.map((p) => {
            const mine = unitsByPlacement.get(p.key) ?? []
            return (
              <div key={p.key} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-slate-800">📍 {p.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {p.qty} {unitLabel}
                  </span>
                </div>

                {mine.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {mine.map((u) => (
                      <li key={u.id} className="flex items-center gap-2 text-[12px] text-slate-500">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
                          {/* The serial reads; the fingerprint is what scans. */}
                          {u.internal_serial || u.qr_payload.slice(0, 22) + '…'}
                        </span>
                        {u.status !== 'available' && (
                          <span className="text-amber-700">{u.status}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* A placement with stock but no tracked units is worth saying
                    out loud: it means nothing there can be scanned onto a job. */}
                {!isLoading && mine.length === 0 && p.qty > 0 && (
                  <p className="mt-1 text-[12px] text-slate-400">
                    No tracked units here — nothing to scan.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
