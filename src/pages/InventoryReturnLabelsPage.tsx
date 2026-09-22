import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getReturn } from '@/lib/inventoryReturns'

/**
 * 4×6 print page for the supplier return label attached to an
 * inventory_return. Renders the uploaded label (PDF or image) inside a
 * 4″×6″ frame so it prints at the right size on a thermal shipping
 * printer (Dymo / Brother / Rollo) or on full-sheet sticker paper.
 *
 * URL: /inventory-returns/:id/labels
 */
export function InventoryReturnLabelsPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-returns', id],
    queryFn: () => getReturn(id as string),
    enabled: !!id,
    staleTime: 0,
  })

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500">Loading return…</div>
  }
  if (!data) {
    return <div className="p-12 text-center text-slate-500">Return not found.</div>
  }

  const ret = data.data
  const isPdf = ret.return_label_mime === 'application/pdf'

  return (
    <div className="bg-white min-h-screen">
      <style>{`
        @media print {
          @page { size: 4in 6in; margin: 0; }
          html, body, #root { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .label-card {
            width: 4in !important;
            height: 6in !important;
            page-break-after: always;
            border: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium text-slate-800">
            Return label — {ret.vendor?.name ?? '—'}
          </div>
          <div className="text-xs text-slate-500">
            {ret.rma_number ? `RMA ${ret.rma_number} · ` : ''}
            {ret.items?.length ?? 0} item{(ret.items?.length ?? 0) === 1 ? '' : 's'} · status: {ret.status}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ret.return_label_url && (
            <a
              href={ret.return_label_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-700 hover:underline"
            >
              View original
            </a>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!ret.return_label_url}
            className="text-sm px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium"
          >
            Print 4×6
          </button>
        </div>
      </div>

      {!ret.return_label_url && (
        <div className="p-12 text-center text-sm text-slate-500">
          No supplier label was uploaded for this return. Edit the return and add one to print.
        </div>
      )}

      {ret.return_label_url && (
        <div className="p-8 flex justify-center">
          <div
            className="label-card bg-white border border-slate-300 overflow-hidden flex items-center justify-center"
            style={{ width: '4in', height: '6in' }}
          >
            {isPdf ? (
              <iframe
                src={ret.return_label_url}
                className="w-full h-full border-none"
                title="Supplier return label"
              />
            ) : (
              <img
                src={ret.return_label_url}
                alt="Supplier return label"
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      )}

      <div className="no-print max-w-2xl mx-auto px-6 pb-12 text-xs text-slate-500 space-y-1">
        <p>
          The uploaded label is scaled to fit the 4″×6″ frame so it prints at thermal-shipping-printer size.
          If the source label was a different aspect ratio, it's letterboxed inside the frame — the printed
          area still aligns with a standard 4×6 sticker.
        </p>
        <p>
          Original file: <span className="font-mono">{ret.return_label_original_filename ?? '—'}</span>
          {ret.return_label_size_bytes ? ` (${Math.round(ret.return_label_size_bytes / 1024)} KB)` : ''}
        </p>
      </div>
    </div>
  )
}
