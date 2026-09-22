import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * The filing, invoice by invoice.
 *
 * The summary answers "what do I owe"; this answers "where did that come
 * from". It's the view you want open when a number on the return looks wrong,
 * or when someone asks why a job was taxed — so it lists the job, who it was
 * for, the invoice, what it was billed at and the tax on it, and nothing else.
 *
 * The exports live here rather than in the page header. Downloading is
 * something you do after looking at a specific period, not a thing that should
 * sit at the top of the screen competing with the filing itself.
 */

export interface SalesTaxInvoiceRow {
  invoice_id: string
  invoice_number: string | null
  work_order_number: string | null
  customer_name: string | null
  issued_at: string | null
  total_cents: number
  tax_cents: number
  is_tax_exempt: boolean
}

interface Props {
  from: string
  to: string
  rows: SalesTaxInvoiceRow[]
  taxTotalCents: number
  onClose: () => void
  onDownload: (format: 'pdf' | 'csv') => void
}

function dollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function SalesTaxDetailOverlay({
  from,
  to,
  rows,
  taxTotalCents,
  onClose,
  onDownload,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prior
    }
  }, [onClose])

  const billed = rows.reduce((n, r) => n + (r.total_cents || 0), 0)

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sales tax detail"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="h-fit w-full max-w-[1080px] rounded-[16px] bg-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-[22px] font-bold text-[#0A1220]">Sales tax detail</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              <span className="tabular-nums">{from}</span> to{' '}
              <span className="tabular-nums">{to}</span> &middot;{' '}
              {rows.length.toLocaleString('en-US')} invoice{rows.length === 1 ? '' : 's'} &middot;{' '}
              <span className="font-mono tabular-nums">${dollars(taxTotalCents)}</span> tax
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload('pdf')}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => onDownload('csv')}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Spreadsheet
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-500 hover:bg-slate-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-6 py-2.5 font-semibold">Job #</th>
                <th className="px-6 py-2.5 font-semibold">Customer</th>
                <th className="px-6 py-2.5 font-semibold">Inv #</th>
                <th className="px-6 py-2.5 text-right font-semibold">Total job cost</th>
                <th className="px-6 py-2.5 text-right font-semibold">Sales tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.invoice_id}>
                  <td className="px-6 py-2.5 font-mono text-[12.5px] text-slate-600">
                    {r.work_order_number ?? <span className="text-slate-300">&mdash;</span>}
                  </td>
                  <td className="px-6 py-2.5 font-semibold text-[#0A1220]">
                    {r.customer_name ?? <span className="font-normal text-slate-400">Unnamed</span>}
                    {/* Exempt invoices still carry a tax line on the invoice
                        itself, so without this the zero looks like a mistake. */}
                    {r.is_tax_exempt && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                        Exempt
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-2.5 font-mono text-[12.5px] text-slate-600">
                    {r.invoice_number ?? <span className="text-slate-300">&mdash;</span>}
                  </td>
                  <td className="px-6 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    ${dollars(r.total_cents)}
                  </td>
                  <td className="px-6 py-2.5 text-right font-mono tabular-nums text-slate-900">
                    ${dollars(r.tax_cents)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-slate-500">
                    No invoices were issued in this period.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td colSpan={3} className="px-6 py-3 text-right text-slate-900">
                    Totals
                  </td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums text-slate-900">
                    ${dollars(billed)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums text-slate-900">
                    ${dollars(taxTotalCents)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>,
    document.body,
  )
}
