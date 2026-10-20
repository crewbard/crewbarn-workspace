import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { purchaseOrderKeys } from '@/hooks/usePurchaseOrders'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { count, money } from '@/lib/catalogOrders'
import { getPoParts, placePoParts, setPoFor, type PoParts } from '@/lib/poParts'

/**
 * Which job or estimate this order is for, and its parts onto it.
 *
 * An order can be for a job or an estimate before or after it arrives.
 * What has arrived is held for it; "Put on the job" makes the job's line
 * items at the customer's price, takes the parts out of stock, and -- for a
 * line put against one of the customer's doors -- records the part on that
 * door. On an estimate the parts become its lines and stay on the shelf.
 */
export function PoPartsPanel({ poId, status }: { poId: string; status: string }) {
  const qc = useQueryClient()
  const { hasAny } = usePermissions()
  const canEdit = hasAny([PERM.INVENTORY_EDIT, PERM.JOBS_EDIT])
  const key = [...purchaseOrderKeys.detail(poId), 'parts']
  const q = useQuery({ queryKey: key, queryFn: () => getPoParts(poId) })

  const [changing, setChanging] = useState(false)
  const [kind, setKind] = useState<'job' | 'estimate'>('job')
  const [number, setNumber] = useState('')
  // What is put on now, line by line, over what is left of each.
  const [qty, setQty] = useState<Record<string, string>>({})
  const [assetOf, setAssetOf] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const p = q.data
  if (!p || status === 'cancelled') return null
  const target = p.job ? `job #${p.job.number}` : p.estimate ? `estimate ${p.estimate.number}` : null
  const waiting = p.lines.filter((l) => l.left > 0)
  const notArrived = p.lines.every((l) => l.received === 0)

  const saved = (data: PoParts) => {
    qc.setQueryData(key, data)
    void qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(poId), exact: true })
    void qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() })
  }

  const attach = async (to: { job?: string | null; estimate?: string | null }) => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      saved(await setPoFor(poId, to))
      setChanging(false)
      setNumber('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }

  const qtyOf = (lineId: string, left: number) => {
    const typed = qty[lineId]
    if (typed === undefined) return left
    const n = parseFloat(typed)
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }

  const place = async () => {
    const lines = waiting
      .map((l) => ({ po_item_id: l.po_item_id, qty: qtyOf(l.po_item_id, l.left), asset_id: assetOf[l.po_item_id] || null }))
      .filter((l) => l.qty > 0)
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await placePoParts(poId, lines)
      const parts = lines.reduce((n, l) => n + l.qty, 0)
      saved(res.data)
      setQty({})
      setAssetOf({})
      setDone(`Put ${count(parts)} ${parts === 1 ? 'part' : 'parts'} on ${res.for}.`)
      void qc.invalidateQueries({ queryKey: ['parts-orders'] })
      void qc.invalidateQueries({ queryKey: ['parts-readiness'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'They were not put on.')
    } finally {
      setBusy(false)
    }
  }

  // How many parts go on, counted as parts, not lines.
  const putting = waiting.reduce((n, l) => n + qtyOf(l.po_item_id, l.left), 0)

  return (
    <section data-tour="po-detail-for" className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Parts onto the job</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          {target ? (
            <span>
              For{' '}
              <Link to={p.job ? `/jobs/${p.job.id}` : `/estimates/${p.estimate!.id}`} className="font-semibold underline underline-offset-2">{target}</Link>
              {(p.job?.title ?? p.estimate?.title) && <span className="text-slate-500"> · {p.job?.title ?? p.estimate?.title}</span>}
            </span>
          ) : (
            <span className="text-slate-500">For stock: not for a job yet.</span>
          )}
          {canEdit && !changing && (
            <button type="button" onClick={() => setChanging(true)} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50">
              {target ? 'Change' : 'Attach to a job or estimate'}
            </button>
          )}
        </div>
      </div>

      {changing && (
        <form
          onSubmit={(e) => { e.preventDefault(); void attach(kind === 'job' ? { job: number.trim() } : { estimate: number.trim() }) }}
          className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-3 text-sm"
        >
          <label>
            <span className="mb-1 block font-medium text-slate-700">For</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'job' | 'estimate')} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
              <option value="job">Job #</option>
              <option value="estimate">Estimate #</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block font-medium text-slate-700">Number</span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={kind === 'job' ? '318' : 'EST-0042'}
              aria-label={kind === 'job' ? 'Job number' : 'Estimate number'}
              autoFocus
              className="w-36 rounded-md border border-slate-300 px-2 py-1.5"
            />
          </label>
          <button type="submit" disabled={busy || number.trim() === ''} className="rounded-md bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Attach</button>
          {target && (
            <button type="button" disabled={busy} onClick={() => void attach({ job: null })} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
              Make it for stock
            </button>
          )}
          <button type="button" onClick={() => setChanging(false)} className="px-2 py-1.5 text-slate-500 hover:text-slate-800">Cancel</button>
          <p className="basis-full text-xs text-slate-500">Parts that already arrived are set aside for it.</p>
        </form>
      )}

      <div className="px-5 py-4 text-sm">
        {!target ? (
          <p className="text-slate-600">Attach this order to a job or estimate, and the parts can go on it as line items, and onto the customer&apos;s doors, once they arrive.</p>
        ) : notArrived ? (
          <p className="text-slate-600">Nothing has arrived yet. Receive it, and the parts are held for {target}; then put them on here.</p>
        ) : waiting.length === 0 ? (
          <p className="text-slate-600">Everything that arrived is on {target}.</p>
        ) : (
          <>
            <p className="mb-3 text-slate-600">
              Arrived and held for {target}. Putting them on adds them to its line items at the customer&apos;s price
              {p.for === 'job' ? ', takes them out of stock, and records each on the door you choose.' : '; they stay on the shelf until the job.'}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Part</th>
                    <th className="px-3 py-1.5 text-right font-medium">Arrived</th>
                    <th className="px-3 py-1.5 text-right font-medium">On it already</th>
                    <th className="px-3 py-1.5 text-right font-medium">Put on now</th>
                    <th className="px-3 py-1.5 font-medium">On which asset</th>
                    <th className="py-1.5 pl-3 text-right font-medium">Each, to the customer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waiting.map((l) => (
                    <tr key={l.po_item_id}>
                      <td className="py-2 pr-3">
                        <div className="text-slate-900">{l.description}</div>
                        <div className="font-mono text-xs text-slate-500">{l.part_number}{l.serialized ? ' · serial-numbered' : ''}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{count(l.received)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{count(l.placed)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          value={qty[l.po_item_id] ?? count(l.left)}
                          onChange={(e) => setQty((all) => ({ ...all, [l.po_item_id]: e.target.value }))}
                          disabled={!canEdit}
                          inputMode="decimal"
                          aria-label={`How many ${l.description} to put on`}
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                        />
                        <div className="mt-0.5 text-xs text-slate-400">of {count(l.left)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={assetOf[l.po_item_id] ?? ''}
                          onChange={(e) => setAssetOf((all) => ({ ...all, [l.po_item_id]: e.target.value }))}
                          disabled={!canEdit || p.assets.length === 0}
                          aria-label={`Asset for ${l.description}`}
                          className="max-w-56 rounded-md border border-slate-300 bg-white px-2 py-1 disabled:bg-slate-50"
                        >
                          <option value="">{p.assets.length === 0 ? 'No assets at this address' : 'None'}</option>
                          {p.assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums text-slate-700">{money(l.sell_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={busy || putting === 0}
                  onClick={() => void place()}
                  className="rounded-md bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Put {count(putting)} {putting === 1 ? 'part' : 'parts'} on {target}
                </button>
              </div>
            )}
          </>
        )}
        {done && <p className="mt-3 text-emerald-700">{done}</p>}
        {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
      </div>
    </section>
  )
}
