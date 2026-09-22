import { SafeHtml } from '@/components/SafeHtml'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Invoice } from '@/types/invoice'
import { emailInvoice, getInvoiceDocument } from '@/lib/invoices'
import { ReceivePaymentModal } from '@/components/ReceivePaymentModal'

/**
 * Full-invoice overlay — a presentable invoice document shown over the
 * page, with a toolbar to Print, Email, Text, or Receive payment.
 *
 *   - Balance due  → shows a "Receive payment" button.
 *   - Paid (balance 0) → stamps a diagonal PAID watermark.
 *   - Print → window.print(); a scoped @media print rule hides everything
 *     except the invoice so only the document prints.
 *   - Email / Text → open the device's mail / SMS app prefilled with the
 *     customer's address/number + an invoice summary (works without any
 *     server-side send wired up).
 */

function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function date(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function InvoicePreviewOverlay({
  invoice,
  onClose,
}: {
  invoice: Invoice
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [payOpen, setPayOpen] = useState(false)

  // Branded render via the tenant's custom invoice template (falls back to
  // the generic layout below when there's no template / no source job).
  const docQ = useQuery({
    queryKey: ['invoice-document', invoice.id],
    queryFn: () => getInvoiceDocument(invoice.id),
  })
  const brandedHtml = docQ.data?.has_template ? docQ.data.html : null
  const portalUrl = docQ.data?.portal_url

  const emailMut = useMutation({
    mutationFn: () => emailInvoice(invoice.id),
  })

  const m = invoice.money
  const isPaid = invoice.status === 'paid' || (m.balance_due_cents <= 0 && m.total_cents > 0)
  const isCancelled = invoice.status === 'cancelled'
  const canReceive = !isCancelled && m.balance_due_cents > 0

  const email = invoice.customer?.email ?? ''
  const phone = invoice.customer?.phone ?? ''

  const summary =
    `Invoice ${invoice.display_number}\n` +
    `Total: ${money(m.total_cents)}\n` +
    (m.amount_paid_cents > 0 ? `Paid: ${money(m.amount_paid_cents)}\n` : '') +
    (canReceive ? `Balance due: ${money(m.balance_due_cents)} (due ${date(invoice.due_at)})\n` : 'Paid in full — thank you!\n')

  // Text a portal link the customer logs into to view/pay; fall back to a
  // plain summary if the portal link isn't available yet.
  const smsBody = portalUrl
    ? `Invoice ${invoice.display_number} from us — view & pay online: ${portalUrl}`
    : summary
  const smsHref = `sms:${phone}?body=${encodeURIComponent(smsBody)}`

  // Print via a hidden iframe holding ONLY the invoice + the app's styles.
  // window.print() on the page printed blank/duplicate pages because the
  // document lives inside a position:fixed overlay (fixed elements reprint per
  // page; visibility:hidden siblings still occupy space). The iframe sidesteps
  // all of that — it contains just the document, so it prints as one clean page.
  const printInvoice = () => {
    const node = document.getElementById('invoice-print-area')
    if (!node) {
      window.print()
      return
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('')
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(frame)
    const doc = frame.contentWindow?.document
    if (!doc) {
      frame.remove()
      window.print()
      return
    }
    doc.open()
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8">' +
        `<base href="${window.location.origin}/">` +
        `<title>Invoice ${invoice.display_number}</title>${styles}` +
        '<style>@page{margin:0.5in}html,body{background:#fff;margin:0;padding:0}' +
        '#invoice-print-area{position:relative;max-width:none;margin:0;padding:24px;box-shadow:none;border-radius:0}</style>' +
        `</head><body>${node.outerHTML}</body></html>`,
    )
    doc.close()
    // Give the copied stylesheet + logo image a beat to load, then print.
    window.setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      window.setTimeout(() => frame.remove(), 1000)
    }, 500)
  }

  return (
    <div id="invoice-print-root" className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      {/* Scoped print rule — only #invoice-print-area prints. */}
      <style>{`
        @page { margin: 0.5in; }
        @media print {
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          /* Flatten the fixed overlay chain so the document prints ONCE — a
             position:fixed ancestor otherwise reprints on every page (the
             "two copies" bug). */
          #invoice-print-root, #invoice-print-root > div, #invoice-print-root > div > div {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .invoice-no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <div className="w-full max-w-3xl">
          {/* Toolbar (not printed) */}
          <div className="invoice-no-print flex flex-wrap items-center justify-end gap-2 mb-3">
            {canReceive && (
              <button
                type="button"
                onClick={() => setPayOpen(true)}
                className="text-sm px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Receive payment
              </button>
            )}
            <button
              type="button"
              onClick={printInvoice}
              className="text-sm px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => { if (email) emailMut.mutate() }}
              disabled={!email || emailMut.isPending}
              title={email ? `Email invoice to ${email}` : 'No email on file for this customer'}
              className={`text-sm px-3 py-2 rounded-md border bg-white hover:bg-slate-50 disabled:opacity-50 ${
                emailMut.isSuccess ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-700'
              } ${email ? '' : 'opacity-40 cursor-not-allowed'}`}
            >
              {emailMut.isPending ? 'Sending…' : emailMut.isSuccess ? 'Emailed ✓' : emailMut.isError ? 'Retry email' : 'Email'}
            </button>
            <a
              href={phone ? smsHref : undefined}
              onClick={(e) => { if (!phone) e.preventDefault() }}
              title={phone ? `Text ${phone}` : 'No phone on file for this customer'}
              className={`text-sm px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ${phone ? '' : 'opacity-40 cursor-not-allowed'}`}
            >
              Text
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-3 py-2 rounded-md text-white/90 hover:text-white"
              aria-label="Close"
            >
              ✕ Close
            </button>
          </div>

          {/* The invoice document */}
          <div id="invoice-print-area" className="relative bg-white rounded-xl shadow-2xl p-6 sm:p-10">
            {isPaid && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                <span className="text-7xl font-black uppercase tracking-widest text-emerald-600/20 border-8 border-emerald-600/20 rounded-2xl px-8 py-3 -rotate-[18deg]">
                  Paid
                </span>
              </div>
            )}

            {brandedHtml ? (
              /* Tenant's custom invoice template, rendered with merge tags. */
              <SafeHtml html={brandedHtml} document />
            ) : (
            <>
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">INVOICE</h1>
                <div className="text-sm text-slate-500 font-mono mt-1">{invoice.display_number}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-slate-500">Issued <span className="text-slate-900">{date(invoice.issued_at)}</span></div>
                <div className="text-slate-500">Due <span className="text-slate-900">{date(invoice.due_at)}</span></div>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Bill to</div>
              <div className="text-sm font-medium text-slate-900">{invoice.customer?.display_name ?? '—'}</div>
              {email && <div className="text-sm text-slate-600">{email}</div>}
              {phone && <div className="text-sm text-slate-600">{phone}</div>}
            </div>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Unit</th>
                  <th className="py-2 px-2 text-right">Tax</th>
                  <th className="py-2 pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.line_items ?? []).map((li) => (
                  <tr key={li.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-slate-900">{li.description}</div>
                      {li.notes && <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{li.notes}</div>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{li.quantity} {li.unit_label}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{money(li.customer_cost_cents)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-slate-600">{li.is_taxable ? money(li.tax_amount_cents) : '—'}</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-semibold">{money(li.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <Row label="Subtotal" value={money(m.subtotal_cents)} />
              <Row label="Tax" value={money(m.tax_cents)} />
              {(m.tax_exempt_adjustment_cents ?? 0) > 0 && (
                <Row label="Tax exempt" value={`-${money(m.tax_exempt_adjustment_cents)}`} />
              )}
              <Row label="Total" value={<strong>{money(m.total_cents)}</strong>} divider />
              {m.amount_paid_cents > 0 && <Row label="Paid" value={money(m.amount_paid_cents)} />}
              {!isPaid && !isCancelled && (
                <Row label="Balance due" value={<strong>{money(m.balance_due_cents)}</strong>} />
              )}
            </div>

            {(invoice.customer_notes || invoice.terms) && (
              <div className="mt-8 pt-6 border-t border-slate-200 space-y-3 text-sm">
                {invoice.customer_notes && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Notes</div>
                    <p className="whitespace-pre-wrap text-slate-700">{invoice.customer_notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Terms</div>
                    <p className="whitespace-pre-wrap text-slate-700">{invoice.terms}</p>
                  </div>
                )}
              </div>
            )}
            </>
            )}
          </div>
        </div>
      </div>

      {payOpen && invoice.customer && (
        <ReceivePaymentModal
          customerId={invoice.customer.id}
          customerName={invoice.customer.display_name}
          preSelectInvoiceId={invoice.id}
          onClose={() => setPayOpen(false)}
          onCreated={() => {
            setPayOpen(false)
            qc.invalidateQueries({ queryKey: ['invoice', invoice.id] })
          }}
        />
      )}
    </div>
  )
}

function Row({
  label,
  value,
  divider,
}: {
  label: React.ReactNode
  value: React.ReactNode
  divider?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${divider ? 'border-t border-slate-200 pt-2 mt-1' : ''}`}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  )
}
