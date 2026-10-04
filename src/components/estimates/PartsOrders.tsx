import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBook2 } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { CATALOG_SHORTCUT_LABEL, openCatalogs } from '@/lib/catalogs'
import { STAGE_LABEL, count, money, poLabel, type OrderStage } from '@/lib/catalogOrders'

type Po = {
  id: string
  po_number: string
  status: string
  kind: 'stock' | 'estimate'
  vendor?: { name: string; label: string } | null
  money: { subtotal_cents: number }
  status_note: string | null
}

type Readiness = {
  estimate: { id: string; estimate_number: string; status: string } | null
  lines: Array<{
    line_id: string
    name: string
    needed: number
    held: number
    coming: number
    used: number
    short: number
    available: number
    holds: Array<{ id: string; qty: number; source: 'stock' | 'received'; location: string | null }>
  }>
  can_hold?: boolean
  can_release?: boolean
}

/**
 * The parts for an estimate or its job: what is set aside on the shelf,
 * what is on its way, what is short, and the orders for them.
 *
 * Parts are held when the customer approves -- as many as the shelves can
 * cover -- and when they arrive on the estimate's own order. Held parts
 * stop counting as available to anybody else, and stop being held when
 * the job is done or cancelled.
 *
 * On the estimate, "Order from a catalog" opens the catalogues for it:
 * a part picked there goes on the estimate at its sell price and on its
 * order only as far as the shelves cannot cover it.
 */
export function PartsOrders({
  estimate,
  workOrderId,
}: {
  estimate?: { id: string; number: string; title: string | null; status: string }
  workOrderId?: string
}) {
  const qc = useQueryClient()
  const { has, hasAny } = usePermissions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scope = estimate ? `estimate_id=${encodeURIComponent(estimate.id)}` : `work_order_id=${encodeURIComponent(workOrderId ?? '')}`
  const key = estimate?.id ?? workOrderId ?? ''
  const canOrder = !!estimate && ['draft', 'sent', 'approved'].includes(estimate.status)
    && has(PERM.CATALOG_VIEW) && hasAny([PERM.INVENTORY_EDIT, PERM.JOBS_EDIT])

  const orders = useQuery({
    queryKey: ['parts-orders', key],
    queryFn: () => apiRequest<{ data: Po[] }>(`/v1/purchase-orders?${scope}`).then((r) => r.data),
    enabled: has(PERM.INVENTORY_VIEW),
  })
  const readiness = useQuery({
    queryKey: ['parts-readiness', key],
    queryFn: () => apiRequest<Readiness>(`/v1/inventory-holds/readiness?${scope}`),
    enabled: hasAny([PERM.INVENTORY_VIEW, PERM.JOBS_VIEW]),
  })

  const list = orders.data ?? []
  const lines = readiness.data?.lines ?? []
  const status = readiness.data?.estimate?.status ?? estimate?.status
  const approved = status === 'approved'
  if (!canOrder && list.length === 0 && lines.length === 0) return null

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['parts-readiness', key] })
    void qc.invalidateQueries({ queryKey: ['catalog-parts'] })
  }

  const act = async (path: string, body: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest(path, { method: 'POST', body })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const stage = (po: Po): OrderStage => {
    if (po.status !== 'draft' || po.kind !== 'estimate') return po.status as OrderStage
    return approved ? 'ready_to_order' : 'waiting_on_approval'
  }

  const shortWithStock = lines.some((l) => l.short > 0 && l.available > 0)

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-sm font-semibold text-navy-900">Parts</h3>
        <span className="text-xs text-slate-500">
          {approved || !estimate
            ? 'Held for this job: they no longer count as available for anybody else.'
            : 'In-stock parts are held for the job when the customer approves.'}
        </span>
        <span className="grow" />
        {readiness.data?.can_hold && shortWithStock && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('/v1/inventory-holds/hold', estimate ? { estimate_id: estimate.id } : { work_order_id: workOrderId })}
            title="Some parts came into stock since the approval. Set them aside for this job."
            className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            Hold from stock
          </button>
        )}
        {canOrder && (
          <button
            type="button"
            onClick={() => openCatalogs({ estimate: { id: estimate!.id, number: estimate!.number, title: estimate!.title } })}
            title={`Pick parts out of a supplier catalog for this estimate (${CATALOG_SHORTCUT_LABEL} opens catalogs anywhere)`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50"
          >
            <IconBook2 size={16} stroke={1.75} />
            Order from a catalog
          </button>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}

      {lines.length > 0 && (
        <ul className="mt-2 list-none space-y-1.5 p-0 text-sm">
          {lines.map((line) => (
            <li key={line.line_id}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-slate-800">{line.name}</span>
                <span className="text-xs tabular-nums text-slate-500">× {count(line.needed)}</span>
                {approved || !estimate ? (
                  <>
                    {line.held > 0 && <Chip tone="emerald">{count(line.held)} held</Chip>}
                    {line.coming > 0 && <Chip tone="violet">{count(line.coming)} on order</Chip>}
                    {line.used > 0 && <Chip tone="slate">{count(line.used)} used</Chip>}
                    {line.short > 0 && <Chip tone="amber">{count(line.short)} short</Chip>}
                  </>
                ) : (
                  <span className="text-xs text-slate-500">
                    {line.available > 0 ? `${count(line.available)} in stock now` : 'None in stock now'}
                    {line.coming > 0 && ` · ${count(line.coming)} on the estimate's order`}
                  </span>
                )}
              </div>
              {readiness.data?.can_release && line.holds.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-x-3 pl-3 text-xs text-slate-500">
                  {line.holds.map((hold) => (
                    <span key={hold.id}>
                      {count(hold.qty)} {hold.source === 'received' ? 'received for it' : 'from stock'}
                      {hold.location ? ` at ${hold.location}` : ''}
                      {' · '}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Why let these go? They become available for other jobs.', '')
                          if (reason !== null) void act(`/v1/inventory-holds/${hold.id}/release`, { reason })
                        }}
                        className="font-medium text-sky-700 hover:underline disabled:opacity-50"
                      >
                        Let go
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {list.length > 0 && (
        <ul className="mt-2 list-none space-y-1 border-t border-slate-200 p-0 pt-2 text-sm">
          {list.map((po) => (
            <li key={po.id} className="flex flex-wrap items-baseline gap-x-2">
              <Link to={`/purchase-orders/${po.id}`} className="font-medium text-sky-700 hover:underline">{poLabel(po.po_number)}</Link>
              <span className="text-slate-600">{po.vendor?.label ?? po.vendor?.name ?? ''}</span>
              <span className="tabular-nums text-slate-600">{money(po.money.subtotal_cents)}</span>
              <Chip tone="slate">{STAGE_LABEL[stage(po)] ?? po.status}</Chip>
              {po.status_note && <span className="basis-full text-xs text-amber-800">{po.status_note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Chip({ tone, children }: { tone: 'emerald' | 'violet' | 'amber' | 'slate'; children: React.ReactNode }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800',
    violet: 'bg-violet-100 text-violet-800',
    amber: 'bg-amber-100 text-amber-900',
    slate: 'bg-white text-slate-700 ring-1 ring-slate-200',
  }
  return <span className={`rounded-full px-2 py-px text-[11px] font-medium tabular-nums ${tones[tone]}`}>{children}</span>
}
