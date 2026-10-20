import { Link, useParams } from 'react-router-dom'
import '@/components/inventory/bins/bins.css'
import { useSupplierCopy } from '@/hooks/usePurchaseOrders'
import { formatDateValue } from '@/hooks/useTenantTime'
import { count, money, poLabel } from '@/lib/catalogOrders'

/**
 * The purchase order for the supplier: print it, or Save as PDF from the
 * print window, and send it. Their part numbers, descriptions, quantities,
 * costs and totals, with both companies on top. Where the shop keeps things,
 * its own SKUs and its notes are never on it (the server leaves them out).
 * A line with no supplier part number shows its description only; the PO
 * page flags those before this goes out.
 */
export function PurchaseOrderSupplierCopyPage() {
  const { id } = useParams<{ id: string }>()
  const copy = useSupplierCopy(id)
  const d = copy.data
  const day = (v: string | null) => (v ? formatDateValue(v, { month: 'short', day: 'numeric', year: 'numeric' }, 'en-US') : null)

  return (
    <div data-bins-ui className="min-h-screen bg-[var(--bins-soft)] print:bg-[var(--bins-surface)]">
      <div data-tour="po-supplier-toolbar" className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[var(--bins-border)] bg-[var(--bins-surface)] px-6 py-3 print:hidden">
        <Link to={`/purchase-orders/${id}`} className="text-sm text-[var(--bins-accent-ink)] hover:underline">← Back to the order</Link>
        <span className="text-sm text-[var(--bins-text-2)]">Supplier copy: no bins, no internal SKUs, no notes.</span>
        <button type="button" onClick={() => window.print()} disabled={!d}
          className="ml-auto rounded-md bg-[var(--bins-accent)] px-4 py-2 text-sm font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:opacity-50">
          Print or save as PDF
        </button>
      </div>

      {copy.isLoading && <p className="p-10 text-center text-sm text-[var(--bins-text-2)]">Loading…</p>}
      {copy.isError && (
        <p role="alert" className="p-10 text-center text-sm text-[var(--color-danger)]">
          Couldn't load this order. <button type="button" className="underline" onClick={() => void copy.refetch()}>Try again</button>
        </p>
      )}

      {d && (
        <article data-tour="po-supplier-sheet" className="mx-auto my-6 max-w-[8.5in] bg-[var(--bins-surface)] p-10 text-[var(--bins-text)] shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
          {d.missing_part_numbers > 0 && (
            <p data-tour="po-supplier-missing" className="mb-6 rounded-md border border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--bins-surface))] px-3 py-2 text-sm text-[var(--bins-text)] print:hidden">
              {d.missing_part_numbers === 1 ? '1 line has' : `${d.missing_part_numbers} lines have`} no supplier part number, so the supplier only sees the description. Add the supplier's number on the order or under Who sells this.
            </p>
          )}
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--bins-border)] pb-6">
            <div className="flex items-start gap-4">
              {d.shop.logo_url && <img src={d.shop.logo_url} alt="" className="h-14 w-auto max-w-[160px] object-contain" />}
              <div className="text-sm leading-relaxed">
                <div className="text-lg font-bold">{d.shop.name}</div>
                {d.shop.address && <div className="whitespace-pre-line text-[var(--bins-text-2)]">{d.shop.address}</div>}
                {d.shop.phone && <div className="text-[var(--bins-text-2)]">{d.shop.phone}</div>}
                {d.shop.email && <div className="text-[var(--bins-text-2)]">{d.shop.email}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight">Purchase order</div>
              <div className="mt-1 font-mono text-lg">{poLabel(d.po_number)}</div>
              <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-3 text-sm text-[var(--bins-text-2)]">
                {day(d.order_date) && <><dt>Date</dt><dd className="font-medium text-[var(--bins-text)]">{day(d.order_date)}</dd></>}
                {day(d.expected_delivery) && <><dt>Needed by</dt><dd className="font-medium text-[var(--bins-text)]">{day(d.expected_delivery)}</dd></>}
                {d.vendor_order_number && <><dt>Your order #</dt><dd className="font-mono text-[var(--bins-text)]">{d.vendor_order_number}</dd></>}
              </dl>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-6 border-b border-[var(--bins-border)] py-6 text-sm leading-relaxed">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--bins-muted)]">Supplier</div>
              {d.supplier ? (
                <>
                  <div className="mt-1 font-semibold">{d.supplier.name}</div>
                  {d.supplier.address.map((l) => <div key={l} className="text-[var(--bins-text-2)]">{l}</div>)}
                  {d.supplier.phone && <div className="text-[var(--bins-text-2)]">{d.supplier.phone}</div>}
                  {d.supplier.email && <div className="text-[var(--bins-text-2)]">{d.supplier.email}</div>}
                </>
              ) : <div className="mt-1 italic text-[var(--bins-muted)]">No supplier chosen yet</div>}
            </div>
            <div>
              {d.supplier?.account_number && (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--bins-muted)]">Our account number</div>
                  <div className="mt-1 font-mono">{d.supplier.account_number}</div>
                </>
              )}
              {d.supplier?.payment_terms && (
                <>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--bins-muted)]">Terms</div>
                  <div className="mt-1">{d.supplier.payment_terms}</div>
                </>
              )}
            </div>
          </section>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--bins-text)] text-left text-xs uppercase tracking-wide text-[var(--bins-text-2)]">
                <th className="py-2 pr-3 font-semibold">Your part #</th>
                <th className="py-2 pr-3 font-semibold">Description</th>
                <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                <th className="py-2 pr-3 text-right font-semibold">Unit cost</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l) => (
                <tr key={l.id} data-supplier-line data-missing={l.missing_part_number ? 'yes' : 'no'} className="border-b border-[var(--bins-border)] align-top">
                  <td className="py-2 pr-3 font-mono">{l.supplier_part_number ?? ''}</td>
                  <td className="py-2 pr-3">{l.description}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{count(l.qty)}{l.unit_label && l.unit_label !== 'each' ? ` ${l.unit_label}` : ''}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(l.unit_cost_cents)}</td>
                  <td className="py-2 text-right tabular-nums">{money(l.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="ml-auto mt-4 grid w-64 grid-cols-2 gap-y-1 text-sm">
            <dt className="text-[var(--bins-text-2)]">Subtotal</dt><dd className="text-right tabular-nums">{money(d.money.subtotal_cents)}</dd>
            {d.money.tax_cents != null && <><dt className="text-[var(--bins-text-2)]">Tax</dt><dd className="text-right tabular-nums">{money(d.money.tax_cents)}</dd></>}
            {d.money.shipping_cents != null && <><dt className="text-[var(--bins-text-2)]">Shipping</dt><dd className="text-right tabular-nums">{money(d.money.shipping_cents)}</dd></>}
            <dt className="border-t border-[var(--bins-text)] pt-1 font-bold">Total</dt><dd className="border-t border-[var(--bins-text)] pt-1 text-right font-bold tabular-nums">{money(d.money.total_cents)}</dd>
          </dl>

          <p className="mt-10 text-xs text-[var(--bins-muted)]">Please quote {poLabel(d.po_number)} on your invoice and packing slip.</p>
        </article>
      )}
    </div>
  )
}
