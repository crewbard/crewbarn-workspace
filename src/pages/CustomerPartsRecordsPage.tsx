import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { getInvoice } from '@/lib/invoices'
import { listInstalledParts } from '@/lib/poParts'
import { poLineFor, toRecords, type PartRecord } from '@/lib/partsRecords'
import { getPurchaseOrder } from '@/lib/purchaseOrders'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import type { Asset } from '@/types/asset'

/**
 * A customer's parts records: for each part fitted, what it is, when, where,
 * on which asset, which vendor it came from and (with revenue.view) what it
 * cost. The invoice's records QR lands here (?invoice=), signed in only:
 * the route sits behind customers.view like the rest of the customer.
 *
 * Built from existing reads only: the customer's assets, each asset's
 * installed parts, and the purchase order each part came off.
 */
const money = (c: number) => `$${(c / 100).toFixed(2)}`
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—')

export function CustomerPartsRecordsPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const invoiceId = params.get('invoice')
  const perms = usePermissions()
  const canCost = perms.has(PERM.REVENUE_VIEW)
  const canOrders = perms.has(PERM.INVENTORY_VIEW)

  const invoice = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => getInvoice(invoiceId as string), enabled: !!invoiceId })
  const records = useQuery({
    queryKey: ['customers', id, 'parts-records'],
    queryFn: async () => {
      const assets = (await apiRequest<{ data: Asset[] }>(`/v1/assets?customer_id=${encodeURIComponent(id)}&per_page=200`)).data
      const lists = await Promise.all(assets.map(async (a) => toRecords(a, await listInstalledParts(a.id).catch(() => []))))
      return lists.flat().sort((a, b) => (b.installedAt ?? '').localeCompare(a.installedAt ?? ''))
    },
  })
  const poIds = [...new Set((records.data ?? []).map((r) => r.po?.id).filter((x): x is string => !!x))]
  const orders = useQuery({
    queryKey: ['parts-records-orders', poIds],
    queryFn: async () => Object.fromEntries(await Promise.all(poIds.map(async (p) => [p, await getPurchaseOrder(p).catch(() => undefined)] as const))),
    enabled: canOrders && poIds.length > 0,
  })

  const jobId = invoice.data?.work_order_id ?? null
  const all = records.data ?? []
  const onInvoice = jobId ? all.filter((r) => r.job?.id === jobId) : []
  const rest = jobId ? all.filter((r) => r.job?.id !== jobId) : all

  const table = (rows: PartRecord[]) => (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border,#e2e8f0)]">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-[var(--color-muted-foreground,#64748b)]">
          <tr>
            <th className="px-3 py-2">Part</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Where</th>
            <th className="px-3 py-2">Asset</th><th className="px-3 py-2">Vendor</th>{canCost && <th className="px-3 py-2 text-right">Price paid</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const po = r.po ? orders.data?.[r.po.id] : undefined
            const line = poLineFor(po, r)
            return (
              <tr key={r.id} data-testid="part-record" className={`border-t border-[var(--color-border,#e2e8f0)] ${r.removed ? 'opacity-60' : ''}`}>
                <td className="px-3 py-2"><div className="font-medium">{r.part}{r.qty !== 1 ? ` ×${r.qty}` : ''}</div>
                  <div className="text-xs text-[var(--color-muted-foreground,#64748b)]">{[r.partNumber, r.serial && `SN ${r.serial}`, r.removed && 'Taken off'].filter(Boolean).join(' · ')}</div></td>
                <td className="px-3 py-2">{day(r.installedAt)}</td>
                <td className="px-3 py-2">{r.job ? <Link className="underline" to={`/jobs/${r.job.id}`}>Job #{r.job.number}</Link> : '—'}<div className="text-xs text-[var(--color-muted-foreground,#64748b)]">{r.where}</div></td>
                <td className="px-3 py-2"><Link className="underline" to={`/assets?id=${encodeURIComponent(r.asset.id)}`}>{r.asset.name}</Link></td>
                <td className="px-3 py-2">{po?.vendor?.label ?? (r.po ? (canOrders ? '…' : '—') : 'Added by hand')}{r.po && canOrders && <div className="text-xs"><Link className="underline" to={`/purchase-orders/${r.po.id}`}>{r.po.po_number}</Link></div>}</td>
                {canCost && <td className="px-3 py-2 text-right">{line ? money(line.unit_cost_cents) : '—'}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4" data-tour="customer-parts-records">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Parts records</h1>
        <Link to={`/customers/${id}`} className="text-sm underline">Back to the customer</Link>
      </div>
      {records.isLoading && <p className="text-sm">Loading records…</p>}
      {records.isError && <p className="text-sm text-[var(--color-destructive,#b91c1c)]">Couldn't load the records.</p>}
      {jobId && (
        <section className="space-y-2">
          <h2 className="font-semibold">On invoice {invoice.data?.invoice_number ?? ''}</h2>
          {onInvoice.length ? table(onInvoice) : <p className="text-sm">No parts were fitted to an asset on this invoice's job.</p>}
        </section>
      )}
      {records.data && (
        <section className="space-y-2">
          {jobId && <h2 className="font-semibold">Everything else for this customer</h2>}
          {rest.length ? table(rest) : <p className="text-sm">No parts recorded yet.</p>}
        </section>
      )}
      {!canCost && <p className="text-xs text-[var(--color-muted-foreground,#64748b)]">Prices paid are shown to people who can see revenue.</p>}
    </div>
  )
}