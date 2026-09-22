import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'

/**
 * The invoice, on top of the job — not a page away. Everything the invoice
 * page can do works here (send, mark paid, terminal charge, print); "Open
 * full page" is there for anyone who wants the URL.
 *
 * No backdrop-blur on purpose: a filter on this layer would trap the
 * fixed-position modals the detail opens (record payment, print preview).
 */
export function InvoiceOverlay({
  invoiceId,
  onClose,
  onChanged,
}: {
  invoiceId: string
  onClose: () => void
  onChanged?: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invoice"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 p-0 sm:p-4 lg:p-8"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="text-sm font-bold text-slate-900">Invoice</div>
          <div className="flex items-center gap-2">
            <Link
              to={`/invoices/${invoiceId}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open full page
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <InvoiceDetail invoiceId={invoiceId} embedded onDeleted={onClose} onChanged={onChanged} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
