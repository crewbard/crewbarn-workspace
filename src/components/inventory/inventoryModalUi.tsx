import { useEffect, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { ReturnFormModal } from "@/components/ReturnFormModal"
import type { InventoryStockLevel } from "@/types/inventoryStockLevel"

/**
 * The Inventory page's modal pieces (shell, footer, field, error banner, the
 * Return and Print QR sections). Moved out of
 * pages/InventoryPage.tsx so the Stock tab's own files use the same ones.
 */
export function ModalShell({
  title,
  children,
  onClose,
  tour,
  wide = false,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  /** data-tour id for guided tours */
  tour?: string
  wide?: boolean
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 26, 46, 0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div data-tour={tour} className={`bg-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

export function Footer({ children, tour }: { children: React.ReactNode; tour?: string }) {
  return (
    <div data-tour={tour} className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
      {children}
    </div>
  )
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

export function ErrorBanner({ message, onRetry, busy = false }: { message: string; onRetry?: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="p-3 bg-red-50 border border-red-100 rounded">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} disabled={busy} className="mt-2 text-sm text-red-700 underline disabled:opacity-50">Try again</button>}
    </div>
  )
}

/**
 * "Return / RMA" trigger inside the Edit Stock modal. Opens the
 * ReturnFormModal stacked on top, which writes the return record + a
 * TYPE_WRITE_OFF movement and redirects to the 4×6 supplier-label print
 * page on success.
 */
export function ReturnSection({
  stockLevel,
  onClose,
}: {
  stockLevel: InventoryStockLevel
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)
  if (!stockLevel.catalog_item_id) return null

  return (
    <>
      <div data-tour="inv-stock-form-return" className="border-t border-slate-100 pt-4 mt-2">
        <div className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
          Return to vendor
        </div>
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-600">
            Damage, defective, recall, or RMA? Create a return — stock decrements and the supplier label is printable at 4×6.
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium whitespace-nowrap"
          >
            Return
          </button>
        </div>
      </div>
      {open && (
        <ReturnFormModal
          stockLevel={stockLevel}
          onClose={() => setOpen(false)}
          onSavedRedirectTo={(returnId) => {
            setOpen(false)
            onClose()
            window.open(`/inventory-returns/${returnId}/labels`, '_blank')
          }}
        />
      )}
    </>
  )
}

/**
 * QR-code preview + Print button shown inside the Edit Stock modal.
 * The QR encodes the deep-link to the catalog item; clicking Print opens
 * the configurable label page in a new tab pre-populated with the bin
 * label + on-hand qty (long-form layout).
 */
export function PrintQrSection({ stockLevel }: { stockLevel: InventoryStockLevel }) {
  const itemId = stockLevel.catalog_item_id
  if (!itemId) return null

  // Keep this exact shape: lib/scanResolve decodes /catalog/products/<id>
  // and labels already printed carry it. A phone camera opening it needs
  // the router to send /catalog/products/:id to /catalog/products?item=:id.
  const qrUrl = `${window.location.origin}/catalog/products/${itemId}`
  const binLabel = stockLevel.bin?.path_label || stockLevel.bin?.name || ''
  const qty = stockLevel.quantities.qty_on_hand ?? ''
  // One label per physical unit, not N copies of one code. Four on hand is
  // four items, each carrying its own fingerprint — identical labels would
  // give a tech no way to scan the one in their hand.
  const printHref =
    `/catalog-items/${itemId}/labels` +
    `?detail=long` +
    `&per_unit=1` +
    `&location_id=${stockLevel.location_id ?? ''}` +
    `&bin_id=${stockLevel.bin_id ?? ''}` +
    `&bin_label=${encodeURIComponent(binLabel)}` +
    `&qty=${qty}`

  return (
    <div data-tour="inv-stock-form-qr" className="border-t border-slate-100 pt-4 mt-2">
      <div className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
        Print QR code
      </div>
      <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded p-3">
        <div className="flex-shrink-0 bg-white p-2 rounded border border-slate-200">
          <QRCodeCanvas value={qrUrl} size={96} level="H" includeMargin />
        </div>
        <div className="flex-1 min-w-0 text-xs text-slate-600 space-y-0.5">
          <div>One QR per unit on hand — each scans as that exact item.</div>
          {binLabel && <div>📍 {binLabel}</div>}
          {qty != null && <div>On hand: {String(qty)}</div>}
        </div>
        <a
          href={printHref}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium whitespace-nowrap"
        >
          Print QR
        </a>
      </div>
    </div>
  )
}
