import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { count } from '@/lib/catalogOrders'
import { addInstalledPart, installedPartsKey, listInstalledParts, removeInstalledPart, type InstalledPart } from '@/lib/poParts'

/**
 * What is fitted to this asset -- a fire door's closer, hinges, lockset --
 * serial-numbered or not. Parts land here when they come off a purchase
 * order onto a job against this asset; what was already there is written
 * in by hand. Taken off, a part stays on the list with when and why.
 */
export function AssetInstalledParts({ assetId }: { assetId: string }) {
  const qc = useQueryClient()
  const { has } = usePermissions()
  const canEdit = has(PERM.ASSETS_EDIT)
  const q = useQuery({ queryKey: installedPartsKey(assetId), queryFn: () => listInstalledParts(assetId) })

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ description: '', part_number: '', quantity: '1', serial_number: '', installed_at: '' })
  const [showRemoved, setShowRemoved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = q.data ?? []
  const fitted = rows.filter((p) => !p.removed_at)
  const removed = rows.filter((p) => p.removed_at)

  const refresh = () => void qc.invalidateQueries({ queryKey: installedPartsKey(assetId) })

  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      await addInstalledPart(assetId, {
        description: form.description.trim(),
        part_number: form.part_number.trim() || null,
        quantity: parseFloat(form.quantity) || 1,
        serial_number: form.serial_number.trim() || null,
        installed_at: form.installed_at || null,
      })
      setForm({ description: '', part_number: '', quantity: '1', serial_number: '', installed_at: '' })
      setAdding(false)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It was not saved.')
    } finally {
      setBusy(false)
    }
  }

  const takeOff = async (part: InstalledPart) => {
    const reason = window.prompt(`Why is ${part.description} coming off? (Replaced, failed inspection…)`, 'Replaced')
    if (reason === null) return
    setBusy(true)
    setError(null)
    try {
      await removeInstalledPart(assetId, part.id, reason)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It was not taken off.')
    } finally {
      setBusy(false)
    }
  }

  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '')

  const row = (p: InstalledPart) => (
    <li key={p.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 ${p.removed_at ? 'text-slate-400' : ''}`}>
      <span className="tabular-nums text-slate-500">{count(p.quantity)}×</span>
      <span className={p.removed_at ? 'line-through' : 'font-medium text-slate-900'}>{p.description}</span>
      {p.part_number && <span className="font-mono text-xs">{p.part_number}</span>}
      {p.serial_number && <span className="font-mono text-xs">SN {p.serial_number}</span>}
      <span className="text-xs text-slate-500">
        {[
          date(p.installed_at),
          p.source === 'by_hand' ? 'written in' : null,
        ].filter(Boolean).join(' · ')}
      </span>
      {p.job && <Link to={`/jobs/${p.job.id}`} className="text-xs underline underline-offset-2">Job #{p.job.number}</Link>}
      {p.purchase_order && <Link to={`/purchase-orders/${p.purchase_order.id}`} className="text-xs underline underline-offset-2">{p.purchase_order.po_number}</Link>}
      {p.removed_at && <span className="text-xs">Taken off {date(p.removed_at)}{p.removed_reason ? `: ${p.removed_reason}` : ''}</span>}
      {canEdit && !p.removed_at && (
        <button type="button" disabled={busy} onClick={() => void takeOff(p)} className="ml-auto text-xs text-slate-500 hover:text-red-700 disabled:opacity-50">Take off</button>
      )}
    </li>
  )

  return (
    <div data-tour="asset-installed-parts" className="text-sm">
      {q.isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : fitted.length === 0 ? (
        <p className="text-slate-500">Nothing recorded on it yet. Parts put on a job against it land here, with the job and the order.</p>
      ) : (
        <ul className="list-none divide-y divide-slate-100 p-0">{fitted.map(row)}</ul>
      )}

      {removed.length > 0 && (
        <button type="button" onClick={() => setShowRemoved((v) => !v)} className="mt-1 text-xs text-slate-500 underline underline-offset-2">
          {showRemoved ? 'Hide' : 'Show'} {removed.length} taken off
        </button>
      )}
      {showRemoved && <ul className="list-none divide-y divide-slate-100 p-0">{removed.map(row)}</ul>}

      {canEdit && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
          + Write in a part already on it
        </button>
      )}
      {adding && (
        <form onSubmit={(e) => { e.preventDefault(); void add() }} className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-6">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What it is (Surface closer)" required maxLength={255} className="rounded border border-slate-300 px-2 py-1.5 sm:col-span-3" />
          <input value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} placeholder="Part number" maxLength={100} className="rounded border border-slate-300 px-2 py-1.5 font-mono sm:col-span-2" />
          <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} inputMode="decimal" aria-label="Quantity" className="rounded border border-slate-300 px-2 py-1.5 text-right" />
          <input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Serial number (if any)" maxLength={120} className="rounded border border-slate-300 px-2 py-1.5 sm:col-span-3" />
          <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-3">
            Fitted on
            <input type="date" value={form.installed_at} onChange={(e) => setForm({ ...form, installed_at: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <div className="flex gap-2 sm:col-span-6">
            <button type="submit" disabled={busy || form.description.trim() === ''} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Add it</button>
            <button type="button" onClick={() => setAdding(false)} className="px-2 text-xs text-slate-500">Cancel</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    </div>
  )
}
