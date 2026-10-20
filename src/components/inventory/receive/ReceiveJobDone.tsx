import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { placePoParts, type PoParts } from '@/lib/poParts'
import { placeLines, preselectAsset } from '@/lib/receiveJob'
import { purchaseOrderKeys } from '@/hooks/usePurchaseOrders'
import type { InventoryBin } from '@/types/inventoryBin'
import type { InventoryLocation } from '@/types/inventoryLocation'
import type { ReceiveOverlayLine } from './ReceiveOverlay'

/**
 * Done, for an order that is for a job or an estimate: the next step in one
 * tap, all on existing endpoints.
 *   Put on Job #  -> POST /purchase-orders/{po}/parts/place (job lines at the
 *                    customer's price, out of stock, onto the asset)
 *   Add to Estimate -> the same call; on an estimate the parts stay held.
 *   Send to <tech>'s van -> POST /inventory-transfers (the tech accepts it).
 * The asset is picked for you when the job has only one.
 */
export type JobDoneProps = {
  poId: string
  parts: PoParts
  bin: InventoryBin
  lines: ReceiveOverlayLine[]
  /** The job's techs, lead first, each with their van (if they have one). */
  holders: JobHolder[]
  canEdit: boolean
}

export type JobHolder = { id: string; name: string; van: InventoryLocation | null }

export function ReceiveJobDone({ poId, parts, bin, lines, holders, canEdit }: JobDoneProps) {
  const qc = useQueryClient()
  const [assetId, setAssetId] = useState<string | null>(() => preselectAsset(parts))
  const [busy, setBusy] = useState<'place' | 'van' | null>(null)
  const [placed, setPlaced] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holderId, setHolderId] = useState<string | null>(holders[0]?.id ?? null)
  const holder = holders.find((h) => h.id === holderId) ?? holders[0] ?? null
  const van = holder?.van ?? null
  const techName = holder?.name ?? null
  const isJob = parts.for === 'job' && !!parts.job
  const target = isJob ? `Job #${parts.job?.number}` : parts.estimate ? `Estimate ${parts.estimate.number}` : null
  if (!target) return null
  const vanReady = isJob && !!van && van.id !== bin.location_id

  const place = async () => {
    setBusy('place'); setError(null)
    try {
      const res = await placePoParts(poId, placeLines(lines, assetId))
      qc.setQueryData([...purchaseOrderKeys.detail(poId), 'parts'], res.data)
      void qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(poId), exact: true })
      void qc.invalidateQueries({ queryKey: ['parts-orders'] })
      void qc.invalidateQueries({ queryKey: ['parts-readiness'] })
      setPlaced(`On ${res.for}${assetId ? `, fitted to ${parts.assets.find((a) => a.id === assetId)?.label ?? 'the asset'}` : ''}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'They were not put on the job.')
    } finally { setBusy(null) }
  }

  const sendToVan = async () => {
    if (!van) return
    setBusy('van'); setError(null)
    try {
      for (const l of lines) {
        if (!l.catalogItemId) continue
        await apiRequest('/v1/inventory-transfers', { method: 'POST', body: {
          catalog_item_id: l.catalogItemId, quantity: l.qty,
          from_location_id: bin.location_id, from_bin_id: bin.id,
          to_location_id: van.id, work_order_id: parts.job?.id ?? null,
          note: `For ${target}`,
        } })
      }
      void qc.invalidateQueries({ queryKey: ['inventory-transfers'] })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The transfer was not sent.')
    } finally { setBusy(null) }
  }

  const btn = 'min-h-[48px] sm:min-h-[40px] rounded-lg px-4 text-[14px] font-bold transition-colors disabled:opacity-50'
  return (
    <div data-testid="receive-job-done" className="mx-auto mt-4 max-w-[460px] space-y-3 rounded-xl border border-[var(--bins-border)] bg-[var(--bins-soft)] p-3 text-left">
      {isJob && parts.assets.length > 0 && !placed && (
        <div>
          <div className="text-[12px] font-semibold text-[var(--bins-muted)]">Fit to</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[{ id: null as string | null, label: 'No asset' }, ...parts.assets].map((a) => (
              <button key={a.id ?? 'none'} type="button" aria-pressed={assetId === a.id} onClick={() => setAssetId(a.id)}
                className={`rounded-full border px-3 py-1 text-[12.5px] ${assetId === a.id ? 'border-[var(--bins-accent)] bg-[var(--bins-accent)] text-white' : 'border-[var(--bins-border)] bg-[var(--bins-surface)]'}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {isJob && holders.length > 1 && !placed && !sent && (
        <div data-testid="who-holds">
          <div className="text-[12px] font-semibold text-[var(--bins-muted)]">Who will hold this part?</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {holders.map((h, i) => (
              <button key={h.id} type="button" aria-pressed={holder?.id === h.id} onClick={() => setHolderId(h.id)}
                className={`rounded-full border px-3 py-1 text-[12.5px] ${holder?.id === h.id ? 'border-[var(--bins-accent)] bg-[var(--bins-accent)] text-white' : 'border-[var(--bins-border)] bg-[var(--bins-surface)]'}`}>
                {h.name}{i === 0 ? ' (lead)' : ''}{h.van ? '' : ' · no van'}
              </button>
            ))}
          </div>
        </div>
      )}
      {isJob && holder && !van && !placed && <p className="text-[12px] text-[var(--bins-muted)]">{holder.name} has no van set up, so the part stays here, held for the job.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        {canEdit && !placed && (
          <button type="button" disabled={!!busy} onClick={() => void place()} className={`${btn} flex-1 bg-[var(--bins-accent)] text-white hover:bg-[var(--bins-accent-strong)]`}>
            {busy === 'place' ? 'Putting on…' : isJob ? `Put on ${target}` : `Add to ${target}`}
          </button>
        )}
        {canEdit && vanReady && !sent && !placed && (
          <button type="button" disabled={!!busy} onClick={() => void sendToVan()} className={`${btn} flex-1 border border-[var(--bins-border)] bg-[var(--bins-surface)] hover:bg-[var(--bins-soft)]`}>
            {busy === 'van' ? 'Sending…' : `Send to ${techName ?? 'the tech'}'s van`}
          </button>
        )}
      </div>
      {placed && <p role="status" className="text-[13px] font-semibold text-[var(--color-success)]">✓ {placed}</p>}
      {sent && <p role="status" className="text-[13px] font-semibold text-[var(--color-success)]">✓ Sent to {van?.name}. {techName ?? 'The tech'} accepts it on the phone.</p>}
      {!isJob && !placed && <p className="text-[12px] text-[var(--bins-muted)]">On an estimate the parts stay on the shelf, held, until it becomes a job.</p>}
      {error && <p role="alert" className="text-[12.5px] text-[var(--color-destructive)]">{error}</p>}
    </div>
  )
}